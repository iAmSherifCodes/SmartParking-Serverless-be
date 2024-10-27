const { DynamoDB } = require("@aws-sdk/client-dynamodb")
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb")
const dynamodbClient = new DynamoDB({
                                                region:"us-east-1",
                                            })
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient)

const tableName = process.env.TABLE_NAME

const getAvailableSpaces = async (limit, lastEvaluatedKey) => {
    if (lastEvaluatedKey) {
        lastEvaluatedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey))
    }
    console.log("Last evaluated key", lastEvaluatedKey);
    const params = {
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey ? lastEvaluatedKey : undefined,
        Limit: Number(limit),
    }
    const scanCommand = new QueryCommand(params)
    const { Items, Count, LastEvaluatedKey} = await dynamodb.send(scanCommand)
    return {Items, Count, LastEvaluatedKey: encodeURIComponent(JSON.stringify(LastEvaluatedKey))}
}

module.exports.handler = async (event, context)=>{
    try {
        const { limit, lastEvaluatedKey } = event.queryStringParameters;
        if (!lastEvaluatedKey || !limit) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Missing required parameters"
                })
            }
        }
        const availableSpaces = await getAvailableSpaces(limit, lastEvaluatedKey)
        return {
            statusCode: 200,
            body: {items: JSON.stringify(availableSpaces.Items),
                    count: availableSpaces.Count,
                    lastEvaluatedKey: availableSpaces.LastEvaluatedKey}
        }
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            body: JSON.stringify(error)
        }
    }
}
