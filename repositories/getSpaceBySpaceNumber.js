const {DynamoDBDocumentClient, GetCommand} = require("@aws-sdk/lib-dynamodb");
const {DynamoDB} = require("@aws-sdk/client-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

const getSpaceBySpaceNumber = async (spaceNumber, tableName) => {
    const space = new GetCommand({
        TableName: tableName,
        Key: {
            space_no: spaceNumber,
        },
        ConsistentRead: true,
        ReturnConsumedCapacity: "NONE",
    })
    console.log("Space availability", space)
    try {
        const result = await dynamodb.send(space);
        return {
            status: 200,
            success: true,
            message: "Parking space is available.",
            data: result.Item
        };
    } catch (error) {
        console.error("Error fetching space:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request body", error: error.message || error }),
        };
    }
}

module.exports = getSpaceBySpaceNumber;