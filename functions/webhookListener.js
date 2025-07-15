const logger = require('../utils/logger');
const ResponseBuilder = require('../utils/response');
const { validateSchema, schemas } = require('../utils/schemaValidation');
const ParkingService = require('../services/parkingService');
const PaymentService = require('../services/paymentService');

const parkingService = new ParkingService();
const paymentService = new PaymentService();

// Webhook secret for verification (should be stored in environment variables)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '123456';

module.exports.handler = async (event, context) => {
  try {
    logger.info('Processing webhook request', { 
      requestId: context.awsRequestId 
    });

    // Verify webhook signature
    const signature = event.headers["verif-hash"] || event.headers["Verif-Hash"];
    
    if (!signature || signature !== WEBHOOK_SECRET) {
      logger.warn('Unauthorized webhook request', { 
        requestId: context.awsRequestId,
        signature: signature ? 'present' : 'missing' 
      });
      return ResponseBuilder.error(new Error('Unauthorized'), 401);
    }

    // Parse and validate webhook payload
    const body = JSON.parse(
      typeof event.body === "string" ? event.body : JSON.stringify(event.body)
    );

    const validatedData = validateSchema(schemas.webhook, body);
    const { event: eventType, data } = validatedData;

    logger.info('Webhook event received', { 
      requestId: context.awsRequestId,
      eventType,
      transactionId: data.id,
      reference: data.tx_ref 
    });

    // Handle different webhook events
    switch (eventType) {
      case 'charge.completed':
        return await handleChargeCompleted(data, context.awsRequestId);
      
      case 'charge.failed':
        return await handleChargeFailed(data, context.awsRequestId);
      
      default:
        logger.info('Unhandled webhook event type', { 
          requestId: context.awsRequestId,
          eventType 
        });
        return ResponseBuilder.success(null, 'Webhook received');
    }

  } catch (error) {
    logger.error('Webhook processing error', {
      requestId: context.awsRequestId,
      error: error.message,
      stack: error.stack,
    });

    return ResponseBuilder.error(error);
  }
};

async function handleChargeCompleted(data, requestId) {
  try {
    logger.info('Processing charge completed webhook', { 
      requestId,
      transactionId: data.id,
      reference: data.tx_ref 
    });

    // Verify payment with Flutterwave
    const verificationResult = await paymentService.verifyPayment(data.id);
    
    if (verificationResult.status === 'successful') {
      // Confirm payment and create reservation
      const reservation = await parkingService.confirmPayment(data.tx_ref, {
        transactionId: data.id,
        paymentMethod: verificationResult.paymentMethod,
      });

      logger.info('Payment confirmed and reservation created', { 
        requestId,
        paymentId: data.tx_ref,
        reservationId: reservation.id,
        spaceNumber: reservation.space_no 
      });

      return ResponseBuilder.success({
        reservationId: reservation.id,
        spaceNumber: reservation.space_no,
        status: 'confirmed',
      }, 'Payment confirmed and reservation created');
    } else {
      logger.warn('Payment verification failed', { 
        requestId,
        transactionId: data.id,
        status: verificationResult.status 
      });

      return ResponseBuilder.success({
        status: 'verification_failed',
        message: verificationResult.message,
      }, 'Payment verification failed');
    }

  } catch (error) {
    logger.error('Error processing charge completed webhook', {
      requestId,
      error: error.message,
      transactionId: data.id,
    });
    throw error;
  }
}

async function handleChargeFailed(data, requestId) {
  try {
    logger.info('Processing charge failed webhook', { 
      requestId,
      transactionId: data.id,
      reference: data.tx_ref 
    });

    // Update payment status to failed
    // This would be implemented in the parking service
    // await parkingService.updatePaymentStatus(data.tx_ref, 'failed');

    return ResponseBuilder.success({
      status: 'failed',
      reference: data.tx_ref,
    }, 'Payment failure recorded');

  } catch (error) {
    logger.error('Error processing charge failed webhook', {
      requestId,
      error: error.message,
      transactionId: data.id,
    });
    throw error;
  }
}


// TODO
// secure apis
// SAVE KEYS TO SSM PARAMETER STORE and implement caching