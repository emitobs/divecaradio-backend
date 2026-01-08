/* eslint-env node, commonjs */
const db = require('./database');

class BlockingService {
    async blockClient(clientId, userId, blockedBy, reason = null) {
        try {
            // Desactivar bloqueos anteriores del mismo cliente
            await db.query(
                'UPDATE blocked_sessions SET is_active = false WHERE client_id = ? AND is_active = true',
                [clientId]
            );

            // Crear nuevo bloqueo
            await db.query(
                `INSERT INTO blocked_sessions (client_id, user_id, blocked_by, reason) 
         VALUES (?, ?, ?, ?)`,
                [clientId, userId, blockedBy, reason]
            );

            console.log(`✅ Cliente ${clientId} bloqueado por usuario ${blockedBy}`);
            return true;
        } catch (error) {
            console.error('❌ Error bloqueando cliente:', error);
            throw error;
        }
    }

    async unblockClient(clientId, unblockedBy) {
        try {
            const result = await db.query(
                `UPDATE blocked_sessions 
         SET is_active = false, unblocked_at = NOW() 
         WHERE client_id = ? AND is_active = true`,
                [clientId]
            );

            if (result.affectedRows > 0) {
                console.log(`✅ Cliente ${clientId} desbloqueado por usuario ${unblockedBy}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error desbloqueando cliente:', error);
            throw error;
        }
    }

    async isClientBlocked(clientId) {
        try {
            const blocked = await db.query(
                'SELECT id FROM blocked_sessions WHERE client_id = ? AND is_active = true LIMIT 1',
                [clientId]
            );

            return blocked.length > 0;
        } catch (error) {
            console.error('❌ Error verificando bloqueo:', error);
            return false;
        }
    }

    async getBlockedClients() {
        try {
            const blocked = await db.query(
                `SELECT bs.client_id, bs.blocked_at, bs.reason,
                u1.username as blocked_user,
                u2.username as blocked_by_user
         FROM blocked_sessions bs
         LEFT JOIN users u1 ON bs.user_id = u1.id
         JOIN users u2 ON bs.blocked_by = u2.id
         WHERE bs.is_active = true
         ORDER BY bs.blocked_at DESC`
            );

            return blocked;
        } catch (error) {
            console.error('❌ Error obteniendo clientes bloqueados:', error);
            throw error;
        }
    }

    async getBlockHistory(limit = 100) {
        try {
            const history = await db.query(
                `SELECT bs.client_id, bs.blocked_at, bs.unblocked_at, bs.reason, bs.is_active,
                u1.username as blocked_user,
                u2.username as blocked_by_user
         FROM blocked_sessions bs
         LEFT JOIN users u1 ON bs.user_id = u1.id
         JOIN users u2 ON bs.blocked_by = u2.id
         ORDER BY bs.blocked_at DESC
         LIMIT ?`,
                [limit]
            );

            return history;
        } catch (error) {
            console.error('❌ Error obteniendo historial de bloqueos:', error);
            throw error;
        }
    }

    async cleanupOldBlocks(daysOld = 30) {
        try {
            const result = await db.query(
                `DELETE FROM blocked_sessions 
         WHERE is_active = false AND blocked_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [daysOld]
            );

            console.log(`✅ Limpieza: ${result.affectedRows} registros antiguos eliminados`);
            return result.affectedRows;
        } catch (error) {
            console.error('❌ Error en limpieza de bloqueos:', error);
            throw error;
        }
    }
}

module.exports = new BlockingService();
