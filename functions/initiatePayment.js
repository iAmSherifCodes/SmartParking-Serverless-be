const axios = require('axios');
const {
    DynamoDBDocumentClient,
    GetCommand
  } = require("@aws-sdk/lib-dynamodb");
  const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const dynamodb = DynamoDBDocumentClient.from(new DynamoDB());
const { PAYMENT_HISTORY_TABLE: paymentHistoryTable, FLW_SECRET_KEY } = process.env;

const fetchPaymentDetails = async (paymentId) => {
    const params = {
        TableName: paymentHistoryTable,
        Key: { id: paymentId },
    };

    const { Item } = await dynamodb.send(new GetCommand(params));
    return Item;
};

// const updatePaymentStatus = async (paymentId, status) => {
//     const params = {
//         TableName: paymentHistoryTable,
//         Key: { id: paymentId },
//         UpdateExpression: "SET #paymentStatus = :status",
//         ExpressionAttributeNames: {
//             "#paymentStatus": "paymentStatus",
//         },
//         ExpressionAttributeValues: {
//             ":status": status,
//         },
//     };

//     await dynamodb.send(new UpdateCommand(params));
// };

module.exports.handler = async (event, context) => {

    try {
        const body = parseEventBody(event.body);
        const paymentDetails = await fetchPaymentDetails(body.paymentId);

        const paymentData = {
            currency: "NGN",
            amount: paymentDetails.charge,
            customer:{
                email: paymentDetails.userDetails,
            },
            customizations: {
                title: 'Smart Parking Payment',
                description: "Please proceed to checkout"
              },
            tx_ref: context.awsRequestId.toString(),
            redirect_url: "www.google.com",
        };

        const response =  await axios.post(
            'https://api.flutterwave.com/v3/payments', paymentData, {
                headers: {
                  Authorization: `Bearer ${FLW_SECRET_KEY}`,
                  'Content-Type': 'application/json'
                }
              });

        if (response.data.status === 'success') {
            console.log('Card Charge Successful', response.data);
            // await updatePaymentStatus(body.paymentId, 'successful');
            return createResponse(200, response.data);
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

function createResponse(statusCode, body) {
    return {
        statusCode,
        body: JSON.stringify(body)
    };
}


// TODO
// secure apis
// SAVE KEYS TO SSM PARAMETER STORE and implement caching
// 