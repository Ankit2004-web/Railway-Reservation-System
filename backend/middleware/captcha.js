const { verifyChallenge } = require('../services/captchaService');

const validateCaptcha = (req, res, next) => {
    const { captchaId, captchaAnswer } = req.body;

    if (!verifyChallenge(captchaId, captchaAnswer)) {
        return res.status(400).json({ msg: 'Invalid or expired captcha. Please try again.' });
    }

    next();
};

module.exports = validateCaptcha;
