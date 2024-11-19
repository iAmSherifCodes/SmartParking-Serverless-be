const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

const tableName = process.env.RESERVATION_TABLE;
const paymentHistoryTable = process.env.PAYMENT_HISTORY_TABLE;
const parkingSpaceTable = process.env.PARKING_SPACE_TABLE;

let ratePer30 = 500;

module.exports.handler = async (event, context) => {
  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
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
      const reserveTime = new Date(reservation.reserve_time).getHours();
      const currentTime = new Date().getMinutes();
      const timeDifference = currentTime - reserveTime;
      const numberOf30Mins = Math.floor(timeDifference / (30 * 60 * 1000));
      let charge = numberOf30Mins * ratePer30;

      const {savedBill, id} = await saveBill(reservation, charge, context);
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
const saveBill = async (reservation, charge, context) => {
  try {
    const id = context.awsRequestId;
    const savedBill = await dynamodb.send(
      new PutCommand({
        TableName: paymentHistoryTable,
        Item: {
          id: id,
          space_no: reservation.space_no,
          reserve_time: reservation.reserve_time,
          charge,
          checkout_time: currentTime.toISOString(),
          userDetails: reservation.userDetails,
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
