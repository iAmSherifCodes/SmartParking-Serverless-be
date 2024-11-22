#!/usr/bin/env node
const cdk = require('aws-cdk-lib')
const { ApiStack } = require('./constructs/apiStack')
const DatabaseStack = require("./constructs/databaseStack");
const { CognitoStack } = require('./constructs/cognitoStack')

const app =new cdk.App();
let stageName = app.node.tryGetContext('stageName')

if (!stageName) {
    console.log('Defaulting stage name to dev')
    stageName = 'dev'
}

const dbStack = new DatabaseStack(app, `DB-stack-${stageName}`, {

})

const cognitoStack = new CognitoStack(app, `CognitoStack-${stageName}`, {
  stageName
})

new ApiStack(app, `api-stack-${stageName}`,
    {
        stageName: stageName,
        reservationTable: dbStack.reservationTable,
        parkingSpaceTable: dbStack.parkingSpaceTable,
        paymentHistoryTable: dbStack.paymentHistoryTable,
        webUserPool: cognitoStack.webUserPoolClient,
        userPool: cognitoStack.userPool
    })
