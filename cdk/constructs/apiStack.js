const { CfnOutput, Stack, Duration } = require("aws-cdk-lib");
const { Runtime, Function, Code } = require("aws-cdk-lib/aws-lambda");
const { RestApi, LambdaIntegration, CfnAuthorizer, AuthorizationType } = require("aws-cdk-lib/aws-apigateway");
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

    const makeReservation = new NodejsFunction(this, "MakeReservation", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/makeReservation.js',
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

    const initiatePayment = new NodejsFunction(this, "InitiatePayment", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/initiatePayment.js',
      environment: {
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        FLW_SECRET_KEY: "FLWSECK_TEST-d98900bcf1bc84b659a91ce565febe08-X"
      },
    });

    reservationTable.grantReadWriteData(checkOutFunction);
    paymentHistoryTable.grantReadWriteData(checkOutFunction);
    parkingSpaceTable.grantWriteData(checkOutFunction);
    paymentHistoryTable.grantReadWriteData(initiatePayment);

    const viewAvailableSpotsLambdaIntegration = new LambdaIntegration(
      viewAvailableSpots
    );
    const makeReservationLambdaIntegration = new LambdaIntegration(
      makeReservation
    );
    const checkOutLambdaIntegration = new LambdaIntegration(checkOutFunction);
    const initiatePaymentIntegration = new LambdaIntegration(initiatePayment);

    // const cognitoAuthorizer = new CfnAuthorizer(this, 'CognitoAuthorizer', {
    //   name: 'CognitoAuthorizer',
    //   type: 'COGNITO_USER_POOLS',
    //   identitySource: 'method.request.header.Authorization',
    //   providerArns: [props.userPool.userPoolArn],
    //   restApiId: restApi.restApiId,
    // })

    // TODO
    // read up on webuser and user pool
    // configure makereservation and checkout auth
    // and test

    restApi.root
      .addResource("available-spaces")
      .addMethod("GET", viewAvailableSpotsLambdaIntegration);

    restApi.root.addResource("reserve").addMethod("POST", makeReservationLambdaIntegration);
    restApi.root.addResource("pay").addMethod("POST", initiatePaymentIntegration);
    // restApi.root
    //   .addResource("reserve")
    //   .addMethod("POST", makeReservationLambdaIntegration,{
    //     authorizationType: AuthorizationType.COGNITO,
    //     authorizer: {
    //       authorizerId: cognitoAuthorizer.ref
    //     },
    //   });
    restApi.root
      .addResource("checkout")
      .addMethod("POST", checkOutLambdaIntegration);

    new CfnOutput(this, "url", {
      value: restApi.url,
    });
  }
}

module.exports = { ApiStack };
