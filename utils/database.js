const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const config = require('../config/environment');
const logger = require('./logger');
const { DatabaseError } = require('./errors');

class DatabaseClient {
  constructor() {
    this.client = new DynamoDB({
      region: config.aws.region,
    });
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  async executeCommand(command, operation = 'database operation') {
    try {
      logger.debug(`Executing ${operation}`, { command: command.constructor.name });
      const result = await this.docClient.send(command);
      logger.debug(`${operation} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`${operation} failed`, {
        error: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
      });
      throw new DatabaseError(`${operation} failed: ${error.message}`);
    }
  }

  getDocumentClient() {
    return this.docClient;
  }
}

// Singleton instance
const databaseClient = new DatabaseClient();

module.exports = databaseClient;