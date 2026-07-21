/**
 * Links legacy seed data to normalized master-data columns.
 * Safe to run multiple times (idempotent).
 */
const { getPool, closePool } = require('./connection');
const runningDayService = require('../backend/services/runningDayService');

async function migrateMasterData() {
    const pool = await getPool();
    console.log('Migrating legacy data to master-data columns...');

    const status = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM TrainStops) AS totalStops,
            (SELECT COUNT(*) FROM TrainStops WHERE stationId IS NOT NULL) AS linkedStops,
            (SELECT COUNT(*) FROM Trains WHERE isActive = 1) AS totalTrains,
            (SELECT COUNT(*) FROM Trains WHERE sourceStationId IS NOT NULL AND destinationStationId IS NOT NULL) AS linkedTrains
    `);
    const { totalStops, linkedStops, totalTrains, linkedTrains } = status.recordset[0];
    const stopsAlreadyLinked = totalStops > 0 && linkedStops === totalStops;
    const trainsAlreadyLinked = totalTrains > 0 && linkedTrains === totalTrains;

    if (stopsAlreadyLinked && trainsAlreadyLinked) {
        console.log('Master-data columns already populated — skipping migration.');
        return;
    }

    const states = await pool.request().query('SELECT DISTINCT state FROM Stations WHERE state IS NOT NULL');
    for (const row of states.recordset) {
        const name = row.state.trim();
        const existing = await pool.request().input('name', 'NVarChar', name)
            .query('SELECT id FROM States WHERE name = @name');
        if (!existing.recordset[0]) {
            await pool.request().input('name', 'NVarChar', name)
                .query('INSERT INTO States (name) VALUES (@name)');
        }
    }

    const stateRows = await pool.request().query('SELECT id, name FROM States');
    const stateMap = new Map(stateRows.recordset.map((s) => [s.name.toLowerCase(), s.id]));

    await pool.request().query(`
        UPDATE s SET s.normalizedName = LOWER(LTRIM(RTRIM(s.name))),
                     s.stateId = st.id, s.isActive = 1
        FROM Stations s
        LEFT JOIN States st ON LOWER(st.name) = LOWER(s.state)
        WHERE s.normalizedName IS NULL OR s.stateId IS NULL
    `);

    const stations = await pool.request().query('SELECT id, code, name FROM Stations');
    const byName = new Map(stations.recordset.map((s) => [s.name.toLowerCase(), s]));

    const trains = await pool.request().query('SELECT id, source, destination, runningDays FROM Trains');
    if (!trainsAlreadyLinked) {
        for (const train of trains.recordset) {
        const src = byName.get(train.source.toLowerCase());
        const dst = byName.get(train.destination.toLowerCase());
        if (src && dst) {
            await pool.request()
                .input('id', 'Int', train.id)
                .input('srcId', 'Int', src.id)
                .input('dstId', 'Int', dst.id)
                .query(`UPDATE Trains SET sourceStationId=@srcId, destinationStationId=@dstId,
                        normalizedName=LOWER(trainName), isActive=1 WHERE id=@id`);
        }

        const days = runningDayService.parseRunningDaysString(train.runningDays);
        for (const dow of days) {
            const ex = await pool.request()
                .input('trainId', 'Int', train.id)
                .input('dow', 'TinyInt', dow)
                .query('SELECT id FROM TrainRunningDays WHERE trainId=@trainId AND dayOfWeek=@dow');
            if (!ex.recordset[0]) {
                await pool.request()
                    .input('trainId', 'Int', train.id)
                    .input('dow', 'TinyInt', dow)
                    .query('INSERT INTO TrainRunningDays (trainId, dayOfWeek, runs) VALUES (@trainId, @dow, 1)');
            }
        }
    }
    }

    if (stopsAlreadyLinked) {
        console.log('Train stops already linked — skipping stop day-offset migration.');
        console.log('Master-data migration completed.');
        return;
    }

    const stops = await pool.request().query(`
        SELECT ts.id, ts.trainId, ts.stationCode, ts.stationName, ts.stopOrder,
               ts.arrivalTime, ts.departureTime, ts.distanceKm
        FROM TrainStops ts
        ORDER BY ts.trainId, ts.stopOrder
    `);

    let prevByTrain = {};
    for (const stop of stops.recordset) {
        const st = stop.stationCode
            ? stations.recordset.find((s) => s.code === stop.stationCode)
            : byName.get(stop.stationName.toLowerCase());

        let arrOffset = 0;
        let depOffset = 0;
        const prev = prevByTrain[stop.trainId];
        if (prev) {
            depOffset = prev.depOffset;
            if (stop.arrivalTime && prev.depTime) {
                const arrM = runningDayService.parseTimeToMinutes(stop.arrivalTime);
                const depM = runningDayService.parseTimeToMinutes(prev.depTime);
                if (arrM != null && depM != null && arrM < depM) {
                    depOffset = prev.depOffset + 1;
                }
            }
            arrOffset = depOffset;
            if (stop.departureTime && stop.arrivalTime) {
                const depM = runningDayService.parseTimeToMinutes(stop.departureTime);
                const arrM = runningDayService.parseTimeToMinutes(stop.arrivalTime);
                if (depM != null && arrM != null && depM < arrM) {
                    depOffset = arrOffset + 1;
                } else {
                    depOffset = arrOffset;
                }
            }
        }

        await pool.request()
            .input('id', 'Int', stop.id)
            .input('stationId', 'Int', st?.id || null)
            .input('arrOff', 'Int', arrOffset)
            .input('depOff', 'Int', depOffset)
            .query(`UPDATE TrainStops SET stationId=@stationId, arrivalDayOffset=@arrOff,
                    departureDayOffset=@depOff WHERE id=@id`);

        prevByTrain[stop.trainId] = {
            depTime: stop.departureTime || stop.arrivalTime,
            depOffset
        };
    }

    console.log('Master-data migration completed.');
}

if (require.main === module) {
    migrateMasterData()
        .then(() => closePool())
        .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = migrateMasterData;
