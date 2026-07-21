const { body } = require('express-validator');

const updateUserRules = [
    body('isAdmin').optional().isBoolean().withMessage('isAdmin must be boolean'),
    body('isBlocked').optional().isBoolean().withMessage('isBlocked must be boolean')
];

module.exports = { updateUserRules };
