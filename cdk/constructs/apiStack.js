const { CfnOutput, Stack, Duration, RemovalPolicy } = require("aws-cdk-lib");
const { Runtime, Function, Code, Tracing, Architecture } = require("aws-cdk-lib/aws-lambda");
const { PolicyStatement, Effect } = require("aws-cdk-lib/aws-iam");
const { 
  RestApi, 
  Model, 
  LambdaIntegration, 
  JsonSchemaVersion, 
  JsonSchemaType, 
  RequestValidator, 
  CfnAuthorizer, 
  AuthorizationType,
  MethodLoggingLevel,
  AccessLogFormat,
  LogGroupLogDestination
} = require("aws-cdk-lib/aws-apigateway");
const { NodejsFunction } = require("aws-cdk-lib/aws-lambda-nodejs");
const { LogGroup, RetentionDays } = require("aws-cdk-lib/aws-logs");
const { StringParameter } = require("aws-cdk-lib/aws-ssm");
// const { EmailIdentity, Identity } = require('aws-cdk-lib/aws-ses')

class ApiStack extends Stack {
  constructor(scope, id,  props) {
    super(scope, id, props);

    const { stageName } = props;
    const isProd = stageName === 'prod';
    
    // Environment-specific configuration
    const origins = isProd 
      ? ["https://smartpark.example.com"] 
      : ["http://localhost:3002", "https://dev.smartpark.example.com"];
    
    const companyName = "Smart Park";

    // Create CloudWatch Log Group for API Gateway
    const apiLogGroup = new LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/smartparking-${stageName}`,
      retention: isProd ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Create REST API with enhanced configuration
    const restApi = new RestApi(this, `SmartParking-API-${stageName}`, {
      restApiName: `SmartParking-API-${stageName}`,
      description: `Smart Parking REST API - ${stageName}`,
      deployOptions: {
        stageName,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: !isProd, // Disable in production for security
        metricsEnabled: true,
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: origins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'X-Requested-With',
          'X-Api-Key'
        ],
        allowCredentials: true,
        maxAge: Duration.hours(1),
      },
      endpointConfiguration: {
        types: [require('aws-cdk-lib/aws-apigateway').EndpointType.REGIONAL]
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
            minLength: 16, // Allow shorter date formats like "2025-07-16T01:00"
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
            maxLength: 16,
            minLength: 16,
          },
          data: {
            type: JsonSchemaType.OBJECT,
            // minProperties: 10
            
          },
        },
        required: ["event", "data"],
      },
    });



    // Store sensitive configuration in SSM Parameter Store
    const flutterwaveSecretParam = StringParameter.fromStringParameterName(
      this,
      'FlutterwaveSecretParam',
      `/smartparking/${stageName}/flutterwave-secret-key`
    );

    const webhookSecretParam = StringParameter.fromStringParameterName(
      this,
      'WebhookSecretParam',
      `/smartparking/${stageName}/webhook-secret`
    );

    // Database table references
    const parkingSpaceTable = props.parkingSpaceTable;
    const reservationTable = props.reservationTable;
    const paymentHistoryTable = props.paymentHistoryTable;
    const reservationHistory = props.reservationHistory;

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.X86_64, // Use x86_64 for better compatibility
      timeout: Duration.seconds(30),
      memorySize: 512,
      tracing: Tracing.ACTIVE, // Enable X-Ray tracing
      environment: {
        NODE_ENV: stageName,
        STAGE_NAME: stageName,
        COMPANY_NAME: companyName,
        TIMEZONE: 'Africa/Lagos',
        RATE_PER_10_MINS: '105.99',
        ALLOWED_ORIGINS: origins.join(','),
        PARKING_SPACE_TABLE: parkingSpaceTable.tableName,
        RESERVATION_TABLE: reservationTable.tableName,
        PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
        RESERVATION_HISTORY_TABLE: reservationHistory.tableName,
        LOG_LEVEL: isProd ? 'info' : 'debug',
        ENABLE_X_RAY_TRACING: 'true',
      },
      bundling: {
        minify: isProd,
        sourceMap: !isProd,
        target: 'node20',
        externalModules: ['@aws-sdk/*'], // Use AWS SDK from Lambda runtime
        forceDockerBundling: false, // Disable Docker bundling to avoid platform issues
      },
    };

    // Create CloudWatch Log Groups for Lambda functions
    const createLogGroup = (functionName) => new LogGroup(this, `${functionName}LogGroup`, {
      logGroupName: `/aws/lambda/smartparking-${stageName}-${functionName.toLowerCase()}`,
      retention: isProd ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // View Available Spots Function
    const viewAvailableSpotsLogGroup = createLogGroup('ViewAvailableSpots');
    const viewAvailableSpots = new NodejsFunction(this, "ViewAvailableSpots", {
      ...commonLambdaProps,
      functionName: `smartparking-${stageName}-view-available-spots`,
      entry: 'functions/viewAvailableSpots.js',
      description: 'Retrieve available parking spaces',
      logGroup: viewAvailableSpotsLogGroup,
      environment: {
        ...commonLambdaProps.environment,
        TABLE_NAME: parkingSpaceTable.tableName, // Legacy support
      },
    });

    parkingSpaceTable.grantReadData(viewAvailableSpots);

    // Make Reservation Function
    const makeReservationLogGroup = createLogGroup('MakeReservation');
    const makeReservation = new NodejsFunction(this, "MakeReservation", {
      ...commonLambdaProps,
      functionName: `smartparking-${stageName}-make-reservation`,
      entry: 'functions/makeReservation.js',
      description: 'Create parking space reservation',
      logGroup: makeReservationLogGroup,
    });

    // Grant permissions
    parkingSpaceTable.grantReadData(makeReservation);
    paymentHistoryTable.grantReadWriteData(makeReservation);
    reservationTable.grantReadWriteData(makeReservation);

    // Check Out Function
    const checkOutLogGroup = createLogGroup('CheckOut');
    const checkOutFunction = new NodejsFunction(this, "CheckOut", {
      ...commonLambdaProps,
      functionName: `smartparking-${stageName}-checkout`,
      entry: 'functions/checkOut.js',
      description: 'Process parking space checkout',
      logGroup: checkOutLogGroup,
    });

    // Grant permissions
    reservationTable.grantReadWriteData(checkOutFunction);
    paymentHistoryTable.grantReadWriteData(checkOutFunction);
    parkingSpaceTable.grantReadWriteData(checkOutFunction);
    reservationHistory.grantReadWriteData(checkOutFunction);

    // Initiate Payment Function
    const initiatePaymentLogGroup = createLogGroup('InitiatePayment');
    const initiatePayment = new NodejsFunction(this, "InitiatePayment", {
      ...commonLambdaProps,
      functionName: `smartparking-${stageName}-initiate-payment`,
      entry: 'functions/initiatePayment.js',
      description: 'Initiate payment with Flutterwave',
      logGroup: initiatePaymentLogGroup,
      environment: {
        ...commonLambdaProps.environment,
        FLW_SECRET_KEY_PARAM: flutterwaveSecretParam.parameterName,
      },
    });

    // Grant permissions
    paymentHistoryTable.grantReadWriteData(initiatePayment);
    flutterwaveSecretParam.grantRead(initiatePayment);

    // Add policy for SSM parameter access
    initiatePayment.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [flutterwaveSecretParam.parameterArn],
      })
    );

    // Webhook Listener Function
    const webhookListenerLogGroup = createLogGroup('WebhookListener');
    const webhookListener = new NodejsFunction(this, "WebhookListener", {
      ...commonLambdaProps,
      functionName: `smartparking-${stageName}-webhook-listener`,
      entry: 'functions/webhookListener.js',
      description: 'Handle payment webhook events',
      logGroup: webhookListenerLogGroup,
      environment: {
        ...commonLambdaProps.environment,
        WEBHOOK_SECRET_PARAM: webhookSecretParam.parameterName,
        FLW_SECRET_KEY_PARAM: flutterwaveSecretParam.parameterName,
      },
    });

    // Grant permissions
    paymentHistoryTable.grantReadWriteData(webhookListener);
    parkingSpaceTable.grantReadWriteData(webhookListener);
    reservationTable.grantReadWriteData(webhookListener);
    reservationHistory.grantReadWriteData(webhookListener);
    webhookSecretParam.grantRead(webhookListener);
    flutterwaveSecretParam.grantRead(webhookListener);

    // Add policy for SSM parameter access
    webhookListener.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          webhookSecretParam.parameterArn,
          flutterwaveSecretParam.parameterArn,
        ],
      })
    );

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

    // API Gateway Outputs
    new CfnOutput(this, "ApiUrl", {
      value: restApi.url,
      description: `Smart Parking API URL - ${stageName}`,
      exportName: `SmartParking-API-URL-${stageName}`,
    });

    new CfnOutput(this, "ApiId", {
      value: restApi.restApiId,
      description: `Smart Parking API ID - ${stageName}`,
      exportName: `SmartParking-API-ID-${stageName}`,
    });

    // Lambda Function ARNs for monitoring
    new CfnOutput(this, "ViewAvailableSpotsArn", {
      value: viewAvailableSpots.functionArn,
      description: "View Available Spots Lambda ARN",
    });

    new CfnOutput(this, "MakeReservationArn", {
      value: makeReservation.functionArn,
      description: "Make Reservation Lambda ARN",
    });

    new CfnOutput(this, "InitiatePaymentArn", {
      value: initiatePayment.functionArn,
      description: "Initiate Payment Lambda ARN",
    });

    new CfnOutput(this, "WebhookListenerArn", {
      value: webhookListener.functionArn,
      description: "Webhook Listener Lambda ARN",
    });
  }
}

module.exports = { ApiStack };