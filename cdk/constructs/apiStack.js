const {CfnOutput, Stack} = require("aws-cdk-lib");
const {Runtime, Function, Code} = require("aws-cdk-lib/aws-lambda");
const {RestApi, LambdaIntegration} = require('aws-cdk-lib/aws-apigateway');

class ApiStack extends Stack{

    constructor(scope, id, props) {
        super(scope, id, props);


        const restApi = new RestApi(this, `${props.stageName}-MyApi`, {
            deployOptions: {
                stageName: props.stageName
            }
        });

        const parkingSpaceTable = props.parkingSpaceTable;
        const reservationTable = props.reservationTable;

        const viewAvailableSpots = new Function(this, "ViewAvailableSpots", {
            runtime: Runtime.NODEJS_20_X,
            handler: "viewAvailableSpots.handler",
            code: Code.fromAsset("functions"),
            environment: {
                TABLE_NAME: parkingSpaceTable.tableName
            }
        })

        parkingSpaceTable.grantReadData(viewAvailableSpots);

        const makeReservation = new Function(this, "MakeReservation",{
            runtime: Runtime.NODEJS_20_X,
            handler: "makeReservation.handler",
            code: Code.fromAsset("functions"),
            environment: {
                PARKING_SPACE_TABLE: parkingSpaceTable.tableName,
                RESERVATION_TABLE: reservationTable.tableName
            }
        })

        parkingSpaceTable.grantReadWriteData(makeReservation);
        reservationTable.grantReadWriteData(makeReservation);

        const viewAvailableSpotsLambdaIntegration = new LambdaIntegration(viewAvailableSpots);
        const makeReservationLambdaIntegration = new LambdaIntegration(makeReservation);

        // const rootApi = restApi.root.addResource('v2');
        restApi.root.addResource("available-spaces").addMethod("GET",viewAvailableSpotsLambdaIntegration);
        restApi.root.addResource('reserve').addMethod("POST", makeReservationLambdaIntegration)

        new CfnOutput(this, 'url', {
            value: restApi.url
        })
    }


}

module.exports = {ApiStack}
