/**
 * Backfill TrainRunningDays from Trains.runningDays text.
 * Trains without parseable schedule default to daily (Mon–Sun).
 */
const { getPool, closePool } = require('./connection');
const runningDayService = require('../backend/services/runningDayService');

async function backfillRunningDays() {
    const pool = await getPool();
    console.log('Backfilling TrainRunningDays...');

    const trains = await pool.request().query(`
        SELECT id, runningDays FROM Trains WHERE isActive = 1
    `);

    let updatedTrains = 0;
    let insertedRows = 0;

    for (const train of trains.recordset) {
        const days = runningDayService.resolveRunningDayList(train.runningDays);
        const label = runningDayService.runningDaysLabel(days);

        if (train.runningDays !== label) {
            await pool.request()
                .input('id', 'Int', train.id)
                .input('runningDays', 'NVarChar', label)
                .query('UPDATE Trains SET runningDays = @runningDays WHERE id = @id');
            updatedTrains += 1;
        }

        for (const dow of days) {
            const existing = await pool.request()
                .input('trainId', 'Int', train.id)
                .input('dow', 'TinyInt', dow)
                .query('SELECT id, runs FROM TrainRunningDays WHERE trainId = @trainId AND dayOfWeek = @dow');

            if (!existing.recordset[0]) {
                await pool.request()
                    .input('trainId', 'Int', train.id)
                    .input('dow', 'TinyInt', dow)
                    .query('INSERT INTO TrainRunningDays (trainId, dayOfWeek, runs) VALUES (@trainId, @dow, 1)');
                insertedRows += 1;
            } else if (!existing.recordset[0].runs) {
                await pool.request()
                    .input('id', 'Int', existing.recordset[0].id)
                    .query('UPDATE TrainRunningDays SET runs = 1 WHERE id = @id');
                insertedRows += 1;
            }
        }
    }

    console.log(`Updated ${updatedTrains} train runningDays labels.`);
    console.log(`Inserted/updated ${insertedRows} TrainRunningDays rows.`);
    console.log('Backfill complete.');
}

backfillRunningDays()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => closePool());
