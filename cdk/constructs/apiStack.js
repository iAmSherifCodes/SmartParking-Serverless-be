const { CfnOutput, Stack, Duration } = require("aws-cdk-lib");
const { Runtime, Function, Code } = require("aws-cdk-lib/aws-lambda");
// const { PolicyStatement } = require("aws-cdk-lib/aws-iam");
const { RestApi, Model, LambdaIntegration, JsonSchemaVersion, JsonSchemaType, RequestValidator, CfnAuthorizer, AuthorizationType } = require("aws-cdk-lib/aws-apigateway");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");
// const { EmailIdentity, Identity } = require('aws-cdk-lib/aws-ses')

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

    const requestValidator = new RequestValidator(
      this,
      `${companyName}- RequestValidator`,
      {
        restApi: restApi,
        requestValidatorName: "requestBodyValidator",
        validateRequestBody: true,
        validateRequestParameters: false,
      }
    );

    const makeReservationApiModel = new Model(this, "makeReservationApiModel", {
      restApi: restApi,
      contentType: "application/json",
      description: "Validate MakeReservation Function Request Body",
      modelName: "makeReservationApiModel",
      schema: {
        schema: JsonSchemaVersion.DRAFT4,
        title: "ModelValidator",
        type: JsonSchemaType.OBJECT,
        properties: {
          checkoutTime: {
            type: JsonSchemaType.STRING,
            minLength: 19,
          },
          spaceNumber: {
            type: JsonSchemaType.STRING,
            maxLength: 2,
            minLength: 2,
          },
          email: {
            type: JsonSchemaType.STRING,
            pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
          }
        },
        required: ["checkoutTime", "spaceNumber", "email"],
      },
    });

    const initiatePaymentApiModel = new Model(this, "initiatePaymentApiModel", {
      restApi: restApi,
      contentType: "application/json",
      description: "Validate initiatePayment Function Request Body",
      modelName: "initiatePaymentApiModel",
      schema: {
        schema: JsonSchemaVersion.DRAFT4,
        title: "initiatePaymentApiModel",
        type: JsonSchemaType.OBJECT,
        properties: {
          paymentId: {
            type: JsonSchemaType.STRING,
            minLength: 5,
          }
        },
        required: ["paymentId"],
      },
    });

    const webhookListenerApiModel = new Model(this, "webhookListenerApiModel", {
      restApi: restApi,
      contentType: "application/json",
      description: "Validate webhookListener Function Request Body",
      modelName: "webhookListenerApiModel",
      schema: {
        schema: JsonSchemaVersion.DRAFT4,
        title: "webhookListenerApiModel",
        type: JsonSchemaType.OBJECT,
        properties: {
          event: {
            type: JsonSchemaType.STRING,
            minLength: 5,
          },
          data: {
            type: JsonSchemaType.OBJECT,
            minLength: 5,
          },
          card: {
            type: JsonSchemaType.OBJECT,
            minLength: 5,
          }
        },
        required: ["event", "data", "card"],
      },
    });



    // const emailIdentity = new EmailIdentity(this, 'SmartParkEmailNotification', {
    //   identity: Identity.email(verifiedEmail),
    // });

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

    parkingSpaceTable.grantReadWriteData(viewAvailableSpots);

    const makeReservation = new NodejsFunction(this, "MakeReservation", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/makeReservation.js',
      environment: {
        PARKING_SPACE_TABLE: parkingSpaceTable.tableName,
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        // COMPANY_NAME: companyName,
        // VERIFIED_EMAIL: verifiedEmail
      },
    });

    // makeReservation.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: ['ses:SendEmail'],
    //     resources: ['*'],
    //   })
    // );

    parkingSpaceTable.grantReadWriteData(makeReservation);
    // reservationTable.grantReadWriteData(makeReservation);
    paymentHistoryTable.grantReadWriteData(makeReservation);


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
        FLW_SECRET_KEY: "FLWSECK_TEST-d98900bcf1bc84b659a91ce565febe08-X"
      },
    });

    paymentHistoryTable.grantReadWriteData(initiatePayment);

    const webhookListener = new NodejsFunction(this, "WebhookListener", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: 'functions/webhookListener.js',
      environment: {
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        RESERVATION_HISTORY_TABLE: reservationHistory.tableName,
        RESERVATION_TABLE: reservationTable.tableNam
      },
    });

    paymentHistoryTable.grantReadWriteData(webhookListener);
    parkingSpaceTable.grantWriteData(webhookListener);
    reservationTable.grantWriteData(webhookListener);

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
      .addMethod("GET", viewAvailableSpotsLambdaIntegration
      );

    restApi.root.addResource("reserve").addMethod("POST", makeReservationLambdaIntegration, {
      requestValidator: requestValidator,
      requestModels: {
        "application/json": makeReservationApiModel
      }
    });
    restApi.root.addResource("pay").addMethod("POST", initiatePaymentIntegration, {
      requestValidator: requestValidator,
      requestModels: {
        "application/json": initiatePaymentApiModel
      }
    });
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
      .addMethod("POST", webhookListenerIntegration, {
        requestValidator: requestValidator,
        requestModels: {
          "application/json": webhookListenerApiModel
        }});

    new CfnOutput(this, "url", {
      value: restApi.url,
    });
  }
}

module.exports = { ApiStack };


// TODO:
// INTEGRATING AWS SQS FOR MAKE PAYMENT COMMAND