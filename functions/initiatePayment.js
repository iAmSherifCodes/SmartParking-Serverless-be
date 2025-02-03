const axios = require('axios');
const {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());
const { PAYMENT_HISTORY_TABLE: paymentHistoryTable, FLW_SECRET_KEY } = process.env;


const ALLOWED_ORIGINS = ['http://localhost:3002'];
const FLUTTERWAVE_API = 'https://api.flutterwave.com/v3/payments';
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

module.exports.handler = async (event, context) => {

    try {
        const body = parseEventBody(event.body);
        const paymentDetails = await fetchPaymentDetails(body.paymentId);

        if (paymentDetails.paymentStatus === 'successful'){
            return createResponse(400, { error: 'Payment already successful' });
        }

        const paymentData = {
            currency: "NGN",
            amount: paymentDetails.charge,
            customer: {
                email: paymentDetails.userDetails,
            },
            customizations: {
                title: 'Smart Parking Payment',
                description: "Please proceed to checkout"
            },
            tx_ref: context.awsRequestId.toString(),
            redirect_url: "www.google.com",
        };

        const response = await axios.post(
            FLUTTERWAVE_API, paymentData, {
            headers: {
                Authorization: `Bearer ${FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'success') {
            console.log('Card Charge Successful', response.data);
            await updatePaymentStatus(body.paymentId, 'successful');
            return createResponse(302, response.data, {
                'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
                'Access-Control-Allow-Credentials': true,
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
                Location: response.data.data.link
            });
        } else {
            console.log('Card Charge Failed', response);
            throw new Error(response);
        }
    } catch (error) {
        console.error('Error:', error);
        return createResponse(400, { error: error.message });
    }
};

function parseEventBody(body) {
    return typeof body === "string" ? JSON.parse(body) : body;
}

function createResponse(statusCode, body, headers) {
    if (!headers) {
        headers = {
            'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        }
    };

return {
    statusCode,
    body: JSON.stringify(body),
    headers
};
}


// TODO
// secure apis
// SAVE KEYS TO SSM PARAMETER STORE and implement caching
// 