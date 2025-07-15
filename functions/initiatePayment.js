const logger = require('../utils/logger');
const ResponseBuilder = require('../utils/response');
const { validateSchema, schemas } = require('../utils/schemaValidation');
const ParkingService = require('../services/parkingService');
const PaymentService = require('../services/paymentService');
const config = require('../config/environment');

const parkingService = new ParkingService();
const paymentService = new PaymentService();

module.exports.handler = async (event, context) => {
  try {
    logger.info('Processing payment initiation request', { 
      requestId: context.awsRequestId 
    });

    // Parse and validate request body
    const body = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    const validatedData = validateSchema(schemas.initiatePayment, body);

    // Process payment initiation
    const paymentDetails = await parkingService.processPayment(validatedData.paymentId);

    // Initiate payment with Flutterwave
    const paymentResult = await paymentService.initiatePayment({
      amount: paymentDetails.charge,
      email: paymentDetails.userEmail,
      paymentId: validatedData.paymentId,
      redirectUrl: config.cors.allowedOrigins[0],
    });

    logger.info('Payment initiation successful', { 
      requestId: context.awsRequestId,
      paymentId: validatedData.paymentId,
      paymentLink: paymentResult.paymentLink 
    });

    return ResponseBuilder.success({
      paymentLink: paymentResult.paymentLink,
      reference: paymentResult.reference,
      amount: paymentDetails.charge,
    }, 'Payment initiated successfully');

  } catch (error) {
    logger.error('Payment initiation error', {
      requestId: context.awsRequestId,
      error: error.message,
      stack: error.stack,
    });

    return ResponseBuilder.error(error);
  }
};