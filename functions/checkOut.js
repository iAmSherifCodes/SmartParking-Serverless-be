const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
// const getSpaceBySpaceNumber = require("../repositories/getSpaceBySpaceNumber");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

const tableName = process.env.RESERVATION_TABLE;
module.exports.handler = async (event, context) => {
  try {
    const spaceNumber = event.body;

    // check spaceNumber in reservation table
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
    const params = {
        TableName: tableName,
        FilterExpression: "space_no = :space_no",
        ExpressionAttributeValues: {
          ":space_no": spaceNumber
        }
      };
    
      const command = new ScanCommand(params);
      const result = await dynamodb.send(command);
      return result.Items[0];
};
