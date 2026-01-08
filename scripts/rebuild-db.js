const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function rebuild() {
    console.log('Conectando a MySQL...');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'divecaradio_db',
        multipleStatements: true
    });

    try {
        console.log('Eliminando tablas existentes...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('DROP TABLE IF EXISTS blocked_sessions');
        await conn.query('DROP TABLE IF EXISTS role_permissions');
        await conn.query('DROP TABLE IF EXISTS users');
        await conn.query('DROP TABLE IF EXISTS permissions');
        await conn.query('DROP TABLE IF EXISTS roles');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Creando estructura nueva...');
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Ejecutar cada statement por separado
        const statements = schema.split(';').filter(s => s.trim());
        for (const stmt of statements) {
            if (stmt.trim()) {
                await conn.query(stmt);
                console.log('✅ Ejecutado:', stmt.substring(0, 50) + '...');
            }
        }

        console.log('✅ Base de datos reconstruida correctamente');
    } finally {
        await conn.end();
    }
}

rebuild().catch(e => {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
});
