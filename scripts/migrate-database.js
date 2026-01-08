/* eslint-env node, commonjs */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    // Primero conectar sin especificar base de datos para crearla si no existe
    const connectionWithoutDB = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    });

    // Crear base de datos si no existe
    const dbName = process.env.DB_NAME || 'divecaradio_db';
    await connectionWithoutDB.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Base de datos '${dbName}' verificada/creada`);
    await connectionWithoutDB.end();

    // Ahora conectar a la base de datos específica
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: dbName
    });

    try {
        console.log('🔄 Ejecutando migración de base de datos...');

        // Leer el archivo de esquema
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Dividir por declaraciones y ejecutar una por una
        const statements = schemaSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        for (const statement of statements) {
            try {
                await connection.execute(statement);
                console.log('✅ Ejecutado:', statement.substring(0, 50) + '...');
            } catch (error) {
                // Ignorar errores de tablas que ya existen
                if (!error.message.includes('already exists')) {
                    console.error('❌ Error ejecutando:', statement.substring(0, 50) + '...', error.message);
                }
            }
        }

        console.log('✅ Migración completada exitosamente');

    } catch (error) {
        console.error('❌ Error en migración:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runMigration().catch(console.error);
}

module.exports = { runMigration };
