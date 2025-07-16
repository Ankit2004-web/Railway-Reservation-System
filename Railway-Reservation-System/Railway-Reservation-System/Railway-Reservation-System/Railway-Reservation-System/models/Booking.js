const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    train: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Train',
        required: true
    },
    passengers: [
        {
            name: {
                type: String,
                required: true
            },
            age: {
                type: Number,
                required: true
            },
            gender: {
                type: String,
                required: true,
                enum: ['Male', 'Female', 'Other']
            }
        }
    ],
    totalPrice: {
        type: Number,
        required: true
    },
    seatNumbers: [Number],
    status: {
        type: String,
        required: true,
        enum: ['Confirmed', 'Pending', 'Cancelled'],
        default: 'Confirmed'
    },
    bookingDate: {
        type: Date,
        default: Date.now
    },
    journeyDate: {
        type: Date,
        required: true
    },
    pnrNumber: {
        type: String,
        required: true,
        unique: true
    }
});

// Generate PNR before validation
BookingSchema.pre('validate', function (next) {
    if (this.isNew && !this.pnrNumber) {
        // Generate a random 10-digit PNR number
       this.pnrNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
       
    }
    next();
});

module.exports = mongoose.model('Booking', BookingSchema); 