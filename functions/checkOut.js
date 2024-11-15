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
    const spaceNumber = event.body;
    
    const reservation = await getReservationBySpaceNumber(spaceNumber);
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
  try {
    const params = {
      TableName: tableName,
      FilterExpression: '#space_no = :spaceNumber',
      ExpressionAttributeNames: {
        '#space_no': 'space_no',
      },
      ExpressionAttributeValues: {
        ':spaceNumber': spaceNumber,
      },
    };


    // {
    //   TableName: tableName,
    //   FilterExpression: "space_no = :space_no",
    //   ExpressionAttributeValues: {
    //     ":space_no": spaceNumber,
    //   },
    // };
    const command = new ScanCommand(params);
    const result = await dynamodb.send(command);

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0];
  } catch (error) {
    console.error(
      `Error fetching reservation for space ${spaceNumber}:`,
      error
    );
    throw error;
  }
};
