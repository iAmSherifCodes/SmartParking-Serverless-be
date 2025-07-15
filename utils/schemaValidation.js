const Joi = require("joi");
const { ValidationError } = require('./errors');

// Reservation schemas
const makeReservationSchema = Joi.object({
  checkoutTime: Joi.date()
    .greater('now')
    .max(Joi.date().add(24, 'hours'))
    .required()
    .messages({
      'date.greater': 'Checkout time cannot be in the past',
      'date.max': 'Checkout time cannot be more than 24 hours from now',
    }),
  spaceNumber: Joi.string()
    .length(2)
    .pattern(/^[A-Z0-9]{2}$/)
    .required()
    .messages({
      'string.length': 'Space number must be exactly 2 characters',
      'string.pattern.base': 'Space number must contain only letters and numbers',
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
    }),
});

const initiatePaymentSchema = Joi.object({
  paymentId: Joi.string()
    .min(5)
    .required()
    .messages({
      'string.min': 'Payment ID must be at least 5 characters',
    }),
});

const webhookSchema = Joi.object({
  event: Joi.string()
    .length(16)
    .required(),
  data: Joi.object()
    .required(),
});

// Query parameter schemas
const paginationSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
  cursor: Joi.string()
    .optional(),
});

// Database schemas
const parkingSpaceSchema = Joi.object({
  space_no: Joi.string().required(),
  reserved: Joi.boolean().required(),
  status: Joi.string().valid('available', 'reserved', 'maintenance').required(),
});

const reservationSchema = Joi.object({
  id: Joi.string().required(),
  space_no: Joi.string().required(),
  userEmail: Joi.string().email().required(),
  reserve_time: Joi.date().required(),
  checkout_time: Joi.date().required(),
  charge: Joi.number().positive().required(),
  paymentStatus: Joi.string().valid('unprocessed', 'processing', 'successful', 'failed').required(),
});

// Validation helper function
const validateSchema = (schema, data, options = {}) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new ValidationError('Validation failed', details);
  }

  return value;
};

module.exports = {
  schemas: {
    makeReservation: makeReservationSchema,
    initiatePayment: initiatePaymentSchema,
    webhook: webhookSchema,
    pagination: paginationSchema,
    parkingSpace: parkingSpaceSchema,
    reservation: reservationSchema,
  },
  validateSchema,
};
