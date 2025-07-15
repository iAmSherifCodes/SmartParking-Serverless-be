#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { ApiStack } = require('./constructs/apiStack');
const DatabaseStack = require('./constructs/databaseStack');
// const { CognitoStack } = require('./constructs/cognitoStack');

const app = new cdk.App();

// Get stage name from context or default to 'dev'
let stageName = app.node.tryGetContext('stageName');
if (!stageName) {
    console.log('Defaulting stage name to dev');
    stageName = 'dev';
}

// Get environment-specific configuration
const envConfig = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SmartParking');
cdk.Tags.of(app).add('Environment', stageName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

// Database Stack
const dbStack = new DatabaseStack(app, `SmartParking-DB-${stageName}`, {
    env: envConfig,
    stageName,
    description: `Smart Parking Database Stack - ${stageName}`,
});

// Authentication Stack (commented out for now)
// const cognitoStack = new CognitoStack(app, `SmartParking-Auth-${stageName}`, {
//   env: envConfig,
//   stageName,
//   description: `Smart Parking Authentication Stack - ${stageName}`,
// });

// API Stack
const apiStack = new ApiStack(app, `SmartParking-API-${stageName}`, {
    env: envConfig,
    stageName,
    description: `Smart Parking API Stack - ${stageName}`,
    reservationTable: dbStack.reservationTable,
    parkingSpaceTable: dbStack.parkingSpaceTable,
    paymentHistoryTable: dbStack.paymentHistoryTable,
    reservationHistory: dbStack.reservationHistory,
    // webUserPool: cognitoStack.webUserPoolClient,
    // userPool: cognitoStack.userPool
});

// Add dependency
apiStack.addDependency(dbStack);
