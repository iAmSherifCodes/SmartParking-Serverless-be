const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const moment = require("moment-timezone");

const tableName = process.env.RESERVATION_TABLE;
const paymentHistoryTable = process.env.PAYMENT_HISTORY_TABLE;
const parkingSpaceTable = process.env.PARKING_SPACE_TABLE;

let ratePer30 = 500;

module.exports.handler = async (event, context) => {
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { spaceNumber } = body;

    if (!spaceNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "spaceNumber is required",
        }),
      };
    }

    const reservation = await getReservationBySpaceNumber(spaceNumber);
    if (reservation) {
      const checkoutTime = moment().tz("Africa/Lagos");
      const unmarshall_time = unmarshall({time: reservation.reserve_time});
      const reserve_time =  moment(unmarshall_time.time).tz("Africa/Lagos");
    
      const numberOf30Mins = get30minsFromReservationAndCheckoutTime(
        reserve_time,
        checkoutTime  
      );

      let charge = numberOf30Mins * ratePer30;

      const {savedBill, id} = await saveBill(reservation.space_no, reserve_time, checkoutTime.format(), charge, context);
      // send payment to user
      // const publishParams = {
      //   Message: `Your parking bill is ${charge}`,
      //   PhoneNumber: reservation.userDetails.phone,
      //   MessageAttributes: {
      //     "AWS.SNS.SMS.SenderID": {
      //       DataType: "String",
      //       StringValue: "ParkingApp",
      //     },
      //   },
      // };
      // const publishCommand = new PublishCommand(publishParams);

      if (savedBill) {
        await deleteReservation(reservation)
        await updateSpaceStatus(reservation.space_no, "available", parkingSpaceTable);

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Please Proceed to Payment",
            reservation,
            charge,
            paymentId: id,
          }),
        };
      }
    }
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

const get30minsFromReservationAndCheckoutTime = (reserveTime, checkoutTime) => {
  const timeDifference = checkoutTime.valueOf() - reserveTime.valueOf();
  const numberOf30Mins = Math.floor(timeDifference / (30 * 60 * 1000));
  return numberOf30Mins;
};
const updateSpaceStatus = async (spaceNumber, status, table) => {
  try {
    const updateParams = {
      TableName: table,
      Key: {
        space_no: spaceNumber,
      },
      UpdateExpression: "set status = :status",
      ExpressionAttributeValues: {
        ":status": status,
      },
    };
    await dynamodb.send(new PutCommand(updateParams));
  } catch (error) {
    console.error("Error updating space status:", error);
    throw error;
  }
};
const deleteReservation = async (reservation) => {
  try{
      const deleteParams = {
    TableName: tableName,
    Key: {
      id: reservation.id,
    },
  };
  await dynamodb.send(new DeleteCommand(deleteParams));
  }catch(error){
    console.error("Error deleting reservation:", error);
    throw error;
  }

};
const saveBill = async (space_no, reserve_time, checkout_time, charge, context) => {
  try {
    const id = context.awsRequestId;
    const savedBill = await dynamodb.send(
      new PutCommand({
        TableName: paymentHistoryTable,
        Item: {
          id: id,
          space_no,
          reserve_time: marshall({time: reserve_time}),
          charge,
          checkout_time: checkout_time,
          userDetails: "user@email.com",
        },
      })
    );
    return {savedBill, id};
  } catch (error) {
    console.error("Error saving bill:", error);
    throw error;
  }
};

const getReservationBySpaceNumber = async (spaceNumber) => {
  try {
    const params = {
      TableName: tableName,
      FilterExpression: "space_no = :space_no",
      ExpressionAttributeValues: {
        ":space_no": spaceNumber,
      },
    };
    const command = new ScanCommand(params);
    const result = await dynamodb.send(command);
    if (!result.Items || result.Items.length === 0) {
      return {
        message: `No reservation for ${spaceNumber}`
      };
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
