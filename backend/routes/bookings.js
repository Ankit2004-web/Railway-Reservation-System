const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validate = require('../middleware/validate');
const validateCaptcha = require('../middleware/captcha');
const { bookingLimiter } = require('../middleware/rateLimit');
const { bookingRules, updateBookingRules } = require('../validators/bookingValidator');
const bookingRepository = require('../repositories/bookingRepository');
const trainRepository = require('../repositories/trainRepository');
const trainClassRepository = require('../repositories/trainClassRepository');
const seatRepository = require('../repositories/seatRepository');
const { isTatkalEligible, getTatkalPrice } = require('../utils/tatkal');
const { generateTicketPdf } = require('../services/ticketService');
const { calculateBookingFare } = require('../utils/fare');
const { VALID_QUOTAS } = require('../utils/quota');

router.get('/pnr/:pnr', async (req, res) => {
    try {
        const booking = await bookingRepository.findByPnr(req.params.pnr.trim());

        if (!booking) {
            return res.status(404).json({ msg: 'No booking found for this PNR' });
        }

        res.json({
            pnrNumber: booking.pnrNumber,
            status: booking.status,
            journeyDate: booking.journeyDate,
            bookingDate: booking.bookingDate,
            classCode: booking.classCode,
            className: booking.className,
            bookingType: booking.bookingType,
            paymentStatus: booking.paymentStatus,
            waitlistPosition: booking.waitlistPosition,
            quota: booking.quota,
            totalPrice: booking.totalPrice,
            seatNumbers: booking.seatNumbers,
            train: booking.train,
            passengers: booking.passengers,
            bookedBy: booking.user.name
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const bookings = await bookingRepository.findByUserId(req.user.id);
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/all', auth, admin, async (req, res) => {
    try {
        const bookings = await bookingRepository.findAll();
        res.json(bookings);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/refund-preview', auth, async (req, res) => {
    try {
        const result = await bookingRepository.getRefundPreview(
            req.params.id,
            req.user.id,
            req.user.isAdmin
        );

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.json(result.refund);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id/ticket', auth, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized to download this ticket' });
        }

        if (booking.status !== 'Confirmed') {
            return res.status(400).json({ msg: 'E-ticket is available only for confirmed bookings' });
        }

        const pdfBuffer = await generateTicketPdf(booking);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.pnrNumber}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error generating ticket' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await bookingRepository.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ msg: 'Booking not found' });
        }

        if (booking.user.id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized to view this booking' });
        }

        res.json(booking);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/', auth, bookingLimiter, bookingRules, validate, validateCaptcha, async (req, res) => {
    const {
        trainId,
        passengers,
        journeyDate,
        classCode,
        seatNumbers,
        bookingType = 'General',
        joinWaitlist = false,
        joinRac = false,
        quota = 'General',
        fromStopSequence,
        toStopSequence,
        fromStationId,
        toStationId
    } = req.body;

    try {
        const train = await trainRepository.findById(trainId);
        if (!train) {
            return res.status(404).json({ msg: 'Train not found' });
        }

        const trainClass = await trainClassRepository.findByTrainAndCode(trainId, classCode);
        if (!trainClass) {
            return res.status(400).json({ msg: 'Selected class not available for this train' });
        }

        if (bookingType === 'Tatkal' && !isTatkalEligible(journeyDate)) {
            return res.status(400).json({ msg: 'Tatkal booking is only available 1-2 days before journey' });
        }

        if (!VALID_QUOTAS.includes(quota)) {
            return res.status(400).json({ msg: 'Invalid quota type' });
        }

        const fareResult = calculateBookingFare({
            basePrice: trainClass.price,
            bookingType,
            quota,
            passengers,
            journeyDate
        });

        if (fareResult.error) {
            return res.status(fareResult.status).json({ msg: fareResult.error });
        }

        const totalPrice = fareResult.totalPrice;

        const result = await bookingRepository.createBooking({
            userId: req.user.id,
            trainId,
            passengers,
            journeyDate,
            totalPrice,
            seatNumbers: seatNumbers || [],
            classCode,
            bookingType,
            joinWaitlist: Boolean(joinWaitlist),
            joinRac: Boolean(joinRac),
            quota,
            fromStopSequence: fromStopSequence ? Number(fromStopSequence) : undefined,
            toStopSequence: toStopSequence ? Number(toStopSequence) : undefined,
            fromStationId: fromStationId ? Number(fromStationId) : undefined,
            toStationId: toStationId ? Number(toStationId) : undefined
        });

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.status(201).json(result.booking);
    } catch (err) {
        console.error('Booking creation error:', err);
        res.status(500).json({ msg: 'Server error while creating booking' });
    }
});

router.put('/:id', auth, updateBookingRules, validate, async (req, res) => {
    const { status } = req.body;

    try {
        const result = await bookingRepository.updateStatus(
            req.params.id,
            status,
            req.user.id,
            req.user.isAdmin
        );

        if (result.error) {
            return res.status(result.status).json({ msg: result.error });
        }

        res.json({
            booking: result.booking,
            refund: result.refund || null
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
