const { UserPool, UserPoolClient } = require("aws-cdk-lib/aws-cognito");
const { Stack } = require("aws-cdk-lib");

class CognitoStack extends Stack {
  /**
   * Creates a Cognito User Pool and User Pool Client
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      signInCaseSensitive: false,
      passwordPolicy: {
        minLength: 5,
      },
      autoVerify: {
        email: true,
      },
    });

    const webUserPoolClient = new UserPoolClient(this, "WebUserPoolClient", {
      userPool,
      preventUserExistenceErrors: true,
      authFlows: {
        userSrp: true,
      },
    });

    this.userPool = userPool;
    this.webUserPoolClient = webUserPoolClient;
  }
}

module.exports = {
  CognitoStack,
};