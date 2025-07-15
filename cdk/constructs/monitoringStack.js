const { Stack, Duration } = require('aws-cdk-lib');
const { Dashboard, Metric, GraphWidget, SingleValueWidget, Alarm, ComparisonOperator, TreatMissingData } = require('aws-cdk-lib/aws-cloudwatch');
const { SnsAction } = require('aws-cdk-lib/aws-cloudwatch-actions');
const { Topic, Subscription, SubscriptionProtocol } = require('aws-cdk-lib/aws-sns');

class MonitoringStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const { stageName, apiId, lambdaFunctions } = props;
        const isProd = stageName === 'prod';

        // SNS Topic for alerts
        const alertTopic = new Topic(this, 'AlertTopic', {
            topicName: `smartparking-alerts-${stageName}`,
            displayName: `Smart Parking Alerts - ${stageName}`,
        });

        // Email subscription for alerts (configure email in deployment)
        if (process.env.ALERT_EMAIL) {
            new Subscription(this, 'EmailAlertSubscription', {
                topic: alertTopic,
                protocol: SubscriptionProtocol.EMAIL,
                endpoint: process.env.ALERT_EMAIL,
            });
        }

        // CloudWatch Dashboard
        const dashboard = new Dashboard(this, 'SmartParkingDashboard', {
            dashboardName: `SmartParking-${stageName}`,
        });

        // API Gateway Metrics
        const apiRequestsMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: {
                ApiName: `SmartParking-API-${stageName}`,
            },
            statistic: 'Sum',
        });

        const apiLatencyMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: {
                ApiName: `SmartParking-API-${stageName}`,
            },
            statistic: 'Average',
        });

        const apiErrorsMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: {
                ApiName: `SmartParking-API-${stageName}`,
            },
            statistic: 'Sum',
        });

        const apiServerErrorsMetric = new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: {
                ApiName: `SmartParking-API-${stageName}`,
            },
            statistic: 'Sum',
        });

        // API Gateway Dashboard Widgets
        dashboard.addWidgets(
            new GraphWidget({
                title: 'API Requests',
                left: [apiRequestsMetric],
                width: 12,
                height: 6,
            }),
            new GraphWidget({
                title: 'API Latency',
                left: [apiLatencyMetric],
                width: 12,
                height: 6,
            })
        );

        dashboard.addWidgets(
            new GraphWidget({
                title: 'API Errors',
                left: [apiErrorsMetric, apiServerErrorsMetric],
                width: 24,
                height: 6,
            })
        );

        // Lambda Function Metrics and Alarms
        Object.entries(lambdaFunctions).forEach(([name, lambdaFunction]) => {
            // Lambda Metrics
            const invocationsMetric = lambdaFunction.metricInvocations();
            const errorsMetric = lambdaFunction.metricErrors();
            const durationMetric = lambdaFunction.metricDuration();
            const throttlesMetric = lambdaFunction.metricThrottles();

            // Lambda Dashboard Widgets
            dashboard.addWidgets(
                new SingleValueWidget({
                    title: `${name} - Invocations`,
                    metrics: [invocationsMetric],
                    width: 6,
                    height: 6,
                }),
                new SingleValueWidget({
                    title: `${name} - Errors`,
                    metrics: [errorsMetric],
                    width: 6,
                    height: 6,
                }),
                new SingleValueWidget({
                    title: `${name} - Duration (ms)`,
                    metrics: [durationMetric],
                    width: 6,
                    height: 6,
                }),
                new SingleValueWidget({
                    title: `${name} - Throttles`,
                    metrics: [throttlesMetric],
                    width: 6,
                    height: 6,
                })
            );

            // Lambda Alarms (only for production)
            if (isProd) {
                // High Error Rate Alarm
                const errorRateAlarm = new Alarm(this, `${name}ErrorRateAlarm`, {
                    alarmName: `SmartParking-${stageName}-${name}-HighErrorRate`,
                    alarmDescription: `High error rate for ${name} function`,
                    metric: errorsMetric,
                    threshold: 5,
                    evaluationPeriods: 2,
                    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                    treatMissingData: TreatMissingData.NOT_BREACHING,
                });
                errorRateAlarm.addAlarmAction(new SnsAction(alertTopic));

                // High Duration Alarm
                const durationAlarm = new Alarm(this, `${name}DurationAlarm`, {
                    alarmName: `SmartParking-${stageName}-${name}-HighDuration`,
                    alarmDescription: `High duration for ${name} function`,
                    metric: durationMetric,
                    threshold: 10000, // 10 seconds
                    evaluationPeriods: 3,
                    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                    treatMissingData: TreatMissingData.NOT_BREACHING,
                });
                durationAlarm.addAlarmAction(new SnsAction(alertTopic));

                // Throttle Alarm
                const throttleAlarm = new Alarm(this, `${name}ThrottleAlarm`, {
                    alarmName: `SmartParking-${stageName}-${name}-Throttles`,
                    alarmDescription: `Throttling detected for ${name} function`,
                    metric: throttlesMetric,
                    threshold: 1,
                    evaluationPeriods: 1,
                    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                    treatMissingData: TreatMissingData.NOT_BREACHING,
                });
                throttleAlarm.addAlarmAction(new SnsAction(alertTopic));
            }
        });

        // API Gateway Alarms (only for production)
        if (isProd) {
            // High API Error Rate Alarm
            const apiErrorRateAlarm = new Alarm(this, 'ApiErrorRateAlarm', {
                alarmName: `SmartParking-${stageName}-API-HighErrorRate`,
                alarmDescription: 'High error rate for API Gateway',
                metric: apiErrorsMetric,
                threshold: 10,
                evaluationPeriods: 2,
                comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: TreatMissingData.NOT_BREACHING,
            });
            apiErrorRateAlarm.addAlarmAction(new SnsAction(alertTopic));

            // High API Latency Alarm
            const apiLatencyAlarm = new Alarm(this, 'ApiLatencyAlarm', {
                alarmName: `SmartParking-${stageName}-API-HighLatency`,
                alarmDescription: 'High latency for API Gateway',
                metric: apiLatencyMetric,
                threshold: 5000, // 5 seconds
                evaluationPeriods: 3,
                comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: TreatMissingData.NOT_BREACHING,
            });
            apiLatencyAlarm.addAlarmAction(new SnsAction(alertTopic));
        }

        // DynamoDB Metrics (if tables are provided)
        if (props.dynamoTables) {
            Object.entries(props.dynamoTables).forEach(([tableName, table]) => {
                const readThrottleMetric = new Metric({
                    namespace: 'AWS/DynamoDB',
                    metricName: 'ReadThrottledEvents',
                    dimensionsMap: {
                        TableName: table.tableName,
                    },
                    statistic: 'Sum',
                });

                const writeThrottleMetric = new Metric({
                    namespace: 'AWS/DynamoDB',
                    metricName: 'WriteThrottledEvents',
                    dimensionsMap: {
                        TableName: table.tableName,
                    },
                    statistic: 'Sum',
                });

                // DynamoDB Dashboard Widget
                dashboard.addWidgets(
                    new GraphWidget({
                        title: `${tableName} - Throttles`,
                        left: [readThrottleMetric, writeThrottleMetric],
                        width: 12,
                        height: 6,
                    })
                );

                // DynamoDB Throttle Alarms (only for production)
                if (isProd) {
                    const readThrottleAlarm = new Alarm(this, `${tableName}ReadThrottleAlarm`, {
                        alarmName: `SmartParking-${stageName}-${tableName}-ReadThrottles`,
                        alarmDescription: `Read throttling detected for ${tableName} table`,
                        metric: readThrottleMetric,
                        threshold: 1,
                        evaluationPeriods: 1,
                        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                        treatMissingData: TreatMissingData.NOT_BREACHING,
                    });
                    readThrottleAlarm.addAlarmAction(new SnsAction(alertTopic));

                    const writeThrottleAlarm = new Alarm(this, `${tableName}WriteThrottleAlarm`, {
                        alarmName: `SmartParking-${stageName}-${tableName}-WriteThrottles`,
                        alarmDescription: `Write throttling detected for ${tableName} table`,
                        metric: writeThrottleMetric,
                        threshold: 1,
                        evaluationPeriods: 1,
                        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                        treatMissingData: TreatMissingData.NOT_BREACHING,
                    });
                    writeThrottleAlarm.addAlarmAction(new SnsAction(alertTopic));
                }
            });
        }

        this.alertTopic = alertTopic;
        this.dashboard = dashboard;
    }
}

module.exports = MonitoringStack;