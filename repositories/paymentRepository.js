const { GetCommand, PutCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const databaseClient = require('../utils/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class PaymentRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async create(paymentData) {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...paymentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(id)',
    });

    logger.debug('Creating payment record', { paymentId: paymentData.id });
    
    await databaseClient.executeCommand(command, 'create payment');
    return paymentData;
  }

  async getById(paymentId) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { id: paymentId },
      ConsistentRead: true,
    });

    logger.debug('Fetching payment', { paymentId });
    
    const result = await databaseClient.executeCommand(command, 'get payment');
    
    if (!result.Item) {
      throw new NotFoundError(`Payment ${paymentId}`);
    }

    return result.Item;
  }

  async updateStatus(paymentId, status, additionalData = {}) {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { id: paymentId },
      UpdateExpression: 'SET paymentStatus = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
        ...Object.keys(additionalData).reduce((acc, key) => {
          acc[`:${key}`] = additionalData[key];
          return acc;
        }, {}),
      },
      ReturnValues: 'ALL_NEW',
    });

    // Add additional fields to update expression if provided
    if (Object.keys(additionalData).length > 0) {
      const additionalUpdates = Object.keys(additionalData)
        .map(key => `${key} = :${key}`)
        .join(', ');
      command.UpdateExpression += `, ${additionalUpdates}`;
    }

    logger.debug('Updating payment status', { paymentId, status, additionalData });
    
    const result = await databaseClient.executeCommand(command, 'update payment status');
    return result.Attributes;
  }

  async getByUserEmail(userEmail, limit = 20, lastEvaluatedKey = null) {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'UserEmailIndex', // Assumes GSI exists
      KeyConditionExpression: 'userEmail = :email',
      ExpressionAttributeValues: {
        ':email': userEmail,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    });

    logger.debug('Fetching payments by user email', { userEmail, limit });
    
    const result = await databaseClient.executeCommand(command, 'get payments by user');
    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
}

module.exports = PaymentRepository;