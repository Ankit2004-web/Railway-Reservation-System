/**
 * Centralized mock API service — swap with REST in api.js when backend is ready.
 */
const MockService = (() => {
    const captchas = new Map();
    let paymentSimOutcome = 'success';

    function initStore() {
        Store.mutate((data) => {
            if (!data.users.some((u) => u.email === MockData.DEMO_USER.email)) {
                data.users.push({ ...MockData.DEMO_USER });
            }
        });
    }

    initStore();

    function err(msg, status = 400) {
        const e = new Error(msg);
        e.status = status;
        throw e;
    }

    function tokenFromUser(user) {
        return `mock-token-${user.id}`;
    }

    function userFromToken(token) {
        if (!token || !token.startsWith('mock-token-')) return null;
        const id = parseInt(token.replace('mock-token-', ''), 10);
        const data = Store.load();
        return data.users.find((u) => u.id === id) || null;
    }

    function safeUser(u) {
        if (!u) return null;
        const { password, ...safe } = u;
        return { ...safe, isAdmin: !!safe.isAdmin, isBlocked: !!safe.isBlocked };
    }

    function getAuthUser() {
        const token = localStorage.getItem('token');
        return userFromToken(token);
    }

    function generatePnr(bookings) {
        let pnr;
        do {
            pnr = String(Math.floor(1000000000 + Math.random() * 9000000000));
        } while (bookings.some((b) => b.pnrNumber === pnr));
        return pnr;
    }

    function assignSeats(passengers, classCode) {
        const coaches = ['B1', 'B2', 'B3', 'A1', 'S1'];
        const coach = coaches[classCode.charCodeAt(0) % coaches.length];
        return passengers.map((p, i) => ({
            ...p,
            passengerStatus: 'Confirmed',
            currentStatus: 'Confirmed',
            coach,
            seatNumber: `${coach}-${(i + 1) * 12 + 3}`,
            berth: p.berthPreference !== 'No Preference' ? p.berthPreference : ['Lower', 'Middle', 'Upper'][i % 3]
        }));
    }

    function calcRefund(booking) {
        const total = booking.totalPrice || 0;
        if (booking.status === 'Waitlisted' || booking.status === 'RAC') {
            return { refundAmount: total, refundPercent: 100, charge: 0, rule: 'Full refund for waitlisted/RAC (development simulation)' };
        }
        const journey = new Date(booking.journeyDate);
        const hours = (journey - new Date()) / 3600000;
        if (hours >= 48) {
            const charge = Math.round(total * 0.05);
            return { refundAmount: total - charge, refundPercent: 95, charge, rule: '100% minus ₹5% cancellation charge (48h+ before journey)' };
        }
        if (hours >= 24) {
            const charge = Math.round(total * 0.25);
            return { refundAmount: total - charge, refundPercent: 75, charge, rule: '75% refund (24–48h before journey)' };
        }
        const charge = Math.round(total * 0.5);
        return { refundAmount: total - charge, refundPercent: 50, charge, rule: '50% refund (less than 24h before journey)' };
    }

    function enrichBooking(b) {
        const train = MockData.trains.find((t) => t.id === b.trainId);
        return {
            ...b,
            train: train ? {
                id: train.id,
                trainNumber: train.trainNumber,
                trainName: train.trainName,
                source: train.source,
                destination: train.destination,
                departureTime: train.departureTime,
                arrivalTime: train.arrivalTime,
                duration: train.duration
            } : b.train
        };
    }

    function setPaymentOutcome(outcome) {
        paymentSimOutcome = outcome === 'failure' ? 'failure' : 'success';
    }

    async function handle(method, path, body) {
        await AppConfig.delay();
        const m = method.toUpperCase();
        const [basePath, query] = path.split('?');
        const params = new URLSearchParams(query || '');

        // --- Captcha ---
        if (m === 'GET' && basePath === '/captcha') {
            const a = Math.floor(Math.random() * 9) + 1;
            const b = Math.floor(Math.random() * 9) + 1;
            const id = `cap-${Date.now()}`;
            captchas.set(id, a + b);
            return { captchaId: id, question: `${a} + ${b} = ?` };
        }

        // --- Auth ---
        if (m === 'POST' && basePath === '/auth/login') {
            validateCaptcha(body);
            const data = Store.load();
            const user = data.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
            if (!user || user.password !== body.password) err('Invalid email or password.');
            if (user.isBlocked) err('Your account has been blocked. Contact admin.', 403);
            const token = tokenFromUser(user);
            Store.setSession({ userId: user.id, remember: !!body.rememberMe });
            return { token };
        }

        if (m === 'POST' && basePath === '/auth/register') {
            validateCaptcha(body);
            const data = Store.load();
            if (data.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) err('User already exists');
            const user = {
                id: data.nextUserId++,
                name: body.name,
                email: body.email,
                phone: body.phone,
                password: body.password,
                isAdmin: false,
                isBlocked: false,
                createdAt: new Date().toISOString()
            };
            data.users.push(user);
            Store.save(data);
            return { token: tokenFromUser(user) };
        }

        if (m === 'GET' && basePath === '/auth/me') {
            const user = getAuthUser();
            if (!user) err('Unauthorized', 401);
            if (user.isBlocked) err('Your account has been blocked.', 403);
            return safeUser(user);
        }

        if (m === 'PUT' && basePath === '/auth/profile') {
            const user = requireAuth();
            Store.mutate((data) => {
                const u = data.users.find((x) => x.id === user.id);
                if (u) { u.name = body.name; u.phone = body.phone; }
            });
            return safeUser(Store.load().users.find((u) => u.id === user.id));
        }

        if (m === 'PUT' && basePath === '/auth/change-password') {
            const user = requireAuth();
            const data = Store.load();
            const u = data.users.find((x) => x.id === user.id);
            if (!u || u.password !== body.currentPassword) err('Current password is incorrect');
            u.password = body.newPassword;
            Store.save(data);
            return { msg: 'Password updated' };
        }

        if (m === 'POST' && basePath === '/auth/forgot-password') {
            validateCaptcha(body);
            const resetToken = `demo-reset-${Date.now()}`;
            return {
                msg: 'Reset request accepted in frontend demo mode. Use the link below if shown.',
                devResetUrl: `resetPassword.html?token=${resetToken}`
            };
        }

        if (m === 'POST' && basePath === '/auth/reset-password') {
            return { msg: 'Password updated successfully (demo mode).' };
        }

        // --- Stations ---
        if (m === 'GET' && basePath === '/stations/search') {
            const q = (params.get('q') || '').toLowerCase();
            return MockData.stations.filter((s) =>
                s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
            ).slice(0, 10);
        }

        // --- Trains ---
        if (m === 'GET' && basePath === '/trains/search') {
            const source = (params.get('source') || '').trim();
            const destination = (params.get('destination') || '').trim();
            const date = params.get('date') || MockData.addDays(1);
            const matchName = (trainName, query) => {
                const q = query.toLowerCase();
                const t = trainName.toLowerCase();
                if (t.includes(q) || q.includes(t)) return true;
                const st = MockData.stationByName(query);
                return st && t.includes(st.name.toLowerCase());
            };
            return MockData.trains
                .filter((t) => matchName(t.source, source) && matchName(t.destination, destination))
                .map((t) => ({
                    ...t,
                    date,
                    tatkalEligible: isTatkalEligible(date),
                    classes: t.classes.map((c) => ({ ...c }))
                }));
        }

        if (m === 'GET' && basePath === '/trains') {
            return MockData.trains;
        }

        const routeMatch = basePath.match(/^\/trains\/(\d+)\/route$/);
        if (m === 'GET' && routeMatch) {
            const train = MockData.trains.find((t) => t.id === parseInt(routeMatch[1], 10));
            if (!train) err('Train not found', 404);
            return { stops: MockData.buildTrainStops(train.source, train.destination, train.departureTime, train.arrivalTime, train.distance) };
        }

        const seatsMatch = basePath.match(/^\/trains\/(\d+)\/seats$/);
        if (m === 'GET' && seatsMatch) {
            const trainId = parseInt(seatsMatch[1], 10);
            const classCode = params.get('classCode') || 'SL';
            const train = MockData.trains.find((t) => t.id === trainId);
            if (!train) err('Train not found', 404);
            const booked = Store.load().bookings
                .filter((b) => b.trainId === trainId && b.classCode === classCode && b.status === 'Confirmed')
                .flatMap((b) => b.seatNumbers || []);
            const seats = [];
            for (let i = 1; i <= 40; i++) {
                const num = `${classCode}-${i}`;
                seats.push({
                    seatNumber: num,
                    berthType: ['LB', 'MB', 'UB', 'SL', 'SU', 'WS'][i % 6],
                    isBooked: booked.includes(num),
                    isAvailable: !booked.includes(num)
                });
            }
            return { seats, tatkalEligible: isTatkalEligible(params.get('journeyDate') || MockData.addDays(1)) };
        }

        // --- Bookings ---
        if (m === 'POST' && basePath === '/bookings') {
            const user = requireAuth();
            validateCaptcha(body);
            const train = MockData.trains.find((t) => t.id === body.trainId);
            if (!train) err('Train not found');
            const cls = train.classes.find((c) => c.classCode === body.classCode);
            if (!cls) err('Invalid class');

            let status = 'Pending';
            let waitlistPosition = null;
            const seats = body.seatNumbers || [];
            if (body.joinWaitlist) { status = 'Waitlisted'; waitlistPosition = Math.floor(Math.random() * 20) + 1; }
            else if (body.joinRac) { status = 'RAC'; waitlistPosition = Math.floor(Math.random() * 15) + 1; }
            else if (seats.length) status = 'Pending';

            const passengerCount = body.passengers.length;
            let baseFare = cls.price * passengerCount;
            if (body.bookingType === 'Tatkal') baseFare = Math.round(baseFare * 1.3);
            if (body.quota === 'SeniorCitizen') baseFare = Math.round(baseFare * 0.6);
            const reservationCharge = passengerCount * 40;
            const totalPrice = baseFare + reservationCharge;

            let created;
            Store.mutate((data) => {
                created = {
                    id: data.nextBookingId++,
                    userId: user.id,
                    trainId: train.id,
                    pnrNumber: generatePnr(data.bookings),
                    journeyDate: body.journeyDate,
                    classCode: body.classCode,
                    className: cls.className,
                    quota: body.quota || 'General',
                    bookingType: body.bookingType || 'General',
                    passengers: body.passengers,
                    contactEmail: body.contactEmail || null,
                    contactPhone: body.contactPhone || null,
                    seatNumbers: seats,
                    totalPrice,
                    baseFare,
                    reservationCharge,
                    status,
                    waitlistPosition,
                    paymentStatus: status === 'Pending' ? 'Pending' : 'Paid',
                    bookingDate: new Date().toISOString(),
                    transactionId: null
                };
                data.bookings.push(created);
            });

            return enrichBooking(created);
        }

        if (m === 'GET' && basePath === '/bookings') {
            const user = requireAuth();
            return Store.load().bookings
                .filter((b) => b.userId === user.id)
                .map(enrichBooking)
                .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
        }

        const pendingDelMatch = basePath.match(/^\/bookings\/(\d+)\/pending$/);
        if (m === 'DELETE' && pendingDelMatch) {
            const user = requireAuth();
            const id = parseInt(pendingDelMatch[1], 10);
            Store.mutate((data) => {
                const idx = data.bookings.findIndex((b) => b.id === id && b.userId === user.id && b.status === 'Pending');
                if (idx >= 0) data.bookings.splice(idx, 1);
            });
            return { ok: true };
        }

        const bookingMatch = basePath.match(/^\/bookings\/(\d+)$/);
        if (bookingMatch) {
            const id = parseInt(bookingMatch[1], 10);
            const user = requireAuth();
            const booking = Store.load().bookings.find((b) => b.id === id && b.userId === user.id);
            if (!booking) err('Booking not found', 404);

            if (m === 'GET') return enrichBooking({ ...booking, passengers: assignSeatsIfConfirmed(booking) });

            if (m === 'PUT' && body.status === 'Cancelled') {
                const preview = calcRefund(booking);
                let updated;
                Store.mutate((data) => {
                    const b = data.bookings.find((x) => x.id === id);
                    b.status = 'Cancelled';
                    b.cancelledAt = new Date().toISOString();
                    b.refund = {
                        refundAmount: preview.refundAmount,
                        refundPercent: preview.refundPercent,
                        charge: preview.charge,
                        status: 'Processed',
                        reference: `REF-${Date.now()}`,
                        rule: preview.rule
                    };
                    updated = b;
                });
                return { ...enrichBooking(updated), refund: updated.refund };
            }
        }

        const refundMatch = basePath.match(/^\/bookings\/(\d+)\/refund-preview$/);
        if (m === 'GET' && refundMatch) {
            requireAuth();
            const booking = Store.load().bookings.find((b) => b.id === parseInt(refundMatch[1], 10));
            if (!booking) err('Booking not found', 404);
            return calcRefund(booking);
        }

        const pnrMatch = basePath.match(/^\/bookings\/pnr\/(\d{10})$/);
        if (m === 'GET' && pnrMatch) {
            const booking = Store.load().bookings.find((b) => b.pnrNumber === pnrMatch[1]);
            if (!booking) err('PNR not found', 404);
            const enriched = enrichBooking({ ...booking, passengers: assignSeatsIfConfirmed(booking) });
            const user = getAuthUser();
            if (!user) {
                delete enriched.totalPrice;
                delete enriched.refund;
                delete enriched.transactionId;
            }
            return enriched;
        }

        const ticketMatch = basePath.match(/^\/bookings\/(\d+)\/ticket$/);
        if (m === 'GET' && ticketMatch) {
            requireAuth();
            const booking = Store.load().bookings.find((b) => b.id === parseInt(ticketMatch[1], 10));
            if (!booking) err('Ticket not found', 404);
            return { html: buildTicketHtml(enrichBooking({ ...booking, passengers: assignSeatsIfConfirmed(booking) })), filename: `ticket-${booking.pnrNumber}.html` };
        }

        // --- Payments ---
        if (m === 'GET' && basePath === '/payments/config') {
            return { devMode: true, mockMode: true };
        }

        if (m === 'POST' && basePath === '/payments/create-order') {
            requireAuth();
            return { devMode: true, mockMode: true, bookingId: body.bookingId, amount: body.amount || 0, currency: 'INR' };
        }

        if (m === 'POST' && basePath === '/payments/dev-confirm') {
            requireAuth();
            if (body.simulateFailure) err('Payment failed (simulated). Your booking has not been confirmed.');
            let updated;
            Store.mutate((data) => {
                const b = data.bookings.find((x) => x.id === body.bookingId);
                if (!b) err('Booking not found', 404);
                b.status = 'Confirmed';
                b.paymentStatus = 'Paid';
                b.transactionId = `PAY-${Date.now()}`;
                b.passengers = assignSeats(b.passengers, b.classCode);
                updated = b;
            });
            return { booking: enrichBooking(updated) };
        }

        // --- Saved passengers ---
        if (m === 'GET' && basePath === '/passengers/saved') {
            const user = requireAuth();
            const key = String(user.id);
            return Store.load().savedPassengers[key] || [];
        }

        if (m === 'POST' && basePath === '/passengers/saved') {
            const user = requireAuth();
            const passenger = Store.mutate((data) => {
                const key = String(user.id);
                if (!data.savedPassengers[key]) data.savedPassengers[key] = [];
                const p = { id: data.nextPassengerId++, ...body };
                data.savedPassengers[key].push(p);
                return p;
            });
            return passenger;
        }

        const passMatch = basePath.match(/^\/passengers\/saved\/(\d+)$/);
        if (passMatch) {
            const user = requireAuth();
            const pid = parseInt(passMatch[1], 10);
            if (m === 'PUT') {
                Store.mutate((data) => {
                    const list = data.savedPassengers[String(user.id)] || [];
                    const idx = list.findIndex((p) => p.id === pid);
                    if (idx >= 0) list[idx] = { ...list[idx], ...body };
                });
                return { ok: true };
            }
            if (m === 'DELETE') {
                Store.mutate((data) => {
                    const key = String(user.id);
                    data.savedPassengers[key] = (data.savedPassengers[key] || []).filter((p) => p.id !== pid);
                });
                return { ok: true };
            }
        }

        err(`Mock endpoint not found: ${m} ${path}`, 404);
    }

    function assignSeatsIfConfirmed(booking) {
        if (booking.status === 'Confirmed' && booking.passengers?.[0] && !booking.passengers[0].coach) {
            return assignSeats(booking.passengers, booking.classCode);
        }
        return booking.passengers;
    }

    function requireAuth() {
        const user = getAuthUser();
        if (!user) err('Unauthorized', 401);
        return user;
    }

    function validateCaptcha(body) {
        if (!body?.captchaId) return;
        const expected = captchas.get(body.captchaId);
        if (expected == null) return;
        if (parseInt(body.captchaAnswer, 10) !== expected) err('Incorrect captcha answer');
        captchas.delete(body.captchaId);
    }

    function isTatkalEligible(journeyDate) {
        if (!journeyDate) return false;
        const journey = new Date(`${journeyDate}T00:00:00`);
        const days = (journey - new Date()) / 86400000;
        return days >= 0 && days <= 2;
    }

    function buildTicketHtml(booking) {
        const train = booking.train || {};
        const rows = (booking.passengers || []).map((p) =>
            `<tr><td>${p.name}</td><td>${p.age}</td><td>${p.gender}</td><td>Confirmed</td><td>${p.currentStatus || 'Confirmed'}</td><td>${p.coach || '—'}</td><td>${p.seatNumber || p.berth || '—'}</td></tr>`
        ).join('');
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E-Ticket ${booking.pnrNumber}</title>
<style>body{font-family:Inter,sans-serif;padding:24px;color:#183642}h1{color:#20B8BE}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #DCE7E9;padding:8px;text-align:left}th{background:#F0FCFC}
.footer{margin-top:24px;font-size:12px;color:#526A73}</style></head><body>
<img src="/assets/logo.png" alt="Railway" height="48"><h1>Railway Reservation — E-Ticket</h1>
<p><strong>PNR:</strong> ${booking.pnrNumber} &nbsp; <strong>Status:</strong> ${booking.status}</p>
<div class="meta"><div><strong>Train:</strong> ${train.trainName} (${train.trainNumber})</div>
<div><strong>Date:</strong> ${booking.journeyDate}</div><div><strong>From:</strong> ${train.source} (${train.departureTime})</div>
<div><strong>To:</strong> ${train.destination} (${train.arrivalTime})</div><div><strong>Class:</strong> ${booking.classCode}</div>
<div><strong>Quota:</strong> ${booking.quota || 'General'}</div></div>
<table><thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Booking</th><th>Current</th><th>Coach</th><th>Seat/Berth</th></tr></thead><tbody>${rows}</tbody></table>
<p><strong>Total Paid:</strong> ₹${booking.totalPrice}</p>
<p class="footer">This is a computer-generated development e-ticket. Not an official government/IRCTC ticket.</p></body></html>`;
    }

    async function download(path) {
        const result = await handle('GET', path);
        if (result.html) {
            const blob = new Blob([result.html], { type: 'text/html' });
            return { blob, filename: result.filename || 'ticket.html' };
        }
        throw new Error('Download not available');
    }

    return { handle, download, setPaymentOutcome, initStore };
})();

window.MockService = MockService;
