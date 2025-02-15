const {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());
const { PAYMENT_HISTORY_TABLE: paymentHistoryTable, RESERVATION_HISTORY_TABLE: reservationHistoryTable } = process.env;


const ALLOWED_ORIGINS = ['http://localhost:3002'];
const fetchPaymentDetails = async (paymentId) => {
    const params = {
        TableName: paymentHistoryTable,
        Key: { id: paymentId },
    };

    const { Item } = await dynamodb.send(new GetCommand(params));
    return Item;
};

const updatePaymentStatus = async (paymentId, status) => {
    try {
        const params = {
            TableName: paymentHistoryTable,
            Key: { id: paymentId },
            UpdateExpression: "SET #paymentStatus = :status",
            ExpressionAttributeNames: {
                "#paymentStatus": "paymentStatus",
            },
            ExpressionAttributeValues: {
                ":status": status,
            },
        };

        await dynamodb.send(new UpdateCommand(params));
    } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }

};

// data in event
// update transaction db with data response
// if transaction is successful notify user and update the db

module.exports.handler = async (event, context) => {
    const secretHash = "123456";
    const signature = event.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
        return createResponse(401, { message: "Unauthorized" })
    }
    const { event: events, data } = parseEventBody(event.body);
    try {

        if (events === "charge.completed") {
            const paymentDetails = await fetchPaymentDetails(data.tx_ref);
            if(!paymentDetails){
                throw new Error("Payment details not found");
            }
            await updatePaymentStatus(data.tx_ref, data.status);
            if (data.status === "successful") {
                // send notification to user
                return createResponse(200, event.body);
            }
        } else {

            return createResponse(200, event.body);
            // update paymenthistory with processor_response
            throw new Error("Charge Not Processed")
        }
    } catch (error) {
        console.error('Error:', error);
        return createResponse(400, { error: error.message });
    }
};

function parseEventBody(body) {
    return typeof body === "string" ? JSON.parse(body) : body;
}

function createResponse(statusCode, body) {
    return {
        statusCode,
        body: JSON.stringify(body),
        headers: {
            'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
    };
}


// TODO
// secure apis
// SAVE KEYS TO SSM PARAMETER STORE and implement caching
// 