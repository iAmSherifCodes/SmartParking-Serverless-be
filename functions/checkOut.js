const {
  DynamoDBDocumentClient,
  GetCommand,
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
  const space = new GetCommand({
    TableName: tableName,
    Key: {
      space_no: spaceNumber,
    },
    ConsistentRead: true,
    ReturnConsumedCapacity: "NONE",
  });
  const result = await dynamodb.send(space);
  return result?.Item;
};
