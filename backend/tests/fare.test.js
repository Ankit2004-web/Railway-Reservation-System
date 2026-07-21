const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('fare simulation (unit)', () => {
    const defaultRateForClass = (classCode) => {
        const rates = { '1A': 4.5, '2A': 2.8, '3A': 2.0, SL: 0.8, CC: 1.5 };
        return rates[classCode] || 1.0;
    };

    function estimateFare({ distanceKm, classCode, passengers = 1, quotaCode }) {
        const rate = defaultRateForClass(classCode);
        let perPassenger = Math.max(100, Math.round(distanceKm * rate));
        if (quotaCode === 'TQ') perPassenger = Math.round(perPassenger * 1.3);
        const reservation = 40 * passengers;
        return perPassenger * passengers + reservation;
    }

    it('scales fare with distance', () => {
        const short = estimateFare({ distanceKm: 100, classCode: '3A', passengers: 1 });
        const long = estimateFare({ distanceKm: 1000, classCode: '3A', passengers: 1 });
        assert.ok(long > short);
    });

    it('applies class difference', () => {
        const sl = estimateFare({ distanceKm: 500, classCode: 'SL', passengers: 1 });
        const first = estimateFare({ distanceKm: 500, classCode: '1A', passengers: 1 });
        assert.ok(first > sl);
    });

    it('multiplies by passenger count', () => {
        const one = estimateFare({ distanceKm: 400, classCode: '2A', passengers: 1 });
        const three = estimateFare({ distanceKm: 400, classCode: '2A', passengers: 3 });
        assert.ok(three > one);
        assert.equal(three - one, estimateFare({ distanceKm: 400, classCode: '2A', passengers: 2 }));
    });
});
