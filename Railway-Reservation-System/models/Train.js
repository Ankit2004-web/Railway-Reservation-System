const mongoose = require('mongoose');

const TrainSchema = new mongoose.Schema({
    trainNumber: {
        type: String,
        required: true,
        unique: true
    },
    trainName: {
        type: String,
        required: true
    },
    source: {
        type: String,
        required: true
    },
    destination: {
        type: String,
        required: true
    },
    departureTime: {
        type: String,
        required: true
    },
    arrivalTime: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    distance: {
        type: Number,
        required: true
    },
    availableSeats: {
        type: Number,
        required: true,
        default: 100
    },
    price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('Train', TrainSchema); 