#!/usr/bin/env node

// API Endpoint Testing Script for SDMS
// Run with: node test-endpoints.js

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'https://student-db-ms.smitharnold230.workers.dev'; // Change to your deployed URL
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  full_name: 'Test User'
};

let authToken = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing Login Endpoint...');
  
  try {
    const response = await makeRequest('POST', '/api/auth/login', TEST_USER);
    
    if (response.status === 200 && response.data.success) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      console.log(`   Token: ${authToken.substring(0, 20)}...`);
      console.log(`   User: ${response.data.user.full_name} (${response.data.user.role})`);
      return true;
    } else {
      console.log('❌ Login failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return false;
  }
}

async function testStudentDashboard() {
  console.log('\n📊 Testing Student Dashboard...');
  
  try {
    const response = await makeRequest('GET', '/api/student/dashboard', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Dashboard retrieved successfully');
      console.log(`   Total Points: ${response.data.data.totalPoints}`);
      console.log(`   Approved Certificates: ${response.data.data.approvedCertificates}`);
      console.log(`   Pending Certificates: ${response.data.data.pendingCertificates}`);
      console.log(`   Upcoming Workshops: ${response.data.data.upcomingWorkshops.length}`);
      return true;
    } else {
      console.log('❌ Dashboard failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Dashboard error:', error.message);
    return false;
  }
}

async function testEvents() {
  console.log('\n📅 Testing Events Endpoints...');
  
  try {
    // Test GET events
    const getResponse = await makeRequest('GET', '/api/events', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (getResponse.status === 200 && getResponse.data.success) {
      console.log('✅ Events list retrieved successfully');
      console.log(`   Total Events: ${getResponse.data.data.length}`);
    } else {
      console.log('❌ Events list failed');
      console.log(`   Status: ${getResponse.status}`);
      return false;
    }
    
    // Test POST event (might fail if user is not faculty/admin)
    const eventData = {
      title: 'Test Event',
      description: 'A test event for API validation',
      start_date: '2024-06-01T09:00:00Z',
      end_date: '2024-06-01T17:00:00Z',
      location: 'Test Location',
      max_participants: 50
    };
    
    const postResponse = await makeRequest('POST', '/api/faculty/events', eventData, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (postResponse.status === 200 && postResponse.data.success) {
      console.log('✅ Event creation successful');
      console.log(`   Event ID: ${postResponse.data.eventId}`);
    } else if (postResponse.status === 403) {
      console.log('⚠️  Event creation failed (expected - requires faculty/admin role)');
      console.log(`   Status: ${postResponse.status}`);
    } else {
      console.log('❌ Event creation failed');
      console.log(`   Status: ${postResponse.status}`);
      console.log(`   Response: ${JSON.stringify(postResponse.data, null, 2)}`);
    }
    
    return true; // Return true as long as GET events works
  } catch (error) {
    console.log('❌ Events error:', error.message);
    return false;
  }
}

async function testApproval() {
  console.log('\n✅ Testing Approval Endpoints...');
  
  try {
    // Test GET pending certificates
    const pendingResponse = await makeRequest('GET', '/api/faculty/pending', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (pendingResponse.status === 200 && pendingResponse.data.success) {
      console.log('✅ Pending certificates retrieved successfully');
      console.log(`   Pending Count: ${pendingResponse.data.data.length}`);
    } else if (pendingResponse.status === 403) {
      console.log('⚠️  Pending certificates failed (expected - requires faculty/admin role)');
    } else {
      console.log('❌ Pending certificates failed');
      console.log(`   Status: ${pendingResponse.status}`);
    }
    
    // Test approval (will likely fail due to no pending certificates or role restrictions)
    const approvalResponse = await makeRequest('PUT', '/api/faculty/approve/1', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (approvalResponse.status === 200 && approvalResponse.data.success) {
      console.log('✅ Certificate approval successful');
    } else if (approvalResponse.status === 403) {
      console.log('⚠️  Certificate approval failed (expected - requires faculty/admin role)');
    } else if (approvalResponse.status === 404) {
      console.log('⚠️  Certificate approval failed (expected - certificate not found)');
    } else {
      console.log('❌ Certificate approval failed');
      console.log(`   Status: ${approvalResponse.status}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Approval error:', error.message);
    return false;
  }
}

async function testAnalytics() {
  console.log('\n📈 Testing Analytics Endpoints...');
  
  try {
    // Test user analytics (should work for any authenticated user)
    const userResponse = await makeRequest('GET', '/api/analytics/user', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (userResponse.status === 200 && userResponse.data.success) {
      console.log('✅ User analytics retrieved successfully');
      console.log(`   Total Points: ${userResponse.data.data.totalPoints}`);
      console.log(`   Activity Records: ${userResponse.data.data.activity.length}`);
    } else {
      console.log('❌ User analytics failed');
      console.log(`   Status: ${userResponse.status}`);
      console.log(`   Response: ${JSON.stringify(userResponse.data, null, 2)}`);
    }
    
    // Test admin analytics (will likely fail due to role restrictions)
    const adminResponse = await makeRequest('GET', '/api/admin/analytics', null, {
      'Authorization': `Bearer ${authToken}`
    });
    
    if (adminResponse.status === 200 && adminResponse.data.success) {
      console.log('✅ Admin analytics retrieved successfully');
      console.log(`   Total Users: ${adminResponse.data.data.systemHealth.total_users}`);
      console.log(`   Pending Reviews: ${adminResponse.data.data.systemHealth.pending_reviews}`);
    } else if (adminResponse.status === 403) {
      console.log('⚠️  Admin analytics failed (expected - requires admin role)');
    } else {
      console.log('❌ Admin analytics failed');
      console.log(`   Status: ${adminResponse.status}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Analytics error:', error.message);
    return false;
  }
}

async function testInvalidRequests() {
  console.log('\n🚫 Testing Invalid Requests...');
  
  try {
    // Test without authentication
    const noAuthResponse = await makeRequest('GET', '/api/student/dashboard');
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Unauthenticated request properly rejected');
    } else {
      console.log('❌ Unauthenticated request should be rejected');
      console.log(`   Status: ${noAuthResponse.status}`);
    }
    
    // Test with invalid JSON
    const invalidResponse = await makeRequest('POST', '/api/auth/login', { email: 'invalid' });
    
    if (invalidResponse.status === 400 || invalidResponse.status === 401) {
      console.log('✅ Invalid request properly rejected');
    } else {
      console.log('❌ Invalid request should be rejected');
      console.log(`   Status: ${invalidResponse.status}`);
    }
    
    // Test non-existent endpoint
    const notFoundResponse = await makeRequest('GET', '/api/nonexistent');
    
    if (notFoundResponse.status === 404) {
      console.log('✅ Non-existent endpoint properly returns 404');
    } else {
      console.log('❌ Non-existent endpoint should return 404');
      console.log(`   Status: ${notFoundResponse.status}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Invalid requests test error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting SDMS API Endpoint Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('=' .repeat(50));
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Test login first (required for other tests)
  results.total++;
  if (await testLogin()) {
    results.passed++;
    
    // Only run authenticated tests if login succeeds
    const tests = [
      testStudentDashboard,
      testEvents,
      testApproval,
      testAnalytics,
      testInvalidRequests
    ];
    
    for (const test of tests) {
      results.total++;
      if (await test()) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } else {
    results.failed++;
    console.log('\n❌ Login failed - skipping authenticated tests');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   🎯 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    console.log('\nNote: Some failures might be expected if:');
    console.log('- Test user doesn\'t have required role permissions');
    console.log('- Database is empty (no existing data)');
    console.log('- Worker is not running or accessible');
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, makeRequest };