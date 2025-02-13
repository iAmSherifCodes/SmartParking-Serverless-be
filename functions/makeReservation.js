const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const moment = require("moment-timezone");

const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());
const { PARKING_SPACE_TABLE: parkingSpaceTable, RESERVATION_TABLE: reservationTable } = process.env;


const TIMEZONE = "Africa/Lagos";
const STATUS = {
  AVAILABLE: "available",
  RESERVED: "reserved"
};


class ParkingService {
  static async saveReservation(spaceNumber, reserveTime, id, email) {
    const params = {
      TableName: reservationTable,
      Item: { id, space_no: spaceNumber, reserve_time: reserveTime, userEmail: email }
    };

    await dynamodb.send(new PutCommand(params));
    return { id, spaceNumber, reserveTime, email };
  }

  static async updateReserveTable(spaceNumber) {
    const params = {
      TableName: parkingSpaceTable,
      Key: { space_no: spaceNumber },
      UpdateExpression: "SET #is_reserved = :reserved, #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
        "#is_reserved": "reserved"
      },
      ExpressionAttributeValues: {
        ":reserved": true,
        ":status": STATUS.RESERVED
      },
      ReturnValues: "ALL_NEW"
    };

    return dynamodb.send(new UpdateCommand(params));
  }

  static async getSpaceBySpaceNumber(spaceNumber) {
    const command = new GetCommand({
      TableName: parkingSpaceTable,
      Key: { space_no: spaceNumber },
      ConsistentRead: true
    });

    const { Item } = await dynamodb.send(command);
    return Item;
  }
}

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Access-Control-Allow-Origin': 'http://localhost:3002',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  }
});

const validateReservationTime = (reservationTime, currentTime) => {
  if (reservationTime < currentTime) {
    throw new Error("Start time cannot be in the past.");
  }
};

module.exports.handler = async (event, context) => {
  try {

    const { reserveTime, spaceNumber, email } = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    if(!email){
      return createResponse(400, {
        success: false,
        message: "Email is required"
      });
    }

    const currentTime = moment().tz(TIMEZONE);
    const reservationTime = moment(reserveTime).tz(TIMEZONE);
    validateReservationTime(reservationTime, currentTime);

    // Check space availability
    const space = await ParkingService.getSpaceBySpaceNumber(spaceNumber);
    if (!space || space.status !== STATUS.AVAILABLE) {
      return createResponse(404, {
        success: false,
        message: `Parking space ${spaceNumber} is not available`
      });
    }

    await ParkingService.updateReserveTable(spaceNumber);
    const reservation = await ParkingService.saveReservation(
      spaceNumber,
      reservationTime.format(),
      context.awsRequestId.toString(),
      email
    );

    return createResponse(200, {
      success: true,
      message: "Parking space reserved successfully",
      data: reservation
    });

  } catch (error) {
    console.error('Reservation error:', error);
    return createResponse(400, {
      success: false,
      message: "Invalid request",
      error: error.message
    });
  }
};
