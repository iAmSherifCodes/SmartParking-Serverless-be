const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const tableName = process.env.TABLE_NAME;

const getAvailableSpaces = async (limit, lastEvaluatedKey) => {
    const params = {
        TableName: tableName,
        Limit: Number(limit),
    };

    if (lastEvaluatedKey) {
        try {
            params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
            console.log("Parsed LastEvaluatedKey:", params.ExclusiveStartKey);
        } catch (error) {
            console.error("Error parsing lastEvaluatedKey:", error);
            throw new Error("Invalid format for lastEvaluatedKey.");
        }
    }

    const command = new ScanCommand(params);

    try {
        const data = await dynamodb.send(command);
        return {
            items: data.Items || [],
            count: data.Count || 0,
            cursor: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null,
        };
    } catch (err) {
        console.error("Unable to scan. Error:", JSON.stringify(err, null, 2));
        throw err;
    }
};

const createResponse = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3002',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
});


module.exports.handler = async (event, context) => {
    try {
        const { limit, cursor: lastEvaluatedKey } = event.queryStringParameters || {};

        if (!limit) {
            return createResponse(400, JSON.stringify({
                message: "Missing required parameter: limit",
            }));
        }

        const availableSpaces = await getAvailableSpaces(limit, lastEvaluatedKey || null);
        return createResponse(200, availableSpaces);
    } catch (error) {
        console.log("Error:", error);
        return createResponse(500, JSON.stringify({
            message: "Internal server error",
            error: error.message || error,
        }));
    }
};