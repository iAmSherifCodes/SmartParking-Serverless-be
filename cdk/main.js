#!/usr/bin/env node
const cdk = require('aws-cdk-lib')
const { ApiStack } = require('./constructs/apiStack')
// const { CognitoStack } = require('./constructs/cognitoStack')

const app =new cdk.App();
let stageName = app.node.tryGetContext('stageName')

if (!stageName) {
    console.log('Defaulting stage name to dev')
    stageName = 'dev'
}

new ApiStack(app, `api-stack-${stageName}`,
    {
        stageName: stageName
    })
// new CognitoStack(app, `cognito-stack-${stageName}`)
