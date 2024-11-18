const {
  DynamoDBDocumentClient,
  ScanCommand,
  } = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

const tableName = process.env.RESERVATION_TABLE;
module.exports.handler = async (event, context) => {
  try {
    // Parse the body if it's a string
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { spaceNumber } = body;

    // Validate spaceNumber exists
    if (!spaceNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "spaceNumber is required"
        })
      };
    }
    // const { spaceNumber } = event.body;
    // console.log("SPACE NUMBER",spaceNumber);
    
    const reservation = await getReservationBySpaceNumber(spaceNumber);
    console.log("RESERVATION", reservation);
    return {
      statusCode: 200,
      body: JSON.stringify(reservation),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message || error,
      }),
    };
  }
};

const getReservationBySpaceNumber = async (spaceNumber) => {
  console.log("SPACE NUMBER IN FUNCTION", spaceNumber);
  try {
    const params = {
      TableName: tableName,
      FilterExpression: 'space_no = :space_no',
      ExpressionAttributeValues: {
        ':space_no': spaceNumber,
      },
    };
    console.log("PARAMS", params);

    const command = new ScanCommand(params);
    const result = await dynamodb.send(command);
    console.log("RESULT", result);
    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items;
  } catch (error) {
    console.error(
      `Error fetching reservation for space ${spaceNumber}:`,
      error
    );
    throw error;
  }
};
