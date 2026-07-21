const { getPool } = require('../../database/connection');

const findByBookingId = async (bookingId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('bookingId', 'Int', bookingId)
        .query('SELECT * FROM Refunds WHERE bookingId = @bookingId');
    return result.recordset[0] || null;
};

const create = async (query, { bookingId, originalAmount, refundAmount, refundPercent, cancellationCharge, reason }) => {
    const rows = await query(
        `INSERT INTO Refunds (bookingId, originalAmount, refundAmount, refundPercent, cancellationCharge, reason)
         OUTPUT INSERTED.*
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookingId, originalAmount, refundAmount, refundPercent, cancellationCharge, reason]
    );
    return rows[0];
};

const findAll = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT r.*, b.pnrNumber, b.journeyDate, u.name AS userName, u.email AS userEmail
        FROM Refunds r
        INNER JOIN Bookings b ON r.bookingId = b.id
        INNER JOIN Users u ON b.userId = u.id
        ORDER BY r.createdAt DESC
    `);
    return result.recordset;
};

const getSummary = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT COUNT(*) AS totalRefunds,
               ISNULL(SUM(refundAmount), 0) AS totalRefunded,
               ISNULL(SUM(cancellationCharge), 0) AS totalCharges
        FROM Refunds
    `);
    return result.recordset[0];
};

module.exports = { findByBookingId, create, findAll, getSummary };
