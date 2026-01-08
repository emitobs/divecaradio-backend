/* eslint-disable import/no-commonjs */
const mysql = require('mysql2/promise');
const config = require('../config/app');

class DatabaseService {
    constructor() {
        this.pool = null;
        this.init();
    }

    async init() {
        try {
            this.pool = mysql.createPool(config.database);
            console.log('✅ Pool de conexiones MySQL creado');

            // Probar la conexión
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            console.log('✅ Conexión a MySQL verificada');
        } catch (error) {
            console.error('❌ Error conectando a MySQL:', error);
            process.exit(1);
        }
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('❌ Error en consulta SQL:', error);
            throw error;
        }
    }

    async transaction(queries) {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();

        try {
            const results = [];
            for (const { sql, params } of queries) {
                const [result] = await connection.execute(sql, params);
                results.push(result);
            }

            await connection.commit();
            connection.release();
            return results;
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ Pool de conexiones cerrado');
        }
    }
}

// Exportar instancia singleton
module.exports = new DatabaseService();
