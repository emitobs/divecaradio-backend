/* eslint-disable import/no-commonjs */
/* eslint-env node, commonjs */

// Detectar si estamos bajo Passenger
let isPassenger = false;
if (typeof(PhusionPassenger) !== 'undefined') {
  isPassenger = true;
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Servicios y configuracion
const config = require('./src/config/app');
const authApp = require('./src/server/auth-server');
const blockingService = require('./src/services/blocking');
const logger = require('./src/utils/logger');

// Middleware
const { requireAuth, requirePermission, canModerate } = require('./src/middleware/auth');

console.log('Iniciando Diveca Radio Backend...');

// Crear aplicacion Express
const app = express();

// ================== HEALTH CHECK ==================
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Diveca Radio API',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    // Verificar conexion a base de datos
    const db = require('./src/services/database');
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Montar rutas de autenticacion
app.use(authApp);

// Crear servidor HTTP
const server = http.createServer(app);

// ================== WEBSOCKET SERVER ==================

const wss = new WebSocket.Server({
  server,
  path: '/ws'
});

// Almacenamiento de clientes conectados
const clients = new Map();
const blockedClientIds = new Set();

const MESSAGE_TYPES = {
  REGISTER: 'register',
  CHAT: 'chat',
  BLOCK: 'block',
  UNBLOCK: 'unblock',
  SYSTEM: 'system',
  LISTENER_COUNT: 'listenerCount'
};

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
    timestamp: Date.now()
  });
}

function broadcastListenerCount() {
  broadcastToAll({
    type: MESSAGE_TYPES.LISTENER_COUNT,
    count: clients.size
  });
}

// Cargar bloqueos al iniciar
async function loadBlockedClients() {
  try {
    const blockedSessions = await blockingService.getActiveBlocks();
    blockedSessions.forEach(session => {
      blockedClientIds.add(session.client_id);
    });
    console.log('Bloqueos cargados:', blockedClientIds.size);
  } catch (error) {
    console.error('Error cargando bloqueos:', error);
  }
}

wss.on('connection', (ws, req) => {
  let clientId = null;
  let username = null;

  console.log('Nueva conexion WebSocket');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case MESSAGE_TYPES.REGISTER:
          clientId = message.clientId;
          username = message.username;

          if (blockedClientIds.has(clientId)) {
            ws.send(JSON.stringify({
              type: MESSAGE_TYPES.SYSTEM,
              message: 'Tu sesion ha sido bloqueada por un moderador.'
            }));
            ws.close();
            return;
          }

          clients.set(clientId, { ws, username });
          console.log('Usuario registrado:', username);

          broadcastSystemMessage(username + ' se ha unido al chat');
          broadcastListenerCount();
          break;

        case MESSAGE_TYPES.CHAT:
          if (!clientId || blockedClientIds.has(clientId)) {
            return;
          }

          broadcastToAll({
            type: MESSAGE_TYPES.CHAT,
            clientId: clientId,
            username: message.username || username,
            message: message.message,
            timestamp: Date.now()
          });
          break;

        case MESSAGE_TYPES.BLOCK:
          if (message.targetClientId) {
            blockedClientIds.add(message.targetClientId);
            
            const targetClient = clients.get(message.targetClientId);
            if (targetClient) {
              targetClient.ws.send(JSON.stringify({
                type: MESSAGE_TYPES.SYSTEM,
                message: 'Has sido bloqueado por un moderador.'
              }));
              targetClient.ws.close();
            }
          }
          break;

        case MESSAGE_TYPES.UNBLOCK:
          if (message.targetClientId) {
            blockedClientIds.delete(message.targetClientId);
          }
          break;
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  });

  ws.on('close', () => {
    if (clientId) {
      clients.delete(clientId);
      if (username) {
        broadcastSystemMessage(username + ' ha salido del chat');
      }
      broadcastListenerCount();
    }
  });

  ws.on('error', (error) => {
    console.error('Error WebSocket:', error);
  });
});

// Inicializar aplicacion
async function initializeApp() {
  try {
    await loadBlockedClients();
    console.log('Aplicacion inicializada correctamente');
  } catch (error) {
    console.error('Error inicializando aplicacion:', error);
    process.exit(1);
  }
}

// Inicializar y arrancar servidor
initializeApp().then(() => {
  if (isPassenger) {
    server.listen('passenger', () => {
      console.log('Diveca Radio ejecutandose bajo Passenger');
    });
  } else {
    const PORT = process.env.PORT || config.server.port || 3002;
    server.listen(PORT, () => {
      console.log('Diveca Radio ejecutandose en puerto ' + PORT);
      console.log('Health check: http://localhost:' + PORT + '/health');
    });
  }
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = server;
