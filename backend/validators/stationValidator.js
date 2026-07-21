const { body } = require('express-validator');

const stationRules = [
    body('code').trim().notEmpty().isLength({ max: 10 }).withMessage('Station code is required'),
    body('name').trim().notEmpty().withMessage('Station name is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required')
];

module.exports = { stationRules };
