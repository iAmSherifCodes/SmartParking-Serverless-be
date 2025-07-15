const config = require('../config/environment');
const logger = require('./logger');

class ResponseBuilder {
  static success(data = null, message = 'Success', statusCode = 200) {
    return {
      statusCode,
      body: JSON.stringify({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
      }),
      headers: this.getHeaders(),
    };
  }

  static error(error, statusCode = 500) {
    const isOperational = error.isOperational || false;
    const errorCode = error.code || 'INTERNAL_ERROR';
    
    // Log error details
    logger.error('API Error', {
      message: error.message,
      statusCode,
      code: errorCode,
      stack: error.stack,
      isOperational,
    });

    // Don't expose internal errors in production
    const message = isOperational ? error.message : 'Internal server error';
    
    return {
      statusCode: error.statusCode || statusCode,
      body: JSON.stringify({
        success: false,
        message,
        code: errorCode,
        timestamp: new Date().toISOString(),
        ...(config.app.stageName === 'dev' && { stack: error.stack }),
      }),
      headers: this.getHeaders(),
    };
  }

  static getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': config.cors.allowedOrigins[0],
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    };
  }
}

module.exports = ResponseBuilder;