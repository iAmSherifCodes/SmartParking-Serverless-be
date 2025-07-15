const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const databaseClient = require('../utils/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class ParkingSpaceRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.docClient = databaseClient.getDocumentClient();
  }

  async getBySpaceNumber(spaceNumber) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { space_no: spaceNumber },
      ConsistentRead: true,
    });

    logger.debug('Fetching parking space', { spaceNumber, tableName: this.tableName });
    
    const result = await databaseClient.executeCommand(command, 'get parking space');
    
    if (!result.Item) {
      throw new NotFoundError(`Parking space ${spaceNumber}`);
    }

    return result.Item;
  }

  async updateReservationStatus(spaceNumber, reserved, reservationDate = null) {
    const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
    
    const updateExpression = reserved 
      ? "SET reserved = :reserved, reservation_date = :date"
      : "SET reserved = :reserved REMOVE reservation_date";
    
    const expressionAttributeValues = reserved
      ? { ":reserved": reserved, ":date": reservationDate }
      : { ":reserved": reserved };

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { space_no: spaceNumber },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    logger.debug('Updating parking space reservation status', { 
      spaceNumber, 
      reserved, 
      reservationDate 
    });

    const result = await databaseClient.executeCommand(command, 'update parking space');
    return result.Attributes;
  }
}

module.exports = ParkingSpaceRepository;