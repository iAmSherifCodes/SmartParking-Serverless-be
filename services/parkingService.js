const moment = require('moment-timezone');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');
const ParkingSpaceRepository = require('../repositories/getSpaceBySpaceNumber');
const PaymentRepository = require('../repositories/paymentRepository');
const ReservationRepository = require('../repositories/reservationRepository');

class ParkingService {
  constructor() {
    this.parkingSpaceRepo = new ParkingSpaceRepository(config.database.parkingSpaceTable);
    this.paymentRepo = new PaymentRepository(config.database.paymentHistoryTable);
    this.reservationRepo = new ReservationRepository(config.database.reservationTable);
    this.reservationHistoryRepo = new ReservationRepository(config.database.reservationHistoryTable);
  }

  async makeReservation(reservationData) {
    const { checkoutTime, spaceNumber, email } = reservationData;
    
    logger.info('Processing reservation request', { spaceNumber, email });

    // Validate reservation time
    const currentTime = moment().tz(config.app.timezone);
    const formattedCheckoutTime = moment(checkoutTime).tz(config.app.timezone);
    
    this.validateReservationTime(formattedCheckoutTime, currentTime);

    // Check space availability
    const space = await this.parkingSpaceRepo.getBySpaceNumber(spaceNumber);
    
    if (space.reserved === true) {
      throw new ConflictError(`Parking space ${spaceNumber} is not available`);
    }

    // Calculate charge
    const charge = this.calculateCharge(currentTime, formattedCheckoutTime);
    
    // Create payment record
    const paymentId = this.generateId();
    const paymentData = {
      id: paymentId,
      userEmail: email,
      space_no: spaceNumber,
      reserve_time: currentTime.format(),
      checkout_time: formattedCheckoutTime.format(),
      charge,
      paymentStatus: 'unprocessed',
    };

    await this.paymentRepo.create(paymentData);

    logger.info('Reservation created successfully', { 
      paymentId, 
      spaceNumber, 
      charge 
    });

    return {
      charge,
      paymentId,
      spaceNumber,
      checkoutTime: formattedCheckoutTime.format(),
    };
  }

  async processPayment(paymentId) {
    logger.info('Processing payment', { paymentId });

    const payment = await this.paymentRepo.getById(paymentId);
    
    if (payment.paymentStatus === 'successful') {
      throw new ConflictError('Payment already processed successfully');
    }

    // Update payment status to processing
    await this.paymentRepo.updateStatus(paymentId, 'processing');

    return payment;
  }

  async confirmPayment(paymentId, paymentData) {
    logger.info('Confirming payment', { paymentId });

    const payment = await this.paymentRepo.getById(paymentId);
    
    // Update payment status to successful
    await this.paymentRepo.updateStatus(paymentId, 'successful', {
      transactionId: paymentData.transactionId,
      paymentMethod: paymentData.paymentMethod,
    });

    // Reserve the parking space
    await this.parkingSpaceRepo.updateReservationStatus(
      payment.space_no, 
      true, 
      payment.reserve_time
    );

    // Create reservation record
    const reservationData = {
      id: this.generateId(),
      paymentId,
      space_no: payment.space_no,
      userEmail: payment.userEmail,
      reserve_time: payment.reserve_time,
      checkout_time: payment.checkout_time,
      status: 'active',
    };

    await this.reservationRepo.create(reservationData);

    logger.info('Payment confirmed and space reserved', { 
      paymentId, 
      spaceNumber: payment.space_no 
    });

    return reservationData;
  }

  async checkOut(reservationId) {
    logger.info('Processing checkout', { reservationId });

    const reservation = await this.reservationRepo.getById(reservationId);
    
    if (reservation.status !== 'active') {
      throw new ConflictError('Reservation is not active');
    }

    // Free up the parking space
    await this.parkingSpaceRepo.updateReservationStatus(reservation.space_no, false);

    // Move reservation to history
    const historyData = {
      ...reservation,
      id: this.generateId(),
      originalReservationId: reservationId,
      checkoutTime: moment().tz(config.app.timezone).format(),
      status: 'completed',
    };

    await this.reservationHistoryRepo.create(historyData);

    // Delete active reservation
    await this.reservationRepo.delete(reservationId);

    logger.info('Checkout completed successfully', { 
      reservationId, 
      spaceNumber: reservation.space_no 
    });

    return historyData;
  }

  validateReservationTime(checkoutTime, currentTime) {
    if (checkoutTime.isBefore(currentTime)) {
      throw new ValidationError('Checkout time cannot be in the past');
    }

    if (checkoutTime.diff(currentTime, 'hours') > config.validation.maxReservationHours) {
      throw new ValidationError(
        `Reservation time cannot exceed ${config.validation.maxReservationHours} hours from now`
      );
    }

    if (checkoutTime.diff(currentTime, 'minutes') < config.validation.minReservationMinutes) {
      throw new ValidationError(
        `Minimum reservation time is ${config.validation.minReservationMinutes} minutes`
      );
    }
  }

  calculateCharge(currentTime, checkoutTime) {
    const reservationDateTime = currentTime.toDate();
    const checkoutDateTime = checkoutTime.toDate();
    const timeDifference = checkoutDateTime - reservationDateTime;
    
    if (timeDifference < 0) {
      return config.pricing.ratePerTenMinutes;
    }
    
    if (timeDifference < config.pricing.tenMinutesInMs) {
      return config.pricing.ratePerTenMinutes;
    }
    
    const numberOf10Mins = Math.ceil(timeDifference / config.pricing.tenMinutesInMs);
    return numberOf10Mins * config.pricing.ratePerTenMinutes;
  }

  generateId() {
    return require('uuid').v4();
  }
}

module.exports = ParkingService;