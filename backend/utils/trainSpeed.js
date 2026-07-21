/** Typical operational avg speed bands (km/h) for Indian Railways train categories. */
const TRAIN_SPEED_RANGES = {
    PASS: { min: 30, max: 40, typical: 35 },
    EXP: { min: 50, max: 60, typical: 55 },
    SF: { min: 50, max: 60, typical: 58 },
    RAJ: { min: 80, max: 95, typical: 88 },
    SHAT: { min: 80, max: 95, typical: 90 },
    DUR: { min: 80, max: 95, typical: 85 },
    TEJAS: { min: 80, max: 95, typical: 92 },
    VB: { min: 130, max: 160, typical: 145 }
};

function inferTrainSpeedCategory(trainTypeCode, trainName = '') {
    const code = String(trainTypeCode || '').toUpperCase();
    const name = String(trainName || '');

    if (code === 'VB' || /vande bharat/i.test(name)) return 'VB';
    if (/tejas/i.test(name)) return 'TEJAS';
    if (code === 'RAJ' || /rajdhani/i.test(name)) return 'RAJ';
    if (code === 'SHAT' || /shatabdi/i.test(name)) return 'SHAT';
    if (code === 'DUR' || /duronto/i.test(name)) return 'DUR';
    if (code === 'PASS' || /passenger|memu|demu|\blocal\b/i.test(name)) return 'PASS';
    if (code === 'SF' || /superfast|super fast|\bsf\b/i.test(name)) return 'SF';
    return 'EXP';
}

function computeAvgSpeedKmh(distanceKm, durationMinutes, trainTypeCode, trainName) {
    const category = inferTrainSpeedCategory(trainTypeCode, trainName);
    const range = TRAIN_SPEED_RANGES[category] || TRAIN_SPEED_RANGES.EXP;

    if (!distanceKm || !durationMinutes || durationMinutes <= 0) {
        return range.typical;
    }

    const raw = distanceKm / (durationMinutes / 60);
    return Math.round(Math.min(range.max, Math.max(range.min, raw)));
}

module.exports = {
    TRAIN_SPEED_RANGES,
    inferTrainSpeedCategory,
    computeAvgSpeedKmh
};
