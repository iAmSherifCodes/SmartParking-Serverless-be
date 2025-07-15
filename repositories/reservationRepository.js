const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const databaseClient = require('../utils/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class ReservationRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async create(reservationData) {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...reservationData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(id)',
    });

    logger.debug('Creating reservation', { reservationId: reservationData.id });
    
    await databaseClient.executeCommand(command, 'create reservation');
    return reservationData;
  }

  async getById(reservationId) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { id: reservationId },
      ConsistentRead: true,
    });

    logger.debug('Fetching reservation', { reservationId });
    
    const result = await databaseClient.executeCommand(command, 'get reservation');
    
    if (!result.Item) {
      throw new NotFoundError(`Reservation ${reservationId}`);
    }

    return result.Item;
  }

  async update(reservationId, updateData) {
    const updateExpression = [];
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString(),
    };

    Object.keys(updateData).forEach(key => {
      updateExpression.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = updateData[key];
    });

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { id: reservationId },
      UpdateExpression: `SET ${updateExpression.join(', ')}, updatedAt = :updatedAt`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    logger.debug('Updating reservation', { reservationId, updateData });
    
    const result = await databaseClient.executeCommand(command, 'update reservation');
    return result.Attributes;
  }

  async delete(reservationId) {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: { id: reservationId },
      ReturnValues: 'ALL_OLD',
    });

    logger.debug('Deleting reservation', { reservationId });
    
    const result = await databaseClient.executeCommand(command, 'delete reservation');
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

    logger.debug('Fetching reservations by user email', { userEmail, limit });
    
    const result = await databaseClient.executeCommand(command, 'get reservations by user');
    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }
}

module.exports = ReservationRepository;