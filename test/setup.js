// Test setup file
process.env.NODE_ENV = 'test';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.STAGE_NAME = 'test';
process.env.COMPANY_NAME = 'Smart Park Test';
process.env.TIMEZONE = 'Africa/Lagos';
process.env.RATE_PER_10_MINS = '105.99';
process.env.FLW_SECRET_KEY = 'test-secret-key';
process.env.ALLOWED_ORIGINS = 'http://localhost:3002';
process.env.PARKING_SPACE_TABLE = 'test-parking-spaces';
process.env.RESERVATION_TABLE = 'test-reservations';
process.env.PAYMENT_HISTORY_TABLE = 'test-payments';
process.env.RESERVATION_HISTORY_TABLE = 'test-reservation-history';
process.env.LOG_LEVEL = 'error';

// Global test utilities
global.mockContext = {
  awsRequestId: 'test-request-id',
  getRemainingTimeInMillis: () => 30000,
};

global.mockEvent = {
  body: '{}',
  headers: {},
  queryStringParameters: null,
};

// Suppress console logs during tests unless explicitly needed
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};