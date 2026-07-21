const { body } = require('express-validator');

const trainStopsRules = [
    body('stops').isArray({ min: 1 }).withMessage('At least one stop is required'),
    body('stops.*.stationName').trim().notEmpty().withMessage('Station name is required'),
    body('stops.*.stopOrder').isInt({ min: 1 }).withMessage('Stop order must be a positive integer'),
    body('stops.*.haltMinutes').optional().isInt({ min: 0 }).withMessage('Invalid halt minutes'),
    body('stops.*.distanceKm').optional().isInt({ min: 0 }).withMessage('Invalid distance')
];

const trainClassUpdateRules = [
    body('className').trim().notEmpty().withMessage('Class name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('totalSeats').isInt({ min: 1 }).withMessage('Total seats must be at least 1'),
    body('availableSeats').isInt({ min: 0 }).withMessage('Available seats must be non-negative')
];

const stationImportRules = [
    body('stations').isArray({ min: 1 }).withMessage('stations array is required'),
    body('stations.*.code').trim().notEmpty().withMessage('Station code is required'),
    body('stations.*.name').trim().notEmpty().withMessage('Station name is required'),
    body('stations.*.city').trim().notEmpty().withMessage('City is required'),
    body('stations.*.state').trim().notEmpty().withMessage('State is required')
];

module.exports = { trainStopsRules, trainClassUpdateRules, stationImportRules };
