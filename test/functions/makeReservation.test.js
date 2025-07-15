const { handler } = require('../../functions/makeReservation');

// Mock dependencies
jest.mock('../../services/parkingService');
const ParkingService = require('../../services/parkingService');

describe('makeReservation Lambda', () => {
  let mockParkingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockParkingService = {
      makeReservation: jest.fn(),
    };
    
    ParkingService.mockImplementation(() => mockParkingService);
  });

  it('should handle valid reservation request', async () => {
    const mockResult = {
      charge: 105.99,
      paymentId: 'payment-123',
      spaceNumber: 'A1',
      checkoutTime: '2025-01-15T14:00:00Z',
    };

    mockParkingService.makeReservation.mockResolvedValue(mockResult);

    const event = {
      body: JSON.stringify({
        checkoutTime: '2025-01-15T14:00:00Z',
        spaceNumber: 'A1',
        email: 'test@example.com',
      }),
    };

    const result = await handler(event, global.mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockResult);
    expect(mockParkingService.makeReservation).toHaveBeenCalledWith({
      checkoutTime: '2025-01-15T14:00:00Z',
      spaceNumber: 'A1',
      email: 'test@example.com',
    });
  });

  it('should handle validation errors', async () => {
    const event = {
      body: JSON.stringify({
        checkoutTime: 'invalid-date',
        spaceNumber: 'A1',
        email: 'invalid-email',
      }),
    };

    const result = await handler(event, global.mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should handle service errors', async () => {
    mockParkingService.makeReservation.mockRejectedValue(
      new Error('Space not available')
    );

    const event = {
      body: JSON.stringify({
        checkoutTime: '2025-01-15T14:00:00Z',
        spaceNumber: 'A1',
        email: 'test@example.com',
      }),
    };

    const result = await handler(event, global.mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });

  it('should handle malformed JSON', async () => {
    const event = {
      body: 'invalid-json',
    };

    const result = await handler(event, global.mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });
});