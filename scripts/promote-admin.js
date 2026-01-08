/* eslint-env node, commonjs */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function promoteUserToAdmin() {
    console.log('👑 Promoviendo usuario a administrador...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'divecaradio_db'
    });

    try {
        // Mostrar usuarios existentes
        const [users] = await connection.execute(
            `SELECT u.id, u.username, u.email, r.name as role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             ORDER BY u.created_at ASC`
        );

        if (users.length === 0) {
            console.log('❌ No hay usuarios registrados.');
            console.log('💡 Primero regístrate en http://localhost:3002 y luego ejecuta este script.');
            return;
        }

        console.log('\n👥 Usuarios disponibles:');
        users.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.username} (${user.email}) - Rol: ${user.role_name || 'sin rol'}`);
        });

        // Obtener el ID del rol admin
        const [adminRole] = await connection.execute(
            'SELECT id FROM roles WHERE name = ?', ['admin']
        );

        if (adminRole.length === 0) {
            console.log('❌ Rol admin no encontrado. Ejecuta primero: npm run setup:new');
            return;
        }

        // Promover el primer usuario (o se puede modificar para preguntar cuál)
        const userToPromote = users[0];

        await connection.execute(
            'UPDATE users SET role_id = ? WHERE id = ?',
            [adminRole[0].id, userToPromote.id]
        );

        console.log(`\n✅ Usuario "${userToPromote.username}" promovido a administrador`);
        console.log('🎯 Ya puedes loguearte con ese usuario y tendrás permisos de admin');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    promoteUserToAdmin().catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}

module.exports = { promoteUserToAdmin };
