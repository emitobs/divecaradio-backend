/* eslint-env node */
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * 🏥 Health Check Script - Verificación Completa del Sistema
 * ========================================================
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironment() {
  log('\n🔍 Verificando configuración del entorno...', 'cyan');

  const checks = [
    { name: 'NODE_ENV', value: process.env.NODE_ENV || 'development' },
    { name: 'PORT', value: process.env.PORT || '3001' },
    { name: 'DB_HOST', value: process.env.DB_HOST || 'localhost' },
    { name: 'DB_NAME', value: process.env.DB_NAME || 'divecaradio' },
    { name: 'SESSION_SECRET', value: process.env.SESSION_SECRET ? '✓ Configurado' : '❌ No configurado' }
  ];

  checks.forEach(check => {
    log(`   ${check.name}: ${check.value}`, 'yellow');
  });
}

function checkFiles() {
  log('\n📂 Verificando archivos del proyecto...', 'cyan');

  const requiredFiles = [
    'app-new.js',
    'package.json',
    'src/config/app.js',
    'src/server/auth-server.js',
    'database/schema.sql'
  ];

  let allFilesExist = true;

  requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    if (exists) {
      log(`   ✅ ${file}`, 'green');
    } else {
      log(`   ❌ ${file} (FALTA)`, 'red');
      allFilesExist = false;
    }
  });

  return allFilesExist;
}

function checkDependencies() {
  log('\n📦 Verificando dependencias...', 'cyan');

  const nodeModulesExists = fs.existsSync(path.join(__dirname, '..', 'node_modules'));
  const packageLockExists = fs.existsSync(path.join(__dirname, '..', 'package-lock.json'));

  if (nodeModulesExists) {
    log('   ✅ node_modules encontrado', 'green');
  } else {
    log('   ❌ node_modules no encontrado - ejecuta npm install', 'red');
    return false;
  }

  if (packageLockExists) {
    log('   ✅ package-lock.json encontrado', 'green');
  } else {
    log('   ⚠️ package-lock.json no encontrado', 'yellow');
  }

  return true;
}

const checkServerHealth = async () => {
  log('\n🌐 Verificando servidor web...', 'cyan');

  return new Promise((resolve) => {
    const port = process.env.PORT || 3001;

    const req = http.get(`http://localhost:${port}/me`, (res) => {
      if (res.statusCode === 401 || res.statusCode === 200) {
        log(`   ✅ Servidor respondiendo en puerto ${port}`, 'green');
        resolve(true);
      } else {
        log(`   ⚠️ Servidor responde con código ${res.statusCode}`, 'yellow');
        resolve(false);
      }
    });

    req.on('error', () => {
      log(`   ❌ Servidor no disponible en puerto ${port}`, 'red');
      log('   💡 Posibles causas:', 'yellow');
      log('      - Servidor no iniciado', 'yellow');
      log('      - Puerto ocupado por otro proceso', 'yellow');
      log('      - Configuración de red incorrecta', 'yellow');
      resolve(false);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      log(`   ⏱️ Timeout al conectar al puerto ${port}`, 'yellow');
      resolve(false);
    });
  });
};

function checkLogs() {
  log('\n📄 Verificando logs...', 'cyan');

  const logsDir = path.join(__dirname, '..', 'logs');

  if (!fs.existsSync(logsDir)) {
    log('   ⚠️ Directorio de logs no existe', 'yellow');
    return false;
  }

  const logFiles = ['combined.log', 'error.log'];
  let hasLogs = false;

  logFiles.forEach(logFile => {
    const logPath = path.join(logsDir, logFile);
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      log(`   ✅ ${logFile} (${Math.round(stats.size / 1024)}KB)`, 'green');
      hasLogs = true;
    } else {
      log(`   ⚠️ ${logFile} no encontrado`, 'yellow');
    }
  });

  return hasLogs;
}

function showSummary(results) {
  log('\n' + '='.repeat(50), 'cyan');
  log('📊 RESUMEN DEL HEALTH CHECK', 'bright');
  log('='.repeat(50), 'cyan');

  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;

  Object.entries(results).forEach(([check, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`   ${icon} ${check}`, color);
  });

  log(`\n📈 Resultado: ${passedChecks}/${totalChecks} verificaciones exitosas`, 'bright');

  if (passedChecks === totalChecks) {
    log('\n🎉 ¡Sistema en perfecto estado!', 'green');
    log('💡 Puedes iniciar el proyecto con: npm run dev', 'cyan');
  } else if (passedChecks >= totalChecks * 0.8) {
    log('\n⚠️ Sistema funcional con advertencias menores', 'yellow');
    log('💡 Revisa las verificaciones fallidas arriba', 'cyan');
  } else {
    log('\n❌ Sistema tiene problemas críticos', 'red');
    log('💡 Soluciona los errores antes de continuar', 'cyan');
  }
}

const performHealthCheck = async () => {
  log('🏥 DIVECA RADIO - HEALTH CHECK', 'bright');
  log('='.repeat(50), 'cyan');

  checkEnvironment();

  const results = {
    'Archivos del proyecto': checkFiles(),
    'Dependencias NPM': checkDependencies(),
    'Servidor web': await checkServerHealth(),
    'Sistema de logs': checkLogs()
  };

  showSummary(results);

  return Object.values(results).every(Boolean);
};

performHealthCheck()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    log(`\n❌ Error inesperado: ${error.message}`, 'red');
    process.exit(1);
  });
