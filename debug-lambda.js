#!/usr/bin/env node

/**
 * Simple Lambda Debug Script
 * Tests the Lambda function locally with mock data
 */

// Set environment variables
process.env.PARKING_SPACE_TABLE = 'ParkingSpaceTable';
process.env.NODE_ENV = 'test';

// Mock AWS SDK before requiring the Lambda function
const originalRequire = require;
require = function(id) {
  if (id === '@aws-sdk/client-dynamodb') {
    return {
      DynamoDB: function() {
        return {};
      }
    };
  }
  
  if (id === '@aws-sdk/lib-dynamodb') {
    return {
      DynamoDBDocumentClient: {
        from: function() {
          return {
            send: async function(command) {
              console.log('🔍 Mock DynamoDB call with command:', command.constructor.name);
              
              // Simulate DynamoDB response
              return {
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
                    space_no: 'C1',
                    reserved: false,
                    status: 'available',
                    location: 'First Floor - Section C',
                  },
                ],
                Count: 4,
                ScannedCount: 5,
                LastEvaluatedKey: null,
              };
            }
          };
        }
      },
      ScanCommand: function(params) {
        console.log('📋 ScanCommand created with params:', JSON.stringify(params, null, 2));
        this.params = params;
        return this;
      }
    };
  }
  
  return originalRequire(id);
};

async function testLambda() {
  console.log('🚀 Testing Lambda Function Locally\n');
  
  try {
    // Import the Lambda function after mocking
    const { handler } = originalRequire('./functions/viewAvailableSpots');
    
    // Create test event (simulating API Gateway event)
    const event = {
      httpMethod: 'GET',
      path: '/available-spaces',
      queryStringParameters: {
        limit: '12'
      },
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3002',
      },
      body: null,
      isBase64Encoded: false,
    };
    
    // Create test context
    const context = {
      awsRequestId: 'test-request-' + Date.now(),
      functionName: 'test-viewAvailableSpots',
      functionVersion: '$LATEST',
      memoryLimitInMB: '512',
      getRemainingTimeInMillis: () => 30000,
    };
    
    console.log('📤 Input Event:');
    console.log(JSON.stringify(event, null, 2));
    console.log('\n📤 Input Context:');
    console.log(JSON.stringify(context, null, 2));
    console.log('\n⚙️  Processing...\n');
    
    // Call the Lambda handler
    const result = await handler(event, context);
    
    console.log('📨 Lambda Response:');
    console.log('Status Code:', result.statusCode);
    console.log('Headers:', JSON.stringify(result.headers, null, 2));
    console.log('\n📋 Response Body:');
    
    if (result.body) {
      try {
        const parsedBody = JSON.parse(result.body);
        console.log(JSON.stringify(parsedBody, null, 2));
        
        // Analyze the response
        console.log('\n📊 Response Analysis:');
        console.log('✅ Success:', parsedBody.success);
        console.log('📝 Message:', parsedBody.message);
        
        if (parsedBody.data) {
          console.log('📦 Items Count:', parsedBody.data.count);
          console.log('🔗 Has Pagination Cursor:', !!parsedBody.data.cursor);
          console.log('📋 Sample Items:');
          
          if (parsedBody.data.items && parsedBody.data.items.length > 0) {
            parsedBody.data.items.slice(0, 3).forEach((item, index) => {
              console.log(`   ${index + 1}. Space ${item.space_no} - ${item.status} (Reserved: ${item.reserved})`);
            });
          }
        }
        
      } catch (parseError) {
        console.log('Raw Body (could not parse as JSON):');
        console.log(result.body);
      }
    }
    
    // Determine if this would cause a Bad Gateway
    console.log('\n🔍 Diagnosis:');
    if (result.statusCode >= 200 && result.statusCode < 300) {
      console.log('✅ Response looks good - should not cause Bad Gateway');
    } else if (result.statusCode >= 400 && result.statusCode < 500) {
      console.log('⚠️  Client error - check request parameters');
    } else if (result.statusCode >= 500) {
      console.log('❌ Server error - this could cause Bad Gateway');
    } else {
      console.log('❓ Unexpected status code');
    }
    
    // Check response format
    if (!result.statusCode || !result.body || !result.headers) {
      console.log('❌ Invalid Lambda response format - this WILL cause Bad Gateway');
      console.log('   Lambda responses must have: statusCode, body, and headers');
    }
    
  } catch (error) {
    console.error('❌ Error testing Lambda function:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('\n🔍 This error would definitely cause a Bad Gateway (502) response');
  }
}

// Test different scenarios
async function testMultipleScenarios() {
  console.log('🧪 Testing Multiple Scenarios\n');
  
  const scenarios = [
    {
      name: 'Normal request (limit=12)',
      queryStringParameters: { limit: '12' }
    },
    {
      name: 'No parameters',
      queryStringParameters: null
    },
    {
      name: 'Empty parameters',
      queryStringParameters: {}
    },
    {
      name: 'Invalid limit',
      queryStringParameters: { limit: 'invalid' }
    },
    {
      name: 'High limit',
      queryStringParameters: { limit: '150' }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n🔬 Testing: ${scenario.name}`);
    console.log('=' .repeat(50));
    
    try {
      const { handler } = originalRequire('./functions/viewAvailableSpots');
      
      const event = {
        httpMethod: 'GET',
        path: '/available-spaces',
        queryStringParameters: scenario.queryStringParameters,
        headers: { 'Content-Type': 'application/json' },
        body: null,
      };
      
      const context = {
        awsRequestId: `test-${Date.now()}`,
        functionName: 'test-function',
        getRemainingTimeInMillis: () => 30000,
      };
      
      const result = await handler(event, context);
      
      console.log(`Status: ${result.statusCode}`);
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        console.log(`Items: ${body.data?.count || 0}`);
        console.log('✅ SUCCESS');
      } else {
        console.log('❌ ERROR');
        console.log('Body:', result.body);
      }
      
    } catch (error) {
      console.log('💥 EXCEPTION:', error.message);
    }
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'multi') {
  testMultipleScenarios();
} else {
  testLambda();
}

console.log('\n💡 To test multiple scenarios, run: node debug-lambda.js multi');