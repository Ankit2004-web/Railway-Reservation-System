const { getPool } = require('../../database/connection');

const BERTH_TYPES = ['LB', 'MB', 'UB', 'SL', 'SU', 'WS'];

const getBerthType = (seatNumber, classCode) => {
    if (['CC', 'EC', '2S'].includes(classCode)) return 'WS';
    const cycle = (seatNumber - 1) % 8;
    if (cycle < 2) return 'LB';
    if (cycle < 4) return 'MB';
    if (cycle < 6) return 'UB';
    if (cycle === 6) return 'SL';
    return 'SU';
};

const formatSeat = (row) => ({
    id: row.id,
    seatNumber: row.seatNumber,
    berthType: row.berthType,
    status: row.status,
    classCode: row.classCode
});

const getSeatMap = async (trainId, classCode, journeyDate) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .input('journeyDate', 'Date', journeyDate)
        .query(`SELECT * FROM Seats
                WHERE trainId = @trainId AND classCode = @classCode AND journeyDate = @journeyDate
                ORDER BY seatNumber ASC`);

    if (result.recordset.length) {
        return result.recordset.map(formatSeat);
    }

    const classResult = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .query('SELECT availableSeats FROM TrainClasses WHERE trainId = @trainId AND classCode = @classCode');

    const availableSeats = classResult.recordset[0]?.availableSeats || 0;
    return Array.from({ length: availableSeats }, (_, index) => ({
        id: null,
        seatNumber: index + 1,
        berthType: getBerthType(index + 1, classCode),
        status: 'Available',
        classCode
    }));
};

const seedSeatsForClass = async (trainId, classCode, totalSeats, journeyDate) => {
    const pool = await getPool();

    for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
        const berthType = getBerthType(seatNumber, classCode);
        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('classCode', 'NVarChar', classCode)
            .input('seatNumber', 'Int', seatNumber)
            .input('berthType', 'NVarChar', berthType)
            .input('journeyDate', 'Date', journeyDate)
            .query(`INSERT INTO Seats (trainId, classCode, seatNumber, berthType, journeyDate, status)
                    VALUES (@trainId, @classCode, @seatNumber, @berthType, @journeyDate, 'Available')`);
    }
};

const validateAndLockSeats = async (query, { trainId, classCode, journeyDate, seatNumbers, bookingId }) => {
    const totalRows = await query(
        'SELECT COUNT(*) AS count FROM Seats WHERE trainId = ? AND classCode = ? AND journeyDate = ?',
        [trainId, classCode, journeyDate]
    );

    if (!totalRows[0]?.count) {
        return { ok: true, legacyMode: true };
    }

    for (const seatNumber of seatNumbers) {
        const rows = await query(
            `SELECT * FROM Seats WITH (UPDLOCK, ROWLOCK)
             WHERE trainId = ? AND classCode = ? AND journeyDate = ? AND seatNumber = ?`,
            [trainId, classCode, journeyDate, seatNumber]
        );

        const seat = rows[0];
        if (!seat) {
            return { error: `Seat ${seatNumber} does not exist`, status: 400 };
        }
        if (seat.status !== 'Available') {
            return { error: `Seat ${seatNumber} is not available`, status: 400 };
        }

        await query(
            `UPDATE Seats SET status = 'Booked', bookingId = ?, updatedAt = SYSUTCDATETIME()
             WHERE id = ?`,
            [bookingId, seat.id]
        );
    }

    return { ok: true };
};

const releaseSeatsForBooking = async (query, bookingId) => {
    await query(
        `UPDATE Seats SET status = 'Available', bookingId = NULL, updatedAt = SYSUTCDATETIME()
         WHERE bookingId = ?`,
        [bookingId]
    );
};

const countAvailableSeats = async (trainId, classCode, journeyDate) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .input('journeyDate', 'Date', journeyDate)
        .query(`SELECT COUNT(*) AS seatCount FROM Seats
                WHERE trainId = @trainId AND classCode = @classCode AND journeyDate = @journeyDate AND status = 'Available'`);

    const seatCount = result.recordset[0].seatCount;
    if (seatCount > 0) return seatCount;

    const classResult = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .query('SELECT availableSeats FROM TrainClasses WHERE trainId = @trainId AND classCode = @classCode');

    return classResult.recordset[0]?.availableSeats || 0;
};

module.exports = {
    BERTH_TYPES,
    getBerthType,
    getSeatMap,
    seedSeatsForClass,
    validateAndLockSeats,
    releaseSeatsForBooking,
    countAvailableSeats
};
