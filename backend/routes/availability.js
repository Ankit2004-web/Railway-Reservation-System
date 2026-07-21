const express = require('express');
const router = express.Router();
const availabilityService = require('../services/availabilityService');
const trainSearchService = require('../services/trainSearchService');
const trainStopRepository = require('../repositories/trainStopRepository');

/**
 * GET /api/availability/check
 * Development availability simulation (Category B).
 */
router.get('/check', async (req, res) => {
    const {
        trainId,
        from,
        to,
        date,
        class: classCode,
        quota
    } = req.query;

    if (!trainId || !from || !to || !date || !classCode) {
        return res.status(400).json({ msg: 'trainId, from, to, date, and class are required' });
    }

    try {
        const fromStation = await trainSearchService.resolveStation(from);
        const toStation = await trainSearchService.resolveStation(to);
        if (!fromStation || !toStation) {
            return res.status(404).json({ msg: 'Station not found' });
        }

        const stops = await trainStopRepository.findByTrainId(trainId);
        const fromStop = stops.find((s) => s.stationId === fromStation.id || s.stationCode === fromStation.code);
        const toStop = stops.find((s) => s.stationId === toStation.id || s.stationCode === toStation.code);
        if (!fromStop || !toStop || fromStop.stopOrder >= toStop.stopOrder) {
            return res.status(400).json({ msg: 'Invalid route segment' });
        }

        const result = await availabilityService.checkAvailability({
            trainId: Number(trainId),
            journeyDate: date,
            classCode,
            fromStopSequence: fromStop.stopOrder,
            toStopSequence: toStop.stopOrder,
            quota: quota || 'GN'
        });

        res.json({
            trainId: Number(trainId),
            from: fromStation.code,
            to: toStation.code,
            journeyDate: date,
            classCode,
            quota: quota || 'GN',
            ...result,
            disclaimer: 'Development availability simulation — not official IRCTC inventory'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
