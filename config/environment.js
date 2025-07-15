const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID,
  },

  // Application Configuration
  app: {
    stageName: process.env.STAGE_NAME || 'dev',
    companyName: process.env.COMPANY_NAME || 'Smart Park',
    timezone: process.env.TIMEZONE || 'Africa/Lagos',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableXRayTracing: process.env.ENABLE_X_RAY_TRACING === 'true',
  },

  // Rate Configuration
  pricing: {
    ratePerTenMinutes: parseFloat(process.env.RATE_PER_10_MINS) || 105.99,
    tenMinutesInMs: 10 * 60 * 1000,
  },

  // Email Configuration
  email: {
    verifiedEmail: process.env.VERIFIED_EMAIL,
  },

  // Payment Configuration
  payment: {
    flutterwaveSecretKey: process.env.FLW_SECRET_KEY,
    flutterwaveApiUrl: 'https://api.flutterwave.com/v3/payments',
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3002'],
  },

  // Database Configuration
  database: {
    parkingSpaceTable: process.env.PARKING_SPACE_TABLE || 'ParkingSpaceTable',
    reservationTable: process.env.RESERVATION_TABLE || 'ReservationsTable',
    paymentHistoryTable: process.env.PAYMENT_HISTORY_TABLE || 'PaymentHistoryTable',
    reservationHistoryTable: process.env.RESERVATION_HISTORY_TABLE || 'ReservationHistoryTable',
  },

  // Validation
  validation: {
    maxReservationHours: 24,
    minReservationMinutes: 10,
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'FLW_SECRET_KEY',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config;