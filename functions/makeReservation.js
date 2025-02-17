const {
  DynamoDBDocumentClient,
  // UpdateCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
// const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
// const sesClient = new SESClient({ region: "us-east-1" });
const moment = require("moment-timezone");

const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());
const {
  PARKING_SPACE_TABLE: parkingSpaceTable,
  PAYMENT_HISTORY_TABLE: paymentHistoryTable,
  // RESERVATION_TABLE: reservationTable,
  // VERIFIED_EMAIL: verifiedEmail,
  // COMPANY_NAME:companyName
} = process.env;


const TIMEZONE = "Africa/Lagos";
const RATE_PER_10_MINS = 105.99;
const TEN_MINUTES_IN_MS = 10 * 60 * 1000;


class ParkingService {
  // static async saveReservation(spaceNumber, reserveTime, id, email) {
  //   const params = {
  //     TableName: reservationTable,
  //     Item: { id, space_no: spaceNumber, reserve_time: reserveTime, userEmail: email }
  //   };

  //   await dynamodb.send(new PutCommand(params));
  //   return { id, spaceNumber, reserveTime, email };
  // }

  static async saveBill(spaceNumber, currentTime, checkoutTime, charge, id, email) {
    const params = {
      TableName: paymentHistoryTable,
      Item: {
        id,
        userEmail: email,
        space_no: spaceNumber,
        reserve_time: currentTime,
        charge,
        checkout_time: checkoutTime,
        paymentStatus: "unprocessed",
      },
    };

    await dynamodb.send(new PutCommand(params));
    return { id };
  }

  // static async updateReserveTable(spaceNumber, date) {
  //   const params = {
  //     TableName: parkingSpaceTable,
  //     Key: { space_no: spaceNumber },
  //     UpdateExpression: "SET #is_reserved = :reserved, #reserved_date = :date",
  //     ExpressionAttributeNames: {
  //       "#is_reserved": "reserved",
  //       "#reserved_date": "date",
  //     },
  //     ExpressionAttributeValues: {
  //       ":reserved": true,
  //       ":date": date
  //     },
  //     ReturnValues: "ALL_NEW"
  //   };

  //   return dynamodb.send(new UpdateCommand(params));
  // }

  static async calculateCharge(currentTime, checkoutTime) {
    const reservationDateTime = new Date(currentTime);
    const checkoutDateTime = new Date(checkoutTime);
    const timeDifference = checkoutDateTime - reservationDateTime;
    if (timeDifference < 0) {
      return RATE_PER_10_MINS;
    } else if (timeDifference < TEN_MINUTES_IN_MS) {
      return RATE_PER_10_MINS;
    } else {
      const numberOf30Mins = Math.round(timeDifference / TEN_MINUTES_IN_MS);
      return numberOf30Mins === 0 ? RATE_PER_10_MINS : numberOf30Mins * RATE_PER_10_MINS;
    }
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

const validateReservationTime = (checkoutTime, currentTime) => {
  if (checkoutTime < currentTime) {
    throw new Error("Start time cannot be in the past.");
  }

  if (checkoutTime.diff(currentTime, 'hours') > 24) {
    throw new Error("Reservation time cannot exceed 24 hours from now.");
  }
};

module.exports.handler = async (event, context) => {
  try {

    const { checkoutTime, spaceNumber, email } = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    if (!email) {
      return createResponse(400, {
        success: false,
        message: "Email is required"
      });
    }

    const currentTime = moment().tz(TIMEZONE);
    const formattedCheckoutTime = moment(checkoutTime).tz(TIMEZONE);
    validateReservationTime(formattedCheckoutTime, currentTime);

    // Check space availability
    const space = await ParkingService.getSpaceBySpaceNumber(spaceNumber);
    if (!space || space.reserved === true) {
      return createResponse(404, {
        success: false,
        message: `Parking space ${spaceNumber} is not available`
      });
    }

    // await ParkingService.updateReserveTable(spaceNumber, reserveTime);
    // const reservation = await ParkingService.saveReservation(
    //   spaceNumber,
    //   formattedCheckoutTime.format(),
    //   context.awsRequestId.toString(),
    //   email
    // );

    // send email to user
    // const emailParams = {
    //   Destination: {
    //     ToAddresses: [email]
    //   },
    //   Message: {
    //     Body: {
    //       Text: {
    //         Data: `Your parking space ${spaceNumber} has been reserved for ${reservationTime.format()}`
    //       }
    //     },
    //     Subject: {
    //       Data: `${companyName}: Parking Space Reservation`
    //     }
    //   },
    //   Source: verifiedEmail
    // };
    // await sesClient.send(new SendEmailCommand(emailParams));


    const charge = await ParkingService.calculateCharge(currentTime, formattedCheckoutTime);
    const { id } = await ParkingService.saveBill(
      spaceNumber,
      currentTime.format(),
      formattedCheckoutTime.format(),
      charge,
      context.awsRequestId.toString(),
      email
    );
    return createResponse(200, {
      success: true,
      message: "Proceed to payment",
      data: {
        charge,
        paymentId: id
      }
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
