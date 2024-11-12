const {parkingReservationSchema} = require("../utils/schemaValidation");
const {DynamoDBDocumentClient, GetCommand} = require("@aws-sdk/lib-dynamodb");
const {DynamoDB} = require("@aws-sdk/client-dynamodb");
const getSpaceBySpaceNumber = require("../repositories/getSpaceBySpaceNumber");
const dynamodbClient = new DynamoDB();
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const parkingSpaceTable = process.env.PARKING_SPACE_NAME;

const reserveParkingSpace = async (event)=>{
    try{
        const value = await parkingReservationSchema.validateAsync(event.body);

        const parsedStartTime = new Date(value.startTime);
        const parsedEndTime = new Date(value.endTime);
        const currentDate = new Date();

        if (parsedStartTime < currentDate) {
            return {
                status: 400,
                success: false,
                message: "Start time cannot be in the past.",
            };
        }

        // Validation: End time must be within 2 days of start time
        const maxEndTime = new Date(parsedStartTime);
        maxEndTime.setDate(maxEndTime.getDate() + 5);

        if (parsedEndTime > maxEndTime) {
            return {
                status: 400,
                success: false,
                message: "End time cannot be more than 2 days from the start time.",
            };
        }

        // Check if the parking space is available in parking space table
        const spaceAvailability = await getSpaceBySpaceNumber(value.spaceNumber, parkingSpaceTable);
        if (!spaceAvailability.success) {
            return {
                status: 404,
                success: false,
                message: "Parking space is already reserved",
            };
        }
        // write the space number to its table (parking space table) as reserved
        // write to reservation table (user details, reserve time)
        // return reservationId, spaceNumber, userId with successfull message sent to their email




    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid request body", error: error.message || error }),
        };
    }
}



module.exports.handler = async (event, context) => {

}