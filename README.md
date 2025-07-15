# Smart Parking Serverless Application

A production-ready serverless parking management system built with AWS CDK, Lambda, DynamoDB, and API Gateway.

## 🏗️ Architecture

- **API Gateway**: RESTful API with CORS, request validation, and logging
- **AWS Lambda**: Serverless functions with ARM64 architecture and X-Ray tracing
- **DynamoDB**: NoSQL database with GSIs for efficient querying
- **SSM Parameter Store**: Secure storage for sensitive configuration
- **CloudWatch**: Comprehensive logging and monitoring

## 🚀 Features

- **Parking Space Management**: View available spaces with pagination
- **Reservation System**: Create and manage parking reservations
- **Payment Integration**: Flutterwave payment processing with webhooks
- **Checkout Process**: Complete parking sessions with billing
- **Security**: Input validation, CORS, and secure secret management
- **Monitoring**: CloudWatch logs, X-Ray tracing, and API metrics

## 📋 Prerequisites

- Node.js >= 18.0.0
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/iAmSherifCodes/SmartParking-Serverless-be.git
   cd smart-parking-serverless-be
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## 🔐 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# AWS Configuration
AWS_REGION=us-east-1
STAGE_NAME=dev

# Application Configuration
COMPANY_NAME=Smart Park
TIMEZONE=Africa/Lagos
RATE_PER_10_MINS=105.99

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3002,https://yourdomain.com
```

### Secrets Management

Set up secure parameters in AWS Systems Manager:

```bash
# Development environment
npm run setup-secrets:dev

# Staging environment
npm run setup-secrets:staging

# Production environment
npm run setup-secrets:prod
```

## 🚀 Deployment

### Development Environment

```bash
npm run deploy:dev
```

### Staging Environment

```bash
npm run deploy:staging
```

### Production Environment

```bash
npm run deploy:prod
```

### Manual Deployment

```bash
# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy specific stage
./scripts/deploy.sh [stage] [region]
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Validate code (lint + test)
npm run validate
```

## 📊 Monitoring

### CloudWatch Logs

- API Gateway: `/aws/apigateway/smartparking-{stage}`
- Lambda Functions: `/aws/lambda/smartparking-{stage}-{function-name}`

### X-Ray Tracing

All Lambda functions have X-Ray tracing enabled for performance monitoring and debugging.

### Metrics

- API Gateway metrics for request count, latency, and errors
- Lambda metrics for invocations, duration, and errors
- DynamoDB metrics for read/write capacity and throttling

## 🔧 API Endpoints

### Base URL
```
https://ml8xqtn1ef.execute-api.us-east-1.amazonaws.com/{stageName}
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/available-spaces` | List available parking spaces |
| POST | `/reserve` | Create a parking reservation |
| POST | `/pay` | Initiate payment for reservation |
| POST | `/checkout` | Complete parking session |
| POST | `/webhook` | Payment webhook handler |

### Request/Response Examples

#### Get Available Spaces
```bash
curl -X GET "{base-url}/available-spaces?limit=20"
```

#### Make Reservation
```bash
curl -X POST "{base-url}/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutTime": "2025-01-15T14:00:00Z",
    "spaceNumber": "A1",
    "email": "user@example.com"
  }'
```

## 🏗️ Development

### Project Structure

```
├── cdk/                    # CDK infrastructure code
│   ├── constructs/         # CDK construct definitions
│   └── main.js            # CDK app entry point
├── functions/             # Lambda function code
├── services/              # Business logic services
├── repositories/          # Data access layer
├── utils/                 # Utility functions
├── test/                  # Test files
├── scripts/               # Deployment scripts
└── config/                # Configuration files
```

### Code Quality

- **ESLint**: Code linting with automatic fixes
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit validation
- **Jest**: Unit testing with coverage reports

### Adding New Features

1. Create service layer in `services/`
2. Add repository layer in `repositories/`
3. Create Lambda function in `functions/`
4. Add CDK resources in `cdk/constructs/`
5. Write comprehensive tests in `test/`

## 🔒 Security Best Practices

- **Input Validation**: Joi schema validation for all inputs
- **CORS Configuration**: Restricted origins and methods
- **Secrets Management**: AWS SSM Parameter Store for sensitive data
- **IAM Permissions**: Least privilege access for Lambda functions
- **API Security**: Request validation and rate limiting
- **Logging**: Comprehensive audit trails without sensitive data

## 🚨 Troubleshooting

### Common Issues

1. **Deployment Failures**
   - Check AWS credentials and permissions
   - Verify CDK bootstrap is complete
   - Review CloudFormation stack events

2. **Lambda Errors**
   - Check CloudWatch logs for detailed error messages
   - Verify environment variables and permissions
   - Use X-Ray traces for performance issues

3. **API Gateway Issues**
   - Verify CORS configuration
   - Check request validation schemas
   - Review API Gateway logs

### Debug Commands

```bash
# View CDK diff
npm run diff

# Synthesize CloudFormation templates
npm run synth

# View deployment outputs
cat cdk-outputs-{stage}.json
```

## 🗑️ Cleanup

### Destroy Environment

```bash
# Development
npm run destroy:dev

# Staging
npm run destroy:staging

# Production (requires confirmation)
npm run destroy:prod
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run validation: `npm run validate`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
