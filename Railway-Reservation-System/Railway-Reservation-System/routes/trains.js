const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Train = require('../models/Train');

// @route   GET api/trains
// @desc    Get all trains
// @access  Public
router.get('/', async (req, res) => {
    try {
        const trains = await Train.find().sort({ date: 1 });
        res.json(trains);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/trains/search
// @desc    Search trains by source and destination
// @access  Public
router.get('/search', async (req, res) => {
    const { source, destination, date } = req.query;

    try {
        const searchDate = date ? new Date(date) : null;

        // Build search query
        const searchQuery = {};
        if (source) searchQuery.source = new RegExp(source, 'i');
        if (destination) searchQuery.destination = new RegExp(destination, 'i');
        if (searchDate) {
            // Match the date (ignoring time)
            const nextDay = new Date(searchDate);
            nextDay.setDate(nextDay.getDate() + 1);

            searchQuery.date = {
                $gte: searchDate,
                $lt: nextDay
            };
        }

        const trains = await Train.find(searchQuery).sort({ departureTime: 1 });
        res.json(trains);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/trains/:id
// @desc    Get train by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const train = await Train.findById(req.params.id);

        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        res.json(train);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Train not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/trains
// @desc    Add a new train
// @access  Public (for admin panel)
router.post('/', async (req, res) => {
    const {
        trainNumber,
        trainName,
        source,
        destination,
        departureTime,
        arrivalTime,
        duration,
        distance,
        availableSeats,
        price,
        date
    } = req.body;

    try {
        // Check if train number already exists
        const existingTrain = await Train.findOne({ trainNumber });
        if (existingTrain) {
            return res.status(400).json({ msg: 'Train with this number already exists' });
        }

        const newTrain = new Train({
            trainNumber,
            trainName,
            source,
            destination,
            departureTime,
            arrivalTime,
            duration,
            distance,
            availableSeats,
            price,
            date: new Date(date)
        });

        const train = await newTrain.save();
        res.json(train);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/trains/:id
// @desc    Update a train
// @access  Public (for admin panel)
router.put('/:id', async (req, res) => {
    try {
        let train = await Train.findById(req.params.id);

        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        train = await Train.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        res.json(train);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Train not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/trains/:id
// @desc    Delete a train
// @access  Public (for admin panel)
router.delete('/:id', async (req, res) => {
    try {
        const train = await Train.findById(req.params.id);

        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        await train.deleteOne();
        res.json({ msg: 'Train removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Train not found' });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router; 