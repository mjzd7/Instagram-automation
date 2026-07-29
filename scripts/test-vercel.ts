// Test script to verify the deployment works
import fetch from 'node-fetch';

const BASE_URL = process.argv[2] || 'http://localhost:3000';

async function testEndpoint(endpoint: string, description: string) {
  console.log(`\\n🧪 Testing ${description}...`);
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`✅ Message: ${data.message}`);
    if (data.results) {
      console.log(`✅ Results: ${JSON.stringify(data.results, null, 2)}`);
    }
    return data.success;
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Vercel API Tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);

  const tests = [
    { endpoint: '/api/test', description: 'Test Generation (4 slots)' },
    { endpoint: '/api/generate?slot=1', description: 'Single Slot Generation' },
    // { endpoint: '/api/post?slots=1,2,3,4', description: 'Full Posting' }, // Uncomment when ready to actually post
  ];

  let passed = 0;
  const total = tests.length;

  for (const test of tests) {
    const success = await testEndpoint(test.endpoint, test.description);
    if (success) passed++;
  }

  console.log(`\\n📊 Test Results: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(console.error);
