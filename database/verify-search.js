const { getPool, closePool } = require('./connection');
const trainSearchService = require('../backend/services/trainSearchService');

async function verify() {
    const pool = await getPool();
    const c = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM Stations WHERE isActive = 1) AS stations,
            (SELECT COUNT(*) FROM Trains WHERE isActive = 1) AS trains,
            (SELECT COUNT(*) FROM TrainStops) AS trainStops,
            (SELECT COUNT(*) FROM TrainRunningDays WHERE runs = 1) AS runningDays,
            (SELECT COUNT(*) FROM TrainClasses WHERE isAvailable = 1) AS trainClasses,
            (SELECT COUNT(*) FROM TrainStops WHERE stationId IS NOT NULL) AS linkedStops
    `);
    console.log('DB counts:', c.recordset[0]);

    const ndlsBct = await trainSearchService.search({ from: 'NDLS', to: 'BCT', date: '2026-07-25' });
    console.log('NDLS->BCT:', ndlsBct.length, ndlsBct.map((t) => t.trainNumber));

    const intermediate = await trainSearchService.search({ from: 'GWL', to: 'BPL', date: '2026-07-25' });
    console.log('GWL->BPL intermediate:', intermediate.length);

    const reverse = await trainSearchService.search({ from: 'DEVD', to: 'DEVB', date: '2026-07-25' });
    console.log('DEVD->DEVB (invalid reverse):', reverse.length);

    await closePool();
}

verify().catch((err) => {
    console.error(err);
    process.exit(1);
});
