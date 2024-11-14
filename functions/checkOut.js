const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
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
    try {
        const command = new ScanCommand(params);
        const result = await dynamodb.send(command);
        
        if (!result.Items || result.Items.length === 0) {
            return null;
        }
        
        return result.Items[0];
    } catch (error) {
        console.error(`Error fetching reservation for space ${spaceNumber}:`, error);
        throw error;
    }
};



// TO DO
//  - CHECK OUT FUCNTION
// - SPACE NUMBER

// CHECK SPACEnUMBER IN RESERVAION TABLE
// GET THE RESERVE TIME, SUBTRACT DATE.NOW FROM RESERVE TIME
// GET THE HOUR AND CHARGE PER 30 MINS RATE
// SAVE TO BILL-TABLE (AMOUNT, SPACE NUMBER, RESERVE TIME, CHECK OUT TIME, USER DETAILS)

// RETURN THE AMOUNT TO PAY, PAYMENT ID



// BUG TO FIX 

// DEBUG SCAN COMMAND TO RETURN FOUND DATA