const Flutterwave = require('flutterwave-node-v3');
const { initiatePaymentSchema } = require("../utils/initiatePaymentSchema");

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

module.exports.handler = async (event, context) => {
    try {
        const body = parseEventBody(event.body);
        const { value } = await initiatePaymentSchema.validateAsync(body);

        const paymentData = {
            currency: "NGN",
            amount: value.amount,
            customer:{
                email: value.customer.email,
                phonenumber: value.customer.phone_number,
                fullname: value.customer.fullname,
            },
            customizations: {
                title: 'Flutterwave Standard Payment'
              },
            tx_ref: context.awsRequestId.toString(),
            redirect_url: "www.google.com",
        };

        const response = await flw.Card.charge_card(paymentData);

        if (response.status === 'success') {
            console.log('Card Charge Successful', response.data);
            return createResponse(200, response.data);
        } else {
            console.log('Card Charge Failed', response);
            throw new Error(response.message);
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
