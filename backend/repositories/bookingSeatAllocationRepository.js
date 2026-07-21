const { getPool } = require('../../database/connection');
const { canAllocateSeat } = require('../utils/segmentOverlap');

async function createForPassengers(query, { passengerIds, fromStopSequence, toStopSequence, bookingStatus = 'Confirmed' }) {
    if (!fromStopSequence || !toStopSequence || !passengerIds?.length) return;

    for (const passengerId of passengerIds) {
        await query(
            `INSERT INTO BookingSeatAllocations (passengerId, journeySeatId, fromStopSequence, toStopSequence, bookingStatus)
             VALUES (?, NULL, ?, ?, ?)`,
            [passengerId, fromStopSequence, toStopSequence, bookingStatus]
        );
    }
}

async function countOverlappingAllocations({ trainId, journeyDate, classCode, fromStopSequence, toStopSequence }) {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('journeyDate', 'Date', journeyDate)
        .input('classCode', 'NVarChar', classCode)
        .input('fromSeq', 'Int', fromStopSequence)
        .input('toSeq', 'Int', toStopSequence)
        .query(`
            SELECT COUNT(*) AS overlapCount
            FROM BookingSeatAllocations bsa
            INNER JOIN Passengers p ON bsa.passengerId = p.id
            INNER JOIN Bookings b ON p.bookingId = b.id
            WHERE b.trainId = @trainId
              AND b.journeyDate = @journeyDate
              AND b.classCode = @classCode
              AND b.status IN ('Confirmed', 'Pending', 'RAC')
              AND bsa.fromStopSequence < @toSeq
              AND @fromSeq < bsa.toStopSequence
        `);

    return result.recordset[0]?.overlapCount || 0;
}

async function getAllocationsForSeatCheck(trainId, journeyDate, classCode) {
    const pool = await getPool();
    const result = await pool.request()
        .input('trainId', 'Int', trainId)
        .input('journeyDate', 'Date', journeyDate)
        .input('classCode', 'NVarChar', classCode)
        .query(`
            SELECT bsa.fromStopSequence, bsa.toStopSequence
            FROM BookingSeatAllocations bsa
            INNER JOIN Passengers p ON bsa.passengerId = p.id
            INNER JOIN Bookings b ON p.bookingId = b.id
            WHERE b.trainId = @trainId
              AND b.journeyDate = @journeyDate
              AND b.classCode = @classCode
              AND b.status IN ('Confirmed', 'Pending', 'RAC')
        `);

    return result.recordset;
}

function segmentHasCapacity(existingAllocations, fromStopSequence, toStopSequence, totalSeats, needed) {
    const overlapping = existingAllocations.filter((a) =>
        a.fromStopSequence < toStopSequence && fromStopSequence < a.toStopSequence
    ).length;
    return overlapping + needed <= totalSeats;
}

module.exports = {
    createForPassengers,
    countOverlappingAllocations,
    getAllocationsForSeatCheck,
    segmentHasCapacity,
    canAllocateSeat
};
