const Joi = require('joi');
const logger = require('../utils/logger');
const ResponseBuilder = require('../utils/response');
const { validateSchema } = require('../utils/schemaValidation');
const ParkingService = require('../services/parkingService');

const parkingService = new ParkingService();

// Schema for checkout request
const checkoutSchema = Joi.object({
  reservationId: Joi.string()
    .required()
    .messages({
      'string.empty': 'Reservation ID is required',
    }),
});

module.exports.handler = async (event, context) => {
  try {
    logger.info('Processing checkout request', { 
      requestId: context.awsRequestId 
    });

    // Parse and validate request body
    const body = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    const validatedData = validateSchema(checkoutSchema, body);

    // Process checkout
    const result = await parkingService.checkOut(validatedData.reservationId);

    logger.info('Checkout processed successfully', { 
      requestId: context.awsRequestId,
      reservationId: validatedData.reservationId,
      spaceNumber: result.space_no 
    });

    return ResponseBuilder.success(result, 'Checkout completed successfully');

  } catch (error) {
    logger.error('Checkout error', {
      requestId: context.awsRequestId,
      error: error.message,
      stack: error.stack,
    });

    return ResponseBuilder.error(error);
  }
};
