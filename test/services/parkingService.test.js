const ParkingService = require('../../services/parkingService');
const moment = require('moment-timezone');

// Mock dependencies
jest.mock('../../repositories/getSpaceBySpaceNumber');
jest.mock('../../repositories/paymentRepository');
jest.mock('../../repositories/reservationRepository');

const ParkingSpaceRepository = require('../../repositories/getSpaceBySpaceNumber');
const PaymentRepository = require('../../repositories/paymentRepository');
const ReservationRepository = require('../../repositories/reservationRepository');

describe('ParkingService', () => {
  let parkingService;
  let mockParkingSpaceRepo;
  let mockPaymentRepo;
  let mockReservationRepo;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockParkingSpaceRepo = {
      getBySpaceNumber: jest.fn(),
      updateReservationStatus: jest.fn(),
    };
    mockPaymentRepo = {
      create: jest.fn(),
      getById: jest.fn(),
      updateStatus: jest.fn(),
    };
    mockReservationRepo = {
      create: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
    };

    // Mock constructors
    ParkingSpaceRepository.mockImplementation(() => mockParkingSpaceRepo);
    PaymentRepository.mockImplementation(() => mockPaymentRepo);
    ReservationRepository.mockImplementation(() => mockReservationRepo);

    parkingService = new ParkingService();
  });

  describe('makeReservation', () => {
    const validReservationData = {
      checkoutTime: moment().add(2, 'hours').toISOString(),
      spaceNumber: 'A1',
      email: 'test@example.com',
    };

    it('should create a reservation successfully', async () => {
      // Mock space availability
      mockParkingSpaceRepo.getBySpaceNumber.mockResolvedValue({
        space_no: 'A1',
        reserved: false,
      });

      // Mock payment creation
      mockPaymentRepo.create.mockResolvedValue({
        id: 'payment-123',
      });

      const result = await parkingService.makeReservation(validReservationData);

      expect(result).toHaveProperty('charge');
      expect(result).toHaveProperty('paymentId');
      expect(result).toHaveProperty('spaceNumber', 'A1');
      expect(mockParkingSpaceRepo.getBySpaceNumber).toHaveBeenCalledWith('A1');
      expect(mockPaymentRepo.create).toHaveBeenCalled();
    });

    it('should throw error if space is not available', async () => {
      mockParkingSpaceRepo.getBySpaceNumber.mockResolvedValue({
        space_no: 'A1',
        reserved: true,
      });

      await expect(parkingService.makeReservation(validReservationData))
        .rejects.toThrow('Parking space A1 is not available');
    });

    it('should throw error if checkout time is in the past', async () => {
      const pastReservationData = {
        ...validReservationData,
        checkoutTime: moment().subtract(1, 'hour').toISOString(),
      };

      await expect(parkingService.makeReservation(pastReservationData))
        .rejects.toThrow('Checkout time cannot be in the past');
    });
  });

  describe('calculateCharge', () => {
    it('should calculate charge correctly for different durations', () => {
      const currentTime = moment();
      const checkoutTime10Mins = moment().add(10, 'minutes');
      const checkoutTime30Mins = moment().add(30, 'minutes');

      const charge10Mins = parkingService.calculateCharge(currentTime, checkoutTime10Mins);
      const charge30Mins = parkingService.calculateCharge(currentTime, checkoutTime30Mins);

      expect(charge10Mins).toBe(105.99); // Base rate
      expect(charge30Mins).toBe(105.99 * 3); // 3 x 10-minute periods
    });

    it('should return base rate for negative time difference', () => {
      const currentTime = moment();
      const pastTime = moment().subtract(1, 'hour');

      const charge = parkingService.calculateCharge(currentTime, pastTime);
      expect(charge).toBe(105.99);
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const paymentId = 'payment-123';
      const mockPayment = {
        id: paymentId,
        paymentStatus: 'unprocessed',
        charge: 105.99,
      };

      mockPaymentRepo.getById.mockResolvedValue(mockPayment);
      mockPaymentRepo.updateStatus.mockResolvedValue({
        ...mockPayment,
        paymentStatus: 'processing',
      });

      const result = await parkingService.processPayment(paymentId);

      expect(result).toEqual(mockPayment);
      expect(mockPaymentRepo.updateStatus).toHaveBeenCalledWith(paymentId, 'processing');
    });

    it('should throw error if payment already successful', async () => {
      const paymentId = 'payment-123';
      mockPaymentRepo.getById.mockResolvedValue({
        id: paymentId,
        paymentStatus: 'successful',
      });

      await expect(parkingService.processPayment(paymentId))
        .rejects.toThrow('Payment already processed successfully');
    });
  });
});