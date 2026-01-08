/* eslint-env node, commonjs */
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Servicios
const authService = require('../services/auth');
const config = require('../config/app');
const logger = require('../utils/logger');

// Middleware
const { requireAuth, requirePermission } = require('../middleware/auth');

const app = express();

// Middleware de logging para requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.jsdelivr.net'],
        styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.jsdelivr.net'],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        connectSrc: [
          '\'self\'',
          'ws://localhost:8080',
          'wss://localhost:8080',
          'https://radio-1.waugi.com',
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// CORS y parsing
app.use(cors(config.cors));
app.use(express.json());

// Rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: 5, // máximo 5 intentos por IP para auth
  message: {
    error: 'Demasiados intentos de autenticación. Intenta en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting general
const generalLimiter = rateLimit(config.rateLimiting);
app.use(generalLimiter);

// Configuración de sesiones
app.use(session(config.session));

// Swagger API Documentation (solo en desarrollo)
if (config.isDevelopment) {
  const { specs, swaggerUi } = require('../config/swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// ================== RUTAS DE AUTENTICACIÓN ==================

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Error de validación
 */
app.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Validaciones básicas
    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Email, contraseña y nombre de usuario son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: 'El nombre de usuario debe tener entre 3 y 20 caracteres'
      });
    }

    const user = await authService.registerUser(email, password, username);

    logger.info('Usuario registrado exitosamente', {
      userId: user.id,
      email: user.email,
      username: user.username
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Error en registro:', error);

    if (error.message.includes('ya existe')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
app.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    const user = await authService.loginUser(email, password);

    // Guardar en sesión
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.permissions = user.permissions;

    // Forzar guardado de sesión
    req.session.save((err) => {
      if (err) {
        logger.error('Error guardando sesión:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      logger.info('Login exitoso', {
        userId: user.id,
        username: user.username,
        role: user.role
      });

      res.json({
        success: true,
        message: 'Login exitoso',
        username: user.username,
        role: user.role,
        permissions: user.permissions
      });
    });

  } catch (error) {
    logger.error('Error en login:', error);

    if (error.message.includes('no encontrado') ||
      error.message.includes('incorrecta') ||
      error.message.includes('bloqueado')) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Cerrar sesión
 *     responses:
 *       200:
 *         description: Logout exitoso
 */
app.post('/logout', (req, res) => {
  if (req.session) {
    const username = req.session.username;

    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destruyendo sesión:', err);
        return res.status(500).json({ error: 'Error cerrando sesión' });
      }

      logger.info('Logout exitoso', { username });
      res.json({ success: true, message: 'Sesión cerrada' });
    });
  } else {
    res.json({ success: true, message: 'No hay sesión activa' });
  }
});

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Obtener información del usuario actual
 *     responses:
 *       200:
 *         description: Información del usuario
 */
app.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({
        loggedIn: false,
        message: 'No hay sesión activa'
      });
    }

    // Obtener datos actualizados del usuario
    const user = await authService.getUserById(req.session.userId);

    if (!user || !user.isActive || user.isBlocked) {
      req.session.destroy();
      return res.json({
        loggedIn: false,
        message: 'Usuario no encontrado o bloqueado'
      });
    }

    res.json({
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      username: user.username // Por compatibilidad
    });

  } catch (error) {
    logger.error('Error obteniendo información de usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// ================== RUTAS DE ADMINISTRACIÓN ==================

/**
 * Obtener usuarios bloqueados (solo para moderadores/admins)
 */
app.get('/admin/blocked-users',
  requireAuth,
  requirePermission(config.permissions.CHAT_MODERATE),
  async (req, res) => {
    try {
      const blockingService = require('../services/blocking');
      const blockedClients = await blockingService.getBlockedClients();

      res.json({
        success: true,
        blockedClientIds: blockedClients.map(client => client.client_id),
        blockedClients: blockedClients
      });
    } catch (error) {
      logger.error('Error obteniendo usuarios bloqueados:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

/**
 * Desbloquear usuario (solo para moderadores/admins)
 */
app.post('/admin/unblock',
  requireAuth,
  requirePermission(config.permissions.CHAT_MODERATE),
  async (req, res) => {
    try {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: 'ClientId es requerido' });
      }

      const blockingService = require('../services/blocking');
      const success = await blockingService.unblockClient(clientId, req.user.id);

      if (success) {
        logger.info('Cliente desbloqueado', {
          clientId,
          unblockedBy: req.user.username
        });

        res.json({
          success: true,
          message: 'Usuario desbloqueado exitosamente'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no estaba bloqueado'
        });
      }
    } catch (error) {
      logger.error('Error desbloqueando usuario:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// ================== RUTA DE DEBUG (SOLO DESARROLLO) ==================

if (config.isDevelopment) {
  app.get('/debug-session', (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionId: req.sessionID,
      sessionData: req.session,
      cookies: req.headers.cookie
    });
  });
}

// ================== MANEJO DE ERRORES ==================

app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(config.isDevelopment && { stack: err.stack })
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

module.exports = app;
