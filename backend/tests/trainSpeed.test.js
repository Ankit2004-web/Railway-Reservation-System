const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    inferTrainSpeedCategory,
    computeAvgSpeedKmh
} = require('../utils/trainSpeed');

describe('train average speed by category', () => {
    it('classifies passenger trains', () => {
        assert.equal(inferTrainSpeedCategory('PASS', 'Mumbai Passenger'), 'PASS');
    });

    it('classifies premium trains', () => {
        assert.equal(inferTrainSpeedCategory('RAJ', 'Mumbai Rajdhani'), 'RAJ');
        assert.equal(inferTrainSpeedCategory(null, 'Vande Bharat Express'), 'VB');
    });

    it('clamps passenger speed to 30–40 km/h', () => {
        assert.equal(computeAvgSpeedKmh(300, 120, 'PASS', 'Local Passenger'), 40);
        assert.equal(computeAvgSpeedKmh(100, 600, 'PASS', 'Local Passenger'), 30);
    });

    it('clamps express speed to 50–60 km/h', () => {
        assert.equal(computeAvgSpeedKmh(500, 300, 'EXP', 'Express'), 60);
        assert.equal(computeAvgSpeedKmh(500, 1200, 'SF', 'Superfast'), 50);
    });

    it('clamps rajdhani speed to 80–95 km/h', () => {
        assert.equal(computeAvgSpeedKmh(1400, 600, 'RAJ', 'Rajdhani'), 95);
        assert.equal(computeAvgSpeedKmh(1400, 2400, 'RAJ', 'Rajdhani'), 80);
    });

    it('clamps vande bharat speed to 130–160 km/h', () => {
        assert.equal(computeAvgSpeedKmh(800, 240, 'VB', 'Vande Bharat'), 160);
        assert.equal(computeAvgSpeedKmh(800, 480, 'VB', 'Vande Bharat'), 130);
    });

    it('uses typical speed when duration is missing', () => {
        assert.equal(computeAvgSpeedKmh(null, null, 'RAJ', 'Rajdhani'), 88);
        assert.equal(computeAvgSpeedKmh(500, 0, 'PASS', 'Passenger'), 35);
    });
});
