const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function fixDatabase() {
  console.log('Conectando a MySQL...');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'divecaradio_db'
  });

  try {
    console.log('Verificando y agregando columnas faltantes a users...');

    // Obtener columnas actuales
    const [columns] = await conn.query('SHOW COLUMNS FROM users');
    const existingColumns = columns.map(c => c.Field);
    console.log('Columnas existentes:', existingColumns);

    // Agregar columnas faltantes una por una con manejo de errores individual
    const alterations = [
      { col: 'role_id', sql: 'ALTER TABLE users ADD COLUMN role_id INT NOT NULL DEFAULT 1' },
      { col: 'is_active', sql: 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE' },
      { col: 'is_blocked', sql: 'ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE' },
      { col: 'last_login', sql: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL' },
      { col: 'updated_at', sql: 'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ];

    for (const alt of alterations) {
      if (!existingColumns.includes(alt.col)) {
        try {
          await conn.query(alt.sql);
          console.log(`✅ ${alt.col} agregado`);
        } catch (err) {
          console.log(`⚠️ ${alt.col}: ${err.message}`);
        }
      } else {
        console.log(`ℹ️ ${alt.col} ya existe`);
      }
    }

    // Verificar que existan roles básicos
    const [roles] = await conn.query('SELECT COUNT(*) as count FROM roles');
    if (roles[0].count === 0) {
      console.log('Insertando roles básicos...');
      await conn.query(`INSERT INTO roles (name, description) VALUES 
        ('user', 'Usuario regular del chat'),
        ('moderator', 'Moderador con permisos de bloqueo'),
        ('admin', 'Administrador con todos los permisos')`);
      console.log('✅ Roles insertados');
    } else {
      console.log(`ℹ️ Roles existentes: ${roles[0].count}`);
    }

    // Verificar permisos
    const [perms] = await conn.query('SELECT COUNT(*) as count FROM permissions');
    if (perms[0].count === 0) {
      console.log('Insertando permisos básicos...');
      await conn.query(`INSERT INTO permissions (name, description) VALUES 
        ('chat.send', 'Enviar mensajes en el chat'),
        ('chat.moderate', 'Moderar chat'),
        ('admin.panel', 'Acceso al panel de administración'),
        ('admin.users', 'Gestionar usuarios'),
        ('admin.roles', 'Gestionar roles y permisos')`);
      console.log('✅ Permisos insertados');
    } else {
      console.log(`ℹ️ Permisos existentes: ${perms[0].count}`);
    }

    console.log('✅ Base de datos corregida correctamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await conn.end();
  }
}

fixDatabase().catch(e => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});
