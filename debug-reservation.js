#!/usr/bin/env node

/**
 * Debug script for makeReservation endpoint
 * Tests the exact payload that's causing the 400 error
 */

// Set environment variables
process.env.NODE_ENV = 'test';

async function testReservationEndpoint() {
  console.log('🔍 Testing makeReservation endpoint with your exact payload\n');
  
  try {
    // Import the Lambda function
    const { handler } = require('./functions/makeReservation');
    
    // Your exact payload that's causing the 400 error
    const testPayload = {
      "spaceNumber": "A0",
      "checkoutTime": "2025-07-16T01:00",
      "email": "awofiranyesherif4@gmail.com"
    };
    
    // Create test event (simulating API Gateway event)
    const event = {
      httpMethod: 'POST',
      path: '/reserve',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://your-frontend-domain.com',
      },
      body: JSON.stringify(testPayload),
      isBase64Encoded: false,
    };
    
    // Create test context
    const context = {
      awsRequestId: 'test-request-' + Date.now(),
      functionName: 'makeReservation',
      functionVersion: '$LATEST',
      memoryLimitInMB: '512',
      getRemainingTimeInMillis: () => 30000,
    };
    
    console.log('📤 Test Payload:');
    console.log(JSON.stringify(testPayload, null, 2));
    console.log('\n📤 Full Event:');
    console.log(JSON.stringify(event, null, 2));
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
        console.log('\n📊 Analysis:');
        if (result.statusCode === 200) {
          console.log('✅ SUCCESS - The Lambda function works correctly!');
          console.log('💡 If you\'re still getting 400 from API Gateway, the issue might be:');
          console.log('   1. API Gateway model validation is rejecting the request');
          console.log('   2. CORS preflight issues');
          console.log('   3. Request format/headers issues');
        } else if (result.statusCode === 400) {
          console.log('❌ VALIDATION ERROR - Check the errors above');
          if (parsedBody.errors) {
            console.log('🔍 Specific validation errors:');
            parsedBody.errors.forEach((error, index) => {
              console.log(`   ${index + 1}. ${error}`);
            });
          }
        } else {
          console.log('⚠️  Unexpected status code');
        }
        
      } catch (parseError) {
        console.log('Raw Body (could not parse as JSON):');
        console.log(result.body);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing Lambda function:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test different date formats to identify the issue
async function testDateFormats() {
  console.log('\n🕐 Testing Different Date Formats\n');
  
  const dateFormats = [
    "2025-07-16T01:00",           // Your current format
    "2025-07-16T01:00:00",        // With seconds
    "2025-07-16T01:00:00.000Z",   // ISO format with timezone
    "2025-07-16T01:00:00Z",       // ISO format with Z
    "2025-01-16T14:00:00.000Z",   // Future date (January instead of July)
  ];
  
  for (const dateFormat of dateFormats) {
    console.log(`\n🔬 Testing date format: ${dateFormat}`);
    
    try {
      const { handler } = require('./functions/makeReservation');
      
      const testPayload = {
        "spaceNumber": "A0",
        "checkoutTime": dateFormat,
        "email": "awofiranyesherif4@gmail.com"
      };
      
      const event = {
        httpMethod: 'POST',
        path: '/reserve',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      };
      
      const context = {
        awsRequestId: `test-${Date.now()}`,
        functionName: 'test-function',
        getRemainingTimeInMillis: () => 30000,
      };
      
      const result = await handler(event, context);
      
      if (result.statusCode === 200) {
        console.log('   ✅ SUCCESS');
      } else {
        console.log('   ❌ FAILED');
        const body = JSON.parse(result.body);
        if (body.errors) {
          console.log('   Errors:', body.errors.join(', '));
        }
      }
      
    } catch (error) {
      console.log('   💥 EXCEPTION:', error.message);
    }
  }
}

// Test API Gateway model validation format
async function testApiGatewayFormat() {
  console.log('\n🌐 Testing API Gateway Model Validation Format\n');
  
  // Check what the API Gateway model expects
  console.log('📋 Current API Gateway Model (from CDK):');
  console.log(`
  makeReservationApiModel: {
    checkoutTime: {
      type: STRING,
      minLength: 19  // This might be the issue!
    },
    spaceNumber: {
      type: STRING,
      maxLength: 2,
      minLength: 2
    },
    email: {
      type: STRING,
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    }
  }
  `);
  
  console.log('🔍 Your payload analysis:');
  const payload = {
    "spaceNumber": "A0",
    "checkoutTime": "2025-07-16T01:00",
    "email": "awofiranyesherif4@gmail.com"
  };
  
  console.log(`checkoutTime length: ${payload.checkoutTime.length} (API Gateway expects minLength: 19)`);
  console.log(`spaceNumber length: ${payload.spaceNumber.length} (API Gateway expects exactly 2)`);
  console.log(`email format: ${/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(payload.email) ? 'VALID' : 'INVALID'}`);
  
  if (payload.checkoutTime.length < 19) {
    console.log('\n❌ FOUND THE ISSUE!');
    console.log('Your checkoutTime is too short for API Gateway model validation.');
    console.log('API Gateway expects minLength: 19, but your string is only', payload.checkoutTime.length, 'characters.');
    console.log('\n💡 Solutions:');
    console.log('1. Use full ISO format: "2025-07-16T01:00:00.000Z"');
    console.log('2. Update API Gateway model to allow shorter strings');
    console.log('3. Use "2025-07-16T01:00:00" (19 characters exactly)');
  }
}

// Main execution
async function main() {
  await testReservationEndpoint();
  await testDateFormats();
  await testApiGatewayFormat();
  
  console.log('\n🎯 Summary:');
  console.log('If the Lambda function works but API Gateway returns 400, check:');
  console.log('1. 📏 String length requirements in API Gateway model');
  console.log('2. 🔤 Pattern matching for email and other fields');
  console.log('3. 🌐 CORS preflight requests');
  console.log('4. 📋 Request Content-Type headers');
}

main().catch(console.error);