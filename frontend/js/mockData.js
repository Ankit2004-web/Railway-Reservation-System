/**
 * Development seed data — mirrors backend seed structure.
 */
const MockData = (() => {
    const addDays = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const stations = [
        { id: 1, code: 'NDLS', name: 'New Delhi', city: 'New Delhi', state: 'Delhi' },
        { id: 2, code: 'CSMT', name: 'Mumbai CSMT', city: 'Mumbai', state: 'Maharashtra' },
        { id: 3, code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal' },
        { id: 4, code: 'SBC', name: 'Bengaluru City', city: 'Bengaluru', state: 'Karnataka' },
        { id: 5, code: 'MAS', name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
        { id: 6, code: 'PNBE', name: 'Patna Junction', city: 'Patna', state: 'Bihar' },
        { id: 7, code: 'LKO', name: 'Lucknow NR', city: 'Lucknow', state: 'Uttar Pradesh' },
        { id: 8, code: 'JP', name: 'Jaipur Junction', city: 'Jaipur', state: 'Rajasthan' },
        { id: 9, code: 'ADI', name: 'Ahmedabad Junction', city: 'Ahmedabad', state: 'Gujarat' },
        { id: 10, code: 'BCT', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra' },
        { id: 11, code: 'SC', name: 'Secunderabad Junction', city: 'Hyderabad', state: 'Telangana' },
        { id: 12, code: 'PUNE', name: 'Pune Junction', city: 'Pune', state: 'Maharashtra' },
        { id: 13, code: 'CNB', name: 'Kanpur Central', city: 'Kanpur', state: 'Uttar Pradesh' },
        { id: 14, code: 'BPL', name: 'Bhopal Junction', city: 'Bhopal', state: 'Madhya Pradesh' },
        { id: 15, code: 'VSKP', name: 'Visakhapatnam', city: 'Visakhapatnam', state: 'Andhra Pradesh' }
    ];

    const rawTrains = [
        ['12951', 'Mumbai Rajdhani', 'New Delhi', 'Mumbai Central', '16:55', '08:35', '15h 40m', 1384, 120, 2500, 1, 'Daily'],
        ['12301', 'Howrah Rajdhani', 'New Delhi', 'Howrah Junction', '16:55', '10:05', '17h 10m', 1447, 100, 2200, 1, 'Daily'],
        ['12627', 'Karnataka Express', 'New Delhi', 'Bengaluru City', '20:20', '06:40', '34h 20m', 2365, 150, 1800, 2, 'Daily'],
        ['12621', 'Tamil Nadu Express', 'New Delhi', 'Chennai Central', '22:30', '04:50', '30h 20m', 2180, 140, 1950, 2, 'Daily'],
        ['12309', 'Rajendra Nagar Express', 'New Delhi', 'Patna Junction', '19:15', '08:30', '13h 15m', 1001, 160, 950, 1, 'Daily'],
        ['12230', 'Lucknow Mail', 'New Delhi', 'Lucknow NR', '22:00', '07:20', '9h 20m', 512, 180, 650, 1, 'Daily'],
        ['12958', 'Jaipur Duronto', 'New Delhi', 'Jaipur Junction', '23:00', '05:30', '6h 30m', 303, 90, 1200, 3, 'Mon,Wed,Fri'],
        ['12917', 'Gujarat Mail', 'Mumbai Central', 'Ahmedabad Junction', '22:20', '06:45', '8h 25m', 493, 130, 850, 2, 'Daily'],
        ['12724', 'Telangana Express', 'New Delhi', 'Secunderabad Junction', '17:25', '19:35', '26h 10m', 1677, 145, 1650, 3, 'Daily'],
        ['12124', 'Deccan Queen', 'Mumbai CSMT', 'Pune Junction', '07:15', '10:30', '3h 15m', 192, 200, 450, 1, 'Daily'],
        ['12382', 'Poorva Express', 'Howrah Junction', 'New Delhi', '08:15', '06:05', '21h 50m', 1447, 155, 1750, 4, 'Daily'],
        ['12276', 'Kanpur Shatabdi', 'New Delhi', 'Kanpur Central', '15:50', '20:45', '4h 55m', 441, 110, 980, 2, 'Except Sun'],
        ['12740', 'Vande Bharat Express', 'New Delhi', 'Lucknow NR', '06:10', '10:35', '4h 25m', 512, 80, 1650, 1, 'Daily']
    ];

    function getClassesForTrain(trainName, basePrice, totalSeats) {
        let templates;
        if (/Rajdhani|Duronto|Vande Bharat/i.test(trainName)) {
            templates = [['1A', 'AC First Class', 5.0, 0.05], ['2A', 'AC 2 Tier', 3.0, 0.10], ['3A', 'AC 3 Tier', 2.0, 0.35], ['CC', 'Chair Car', 1.5, 0.50]];
        } else if (/Shatabdi/i.test(trainName)) {
            templates = [['CC', 'Chair Car', 1.8, 0.70], ['EC', 'Executive Chair', 3.0, 0.30]];
        } else {
            templates = [['SL', 'Sleeper', 1.0, 0.45], ['3A', 'AC 3 Tier', 2.0, 0.25], ['2A', 'AC 2 Tier', 3.0, 0.15], ['2S', 'Second Sitting', 0.6, 0.15]];
        }
        let remaining = totalSeats;
        return templates.map(([classCode, className, mult, share], i) => {
            const seats = i === templates.length - 1 ? remaining : Math.max(1, Math.floor(totalSeats * share));
            remaining -= seats;
            return { classCode, className, price: Math.round(basePrice * mult), totalSeats: seats, availableSeats: seats };
        });
    }

    function buildTrainStops(source, destination, departureTime, arrivalTime, distance) {
        const mid = Math.floor(distance / 2);
        return [
            { stationName: source, stopOrder: 1, arrivalTime: null, departureTime, haltMinutes: 0, distanceKm: 0 },
            { stationName: 'Midway Junction', stopOrder: 2, arrivalTime: '--:--', departureTime: '--:--', haltMinutes: 5, distanceKm: mid },
            { stationName: destination, stopOrder: 3, arrivalTime, departureTime: null, haltMinutes: 0, distanceKm: distance }
        ];
    }

    const trains = rawTrains.map((t, idx) => {
        const [trainNumber, trainName, source, destination, departureTime, arrivalTime, duration, distance, availableSeats, price, dayOffset, runningDays] = t;
        const journeyDate = addDays(dayOffset);
        const classes = getClassesForTrain(trainName, price, availableSeats);
        return {
            id: idx + 1,
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
            journeyDate,
            runningDays,
            trainType: /Rajdhani|Duronto|Shatabdi|Vande Bharat/i.test(trainName) ? 'Premium' : 'Express',
            classes,
            lowestPrice: Math.min(...classes.map((c) => c.price))
        };
    });

    const DEMO_USER = {
        id: 1,
        name: 'Demo Passenger',
        email: 'demo@railway.com',
        phone: '9876543210',
        password: 'Demo@123',
        isAdmin: false,
        isBlocked: false,
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
    };

    function stationByName(name) {
        return stations.find((s) => s.name.toLowerCase() === name.toLowerCase()) ||
            stations.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
    }

    return {
        stations,
        trains,
        DEMO_USER,
        getClassesForTrain,
        buildTrainStops,
        stationByName,
        addDays
    };
})();

window.MockData = MockData;
