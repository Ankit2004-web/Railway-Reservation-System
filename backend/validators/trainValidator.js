const { body } = require('express-validator');

const trainRules = [
    body('trainNumber').trim().notEmpty().withMessage('Train number is required'),
    body('trainName').trim().notEmpty().withMessage('Train name is required'),
    body('source').trim().notEmpty().withMessage('Source is required'),
    body('destination').trim().notEmpty().withMessage('Destination is required'),
    body('departureTime').trim().notEmpty().withMessage('Departure time is required'),
    body('arrivalTime').trim().notEmpty().withMessage('Arrival time is required'),
    body('duration').trim().notEmpty().withMessage('Duration is required'),
    body('distance').isInt({ min: 1 }).withMessage('Distance must be a positive number'),
    body('availableSeats').isInt({ min: 0 }).withMessage('Available seats must be 0 or more'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('date').isISO8601().withMessage('Valid date is required')
];

module.exports = { trainRules };
