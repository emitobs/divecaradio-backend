/* eslint-disable import/no-commonjs */
/* eslint-env node, commonjs */

// Detectar si estamos bajo Passenger
let isPassenger = false;
if (typeof(PhusionPassenger) !== 'undefined') {
  isPassenger = true;
}

// Diveca Radio: Aplicación profesional con sistema de roles y permisos
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Servicios y configuración
const config = require('./src/config/app');
const authApp = require('./src/server/auth-server');
const blockingService = require('./src/services/blocking');
const logger = require('./src/utils/logger');

// Middleware
const { requireAuth, requirePermission, canModerate } = require('./src/middleware/auth');

console.log('🚀 Iniciando Diveca Radio (Versión Profesional)');

// Crear aplicación Express
const app = express();

// Configuración de archivos estáticos
const publicDir = path.join(__dirname, 'src/public');
app.use(express.static(publicDir));

// Ruta raíz: servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Montar rutas de autenticación
app.use(authApp);

// Crear servidor HTTP
const server = http.createServer(app);

// ================== WEBSOCKET SERVER ==================

const wss = new WebSocket.Server({
  server,
  path: '/ws'
});

// Almacenamiento de clientes conectados
const clients = new Map(); // clientId -> { ws, userId, username }
const blockedClientIds = new Set();

// Tipos de mensajes WebSocket
const MESSAGE_TYPES = {
  REGISTER: 'register',
  CHAT: 'chat',
  BLOCK: 'block',
  UNBLOCK: 'unblock',
  SYSTEM: 'system',
  LISTENER_COUNT: 'listenerCount'
};

// Función para broadcast de mensajes
function broadcastToAll(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

function broadcastSystemMessage(message) {
  broadcastToAll({
    type: MESSAGE_TYPES.SYSTEM,
    message: message,
    timestamp: new Date().toISOString()
  });
}

function updateListenerCount() {
  const count = clients.size;
  broadcastToAll({
    type: MESSAGE_TYPES.LISTENER_COUNT,
    count: count
  });
  logger.info(`📊 Oyentes conectados: ${count}`);
}

// Cargar clientes bloqueados desde la base de datos al iniciar
async function loadBlockedClients() {
  try {
    const blocked = await blockingService.getBlockedClients();
    blocked.forEach(client => blockedClientIds.add(client.client_id));
    console.log(`🚫 ${blockedClientIds.size} clientes bloqueados cargados`);
  } catch (error) {
    console.error('❌ Error cargando clientes bloqueados:', error);
  }
}

// Verificar si un usuario puede moderar
async function canUserModerate(userId) {
  try {
    const authService = require('./src/services/auth');
    const user = await authService.getUserById(userId);
    return user && authService.hasPermission(user.permissions, config.permissions.CHAT_MODERATE);
  } catch (error) {
    console.error('❌ Error verificando permisos de moderación:', error);
    return false;
  }
}

// Configuración del WebSocket Server
wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  logger.info('🔌 Nueva conexión WebSocket', { ip: clientIP });

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      logger.error('❌ Mensaje WebSocket inválido:', error);
      return;
    }

    switch (data.type) {
      case MESSAGE_TYPES.REGISTER:
        await handleRegister(ws, data);
        break;

      case MESSAGE_TYPES.CHAT:
        await handleChatMessage(ws, data);
        break;

      case MESSAGE_TYPES.BLOCK:
      case MESSAGE_TYPES.UNBLOCK:
        await handleModerationAction(ws, data);
        break;

      default:
        logger.warn('❓ Tipo de mensaje WebSocket desconocido:', data.type);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    logger.error('❌ Error en WebSocket:', error);
    handleDisconnect(ws);
  });
});

async function handleRegister(ws, data) {
  const { clientId, username } = data;

  if (!clientId || !username) {
    logger.warn('❌ Registro WebSocket inválido: falta clientId o username');
    return;
  }

  // Verificar si el cliente está bloqueado
  if (blockedClientIds.has(clientId)) {
    logger.warn(`🚫 Cliente bloqueado intentó conectarse: ${clientId}`);
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.SYSTEM,
      message: 'Tu dispositivo está bloqueado. Contacta al administrador.'
    }));
    ws.close();
    return;
  }

  // Registrar cliente
  clients.set(clientId, { ws, username, clientId });
  logger.info(`✅ Cliente registrado: ${username} (${clientId})`);

  updateListenerCount();

  // Enviar mensaje de bienvenida
  broadcastSystemMessage(`${username} se unió al chat`);
}

async function handleChatMessage(ws, data) {
  const { clientId, username, message } = data;

  if (!clientId || !username || !message) {
    logger.warn('❌ Mensaje de chat inválido');
    return;
  }

  // Verificar si el cliente está bloqueado
  if (blockedClientIds.has(clientId)) {
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.SYSTEM,
      message: 'No puedes enviar mensajes. Tu dispositivo está bloqueado.'
    }));
    return;
  }

  // Broadcast del mensaje
  const chatMessage = {
    type: MESSAGE_TYPES.CHAT,
    username,
    message,
    clientId,
    timestamp: new Date().toISOString()
  };

  broadcastToAll(chatMessage);
  logger.info(`💬 ${username}: ${message}`);
}

