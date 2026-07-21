const express = require('express');
const router = express.Router();
const { createChallenge } = require('../services/captchaService');

router.get('/', (req, res) => {
    res.json(createChallenge());
});

module.exports = router;
