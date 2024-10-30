const {CfnOutput, Stack} = require("aws-cdk-lib");
const {Runtime, Function, Code} = require("aws-cdk-lib/aws-lambda");
const {RestApi, LambdaIntegration} = require('aws-cdk-lib/aws-apigateway');

class ApiStack extends Stack{

    constructor(scope, id, props) {
        super(scope, id, props);


        const restApi = new RestApi(this, `${props.stageName}-MyApi`, {
            restApiName: 'RestApi',
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

        const viewAvailableSpotsLambdaIntegration = new LambdaIntegration(viewAvailableSpots);
        restApi.root.addResource("available-spaces").addMethod("GET",viewAvailableSpotsLambdaIntegration);

        new CfnOutput(this, 'AvailableSpaceUrl', {
            value: restApi.url
        })
    }


}

module.exports = {ApiStack}
