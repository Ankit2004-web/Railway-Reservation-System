const TATKAL_SURCHARGE = 1.3;
const TATKAL_MIN_DAYS = 1;
const TATKAL_MAX_DAYS = 2;

const daysUntilJourney = (journeyDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const journey = new Date(journeyDate);
    journey.setHours(0, 0, 0, 0);
    return Math.round((journey - today) / (1000 * 60 * 60 * 24));
};

const isTatkalEligible = (journeyDate) => {
    const days = daysUntilJourney(journeyDate);
    return days >= TATKAL_MIN_DAYS && days <= TATKAL_MAX_DAYS;
};

const getTatkalPrice = (basePrice) => Math.round(Number(basePrice) * TATKAL_SURCHARGE);

module.exports = {
    TATKAL_SURCHARGE,
    isTatkalEligible,
    getTatkalPrice,
    daysUntilJourney
};