async function handleModerationAction(ws, data) {
  const { type, clientId: targetClientId, username } = data;

  // Obtener información del cliente que realiza la acción
  const moderatorClient = Array.from(clients.values()).find(client =>
    client.ws === ws && client.username === username
  );

  if (!moderatorClient) {
    logger.warn('❌ Acción de moderación por cliente no registrado');
    return;
  }

  // Verificar permisos de moderación (esto debería mejorar con userId real)
  // Por ahora, verificamos si el username tiene permisos de moderación
  const authService = require('./src/services/auth');
  try {
    // Buscar usuario por username para obtener permisos
    const db = require('./src/services/database');
    const users = await db.query(
      `SELECT u.id, u.username, r.name as role_name,
              GROUP_CONCAT(p.name) as permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.username = ?
       GROUP BY u.id`,
      [username]
    );

    if (users.length === 0) {
      logger.warn(`❌ Usuario ${username} no encontrado para moderación`);
      return;
    }

    const user = users[0];
    const permissions = user.permissions ? user.permissions.split(',') : [];

    if (!authService.hasPermission(permissions, config.permissions.CHAT_MODERATE)) {
      logger.warn(`❌ Usuario ${username} sin permisos de moderación`);
      ws.send(JSON.stringify({
        type: MESSAGE_TYPES.SYSTEM,
        message: 'No tienes permisos para realizar esta acción.'
      }));
      return;
    }

    // Realizar acción de moderación
    if (type === MESSAGE_TYPES.BLOCK) {
      await blockingService.blockClient(targetClientId, user.id, user.id, 'Bloqueado por moderador');
      blockedClientIds.add(targetClientId);

      // Desconectar cliente bloqueado si está conectado
      const targetClient = clients.get(targetClientId);
      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: MESSAGE_TYPES.SYSTEM,
          message: 'Has sido bloqueado por un moderador.'
        }));
        targetClient.ws.close();
        clients.delete(targetClientId);
      }

      logger.info(`🚫 Cliente ${targetClientId} bloqueado por ${username}`);
      broadcastSystemMessage(`Usuario bloqueado por moderador`);

    } else if (type === MESSAGE_TYPES.UNBLOCK) {
      const success = await blockingService.unblockClient(targetClientId, user.id);
      if (success) {
        blockedClientIds.delete(targetClientId);
        logger.info(`✅ Cliente ${targetClientId} desbloqueado por ${username}`);
        broadcastSystemMessage(`Usuario desbloqueado por moderador`);
      }
    }

  } catch (error) {
    logger.error('❌ Error en acción de moderación:', error);
    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.SYSTEM,
      message: 'Error al procesar la acción de moderación.'
    }));
  }
}

function handleDisconnect(ws) {
  // Encontrar y remover cliente
  for (const [clientId, client] of clients.entries()) {
    if (client.ws === ws) {
      const username = client.username;
      clients.delete(clientId);
      logger.info(`❌ Cliente desconectado: ${username} (${clientId})`);

      updateListenerCount();
      broadcastSystemMessage(`${username} salió del chat`);
      break;
    }
  }
}

// ================== ENDPOINTS ADICIONALES ==================

// Endpoint para obtener estadísticas (solo para moderadores/admins)
app.get('/api/stats',
  requireAuth,
  requirePermission(config.permissions.ADMIN_PANEL),
  (req, res) => {
    res.json({
      connectedClients: clients.size,
      blockedClients: blockedClientIds.size,
      totalClients: clients.size + blockedClientIds.size
    });
  }
);

// ================== INICIALIZACIÓN ==================

// Inicializar servicios
async function initializeApp() {
  try {
    // Cargar clientes bloqueados
    await loadBlockedClients();

    // Ejecutar migración de base de datos en desarrollo
    if (config.isDevelopment) {
      try {
        const { runMigration } = require('./scripts/migrate-database');
        await runMigration();
        console.log('✅ Migración de base de datos completada');
      } catch (migrationError) {
        console.warn('⚠️ Error en migración (puede ser normal):', migrationError.message);
      }
    }

    console.log('✅ Aplicación inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error);
    process.exit(1);
  }
}

// Inicializar y arrancar servidor
initializeApp().then(() => {
  // Passenger maneja el puerto automáticamente
  if (isPassenger) {
    server.listen('passenger', () => {
      console.log('🎵 Diveca Radio ejecutándose bajo Passenger');
      console.log('🌍 Modo: Producción (Passenger)');
      console.log('🔗 WebSocket: wss://[domain]/ws');
    });
  } else {
    // Desarrollo local - usar puerto configurado
    const PORT = process.env.PORT || config.server.port;
    server.listen(PORT, () => {
      console.log(`🎵 Diveca Radio ejecutándose en puerto ${PORT}`);
      console.log(`🌍 Modo: ${config.isProduction ? 'Producción' : 'Desarrollo'}`);
      console.log(`🔗 WebSocket: ws://localhost:${PORT}/ws`);
    });
  }
});

// Manejo de señales para cierre limpio
process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = server;

