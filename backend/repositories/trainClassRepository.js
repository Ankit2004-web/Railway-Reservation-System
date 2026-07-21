const { getPool } = require('../../database/connection');

const formatClass = (row) => ({
    id: row.id,
    trainId: row.trainId,
    classCode: row.classCode,
    className: row.className,
    price: Number(row.price),
    totalSeats: row.totalSeats,
    availableSeats: row.availableSeats
});

const findByTrainId = async (trainId) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .query('SELECT * FROM TrainClasses WHERE trainId = @trainId ORDER BY price ASC');
    return result.recordset.map(formatClass);
};

const findByTrainIds = async (trainIds) => {
    if (!trainIds.length) return {};

    const pool = await getPool();
    const request = pool.request();
    const placeholders = trainIds.map((id, index) => {
        request.input(`id${index}`, 'Int', id);
        return `@id${index}`;
    }).join(',');

    const result = await request.query(
        `SELECT * FROM TrainClasses WHERE trainId IN (${placeholders}) ORDER BY price ASC`
    );

    return result.recordset.reduce((acc, row) => {
        if (!acc[row.trainId]) acc[row.trainId] = [];
        acc[row.trainId].push(formatClass(row));
        return acc;
    }, {});
};

const findByTrainAndCode = async (trainId, classCode) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('classCode', 'NVarChar', classCode)
        .query('SELECT * FROM TrainClasses WHERE trainId = @trainId AND classCode = @classCode');
    return result.recordset[0] ? formatClass(result.recordset[0]) : null;
};

const createMany = async (trainId, classes) => {
    const pool = await getPool();

    for (const cls of classes) {
        await pool.request()
            .input('trainId', 'Int', trainId)
            .input('classCode', 'NVarChar', cls.classCode)
            .input('className', 'NVarChar', cls.className)
            .input('price', 'Decimal', cls.price)
            .input('totalSeats', 'Int', cls.totalSeats)
            .input('availableSeats', 'Int', cls.availableSeats)
            .query(`INSERT INTO TrainClasses (trainId, classCode, className, price, totalSeats, availableSeats)
                    VALUES (@trainId, @classCode, @className, @price, @totalSeats, @availableSeats)`);
    }
};

const findById = async (id) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .query('SELECT * FROM TrainClasses WHERE id = @id');
    return result.recordset[0] ? formatClass(result.recordset[0]) : null;
};

const update = async (id, { className, price, totalSeats, availableSeats }) => {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', 'Int', id)
        .input('className', 'NVarChar', className)
        .input('price', 'Decimal', price)
        .input('totalSeats', 'Int', totalSeats)
        .input('availableSeats', 'Int', availableSeats)
        .query(`UPDATE TrainClasses
                SET className = @className, price = @price, totalSeats = @totalSeats,
                    availableSeats = @availableSeats, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE id = @id`);
    return result.recordset[0] ? formatClass(result.recordset[0]) : null;
};

module.exports = {
    findByTrainId,
    findByTrainIds,
    findByTrainAndCode,
    findById,
    createMany,
    update
};
