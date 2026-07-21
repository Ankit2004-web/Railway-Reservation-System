const crypto = require('crypto');
const { getPool } = require('../../database/connection');

const createToken = async (userId) => {
    const pool = await getPool();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.request()
        .input('userId', 'Int', userId)
        .query(`UPDATE PasswordResetTokens SET used = 1 WHERE userId = @userId AND used = 0`);

    const result = await pool.request()
        .input('userId', 'Int', userId)
        .input('token', 'NVarChar', token)
        .input('expiresAt', 'DateTime2', expiresAt)
        .query(`INSERT INTO PasswordResetTokens (userId, token, expiresAt)
                OUTPUT INSERTED.*
                VALUES (@userId, @token, @expiresAt)`);

    return result.recordset[0];
};

const findValidToken = async (token) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('token', 'NVarChar', token)
        .query(`SELECT prt.*, u.email
                FROM PasswordResetTokens prt
                INNER JOIN Users u ON prt.userId = u.id
                WHERE prt.token = @token AND prt.used = 0 AND prt.expiresAt > SYSUTCDATETIME()`);

    return result.recordset[0] || null;
};

const markUsed = async (token) => {
    const pool = await getPool();
    await pool.request()
        .input('token', 'NVarChar', token)
        .query('UPDATE PasswordResetTokens SET used = 1 WHERE token = @token');
};

module.exports = { createToken, findValidToken, markUsed };
