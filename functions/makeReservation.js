const { parkingReservationSchema } = require("../utils/schemaValidation");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const getSpaceBySpaceNumber = require("../repositories/getSpaceBySpaceNumber");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const parkingSpaceTable = process.env.PARKING_SPACE_TABLE;
const reservationTable = process.env.RESERVATION_TABLE;
const uuid = require("uuid");

const reserveParkingSpace = async (req) => {
  try {

    // reserve time
    // check in time
    // space number
    const value = await parkingReservationSchema.validateAsync(req);

    const parsedStartTime = new Date(value.startTime);
    const parsedReservedTime = new Date(value.reserveTime);
    const currentDate = new Date();

    if (parsedStartTime < currentDate) {
      return {
        status: 400,
        success: false,
        message: "Start time cannot be in the past.",
      };
    }

    // Validation: End time must be within 2 days of start time
    const maxEndTime = new Date(parsedStartTime);
    maxEndTime.setDate(maxEndTime.getDate() + 2);

    if (parsedReservedTime > maxEndTime) {
      return {
        status: 400,
        success: false,
        message: "Check-in time cannot be more than 2 days from the start time.",
      };
    }

    // Check if the parking space is available in parking space table
    const spaceAvailability = await getSpaceBySpaceNumber(
      value.spaceNumber,
      parkingSpaceTable
    );
    if (!spaceAvailability.success) {
      return {
        status: 404,
        success: false,
        message: "Parking space is already reserved",
      };
    }
    // write the space number to its table (parking space table) as reserved
    await updateReserveTable(value.spaceNumber);
    // write to reservation table (user details, reserve time)
    const savedData = await saveReservation(value.spaceNumber, value.reserveTime, value.startTime);
    // return reservationId, spaceNumber, userId with successfull message sent to their email
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Parking space reserved successfully",
        data: value,
        value: savedData
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
      UpdateExpression: "SET is_reserved = :reserved",
      ExpressionAttributeValues: {
        ":reserved": true,
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

const saveReservation = async (spaceNumber, reserveTime, startTime) => {
  try {
    const params = {
      TableName: reservationTable,
      Item: {
        reservation_id: uuid.v6,
        space_no: spaceNumber,
        // user_id: event.userId,
        reserve_time: reserveTime,
        start_time: startTime,
        // end_time: event.endTime,
      },
    };
    const putCommand = new PutCommand(params);
    const res = await dynamodb.send(putCommand);
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

module.exports.handler = async (event, context) => {
  console.log("CONTEXGT OBJ: ", context);
  await reserveParkingSpace(event);
  };
