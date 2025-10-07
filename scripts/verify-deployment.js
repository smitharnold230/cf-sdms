#!/usr/bin/env node

/**
 * Production Deployment Verification Script
 * Tests all critical API endpoints after deployment
 */

const BASE_URL = process.env.API_BASE_URL || 'https://your-worker.your-subdomain.workers.dev';

async function testEndpoint(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`Testing: ${options.method || 'GET'} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => null);
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (options.expectedStatus && response.status !== options.expectedStatus) {
      console.log(`  ❌ Expected status ${options.expectedStatus}, got ${response.status}`);
      return false;
    } else {
      console.log(`  ✅ Success`);
    }
    
    if (options.expectedData) {
      const hasExpectedData = Object.keys(options.expectedData).every(key => 
        data && data[key] === options.expectedData[key]
      );
      if (!hasExpectedData) {
        console.log(`  ❌ Expected data not found`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 SDMS Production Deployment Verification');
  console.log(`Testing API at: ${BASE_URL}`);
  console.log('=' .repeat(50));
  
  const tests = [
    {
      name: 'Health Check',
      test: () => testEndpoint('/', {
        expectedStatus: 200,
        expectedData: { service: 'Student DB Management System' }
      })
    },
    
    {
      name: 'Authentication Endpoint',
      test: () => testEndpoint('/auth/login', {
        method: 'POST',
        expectedStatus: 401, // Should fail without credentials
        body: {}
      })
    },
    
    {
      name: 'User Registration',
      test: () => testEndpoint('/auth/register', {
        method: 'POST',
        expectedStatus: 400, // Should fail with invalid data
        body: {}
      })
    },
    
    {
      name: 'Protected Endpoint (Unauthorized)',
      test: () => testEndpoint('/users', {
        expectedStatus: 401 // Should require authentication
      })
    },
    
    {
      name: 'API Documentation Endpoint',
      test: () => testEndpoint('/api/events', {
        expectedStatus: 401 // Should require authentication
      })
    },
    
    {
      name: 'Notification API',
      test: () => testEndpoint('/api/notifications', {
        expectedStatus: 401 // Should require authentication
      })
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    console.log(`\n🔍 ${name}`);
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Deployment looks good.');
    console.log('\nNext steps:');
    console.log('1. Create an admin account');
    console.log('2. Test frontend integration');
    console.log('3. Configure external services (optional)');
    console.log('4. Set up monitoring and alerts');
  } else {
    console.log('⚠️  Some tests failed. Check the deployment configuration.');
    console.log('\nTroubleshooting:');
    console.log('1. Verify all secrets are set: wrangler secret list');
    console.log('2. Check worker logs: wrangler tail');
    console.log('3. Verify database migrations: wrangler d1 migrations list student_db');
    process.exit(1);
  }
}

// Advanced testing with authentication
async function runAuthenticatedTests() {
  console.log('\n🔐 Testing with Authentication');
  
  // You would need to implement login and get a token first
  console.log('To run authenticated tests:');
  console.log('1. Create a test user account');
  console.log('2. Get JWT token from /auth/login');
  console.log('3. Run: API_BASE_URL=your-url JWT_TOKEN=your-token node verify-deployment.js --auth');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log('Usage: node verify-deployment.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --auth     Run authenticated tests (requires JWT_TOKEN env var)');
    console.log('  --help     Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  API_BASE_URL    Base URL of the deployed API');
    console.log('  JWT_TOKEN       JWT token for authenticated tests');
    process.exit(0);
  }
  
  runTests().then(() => {
    if (args.includes('--auth')) {
      runAuthenticatedTests();
    }
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}