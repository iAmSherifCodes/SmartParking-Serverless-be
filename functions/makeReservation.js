const moment = require('moment-timezone');

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: corsHeaders,
});

// Simple validation function
const validateReservationData = (data) => {
  const errors = [];

  if (!data.spaceNumber) {
    errors.push('spaceNumber is required');
  }

  if (!data.checkoutTime) {
    errors.push('checkoutTime is required');
  }

  if (!data.email) {
    errors.push('email is required');
  }

  // Basic email validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  // Date validation
  if (data.checkoutTime) {
    const checkoutMoment = moment(data.checkoutTime);
    if (!checkoutMoment.isValid()) {
      errors.push('Invalid checkoutTime format');
    } else if (checkoutMoment.isBefore(moment())) {
      errors.push('checkoutTime cannot be in the past');
    } else if (checkoutMoment.isAfter(moment().add(24, 'hours'))) {
      errors.push('checkoutTime cannot be more than 24 hours from now');
    }
  }

  return errors;
};

module.exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    console.log('Processing make reservation request', { 
      requestId: context.awsRequestId 
    });

    // Parse request body
    let body;
    try {
      body = JSON.parse(typeof event.body === "string" ? event.body : JSON.stringify(event.body));
      console.log('Parsed body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createResponse(400, {
        success: false,
        message: 'Invalid JSON in request body',
        error: parseError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Simple validation (API Gateway model validation should handle most of this)
    const validationErrors = validateReservationData(body);
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return createResponse(400, {
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        timestamp: new Date().toISOString(),
      });
    }

    // For now, return a mock successful response to test the endpoint
    const mockResult = {
      charge: 105.99,
      paymentId: `payment-${Date.now()}`,
      spaceNumber: body.spaceNumber,
      checkoutTime: body.checkoutTime,
      email: body.email,
    };

    console.log('Mock reservation result:', mockResult);

    return createResponse(200, {
      success: true,
      message: 'Proceed to payment',
      data: mockResult,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Make reservation error', {
      requestId: context.awsRequestId,
      error: error.message,
      stack: error.stack,
    });

    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
