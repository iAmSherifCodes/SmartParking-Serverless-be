#!/usr/bin/env node

/**
 * Local Lambda Function Test Script
 * This script helps debug Lambda functions locally without deploying to AWS
 */

const path = require('path');

// Mock AWS SDK for local testing
const mockDynamoDBResponse = {
  Items: [
    {
      space_no: 'A1',
      reserved: false,
      status: 'available',
      location: 'Ground Floor - Section A',
    },
    {
      space_no: 'A2',
      reserved: false,
      status: 'available',
      location: 'Ground Floor - Section A',
    },
    {
      space_no: 'B1',
      reserved: false,
      status: 'available',
      location: 'Ground Floor - Section B',
    },
    {
      space_no: 'B2',
      reserved: true,
      status: 'reserved',
      location: 'Ground Floor - Section B',
    },
    {
      space_no: 'C1',
      reserved: false,
      status: 'available',
      location: 'First Floor - Section C',
    },
  ],
  Count: 4, // Only non-reserved items
  ScannedCount: 5,
  LastEvaluatedKey: null,
};

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn().mockResolvedValue(mockDynamoDBResponse),
    })),
  },
  ScanCommand: jest.fn(),
}));

// Set environment variables for testing
process.env.PARKING_SPACE_TABLE = 'ParkingSpaceTable';
process.env.NODE_ENV = 'test';

// Mock event and context
const createMockEvent = (queryParams = {}) => ({
  httpMethod: 'GET',
  path: '/available-spaces',
  queryStringParameters: queryParams,
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3002',
  },
  body: null,
  isBase64Encoded: false,
});

const createMockContext = () => ({
  awsRequestId: 'test-request-id-' + Date.now(),
  functionName: 'test-function',
  functionVersion: '$LATEST',
  memoryLimitInMB: '512',
  getRemainingTimeInMillis: () => 30000,
});

// Test scenarios
const testScenarios = [
  {
    name: 'Basic request with default limit',
    event: createMockEvent(),
    expectedStatus: 200,
  },
  {
    name: 'Request with custom limit',
    event: createMockEvent({ limit: '10' }),
    expectedStatus: 200,
  },
  {
    name: 'Request with invalid limit (too high)',
    event: createMockEvent({ limit: '150' }),
    expectedStatus: 400,
  },
  {
    name: 'Request with invalid limit (negative)',
    event: createMockEvent({ limit: '-5' }),
    expectedStatus: 400,
  },
  {
    name: 'Request with cursor pagination',
    event: createMockEvent({ 
      limit: '5', 
      cursor: encodeURIComponent(JSON.stringify({ space_no: 'A5' }))
    }),
    expectedStatus: 200,
  },
  {
    name: 'Request with invalid cursor',
    event: createMockEvent({ 
      limit: '5', 
      cursor: 'invalid-cursor-data'
    }),
    expectedStatus: 500,
  },
];

// Test runner
async function runTests() {
  console.log('🧪 Starting Local Lambda Function Tests\n');
  
  try {
    // Import the Lambda function
    const { handler } = require('./functions/viewAvailableSpots');
    
    let passedTests = 0;
    let totalTests = testScenarios.length;
    
    for (const scenario of testScenarios) {
      console.log(`📋 Testing: ${scenario.name}`);
      
      try {
        const context = createMockContext();
        const result = await handler(scenario.event, context);
        
        console.log(`   Request ID: ${context.awsRequestId}`);
        console.log(`   Expected Status: ${scenario.expectedStatus}`);
        console.log(`   Actual Status: ${result.statusCode}`);
        
        if (result.statusCode === scenario.expectedStatus) {
          console.log('   ✅ PASSED\n');
          passedTests++;
          
          // Log response body for successful requests
          if (result.statusCode === 200) {
            const body = JSON.parse(result.body);
            console.log(`   📊 Response Data:`);
            console.log(`      Success: ${body.success}`);
            console.log(`      Message: ${body.message}`);
            console.log(`      Items Count: ${body.data?.count || 0}`);
            console.log(`      Has Cursor: ${!!body.data?.cursor}`);
            console.log('');
          }
        } else {
          console.log('   ❌ FAILED');
          console.log(`   Response Body: ${result.body}\n`);
        }
        
      } catch (error) {
        console.log('   ❌ ERROR');
        console.log(`   Error: ${error.message}`);
        console.log(`   Stack: ${error.stack}\n`);
      }
    }
    
    console.log(`📈 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! The Lambda function should work correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the issues above.');
    }
    
  } catch (error) {
    console.error('❌ Failed to load Lambda function:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Manual test function for specific scenarios
async function testSpecificScenario() {
  console.log('🔍 Manual Test - Testing specific scenario\n');
  
  try {
    const { handler } = require('./functions/viewAvailableSpots');
    
    // Test the exact scenario from your frontend
    const event = createMockEvent({ limit: '12' });
    const context = createMockContext();
    
    console.log('📤 Request Event:');
    console.log(JSON.stringify(event, null, 2));
    console.log('\n📥 Processing...\n');
    
    const result = await handler(event, context);
    
    console.log('📨 Response:');
    console.log(`Status Code: ${result.statusCode}`);
    console.log('Headers:', JSON.stringify(result.headers, null, 2));
    console.log('Body:', result.body);
    
    // Parse and display formatted response
    if (result.body) {
      try {
        const parsedBody = JSON.parse(result.body);
        console.log('\n📋 Formatted Response:');
        console.log(JSON.stringify(parsedBody, null, 2));
      } catch (e) {
        console.log('Could not parse response body as JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'manual':
    testSpecificScenario();
    break;
  case 'all':
  default:
    runTests();
    break;
}

// Export for use in other test files
module.exports = {
  createMockEvent,
  createMockContext,
  mockDynamoDBResponse,
};