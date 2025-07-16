const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Train = require('../models/Train');
const User = require('../models/User');

// @route   GET api/bookings
// @desc    Get all bookings for current user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user.id })
            .populate('train', 'trainNumber trainName source destination departureTime arrivalTime date')
            .sort({ bookingDate: -1 });

        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/bookings/all
// @desc    Get all bookings (admin only)
// @access  Private/Admin
router.get('/all', auth, async (req, res) => {
    // Check if user is admin
    if (!req.user.isAdmin) {
        return res.status(401).json({ msg: 'Not authorized to view all bookings' });
    }

    try {
        const bookings = await Booking.find()
            .populate('train', 'trainNumber trainName source destination departureTime arrivalTime date')
            .populate('user', 'name email phone')
            .sort({ bookingDate: -1 });

        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('train', 'trainNumber trainName source destination departureTime arrivalTime date')
            .populate('user', 'name email phone');

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check if booking belongs to user or user is admin
        if (booking.user._id.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(401).json({ msg: 'Not authorized to view this booking' });
        }

        res.json(booking);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Booking not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', auth, async (req, res) => {
    const {
        trainId,
        passengers,
        journeyDate
    } = req.body;

    try {
        // Validate required fields
        if (!trainId || !passengers || !journeyDate) {
            return res.status(400).json({ msg: 'Please provide all required fields' });
        }

        // Validate passengers array
        if (!Array.isArray(passengers) || passengers.length === 0) {
            return res.status(400).json({ msg: 'Please provide at least one passenger' });
        }

        // Validate each passenger
        for (const passenger of passengers) {
            if (!passenger.name || !passenger.age || !passenger.gender) {
                return res.status(400).json({ msg: 'Invalid passenger details' });
            }
            if (!['Male', 'Female', 'Other'].includes(passenger.gender)) {
                return res.status(400).json({ msg: 'Invalid gender value' });
            }
        }

        // Check if train exists
        const train = await Train.findById(trainId);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        // Check if seats are available
        if (train.availableSeats < passengers.length) {
            return res.status(400).json({ msg: 'Not enough seats available' });
        }

        // Calculate total price
        const totalPrice = passengers.length * train.price;

        // Assign seat numbers (simplified version)
        let seatStart = train.availableSeats - passengers.length + 1;
        const seatNumbers = [];
        for (let i = 0; i < passengers.length; i++) {
            seatNumbers.push(seatStart + i);
        }

        // Create new booking
        const newBooking = new Booking({
            user: req.user.id,
            train: trainId,
            passengers,
            totalPrice,
            seatNumbers,
            journeyDate: new Date(journeyDate)
        });

        const booking = await newBooking.save();

        // Update available seats in train
        train.availableSeats -= passengers.length;
        await train.save();

        res.json(booking);
    } catch (err) {
        console.error('Booking creation error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Duplicate PNR number. Please try again.' });
        }
        res.status(500).json({ msg: 'Server error while creating booking' });
    }
});

// @route   PUT api/bookings/:id
// @desc    Update booking status (cancel booking)
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const { status } = req.body;

    // Check if status is valid
    if (status !== 'Confirmed' && status !== 'Cancelled') {
        return res.status(400).json({ msg: 'Invalid status' });
    }

    try {
        let booking = await Booking.findById(req.params.id).populate('train');

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        // Check if booking belongs to user or user is admin
        if (booking.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(401).json({ msg: 'Not authorized to update this booking' });
        }

        // If cancelling a confirmed booking, update seats
        if (booking.status === 'Confirmed' && status === 'Cancelled') {
            const train = booking.train;
            train.availableSeats += booking.passengers.length;
            await train.save();
        }

        // Update booking status
        booking.status = status;
        await booking.save();

        res.json(booking);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Booking not found' });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router; 