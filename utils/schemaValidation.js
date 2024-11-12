const Joi = require("joi");

const parkingReservationSchema = Joi.object({
    reservation_id: Joi.string().required(),
    space_id: Joi.string().required(),
    user_id: Joi.string().required(),
    reserve_time: Joi.date().optional(),
    start_time: Joi.date()
        .greater("now")
        .required()
        .messages({ "date.greater": "Start time cannot be in the past." }),
    end_time: Joi.date()
        .greater(Joi.ref("start_time"))
        .max(Joi.ref("start_time", { adjust: (start) => new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000) }))
        .required()
        .messages({
            "date.greater": "End time must be after the start time.",
            "date.max": "End time cannot be more than 2 days from the start time."
        })
});

const parkingSpaceSchema = Joi.object({
    space_id: Joi.string().required(),
    lot_id: Joi.string().required(),
    space_number: Joi.string().required(),
    status: Joi.string().valid("available", "reserved", "maintenance").required(),
    is_reserved: Joi.boolean().required(),
});

module.exports = { parkingReservationSchema, parkingSpaceSchema };
