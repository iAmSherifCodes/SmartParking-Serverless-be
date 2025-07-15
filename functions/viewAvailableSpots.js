const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

// Get table name from environment variable
const tableName = process.env.PARKING_SPACE_TABLE || 'ParkingSpaceTable';

// CORS headers
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // Configure this properly in production
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: corsHeaders,
});

const getAvailableSpaces = async (limit, lastEvaluatedKey) => {
  const params = {
    TableName: tableName,
    Limit: Number(limit) || 20,
    FilterExpression: 'is_reserved = :is_reserved',
    ExpressionAttributeValues: {
      ':is_reserved': true,
    },
  };

  if (lastEvaluatedKey) {
    try {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
      console.log("Using pagination cursor:", params.ExclusiveStartKey);
    } catch (error) {
      console.error("Error parsing pagination cursor:", error);
      throw new Error("Invalid pagination cursor format");
    }
  }

  console.log("Scanning table with params:", JSON.stringify(params, null, 2));

  try {
    const command = new ScanCommand(params);
    const result = await dynamodb.send(command);
    
    console.log("Scan result:", {
      count: result.Count,
      scannedCount: result.ScannedCount,
      hasLastEvaluatedKey: !!result.LastEvaluatedKey
    });

    return {
      items: result.Items || [],
      count: result.Count || 0,
      cursor: result.LastEvaluatedKey 
        ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) 
        : null,
    };
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
};

module.exports.handler = async (event, context) => {
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    console.log('Processing view available spots request', { 
      requestId: context.awsRequestId 
    });

    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit || 20;
    const cursor = queryParams.cursor || null;

    console.log("Query params:", { limit, cursor });

    // Validate limit
    const numLimit = Number(limit);
    if (isNaN(numLimit) || numLimit < 1 || numLimit > 100) {
      return createResponse(400, {
        success: false,
        message: 'Limit must be a number between 1 and 100',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    // Get available spaces
    const availableSpaces = await getAvailableSpaces(numLimit, cursor);

    console.log('Available spots retrieved successfully', { 
      requestId: context.awsRequestId,
      count: availableSpaces.count,
      hasMore: !!availableSpaces.cursor 
    });

    return createResponse(200, {
      success: true,
      message: 'Available parking spaces retrieved',
      data: availableSpaces,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('View available spots error', {
      requestId: context.awsRequestId,
      error: error.message,
      stack: error.stack,
    });

    return createResponse(500, {
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'dev' && { 
        error: error.message,
        stack: error.stack 
      }),
    });
  }
};