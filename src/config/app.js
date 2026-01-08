// Configuración centralizada de la aplicación
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

class Config {
    constructor() {
        this.loadEnvironment();
        this.setupConstants();
    }

    loadEnvironment() {
        const envFile = process.env.NODE_ENV === 'production'
            ? path.join(__dirname, '../../.env.production')
            : path.join(__dirname, '../../.env.local');

        if (fs.existsSync(envFile)) {
            dotenv.config({ path: envFile });
            console.log(`✅ Variables de entorno cargadas desde: ${envFile}`);
        } else {
            dotenv.config();
            console.log('✅ Variables de entorno cargadas desde .env por defecto');
        }
    }

    setupConstants() {
        // Configuración de base de datos
        this.database = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'divecaradio',
            port: process.env.DB_PORT || 3306,
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000
        };

        // Configuración del servidor
        this.server = {
            port: process.env.PORT || 3000,
            wsPort: process.env.WS_PORT || 8080,
            host: process.env.HOST || 'localhost'
        };

        // Configuración de sesiones
        this.session = {
            secret: process.env.SESSION_SECRET || 'divecaradio-secret-key-change-in-production',
            name: 'divecaradio.sid',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 24 horas
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: process.env.NODE_ENV === 'production' ? '.divecaradio.com' : undefined
            }
        };

        // Roles y permisos
        this.roles = {
            USER: 'user',
            MODERATOR: 'moderator',
            ADMIN: 'admin'
        };

        this.permissions = {
            CHAT_SEND: 'chat.send',
            CHAT_MODERATE: 'chat.moderate',
            ADMIN_PANEL: 'admin.panel',
            ADMIN_USERS: 'admin.users',
            ADMIN_ROLES: 'admin.roles'
        };

        // Configuración de rate limiting
        this.rateLimiting = {
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100, // límite de requests por ventana
            message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
        };

        // Configuración de CORS
        this.cors = {
            origin: process.env.ALLOWED_ORIGINS ?
                process.env.ALLOWED_ORIGINS.split(',') :
                ['http://localhost:3000', 'http://localhost:5173', 'https://divecaradio.com', 'https://www.divecaradio.com'],
            credentials: true
        };
    }

    // Getters para acceso fácil
    get isDevelopment() {
        return process.env.NODE_ENV !== 'production';
    }

    get isProduction() {
        return process.env.NODE_ENV === 'production';
    }
}

// Exportar instancia singleton
module.exports = new Config();
