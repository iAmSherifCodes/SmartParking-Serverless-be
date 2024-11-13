const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
// const getSpaceBySpaceNumber = require("../repositories/getSpaceBySpaceNumber");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const parkingSpaceTable = process.env.PARKING_SPACE_TABLE;
const reservationTable = process.env.RESERVATION_TABLE;
const crypto = require('crypto')


const generateId = () => {
  const length = 7;
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/\//g, "_")
    .replace(/\+/g, "-")
    .slice(0, length);
};

const saveReservation = async (spaceNumber, reserveTime) => {
  try {
    const v4 = generateId();
    const params = {
      TableName: reservationTable,
      Item: {
        reservation_id: v4,
        space_no: spaceNumber,
        // user_id: event.userId,
        reserve_time: reserveTime,
        // start_time: startTime,
        // end_time: event.endTime,
      },
    };
    const putCommand = new PutCommand(params);
    const res = await dynamodb.send(putCommand);
    console.log("SAVED DATA", res)
    // return ({
    //   data: res
    // })
  } catch (error) {
    console.log(error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request body",
        error: error.message || error,
      }),
    };
  }
};


const reserveParkingSpace = async (spaceNumber, reserveTime) => {
  try {
    // Check if the parking space is available in parking space table
    const spaceAvailability = await getSpaceBySpaceNumber(
      spaceNumber,
      parkingSpaceTable
    );
    if (!spaceAvailability.success) {
      return {
        statusCode: 404,
        body: "Parking space is already reserved",
      };
    }
    // write the space number to its table (parking space table) as reserved
    await updateReserveTable(spaceNumber);
    // write to reservation table (user details, reserve time)
    await saveReservation(
      spaceNumber,
      reserveTime
    );
    // return reservationId, spaceNumber, userId with successfull message sent to their email
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Parking space reserved successfully",
        data: value,
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

const updateReserveTable = async (spaceNumber) => {
  try {
    const params = {
      TableName: parkingSpaceTable,
      Key: {
        space_no: spaceNumber,
      },
      UpdateExpression: "SET is_reserved = :reserved, status = :available",
      ExpressionAttributeValues: {
        ":reserved": true,
        ":available": "reserved"
      },
      ReturnValues: "ALL_NEW",
    };

    const updateCommand = new UpdateCommand(params);
    const res = await dynamodb.send(updateCommand);
  } catch (error) {
    console.log(error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request body",
        error: error.message || error,
      }),
    };
  }
};

const getSpaceBySpaceNumber = async (spaceNumber, tableName) => {
  const space = new GetCommand({
      TableName: tableName,
      Key: {
          space_no: spaceNumber,
      },
      ConsistentRead: true,
      ReturnConsumedCapacity: "NONE",
  })
  console.log("Space availability", space)
  try {
      const result = await dynamodb.send(space);
      return {
        statusCode: 200,
          message: "Parking space is available.",
          body: result.Item
      };
  } catch (error) {
      console.error("Error fetching space:", error);
      return {
          statusCode: 400,
          body: JSON.stringify({ message: "Invalid request body", error: error.message || error }),
      };
  }
}



module.exports.handler = async (event, context) => {
  console.log("CONTEXGT OBJ: ", context);
  // reserve time
  // check in time
  // space number
  // const value = await parkingReservationSchema.validateAsync(event.body);
  const value = JSON.parse(event.body);
  console.log("VALUE: ", value);
  // const parsedStartTime = new Date(value.startTime);
  const parsedReservedTime = new Date(value.reserveTime);
  const currentDate = new Date();

  if (parsedReservedTime < currentDate) {
    return {
      status: 400,
      success: false,
      message: "Start time cannot be in the past.",
    };
  }

  // Validation: End time must be within 2 days of start time
  const maxEndTime = new Date();
  maxEndTime.setDate(maxEndTime.getDate() + 2);

  if (parsedReservedTime > maxEndTime) {
    return {
      status: 400,
      success: false,
      message: "Check-in time cannot be more than 2 days from the start time.",
    };
  }

  const data = await reserveParkingSpace(value.spaceNumber, value.reserveTime);
  return({
    statusCode: 200,
    body: JSON.stringify({
      message: "Parking space reserved successfully",
      data: data.body.message,
    }),
  })
};

