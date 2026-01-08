/* eslint-env node, commonjs */
const bcrypt = require('bcrypt');
const db = require('./database');
const config = require('../config/app');

class AuthService {
    async registerUser(email, password, username) {
        try {
            // Verificar si el usuario ya existe
            const existingUser = await db.query(
                'SELECT id FROM users WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingUser.length > 0) {
                throw new Error('El email o nombre de usuario ya existe');
            }

            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(password, 12);

            // Insertar usuario con rol de usuario regular por defecto
            const result = await db.query(
                `INSERT INTO users (email, password, username, role_id) 
         VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?))`,
                [email, hashedPassword, username, config.roles.USER]
            );

            return {
                id: result.insertId,
                email,
                username,
                role: config.roles.USER
            };
        } catch (error) {
            console.error('❌ Error en registro:', error);
            throw error;
        }
    }

    async loginUser(email, password) {
        try {
            // Buscar usuario con su rol y permisos
            const users = await db.query(
                `SELECT u.id, u.email, u.username, u.password, u.is_active, u.is_blocked,
                r.name as role_name,
                GROUP_CONCAT(p.name) as permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN role_permissions rp ON r.id = rp.role_id
         LEFT JOIN permissions p ON rp.permission_id = p.id
         WHERE u.email = ? AND u.is_active = true
         GROUP BY u.id`,
                [email]
            );

            if (users.length === 0) {
                throw new Error('Usuario no encontrado o inactivo');
            }

            const user = users[0];

            if (user.is_blocked) {
                throw new Error('Usuario bloqueado');
            }

            // Verificar contraseña
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new Error('Contraseña incorrecta');
            }

            // Actualizar último login
            await db.query(
                'UPDATE users SET last_login = NOW() WHERE id = ?',
                [user.id]
            );

            return {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role_name,
                permissions: user.permissions ? user.permissions.split(',') : []
            };
        } catch (error) {
            console.error('❌ Error en login:', error);
            throw error;
        }
    }

    async getUserById(userId) {
        try {
            const users = await db.query(
                `SELECT u.id, u.email, u.username, u.is_active, u.is_blocked,
                r.name as role_name,
                GROUP_CONCAT(p.name) as permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN role_permissions rp ON r.id = rp.role_id
         LEFT JOIN permissions p ON rp.permission_id = p.id
         WHERE u.id = ?
         GROUP BY u.id`,
                [userId]
            );

            if (users.length === 0) {
                return null;
            }

            const user = users[0];
            return {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role_name,
                permissions: user.permissions ? user.permissions.split(',') : [],
                isActive: user.is_active,
                isBlocked: user.is_blocked
            };
        } catch (error) {
            console.error('❌ Error obteniendo usuario:', error);
            throw error;
        }
    }

    hasPermission(userPermissions, requiredPermission) {
        return userPermissions.includes(requiredPermission);
    }

    async updateUserRole(userId, newRoleId, updatedBy) {
        try {
            await db.query(
                'UPDATE users SET role_id = ?, updated_at = NOW() WHERE id = ?',
                [newRoleId, userId]
            );

            console.log(`✅ Rol actualizado para usuario ${userId} por ${updatedBy}`);
            return true;
        } catch (error) {
            console.error('❌ Error actualizando rol:', error);
            throw error;
        }
    }

    async blockUser(userId, blockedBy, reason = null) {
        try {
            await db.query(
                'UPDATE users SET is_blocked = true, updated_at = NOW() WHERE id = ?',
                [userId]
            );

            console.log(`✅ Usuario ${userId} bloqueado por ${blockedBy}`);
            return true;
        } catch (error) {
            console.error('❌ Error bloqueando usuario:', error);
            throw error;
        }
    }

    async unblockUser(userId, unblockedBy) {
        try {
            await db.query(
                'UPDATE users SET is_blocked = false, updated_at = NOW() WHERE id = ?',
                [userId]
            );

            console.log(`✅ Usuario ${userId} desbloqueado por ${unblockedBy}`);
            return true;
        } catch (error) {
            console.error('❌ Error desbloqueando usuario:', error);
            throw error;
        }
    }
}

module.exports = new AuthService();
