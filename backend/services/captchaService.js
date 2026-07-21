const crypto = require('crypto');

const store = new Map();
const TTL_MS = 5 * 60 * 1000;

const cleanup = () => {
    const now = Date.now();
    for (const [id, entry] of store.entries()) {
        if (entry.expiresAt <= now) store.delete(id);
    }
};

setInterval(cleanup, 60 * 1000).unref();

const createChallenge = () => {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    const captchaId = crypto.randomBytes(16).toString('hex');

    store.set(captchaId, {
        answer: String(a + b),
        expiresAt: Date.now() + TTL_MS
    });

    return {
        captchaId,
        question: `${a} + ${b} = ?`
    };
};

const verifyChallenge = (captchaId, captchaAnswer) => {
    if (!captchaId || captchaAnswer === undefined || captchaAnswer === null) {
        return false;
    }

    const entry = store.get(captchaId);
    if (!entry || entry.expiresAt <= Date.now()) {
        store.delete(captchaId);
        return false;
    }

    const valid = String(captchaAnswer).trim() === entry.answer;
    store.delete(captchaId);
    return valid;
};

module.exports = { createChallenge, verifyChallenge };
