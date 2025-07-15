const { Stack, RemovalPolicy, Duration } = require("aws-cdk-lib");
const { Table, AttributeType, BillingMode, ProjectionType } = require("aws-cdk-lib/aws-dynamodb");

class DatabaseStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const { stageName } = props;

        // Parking Space Table (existing table reference)
        const parkingSpaceTable = Table.fromTableName(this,
            'ParkingSpaceTable',
            'ParkingSpaceTable'
        );

        // Reservations Table with GSI for user queries
        const reservationTable = new Table(this, "ReservationsTable", {
            tableName: `reservations-${stageName}`,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            contributorInsightsEnabled: false,
            pointInTimeRecovery: stageName === 'prod',
            removalPolicy: stageName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl', // Auto-cleanup old reservations
        });

        // GSI for querying reservations by user email
        reservationTable.addGlobalSecondaryIndex({
            indexName: 'UserEmailIndex',
            partitionKey: {
                name: 'userEmail',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
        });

        // GSI for querying reservations by space number
        reservationTable.addGlobalSecondaryIndex({
            indexName: 'SpaceNumberIndex',
            partitionKey: {
                name: 'space_no',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
        });

        // Reservation History Table
        const reservationHistory = new Table(this, "ReservationHistoryTable", {
            tableName: `reservation-history-${stageName}`,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            contributorInsightsEnabled: false,
            pointInTimeRecovery: stageName === 'prod',
            removalPolicy: stageName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        // GSI for querying history by user email
        reservationHistory.addGlobalSecondaryIndex({
            indexName: 'UserEmailIndex',
            partitionKey: {
                name: 'userEmail',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'checkoutTime',
                type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
        });

        // Payment History Table
        const paymentHistoryTable = new Table(this, "PaymentHistoryTable", {
            tableName: `payment-history-${stageName}`,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            contributorInsightsEnabled: false,
            pointInTimeRecovery: stageName === 'prod',
            removalPolicy: stageName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        // GSI for querying payments by user email
        paymentHistoryTable.addGlobalSecondaryIndex({
            indexName: 'UserEmailIndex',
            partitionKey: {
                name: 'userEmail',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
        });

        // GSI for querying payments by status
        paymentHistoryTable.addGlobalSecondaryIndex({
            indexName: 'PaymentStatusIndex',
            partitionKey: {
                name: 'paymentStatus',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'createdAt',
                type: AttributeType.STRING,
            },
            projectionType: ProjectionType.ALL,
        });

        this.parkingSpaceTable = parkingSpaceTable;
        this.reservationTable = reservationTable;
        this.paymentHistoryTable = paymentHistoryTable;
        this.reservationHistory = reservationHistory;
    }
}

module.exports = DatabaseStack;
