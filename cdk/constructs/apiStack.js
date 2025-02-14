const { CfnOutput, Stack, Duration } = require("aws-cdk-lib");
const { Runtime, Function, Code } = require("aws-cdk-lib/aws-lambda");
const { PolicyStatement } = require("aws-cdk-lib/aws-iam");
const { RestApi, LambdaIntegration, CfnAuthorizer, AuthorizationType } = require("aws-cdk-lib/aws-apigateway");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");
const { EmailIdentity, Identity } = require('aws-cdk-lib/aws-ses')

class ApiStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const origins = ["http://localhost:3002"];
    const verifiedEmail = 'cashgraphicx@gmail.com';
    const companyName = "Smart Park"

    const restApi = new RestApi(this, `${props.stageName}-MyApi`, {
      deployOptions: {
        stageName: props.stageName,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: origins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'X-Requested-With'
        ],
        allowCredentials: true,
        maxAge: Duration.days(1),
      },
    });

    const emailIdentity = new EmailIdentity(this, 'SmartParkEmailNotification', {
      identity: Identity.email(verifiedEmail),
    });

    const parkingSpaceTable = props.parkingSpaceTable;
    const reservationTable = props.reservationTable;
    const paymentHistoryTable = props.paymentHistoryTable;
    const reservationHistory = props.reservationHistory;

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
        COMPANY_NAME: companyName,
        VERIFIED_EMAIL: verifiedEmail
      },
    });

    makeReservation.addToRolePolicy(
      new PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'],
      })
    );

    parkingSpaceTable.grantReadWriteData(makeReservation);
    reservationTable.grantReadWriteData(makeReservation);

    const checkOutFunction = new NodejsFunction(this, "CheckOut", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/checkOut.js',
      environment: {
        RESERVATION_TABLE: reservationTable.tableName,
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        PARKING_SPACE_TABLE: parkingSpaceTable.tableName,
        RESERVATION_HISTORY_TABLE: reservationHistory.tableName
      },
    });

    reservationTable.grantReadWriteData(checkOutFunction);
    paymentHistoryTable.grantReadWriteData(checkOutFunction);
    parkingSpaceTable.grantWriteData(checkOutFunction);
    reservationHistory.grantReadWriteData(checkOutFunction);

    const initiatePayment = new NodejsFunction(this, "InitiatePayment", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/initiatePayment.js',
      environment: {
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        FLW_SECRET_KEY: "XXXXXXXXXXXX"
      },
    });

    paymentHistoryTable.grantReadWriteData(initiatePayment);

    const webhookListener = new NodejsFunction(this, "WebhookListener", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/webhookListener.js',
      environment: {
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        RESERVATION_HISTORY_TABLE: reservationHistory.tableName
      },
    });

    paymentHistoryTable.grantReadWriteData(webhookListener);

    const viewAvailableSpotsLambdaIntegration = new LambdaIntegration(viewAvailableSpots);
    const makeReservationLambdaIntegration = new LambdaIntegration(makeReservation);
    const checkOutLambdaIntegration = new LambdaIntegration(checkOutFunction);
    const initiatePaymentIntegration = new LambdaIntegration(initiatePayment);
    const webhookListenerIntegration = new LambdaIntegration(webhookListener);
    // const cognitoAuthorizer = new CfnAuthorizer(this, 'CognitoAuthorizer', {
    //   name: 'CognitoAuthorizer',
    //   type: 'COGNITO_USER_POOLS',
    //   identitySource: 'method.request.header.Authorization',
    //   providerArns: [props.userPool.userPoolArn],
    //   restApiId: restApi.restApiId,
    // })

    // TODO
    // Configure webuser and user pool
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

    restApi.root
      .addResource("webhook")
      .addMethod("POST", webhookListenerIntegration);

    new CfnOutput(this, "url", {
      value: restApi.url,
    });
  }
}

module.exports = { ApiStack };


// TODO:
// INTEGRATING AWS SQS FOR MAKE PAYMENT COMMAND