const mysql = require('mysql2/promise');
const path = require('path');

// Cargar variables de entorno desde .env.local si existe, sino desde .env
if (require('fs').existsSync(path.join(__dirname, '..', '.env.local'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} else {
  require('dotenv').config();
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'divecaradio',
};

async function runMigrations() {
  console.log('🚀 Iniciando migraciones de base de datos...');

  try {
    // Conectar sin especificar la base de datos para crearla si no existe
    const connWithoutDB = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    console.log('✅ Conexión a MySQL establecida');

    // Crear base de datos si no existe
    await connWithoutDB.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(`✅ Base de datos '${dbConfig.database}' creada o ya existe`);
    await connWithoutDB.end();

    // Conectar a la base de datos específica
    const conn = await mysql.createConnection(dbConfig);

    // Verificar si la tabla users existe
    const [tables] = await conn.execute('SHOW TABLES LIKE \'users\'');

    if (tables.length === 0) {
      console.log('📋 Creando tabla users...');
      await conn.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          username VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Tabla users creada exitosamente');
    } else {
      console.log('✅ Tabla users ya existe');
    }

    // Verificar estructura de la tabla
    const [columns] = await conn.execute('DESCRIBE users');
    console.log('📊 Estructura de tabla users:');
    columns.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? col.Key : ''}`
      );
    });

    await conn.end();
    console.log('✅ Migraciones completadas exitosamente');
  } catch (error) {
    console.error('❌ Error en migraciones:', error.message);
    process.exit(1);
  }
}

async function testDatabase() {
  console.log('\n🧪 Iniciando pruebas de base de datos...');

  try {
    const conn = await mysql.createConnection(dbConfig);

    // Limpiar datos de prueba previos
    await conn.execute('DELETE FROM users WHERE email LIKE \'test%@test.com\'');

    // Test 1: Insertar usuario de prueba
    console.log('🔸 Test 1: Insertando usuario de prueba...');
    const testEmail = 'test@test.com';
    const testPassword = 'hashedpassword123';
    const testUsername = 'UsuarioPrueba';

    await conn.execute('INSERT INTO users (email, password, username) VALUES (?, ?, ?)', [
      testEmail,
      testPassword,
      testUsername,
    ]);
    console.log('✅ Usuario de prueba insertado');

    // Test 2: Leer usuario
    console.log('🔸 Test 2: Leyendo usuario de prueba...');
    const [rows] = await conn.execute('SELECT * FROM users WHERE email = ?', [testEmail]);
    if (rows.length > 0) {
      console.log('✅ Usuario encontrado:', {
        id: rows[0].id,
        email: rows[0].email,
        username: rows[0].username,
        created_at: rows[0].created_at,
      });
    } else {
      throw new Error('Usuario no encontrado');
    }

    // Test 3: Verificar restricción UNIQUE en email
    console.log('🔸 Test 3: Verificando restricción UNIQUE...');
    try {
      await conn.execute('INSERT INTO users (email, password, username) VALUES (?, ?, ?)', [
        testEmail,
        'otropassword',
        'OtroUsuario',
      ]);
      throw new Error('La restricción UNIQUE no funcionó');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('✅ Restricción UNIQUE funcionando correctamente');
      } else {
        throw error;
      }
    }

    // Test 4: Contar usuarios
    console.log('🔸 Test 4: Contando usuarios...');
    const [countResult] = await conn.execute('SELECT COUNT(*) as total FROM users');
    console.log(`✅ Total de usuarios en BD: ${countResult[0].total}`);

    // Limpiar datos de prueba
    await conn.execute('DELETE FROM users WHERE email = ?', [testEmail]);
    console.log('🧹 Datos de prueba limpiados');

    await conn.end();
    console.log('✅ Todas las pruebas de base de datos pasaron');
  } catch (error) {
    console.error('❌ Error en pruebas de BD:', error.message);
    process.exit(1);
  }
}

async function testAPIEndpoints() {
  console.log('\n🌐 Iniciando pruebas de API...');

  const baseURL = `http://localhost:${process.env.PORT || 3001}`;

  try {
    // Test 1: Endpoint /me sin sesión
    console.log('🔸 Test 1: GET /me sin sesión...');
    const response1 = await fetch(`${baseURL}/me`);
    const data1 = await response1.json();
    if (data1.loggedIn === false) {
      console.log('✅ /me responde correctamente sin sesión');
    } else {
      throw new Error('Respuesta inesperada de /me');
    }

    // Test 2: Registro de usuario
    console.log('🔸 Test 2: POST /register...');
    const testUser = {
      email: 'apitest@test.com',
      password: 'password123',
      username: 'APITestUser',
    };

    const response2 = await fetch(`${baseURL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (response2.ok) {
      console.log('✅ Registro exitoso');
    } else {
      const errorData = await response2.json();
      throw new Error(`Error en registro: ${errorData.error}`);
    }

    // Test 3: Login con credenciales correctas
    console.log('🔸 Test 3: POST /login...');
    const response3 = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    if (response3.ok) {
      const loginData = await response3.json();
      console.log('✅ Login exitoso:', loginData);
    } else {
      const errorData = await response3.json();
      throw new Error(`Error en login: ${errorData.error}`);
    }

    // Test 4: Login con credenciales incorrectas
    console.log('🔸 Test 4: POST /login con credenciales incorrectas...');
    const response4 = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'passwordincorrecto',
      }),
    });

    if (!response4.ok) {
      console.log('✅ Login rechazado correctamente con credenciales incorrectas');
    } else {
      throw new Error('Login no debería haber funcionado con credenciales incorrectas');
    }

    console.log('✅ Todas las pruebas de API pasaron');
  } catch (error) {
    console.error('❌ Error en pruebas de API:', error.message);
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log('🎯 INICIANDO SUITE COMPLETA DE PRUEBAS\n');

  await runMigrations();
  await testDatabase();
  await testAPIEndpoints();

  console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS');
}

runAllTests().catch(console.error);
