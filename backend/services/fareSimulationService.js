/**
 * Development fare simulation engine (Category B — NOT official Indian Railways fares).
 */
const { getPool } = require('../../database/connection');

async function getFareRule(travelClassCode, trainTypeCode) {
    const pool = await getPool();
    const result = await pool.request()
        .input('classCode', 'NVarChar', travelClassCode)
        .input('typeCode', 'NVarChar', trainTypeCode || null)
        .query(`
            SELECT TOP 1 fr.*
            FROM FareRules fr
            INNER JOIN TravelClasses tc ON tc.id = fr.travelClassId
            LEFT JOIN TrainTypes tt ON tt.id = fr.trainTypeId
            WHERE tc.code = @classCode
              AND (fr.trainTypeId IS NULL OR tt.code = @typeCode)
              AND fr.effectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
              AND (fr.effectiveTo IS NULL OR fr.effectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
            ORDER BY CASE WHEN fr.trainTypeId IS NULL THEN 1 ELSE 0 END
        `);
    return result.recordset[0] || null;
}

async function getExactSegmentFare({ trainId, fromStationId, toStationId, travelClassCode, quotaCode }) {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('fromId', 'Int', fromStationId)
        .input('toId', 'Int', toStationId)
        .input('classCode', 'NVarChar', travelClassCode)
        .input('quotaCode', 'NVarChar', quotaCode || 'GN')
        .query(`
            SELECT TOP 1 tsf.fare
            FROM TrainSegmentFares tsf
            INNER JOIN TravelClasses tc ON tc.id = tsf.travelClassId
            LEFT JOIN Quotas q ON q.id = tsf.quotaId
            WHERE tsf.trainId = @trainId
              AND tsf.fromStationId = @fromId
              AND tsf.toStationId = @toId
              AND tc.code = @classCode
              AND (tsf.quotaId IS NULL OR q.code = @quotaCode)
              AND tsf.effectiveFrom <= CAST(SYSUTCDATETIME() AS DATE)
              AND (tsf.effectiveTo IS NULL OR tsf.effectiveTo >= CAST(SYSUTCDATETIME() AS DATE))
        `);
    return result.recordset[0]?.fare ?? null;
}

function defaultRateForClass(classCode) {
    const rates = { '1A': 4.5, '2A': 2.8, '3A': 2.0, '3E': 1.8, SL: 0.8, CC: 1.5, EC: 2.2, '2S': 0.5 };
    return rates[classCode] || 1.0;
}

async function calculateEstimatedFare({
    trainId,
    trainTypeCode,
    distanceKm,
    travelClassCode,
    quotaCode,
    passengerCount = 1,
    fromStationId,
    toStationId
}) {
    if (fromStationId && toStationId) {
        const exact = await getExactSegmentFare({
            trainId, fromStationId, toStationId, travelClassCode, quotaCode
        });
        if (exact != null) {
            return buildFareBreakdown(exact, passengerCount, travelClassCode, quotaCode, 'exact_authorized_dataset');
        }
    }

    const rule = await getFareRule(travelClassCode, trainTypeCode);
    const rate = rule?.baseRatePerKm ?? defaultRateForClass(travelClassCode);
    let baseFare = Math.max(rule?.minimumFare || 0, Math.round(distanceKm * rate));
    if (/RAJ|DUR|VB|SHAT|SF/i.test(trainTypeCode || '')) {
        baseFare = Math.round(baseFare * 1.15);
    }

    let perPassenger = baseFare;
    if (quotaCode === 'SS' || quotaCode === 'SeniorCitizen') perPassenger = Math.round(perPassenger * 0.6);
    if (quotaCode === 'TQ' || quotaCode === 'Tatkal') perPassenger = Math.round(perPassenger * 1.3);

    const reservation = (rule?.reservationCharge ?? 40) * passengerCount;
    const superfast = (rule?.superfastCharge ?? 0) * passengerCount;
    const total = perPassenger * passengerCount + reservation + superfast;

    return buildFareBreakdown(total, passengerCount, travelClassCode, quotaCode, 'development_simulation', {
        baseFare: perPassenger * passengerCount,
        reservationCharge: reservation,
        superfastCharge: superfast,
        distanceKm
    });
}

function buildFareBreakdown(total, passengerCount, classCode, quotaCode, source, extra = {}) {
    return {
        totalFare: total,
        passengerCount,
        classCode,
        quotaCode: quotaCode || 'GN',
        fareSource: source,
        isSimulated: source === 'development_simulation',
        ...extra
    };
}

async function seedDefaultFareRulesIfEmpty() {
    const pool = await getPool();
    const count = await pool.request().query('SELECT COUNT(*) AS c FROM FareRules');
    if (count.recordset[0].c > 0) return;

    const classes = await pool.request().query('SELECT id, code FROM TravelClasses');
    for (const cls of classes.recordset) {
        await pool.request()
            .input('tcId', 'Int', cls.id)
            .input('rate', 'Decimal', defaultRateForClass(cls.code))
            .input('min', 'Decimal', cls.code === '2S' ? 30 : 100)
            .query(`INSERT INTO FareRules (travelClassId, baseRatePerKm, minimumFare, reservationCharge, superfastCharge)
                    VALUES (@tcId, @rate, @min, 40, 20)`);
    }
}

module.exports = {
    calculateEstimatedFare,
    getExactSegmentFare,
    seedDefaultFareRulesIfEmpty
};
