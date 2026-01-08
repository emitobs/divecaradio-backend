/* eslint-env node, commonjs */
const authService = require('../services/auth');
const config = require('../config/app');

// Middleware para verificar autenticación
const requireAuth = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                error: 'No autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Obtener datos actualizados del usuario
        const user = await authService.getUserById(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.status(401).json({
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        if (!user.isActive || user.isBlocked) {
            req.session.destroy();
            return res.status(403).json({
                error: 'Usuario inactivo o bloqueado',
                code: 'USER_BLOCKED'
            });
        }

        // Añadir usuario al request
        req.user = user;
        next();
    } catch (error) {
        console.error('❌ Error en middleware de autenticación:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!authService.hasPermission(req.user.permissions, permission)) {
            return res.status(403).json({
                error: 'Permisos insuficientes',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: permission
            });
        }

        next();
    };
};

// Middleware para verificar roles específicos
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (req.user.role !== role) {
            return res.status(403).json({
                error: 'Rol insuficiente',
                code: 'INSUFFICIENT_ROLE',
                required: role,
                current: req.user.role
            });
        }

        next();
    };
};

// Middleware combinado para verificar múltiples roles
const requireAnyRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Rol insuficiente',
                code: 'INSUFFICIENT_ROLE',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

// Helpers para verificaciones comunes
const isAdmin = (req) => req.user && req.user.role === config.roles.ADMIN;
const isModerator = (req) => req.user && req.user.role === config.roles.MODERATOR;
const canModerate = (req) => isAdmin(req) || isModerator(req);

module.exports = {
    requireAuth,
    requirePermission,
    requireRole,
    requireAnyRole,
    isAdmin,
    isModerator,
    canModerate
};
