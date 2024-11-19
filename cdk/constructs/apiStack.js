const { CfnOutput, Stack, Duration } = require("aws-cdk-lib");
const { Runtime, Function, Code } = require("aws-cdk-lib/aws-lambda");
const { RestApi, LambdaIntegration } = require("aws-cdk-lib/aws-apigateway");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const restApi = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName,
      },
    });

    const parkingSpaceTable = props.parkingSpaceTable;
    const reservationTable = props.reservationTable;
    const paymentHistoryTable = props.paymentHistoryTable;

    const viewAvailableSpots = new Function(this, "ViewAvailableSpots", {
      runtime: Runtime.NODEJS_20_X,
      handler: "viewAvailableSpots.handler",
      code: Code.fromAsset("functions"),
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: parkingSpaceTable.tableName,
      },
    });

    parkingSpaceTable.grantReadData(viewAvailableSpots);

    const makeReservation = new Function(this, "MakeReservation", {
      runtime: Runtime.NODEJS_20_X,
      handler: "makeReservation.handler",
      timeout: Duration.seconds(30),
      code: Code.fromAsset("functions"),
      environment: {
        PARKING_SPACE_TABLE: parkingSpaceTable.tableName,
        RESERVATION_TABLE: reservationTable.tableName,
      },
    });

    parkingSpaceTable.grantReadWriteData(makeReservation);
    reservationTable.grantReadWriteData(makeReservation);

    const checkOutFunction = new NodejsFunction(this, "CheckOut", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/checkOut.js',
      environment: {
        RESERVATION_TABLE: reservationTable.tableName,
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        PARKING_SPACE_TABLE: parkingSpaceTable.tableName
      },
    });
    reservationTable.grantReadWriteData(checkOutFunction);
    paymentHistoryTable.grantReadWriteData(checkOutFunction);
    parkingSpaceTable.grantWriteData(checkOutFunction);

    const viewAvailableSpotsLambdaIntegration = new LambdaIntegration(
      viewAvailableSpots
    );
    const makeReservationLambdaIntegration = new LambdaIntegration(
      makeReservation
    );
    const checkOutLambdaIntegration = new LambdaIntegration(checkOutFunction);

    // const rootApi = restApi.root.addResource('v2');
    restApi.root
      .addResource("available-spaces")
      .addMethod("GET", viewAvailableSpotsLambdaIntegration);
    restApi.root
      .addResource("reserve")
      .addMethod("POST", makeReservationLambdaIntegration);
    restApi.root
      .addResource("checkout")
      .addMethod("POST", checkOutLambdaIntegration);

    new CfnOutput(this, "url", {
      value: restApi.url,
    });
  }
}

module.exports = { ApiStack };
