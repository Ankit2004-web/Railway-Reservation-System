const { getPool } = require('../../database/connection');

const create = async ({ bookingId, razorpayOrderId, amount, currency = 'INR' }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('bookingId', 'Int', bookingId)
        .input('razorpayOrderId', 'NVarChar', razorpayOrderId)
        .input('amount', 'Decimal', amount)
        .input('currency', 'NVarChar', currency)
        .query(`INSERT INTO Payments (bookingId, razorpayOrderId, amount, currency, status)
                OUTPUT INSERTED.*
                VALUES (@bookingId, @razorpayOrderId, @amount, @currency, 'Pending')`);
    return result.recordset[0];
};

const findByBookingId = async (bookingId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('bookingId', 'Int', bookingId)
        .query('SELECT TOP 1 * FROM Payments WHERE bookingId = @bookingId ORDER BY createdAt DESC');
    return result.recordset[0] || null;
};

const markPaid = async (bookingId, razorpayPaymentId) => {
    const pool = await getPool();
    await pool.request()
        .input('bookingId', 'Int', bookingId)
        .input('razorpayPaymentId', 'NVarChar', razorpayPaymentId)
        .query(`UPDATE Payments SET status = 'Paid', razorpayPaymentId = @razorpayPaymentId, updatedAt = SYSUTCDATETIME()
                WHERE bookingId = @bookingId AND status = 'Pending'`);
};

const markFailed = async (bookingId) => {
    const pool = await getPool();
    await pool.request()
        .input('bookingId', 'Int', bookingId)
        .query(`UPDATE Payments SET status = 'Failed', updatedAt = SYSUTCDATETIME()
                WHERE bookingId = @bookingId AND status = 'Pending'`);
};

const markRefunded = async (bookingId) => {
    const pool = await getPool();
    await pool.request()
        .input('bookingId', 'Int', bookingId)
        .query(`UPDATE Payments SET status = 'Refunded', updatedAt = SYSUTCDATETIME()
                WHERE bookingId = @bookingId AND status = 'Paid'`);
};

module.exports = {
    create,
    findByBookingId,
    markPaid,
    markFailed,
    markRefunded
};
