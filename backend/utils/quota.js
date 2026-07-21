const VALID_QUOTAS = ['General', 'Ladies', 'SeniorCitizen'];

const SENIOR_AGE = 60;
const SENIOR_DISCOUNT = 0.4;

const validateQuota = (quota, passengers) => {
    if (!VALID_QUOTAS.includes(quota)) {
        return { error: 'Invalid quota type', status: 400 };
    }

    if (quota === 'Ladies') {
        const invalid = passengers.some((p) => p.gender !== 'Female');
        if (invalid) {
            return { error: 'Ladies quota requires all passengers to be female', status: 400 };
        }
    }

    if (quota === 'SeniorCitizen') {
        const invalid = passengers.some((p) => Number(p.age) < SENIOR_AGE);
        if (invalid) {
            return { error: 'Senior Citizen quota requires all passengers to be 60 years or older', status: 400 };
        }
    }

    return { ok: true };
};

const getPassengerFare = (basePrice, quota, passenger) => {
    let fare = basePrice;

    if (quota === 'SeniorCitizen' && Number(passenger.age) >= SENIOR_AGE) {
        fare = Math.round(fare * (1 - SENIOR_DISCOUNT));
    }

    return fare;
};

const calculateTotalFare = ({ basePrice, quota, passengers }) => {
    const totalPrice = passengers.reduce(
        (sum, passenger) => sum + getPassengerFare(basePrice, quota, passenger),
        0
    );

    return {
        totalPrice,
        pricePerTicket: passengers.length ? Math.round(totalPrice / passengers.length) : basePrice
    };
};

module.exports = {
    VALID_QUOTAS,
    SENIOR_AGE,
    validateQuota,
    calculateTotalFare,
    getPassengerFare
};
