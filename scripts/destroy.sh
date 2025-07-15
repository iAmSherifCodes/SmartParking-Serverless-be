#!/bin/bash

# Smart Parking Destroy Script
# Usage: ./scripts/destroy.sh [stage] [region]

set -e

STAGE=${1:-dev}
REGION=${2:-us-east-1}
PROFILE=${AWS_PROFILE:-default}

echo "🗑️  Destroying Smart Parking Application"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo "AWS Profile: $PROFILE"

# Confirmation for production
if [[ "$STAGE" == "prod" ]]; then
    echo "⚠️  WARNING: You are about to destroy the PRODUCTION environment!"
    read -p "Type 'DESTROY PRODUCTION' to confirm: " confirmation
    if [[ "$confirmation" != "DESTROY PRODUCTION" ]]; then
        echo "❌ Destruction cancelled"
        exit 1
    fi
fi

# Destroy CDK stacks
echo "🗑️  Destroying CDK stacks..."
cdk destroy --all \
    --force \
    --profile $PROFILE \
    --context stageName=$STAGE

# Clean up SSM parameters (for non-prod environments)
if [[ "$STAGE" != "prod" ]]; then
    echo "🧹 Cleaning up SSM parameters..."
    
    # Delete Flutterwave secret
    aws ssm delete-parameter \
        --name "/smartparking/$STAGE/flutterwave-secret-key" \
        --profile $PROFILE 2>/dev/null || true
    
    # Delete webhook secret
    aws ssm delete-parameter \
        --name "/smartparking/$STAGE/webhook-secret" \
        --profile $PROFILE 2>/dev/null || true
fi

# Clean up output files
rm -f cdk-outputs-$STAGE.json

echo "✅ Destruction completed successfully!"