function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeTrainNumber(value) {
    return String(value || '').trim().replace(/\s+/g, '');
}

function normalizeTime(value) {
    const v = String(value || '').trim();
    if (!v || v === '--:--') return null;
    const match = v.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function parseBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const v = String(value).toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
}

function parseIntSafe(value, fallback = 0) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
}

function parseFloatSafe(value, fallback = null) {
    const n = parseFloat(value);
    return Number.isNaN(n) ? fallback : n;
}

function inferTrainTypeCode(trainName) {
    const n = String(trainName || '');
    if (/vande bharat/i.test(n)) return 'VB';
    if (/rajdhani/i.test(n)) return 'RAJ';
    if (/shatabdi/i.test(n)) return 'SHAT';
    if (/duronto/i.test(n)) return 'DUR';
    if (/superfast| express$/i.test(n)) return 'SF';
    return 'EXP';
}

function parseRunningDaysField(value) {
    if (!value || /^daily$/i.test(value)) return [1, 2, 3, 4, 5, 6, 7];
    const runningDayService = require('../../backend/services/runningDayService');
    return runningDayService.parseRunningDaysString(value);
}

module.exports = {
    normalizeCode,
    normalizeName,
    normalizeTrainNumber,
    normalizeTime,
    parseBool,
    parseIntSafe,
    parseFloatSafe,
    inferTrainTypeCode,
    parseRunningDaysField
};
