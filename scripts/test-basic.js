const assert = require('assert');
const http = require('http');

/**
 * Diveca Radio - Basic Integration Tests
 * =====================================
 */

class BasicTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runTests() {
    console.log('🧪 Running Basic Integration Tests...\n');

    // Test 1: Check if auth server is running
    await this.test('Auth Server Health Check', async () => {
      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3001/me', (res) => {
          if (res.statusCode === 401 || res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`Unexpected status code: ${res.statusCode}`));
          }
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
    });

    // Test 2: Check if static files are served
    await this.test('Static Files Serving', async () => {
      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3001/', (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`Static files not served: ${res.statusCode}`));
          }
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
    });

    // Test 3: Database connection test
    await this.test('Database Connection', async () => {
      const mysql = require('mysql2/promise');
      const path = require('path');

      // Cargar variables de entorno desde .env.local si existe, sino desde .env
      if (require('fs').existsSync(path.join(__dirname, '..', '.env.local'))) {
        require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
      } else {
        require('dotenv').config();
      }

      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'divecaradio',
      });

      const [rows] = await connection.execute('SELECT 1 as test');
      await connection.end();

      return rows[0].test === 1;
    });

    this.printResults();
  }

  async test(name, testFn) {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
    }
  }

  printResults() {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.passed + this.failed}`);

    if (this.failed === 0) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('🚨 Some tests failed!');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tests = new BasicTests();
  tests.runTests().catch(console.error);
}

module.exports = BasicTests;
