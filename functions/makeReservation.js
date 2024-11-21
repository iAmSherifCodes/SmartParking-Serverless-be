const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const moment = require("moment-timezone");
// const getSpaceBySpaceNumber = require("../repositories/getSpaceBySpaceNumber");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const parkingSpaceTable = process.env.PARKING_SPACE_TABLE;
const reservationTable = process.env.RESERVATION_TABLE;

const saveReservation = async (spaceNumber, reserveTime, id) => {
  const params = {
    TableName: reservationTable,

    Item: {
      id: id,
      space_no: spaceNumber,
      reserve_time: reserveTime,
    },
  };
  const putCommand = new PutCommand(params);
  const res = await dynamodb.send(putCommand);
  return { id, spaceNumber, reserveTime };
};

const updateReserveTable = async (spaceNumber) => {
  const params = {
    TableName: parkingSpaceTable,
    Key: {
      space_no: spaceNumber,
    },
    UpdateExpression: "SET #is_reserved = :reserved, #status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
      "#is_reserved": "reserved",
    },
    ExpressionAttributeValues: {
      ":reserved": true,
      ":status": "reserved",
    },
    ReturnValues: "ALL_NEW",
  };

  const updateCommand = new UpdateCommand(params);
  const res = await dynamodb.send(updateCommand);
  return res;
};

const getSpaceBySpaceNumber = async (spaceNumber) => {
  const space = new GetCommand({
    TableName: parkingSpaceTable,
    Key: {
      space_no: spaceNumber,
    },
    ConsistentRead: true,
    ReturnConsumedCapacity: "NONE",
  });
  const result = await dynamodb.send(space);
  return result?.Item;
};

module.exports.handler = async (event, context) => {
  try {
    const { reserveTime, spaceNumber } = event.body;

    const currentTime = moment().tz("Africa/Lagos");
    const reservationTime = moment(reserveTime).tz("Africa/Lagos");

    if (reservationTime < currentTime){
      return {
        status: 400,
        success: false,
        message: "Start time cannot be in the past.",
      };
    }

    const spaceAvailability = await getSpaceBySpaceNumber(spaceNumber);

    if (spaceAvailability.status !== "available") {
      return {
        statusCode: 404,
        body: "Parking space is already reserved",
      };
    }

    await updateReserveTable(spaceNumber);
    const res = await saveReservation(
      spaceNumber,
      reservationTime.format(),
      context.awsRequestId.toString()
    );
    // TODO
    //  - SEND RESERVATION DETAILS TO CUSTOMER USING SNS
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Parking space reserved successfully",
        data: res,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request body",
        error: error.message || error,
      }),
    };
  }
};
