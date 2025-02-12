const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const moment = require("moment-timezone");

const TIMEZONE = "Africa/Lagos";
const RATE_PER_30_MINS = 305.99;
const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;
const ALLOWED_ORIGINS = ['http://localhost:3002'];

const {
  RESERVATION_TABLE: reservationTable,
  PAYMENT_HISTORY_TABLE: paymentHistoryTable,
  PARKING_SPACE_TABLE: parkingSpaceTable,
  RESERVATION_HISTORY_TABLE: reservationHistoryTable
} = process.env;

const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST'
  }
});

class ParkingService {
  static async getReservationBySpaceNumber(spaceNumber) {
    const params = {
      TableName: reservationTable,
      FilterExpression: "space_no = :space_no",
      ExpressionAttributeValues: {
        ":space_no": spaceNumber,
      },
    };

    const { Items } = await dynamodb.send(new ScanCommand(params));
    return Items?.[0];
  }

  static async saveReservationHistory(id, paymentId, spaceNumber, checkoutTime, reserve_time, charge, email, paymentStatus) {
    const params = {
      TableName: reservationHistoryTable,
      Item: {
        id,
        email,
        paymentId,
        space_no: spaceNumber,
        reserve_time,
        charge,
        checkout_time: checkoutTime,
        paymentStatus,
        userDetails: email
      },
    };

    await dynamodb.send(new PutCommand(params));
    return { id: reservation.id };

  }



  static calculateCharge(reserveTime, checkoutTime) {
    const reservationDateTime = new Date(reserveTime);
    const checkoutDateTime = new Date(checkoutTime);
    const timeDifference = checkoutDateTime - reservationDateTime;
    if (timeDifference < 0) {
      return RATE_PER_30_MINS;
    } else if (timeDifference < THIRTY_MINUTES_IN_MS) {
      return RATE_PER_30_MINS;
    } else {
      const numberOf30Mins = Math.floor(timeDifference / THIRTY_MINUTES_IN_MS);
      return numberOf30Mins === 0 ? RATE_PER_30_MINS : numberOf30Mins * RATE_PER_30_MINS;
    }
  }

  static async saveBill(spaceNumber, reserveTime, checkoutTime, charge, id, email) {
    const params = {
      TableName: paymentHistoryTable,
      Item: {
        id,
        email,
        space_no: spaceNumber,
        reserve_time: reserveTime,
        charge,
        checkout_time: checkoutTime,
        paymentStatus: "unsuccessful",
      },
    };

    await dynamodb.send(new PutCommand(params));
    return { id };
  }

  static async updateSpaceStatus(spaceNumber, isReserved = false) {
    const params = {
      TableName: parkingSpaceTable,
      Key: { space_no: spaceNumber },
      UpdateExpression: "SET #is_reserved = :reserved, #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
        "#is_reserved": "reserved",
      },
      ExpressionAttributeValues: {
        ":reserved": isReserved,
        ":status": isReserved ? "reserved" : "available",
      },
    };

    await dynamodb.send(new UpdateCommand(params));
  }

  static async deleteReservation(reservationId) {
    const params = {
      TableName: reservationTable,
      Key: { id: reservationId },
    };

    await dynamodb.send(new DeleteCommand(params));
  }

  static async processCheckout(reservation, checkoutTime, requestId, email) {
    const reserveTime = moment(reservation.reserve_time).tz(TIMEZONE);
    const charge = this.calculateCharge(reserveTime, checkoutTime);

    const { id } = await this.saveBill(
      reservation.space_no,
      reserveTime.format(),
      checkoutTime.format(),
      charge,
      requestId,
      email
    );

    await Promise.all([
      this.deleteReservation(reservation.id),
      this.updateSpaceStatus(reservation.space_no, false),
    ]);

    return { charge, paymentId: id };
  }
}

module.exports.handler = async (event, context) => {
  try {
    const { spaceNumber } = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    if (!spaceNumber) {
      return createResponse(400, {
        success: false,
        message: "spaceNumber is required",
      });
    }

    const reservation = await ParkingService.getReservationBySpaceNumber(spaceNumber);

    if (!reservation) {
      return createResponse(404, {
        success: false,
        message: `No reservation found for space ${spaceNumber}`,
      });
    }

    const checkoutTime = moment().tz(TIMEZONE);
    const generatedId = context.awsRequestId.toString();

    const { charge, paymentId } = await ParkingService.processCheckout(
      reservation,
      checkoutTime,
      generatedId,
      reservation.email
    );

    await ParkingService.saveReservationHistory(
      generatedId,
      paymentId,
      spaceNumber,
      checkoutTime,
      reservation.reserve_time,
      charge,
      reservation.space_no,
      reservation.email,
      "Uncompleted")

    return createResponse(200, {
      success: true,
      message: "Please Proceed to Payment",
      data: {
        reservation,
        charge,
        paymentId,
      },
    });

  } catch (error) {
    console.error("Checkout error:", error);
    return createResponse(500, {
      success: false,
      message: "Internal server error",
      error: error.message || "Unknown error occurred",
    });
  }
};
