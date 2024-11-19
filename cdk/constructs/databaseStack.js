const {Stack} = require("aws-cdk-lib");
const {TableV2, Table, AttributeType, BillingMode} = require("aws-cdk-lib/aws-dynamodb");

class DatabaseStack extends Stack{
    constructor(scope, id, props) {
        super(scope, id, props);


        const parkingSpaceTable = TableV2.fromTableName(this,
            'ParkingSpaceTable',
            'ParkingSpaceTable');

        const reservationTable = new Table(this, "ReservationsTable",{
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST
        });

        const paymentHistoryTable = new Table(this, "PaymentHistoryTable",{
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
            billingMode: BillingMode.PAY_PER_REQUEST
        });


        this.parkingSpaceTable = parkingSpaceTable;
        this.reservationTable = reservationTable;
        this.paymentHistoryTable = paymentHistoryTable;
    }
}

module.exports = DatabaseStack;
