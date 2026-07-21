const { getPool } = require('../../database/connection');

const findByTrainId = async (trainId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .query(`SELECT * FROM TrainStops WHERE trainId = @trainId ORDER BY stopOrder ASC`);
    return result.recordset;
};

const createMany = async (trainId, stops) => {
    const pool = await getPool();

    for (const stop of stops) {
        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('stationCode', 'NVarChar', stop.stationCode || null)
            .input('stationName', 'NVarChar', stop.stationName)
            .input('stopOrder', 'Int', stop.stopOrder)
            .input('arrivalTime', 'NVarChar', stop.arrivalTime || null)
            .input('departureTime', 'NVarChar', stop.departureTime || null)
            .input('haltMinutes', 'Int', stop.haltMinutes || 0)
            .input('distanceKm', 'Int', stop.distanceKm || null)
            .query(`INSERT INTO TrainStops (trainId, stationCode, stationName, stopOrder, arrivalTime, departureTime, haltMinutes, distanceKm)
                    VALUES (@trainId, @stationCode, @stationName, @stopOrder, @arrivalTime, @departureTime, @haltMinutes, @distanceKm)`);
    }
};

const replaceForTrain = async (trainId, stops) => {
    const pool = await getPool();
    await pool.request()
        .input('trainId', 'Int', trainId)
        .query('DELETE FROM TrainStops WHERE trainId = @trainId');

    if (stops?.length) {
        await createMany(trainId, stops);
    }
};

module.exports = { findByTrainId, createMany, replaceForTrain };
