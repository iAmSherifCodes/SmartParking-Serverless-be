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

const savePayment = async (spaceNumber, reserveTime, checkoutTime, charge, id, email, paymentStatus, flutterwavePaymentId) => {
    const params = {
        TableName: paymentHistoryTable,
        Item: {
            id,
            email,
            space_no: spaceNumber,
            reserve_time: reserveTime,
            charge,
            flutterwavePaymentId,
            checkout_time: checkoutTime,
            paymentStatus
        },
    };

    await dynamodb.send(new PutCommand(params));
    return { id };
}

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

const updateReservationHistoryTable = async (id, paymentStatus) => {
    const params = {
        TableName: reservationHistoryTable,
        Key: { id: id },
        UpdateExpression: "SET #paymentStatus = :status",
        ExpressionAttributeNames: {
            "#paymentStatus": "status"
        },
        ExpressionAttributeValues: {
            ":status": paymentStatus,
        },
    };

    await dynamodb.send(new UpdateCommand(params));
}

const saveReservationHistory = async (id, paymentId, spaceNumber, checkoutTime, reserve_time, charge, email, paymentStatus) => {
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


// data in event
// update transaction db with data response
// if transaction is successful notify user and update the db

module.exports.handler = async (event, context) => {

    try {

        const { event, data } = parseEventBody(event.body);
        

        if (event === "charge.completed") {
            const paymentDetails = await fetchPaymentDetails(data.tx_ref);
            const { email } = data.customer;
            await updateReservationHistoryTable(data.tx_ref, data.status);
            await updatePaymentStatus(data.tx_ref, data.status);
            if (data.status === "successful") {
                // save payment status to paymwnt and reservation history db
                // update trx db
                // send notification to user
                return createResponse(200, event.body);
            }

            // const transactionEvent = {
            //     event: "charge.completed",
            //     data: {
            //         id: 408136545,
            //         txRef: "Links-618617883594",
            //         flwRef: "NETFLIX/SM31570678271",
            //         deviceFingerprint: "7852b6c97d67edce50a5f1e540719e39",
            //         amount: 100000,
            //         currency: "NGN",
            //         chargedAmount: 100000,
            //         processorResponse: "invalid token supplied",
            //         authModel: "PIN",
            //         ip: "72.140.222.142",
            //         narration: "CARD Transaction",
            //         status: "failed",
            //         paymentType: "card",
            //         createdAt: "2021-04-16T14:52:37.000Z",
            //         accountId: 82913,
            //         customer: {
            //             id: 255128611,
            //             name: "a a",
            //             phoneNumber: null,
            //             email: "a@b.com",
            //             createdAt: "2021-04-16T14:52:37.000Z"
            //         },
            //         card: {
            //             first6Digits: "536613",
            //             last4Digits: "8816",
            //             issuer: "MASTERCARD ACCESS BANK PLC  CREDIT",
            //             country: "NG",
            //             type: "MASTERCARD",
            //             expiry: "12/21"
            //         }
            //     },
            //     eventType: "CARD_TRANSACTION"
            // };

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
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        }
    };
}


// TODO
// secure apis
// SAVE KEYS TO SSM PARAMETER STORE and implement caching
// 