import {DynamoDBDocumentClient, GetCommand} from "@aws-sdk/lib-dynamodb";
import {DynamoDB} from "@aws-sdk/client-dynamodb";
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

module.exports.findSpaceByIdAndStatus = async (id) => {
    const space = new GetCommand({
        TableName: process.env.PARKING_SPACES_TABLE,
        Key: {
            space_id: id,
        },
        AttributesToGet: ["status"],
        ConsistentRead: true,
        ReturnConsumedCapacity: "NONE",
        ExpressionAttributeNames: {
            "#status": "status",
        },

    })
    console.log("Space availability", space)
    try {
        const result = await dynamodb.send(space);
        if(result.Item.status === "available"){
            return {
                status: 200,
                success: true,
                message: "Parking space is available.",
            };
        } else{
            return {
                status: 400,
                success: false,
                message: "Parking space not available.",
            };
        }
    } catch (error) {
        console.error("Error fetching space:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request body", error: error.message || error }),
        };
    }
}

