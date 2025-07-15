const axios = require('axios');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { PaymentError } = require('../utils/errors');

class PaymentService {
  constructor() {
    this.flutterwaveApiUrl = config.payment.flutterwaveApiUrl;
    this.secretKey = config.payment.flutterwaveSecretKey;
  }

  async initiatePayment(paymentData) {
    const { amount, email, paymentId, redirectUrl } = paymentData;

    logger.info('Initiating Flutterwave payment', { paymentId, amount, email });

    const requestData = {
      currency: 'NGN',
      amount,
      customer: { email },
      customizations: {
        title: `${config.app.companyName} Parking Payment`,
        description: 'Parking space reservation payment',
      },
      tx_ref: paymentId,
      redirect_url: redirectUrl || config.cors.allowedOrigins[0],
    };

    try {
      const response = await axios.post(this.flutterwaveApiUrl, requestData, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.data.status === 'success') {
        logger.info('Payment initiation successful', { 
          paymentId, 
          paymentLink: response.data.data.link 
        });
        
        return {
          status: 'success',
          paymentLink: response.data.data.link,
          reference: response.data.data.tx_ref,
        };
      } else {
        logger.error('Payment initiation failed', { 
          paymentId, 
          response: response.data 
        });
        throw new PaymentError('Failed to initiate payment');
      }
    } catch (error) {
      if (error.response) {
        logger.error('Flutterwave API error', {
          paymentId,
          status: error.response.status,
          data: error.response.data,
        });
        throw new PaymentError(`Payment service error: ${error.response.data.message || 'Unknown error'}`);
      } else if (error.request) {
        logger.error('Payment service timeout', { paymentId });
        throw new PaymentError('Payment service is currently unavailable');
      } else {
        logger.error('Payment initiation error', { paymentId, error: error.message });
        throw new PaymentError('Failed to initiate payment');
      }
    }
  }

  async verifyPayment(transactionId) {
    logger.info('Verifying payment', { transactionId });

    const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;

    try {
      const response = await axios.get(verifyUrl, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        timeout: 10000,
      });

      if (response.data.status === 'success' && response.data.data.status === 'successful') {
        logger.info('Payment verification successful', { transactionId });
        
        return {
          status: 'successful',
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          reference: response.data.data.tx_ref,
          paymentMethod: response.data.data.payment_type,
        };
      } else {
        logger.warn('Payment verification failed', { 
          transactionId, 
          status: response.data.data.status 
        });
        
        return {
          status: response.data.data.status || 'failed',
          message: response.data.message,
        };
      }
    } catch (error) {
      logger.error('Payment verification error', { 
        transactionId, 
        error: error.message 
      });
      throw new PaymentError('Failed to verify payment');
    }
  }

  validateWebhookSignature(payload, signature) {
    // Implement webhook signature validation if Flutterwave provides it
    // This is a placeholder for webhook security
    logger.debug('Validating webhook signature');
    return true; // Implement actual validation
  }
}

module.exports = PaymentService;