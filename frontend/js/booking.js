/** Booking flow — modal, passengers, payment handoff */
function setBookingStep(step) {
    bookingStep = step;
    document.querySelectorAll('.booking-step-panel').forEach((p) => {
        p.style.display = Number(p.dataset.panel) === step ? 'block' : 'none';
    });
    document.querySelectorAll('#booking-steps .step-item').forEach((item) => {
        const s = Number(item.dataset.step);
        item.classList.toggle('active', s === step);
        item.classList.toggle('completed', s < step);
    });
    document.getElementById('booking-prev').style.display = step > 1 ? 'inline-flex' : 'none';
    document.getElementById('booking-next').style.display = step < 5 ? 'inline-flex' : 'none';
    document.getElementById('booking-submit').style.display = step === 5 ? 'inline-flex' : 'none';
    if (step === 4) renderBookingReview();
    if (step === 5) {
        const totalEl = document.getElementById('total-price');
        const payEl = document.getElementById('payment-total-amount');
        if (payEl && totalEl) payEl.textContent = `₹${totalEl.textContent}`;
        const failView = document.getElementById('payment-failure-view');
        if (failView) failView.style.display = 'none';
    }
}

function advanceBookingStep(delta) {
    if (delta > 0) {
        if (bookingStep === 1) {
            if (!document.getElementById('booking-class-select').value) {
                document.getElementById('booking-error').textContent = 'Please select a travel class';
                return;
            }
        }
        if (bookingStep === 2) {
            const joinWaitlist = document.getElementById('join-waitlist').checked;
            const joinRac = document.getElementById('join-rac').checked;
            const seats = getSelectedSeats();
            const pCount = document.querySelectorAll('.passenger-details').length;
            if (!joinWaitlist && !joinRac && seats.length !== pCount) {
                document.getElementById('booking-error').textContent = `Please select ${pCount} seat(s) or join waitlist/RAC`;
                return;
            }
        }
        if (bookingStep === 3) {
            const err = validatePassengers() || validateBookingContact();
            if (err) {
                document.getElementById('booking-error').textContent = err;
                return;
            }
        }
        document.getElementById('booking-error').textContent = '';
    }
    setBookingStep(Math.max(1, Math.min(5, bookingStep + delta)));
}

function applyPassengerDataToBooking(p) {
    if (!p) return;
    let card = document.querySelector('.passenger-details');
    if (!card) {
        document.getElementById('passengers-container').innerHTML = getPassengerHTML();
        card = document.querySelector('.passenger-details');
    }
    const nameEl = card.querySelector('.passenger-name');
    const ageEl = card.querySelector('.passenger-age');
    const genderEl = card.querySelector('.passenger-gender');
    const berthEl = card.querySelector('.passenger-berth');
    if (nameEl) nameEl.value = p.name || '';
    if (ageEl) ageEl.value = p.age != null ? String(p.age) : '';
    if (genderEl && p.gender) genderEl.value = p.gender;
    if (berthEl) berthEl.value = p.berthPreference || 'No Preference';
}

function openBookingModal(trainId, train) {
    selectedTrainForBooking = train;
    bookingStep = 1;
    document.getElementById('booking-train-id').value = trainId;
    document.getElementById('booking-journey-date').value = train.date;
    document.getElementById('booking-class-code').value = '';
    document.getElementById('passenger-count').textContent = '1';
    document.getElementById('price-per-ticket').textContent = '0';
    document.getElementById('total-price').textContent = '0';
    document.getElementById('booking-type-general').checked = true;
    document.getElementById('booking-quota').value = preferredQuota;
    document.getElementById('join-waitlist').checked = false;
    document.getElementById('join-rac').checked = false;
    document.getElementById('booking-error').textContent = '';
    resetSeatSelection();
    document.getElementById('seat-map-container').innerHTML = '<p class="form-hint">Select a class to view seats</p>';

    const classSelect = document.getElementById('booking-class-select');
    classSelect.innerHTML = '<option value="">Select class</option>';
    (train.classes || []).forEach((cls) => {
        const opt = document.createElement('option');
        opt.value = cls.classCode;
        opt.dataset.price = cls.price;
        opt.textContent = `${cls.classCode} - ${cls.className} (${UI.formatCurrency(cls.price)}, ${cls.availableSeats} seats)`;
        if (cls.availableSeats === 0) opt.disabled = true;
        classSelect.appendChild(opt);
    });

    document.getElementById('passengers-container').innerHTML = getPassengerHTML();
    document.getElementById('booking-train-details').innerHTML = `
        <strong>${UI.escapeHTML(train.trainName)} (${UI.escapeHTML(train.trainNumber)})</strong>
        <p class="form-hint">${UI.escapeHTML(train.source)} → ${UI.escapeHTML(train.destination)} | ${UI.formatDate(train.date)} | Dep ${UI.escapeHTML(train.departureTime)}</p>`;

    setBookingStep(1);
    UI.openModal('bookingModal');
    loadCaptcha('booking-captcha');
    if (typeof Dashboard !== 'undefined' && Dashboard.renderSavedPassengerPicker) {
        Dashboard.renderSavedPassengerPicker();
    }
    const savedSelect = document.getElementById('saved-passenger-select');
    if (savedSelect) savedSelect.value = '';
    const emailEl = document.getElementById('booking-contact-email');
    const phoneEl = document.getElementById('booking-contact-phone');
    if (emailEl) emailEl.value = currentUser?.email || '';
    if (phoneEl) phoneEl.value = currentUser?.phone || '';
}

function validateBookingContact() {
    const emailEl = document.getElementById('booking-contact-email');
    const phoneEl = document.getElementById('booking-contact-phone');
    const email = emailEl?.value.trim() || '';
    const phone = (phoneEl?.value.trim() || '').replace(/\D/g, '');
    emailEl?.classList.remove('is-error');
    phoneEl?.classList.remove('is-error');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailEl?.classList.add('is-error');
        return 'Enter a valid contact email';
    }
    if (!phone || phone.length < 10) {
        phoneEl?.classList.add('is-error');
        return 'Enter a valid 10-digit contact phone number';
    }
    return null;
}

function getPassengerHTML() {
    return `<div class="passenger-card passenger-details">
        <div class="passenger-card-header"><h4>Passenger 1</h4></div>
        <div class="form-row">
            <div class="form-group"><label>Name</label><input type="text" class="form-control passenger-name" required></div>
            <div class="form-group"><label>Age</label><input type="number" class="form-control passenger-age" min="1" max="120" required></div>
            <div class="form-group"><label>Gender</label>
                <select class="form-control passenger-gender" required>
                    <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group"><label>Berth Preference</label>
                <select class="form-control passenger-berth">
                    <option value="No Preference">No Preference</option>
                    <option value="Lower">Lower</option>
                    <option value="Middle">Middle</option>
                    <option value="Upper">Upper</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                </select>
            </div>
        </div>
    </div>`;
}

function validatePassengers() {
    let validCount = 0;
    let error = null;
    document.querySelectorAll('.passenger-details').forEach((elem, i) => {
        const nameEl = elem.querySelector('.passenger-name');
        const ageEl = elem.querySelector('.passenger-age');
        const genderEl = elem.querySelector('.passenger-gender');
        [nameEl, ageEl, genderEl].forEach((el) => el?.classList.remove('is-error'));

        const name = nameEl?.value.trim();
        const age = parseInt(ageEl?.value, 10);
        const gender = genderEl?.value;

        if (!name) { nameEl?.classList.add('is-error'); error = error || `Passenger ${i + 1}: name is required`; }
        if (!age || age < 1 || age > 120) { ageEl?.classList.add('is-error'); error = error || `Passenger ${i + 1}: enter a valid age`; }
        if (!gender) { genderEl?.classList.add('is-error'); error = error || `Passenger ${i + 1}: select gender`; }

        const quota = getQuota();
        if (quota === 'Ladies' && gender && gender !== 'Female') {
            genderEl?.classList.add('is-error');
            error = 'Ladies quota requires all passengers to be female';
        }
        if (quota === 'SeniorCitizen' && age && age < 60) {
            ageEl?.classList.add('is-error');
            error = 'Senior Citizen quota requires passengers aged 60+';
        }

        if (name && age && gender) validCount++;
    });
    if (!validCount) return error || 'Please add at least one passenger';
    return error;
}

function collectPassengers() {
    const passengers = [];
    document.querySelectorAll('.passenger-details').forEach((elem) => {
        const name = elem.querySelector('.passenger-name')?.value.trim();
        const age = elem.querySelector('.passenger-age')?.value;
        const gender = elem.querySelector('.passenger-gender')?.value;
        const berthPreference = elem.querySelector('.passenger-berth')?.value || 'No Preference';
        if (name && age && gender) passengers.push({ name, age: parseInt(age, 10), gender, berthPreference });
    });
    return passengers;
}

function renderBookingReview() {
    const train = selectedTrainForBooking;
    const passengers = collectPassengers();
    const classSel = document.getElementById('booking-class-select');
    const classText = classSel.options[classSel.selectedIndex]?.text || '';
    document.getElementById('booking-review').innerHTML = `
        <h4>Journey Summary</h4>
        <p><strong>${UI.escapeHTML(train?.trainName)}</strong> (${UI.escapeHTML(train?.trainNumber)})</p>
        <p>${UI.escapeHTML(train?.source)} → ${UI.escapeHTML(train?.destination)} | ${UI.formatDate(train?.date)}</p>
        <p>Class: ${UI.escapeHTML(classText)} | Quota: ${UI.escapeHTML(getQuota())} | Type: ${UI.escapeHTML(getBookingType())}</p>
        <p>Passengers: ${passengers.map((p) => UI.escapeHTML(p.name)).join(', ')}</p>
        <p>Contact: ${UI.escapeHTML(document.getElementById('booking-contact-email')?.value.trim() || '')} · ${UI.escapeHTML(document.getElementById('booking-contact-phone')?.value.trim() || '')}</p>`;
    document.getElementById('passenger-count').textContent = passengers.length;
}

function getBookingType() {
    return document.querySelector('input[name="booking-type"]:checked')?.value || 'General';
}

function getTatkalMultiplier() { return getBookingType() === 'Tatkal' ? 1.3 : 1; }
function getQuota() { return document.getElementById('booking-quota')?.value || 'General'; }

function calculateDisplayFare(basePrice, passengerCount) {
    let pricePerTicket = Math.round(basePrice * getTatkalMultiplier());
    if (getQuota() === 'SeniorCitizen') pricePerTicket = Math.round(pricePerTicket * 0.6);
    const reservationCharge = passengerCount * 40;
    const total = pricePerTicket * passengerCount + reservationCharge;
    return { pricePerTicket, total, reservationCharge };
}

async function updateBookingPrice() {
    const select = document.getElementById('booking-class-select');
    const option = select.options[select.selectedIndex];
    if (!option?.value) return;
    const basePrice = parseInt(option.dataset.price, 10);
    const passengerCount = document.querySelectorAll('.passenger-details').length;
    const { pricePerTicket, total, reservationCharge } = calculateDisplayFare(basePrice, passengerCount);
    document.getElementById('booking-class-code').value = option.value;
    document.getElementById('price-per-ticket').textContent = pricePerTicket;
    document.getElementById('total-price').textContent = total;
    const resEl = document.getElementById('reservation-charge');
    if (resEl) resEl.textContent = reservationCharge;
    const payEl = document.getElementById('payment-total-amount');
    if (payEl) payEl.textContent = `₹${total}`;
    await loadSeatMap(document.getElementById('booking-train-id').value, option.value, document.getElementById('booking-journey-date').value, passengerCount);
}

const MAX_PASSENGERS_PER_BOOKING = 6;

function addPassengerField() {
    const container = document.getElementById('passengers-container');
    const count = container.querySelectorAll('.passenger-details').length;
    if (count >= MAX_PASSENGERS_PER_BOOKING) {
        UI.showToast(`Maximum ${MAX_PASSENGERS_PER_BOOKING} passengers allowed per booking`, 'warning');
        return;
    }
    const div = document.createElement('div');
    div.className = 'passenger-card passenger-details';
    div.innerHTML = `
        <div class="passenger-card-header"><h4>Passenger ${count + 1}</h4>
            <button type="button" class="btn btn-ghost btn-sm remove-passenger"><i class="fas fa-times"></i></button></div>
        <div class="form-row">
            <div class="form-group"><label>Name</label><input type="text" class="form-control passenger-name" required></div>
            <div class="form-group"><label>Age</label><input type="number" class="form-control passenger-age" min="1" max="120" required></div>
            <div class="form-group"><label>Gender</label>
                <select class="form-control passenger-gender" required>
                    <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group"><label>Berth Preference</label>
                <select class="form-control passenger-berth">
                    <option value="No Preference">No Preference</option>
                    <option value="Lower">Lower</option>
                    <option value="Middle">Middle</option>
                    <option value="Upper">Upper</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                </select>
            </div>
        </div>`;
    container.appendChild(div);
    div.querySelector('.remove-passenger').addEventListener('click', () => {
        div.remove();
        updateBookingPrice();
    });
    updateBookingPrice();
}

async function createBooking() {
    if (!token) {
        if (selectedTrainForBooking) {
            promptGuestAuth(buildBookingIntent(selectedTrainForBooking, document.getElementById('booking-class-code')?.value));
        } else {
            UI.openModal('loginModal');
            loadCaptcha('login-captcha');
        }
        return;
    }
    const passengers = collectPassengers();
    if (!passengers.length) {
        document.getElementById('booking-error').textContent = 'Please add at least one passenger';
        return;
    }
    const classCode = document.getElementById('booking-class-code').value;
    if (!classCode) {
        document.getElementById('booking-error').textContent = 'Please select a travel class';
        return;
    }
    const joinWaitlist = document.getElementById('join-waitlist').checked;
    const joinRac = document.getElementById('join-rac').checked;
    const seatNumbers = getSelectedSeats();
    if (!joinWaitlist && !joinRac && seatNumbers.length !== passengers.length) {
        document.getElementById('booking-error').textContent = `Please select ${passengers.length} seat(s) or join waitlist/RAC`;
        return;
    }

    const submitBtn = document.getElementById('booking-submit');
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    document.getElementById('booking-error').textContent = '';

    try {
        const simulateFailure = document.querySelector('input[name="payment-outcome"]:checked')?.value === 'failure';
        const data = await API.post('/bookings', {
            trainId: parseInt(document.getElementById('booking-train-id').value, 10),
            passengers,
            journeyDate: document.getElementById('booking-journey-date').value,
            classCode,
            seatNumbers,
            bookingType: getBookingType(),
            joinWaitlist,
            joinRac,
            quota: getQuota(),
            contactEmail: document.getElementById('booking-contact-email')?.value.trim(),
            contactPhone: document.getElementById('booking-contact-phone')?.value.trim(),
            ...(selectedTrainForBooking?.fromStopSequence && selectedTrainForBooking?.toStopSequence ? {
                fromStopSequence: selectedTrainForBooking.fromStopSequence,
                toStopSequence: selectedTrainForBooking.toStopSequence,
                fromStationId: selectedTrainForBooking.fromStationId,
                toStationId: selectedTrainForBooking.toStationId
            } : {}),
            ...getCaptchaValues('booking-captcha')
        });

        let finalBooking;
        try {
            finalBooking = await processPayment(data, { simulateFailure });
        } catch (payErr) {
            try { await API.del(`/bookings/${getId(data)}/pending`); } catch { /* cleanup best-effort */ }
            document.getElementById('payment-failure-view').style.display = 'block';
            document.getElementById('booking-error').textContent = payErr.message || 'Payment failed';
            UI.showToast('Payment unsuccessful. Your booking was not confirmed.', 'error');
            loadCaptcha('booking-captcha');
            return;
        }

        UI.closeAllModals();
        showBookingConfirmation(finalBooking, selectedTrainForBooking);
        if (typeof Dashboard !== 'undefined') Dashboard.onBookingsUpdated();
        loadCaptcha('booking-captcha');
    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            document.getElementById('booking-error').textContent = 'Cannot reach server. Run npm start and try again.';
        } else {
            document.getElementById('booking-error').textContent = msg || 'Booking failed';
        }
        loadCaptcha('booking-captcha');
    } finally {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
    }
}

function showBookingConfirmation(booking, train) {
    const container = document.getElementById('confirmation-content');
    const isWaitlist = booking.status === 'Waitlisted';
    const isRac = booking.status === 'RAC';
    container.innerHTML = `
        <div class="confirmation-icon"><i class="fas fa-${isWaitlist || isRac ? 'clock' : 'check'}"></i></div>
        <h2>${isWaitlist ? 'Added to Waitlist' : isRac ? 'Added to RAC' : 'Booking Confirmed'}</h2>
        <p class="page-subtitle">${isWaitlist ? `Waitlist position: WL/${booking.waitlistPosition}` : isRac ? `RAC position: RAC/${booking.waitlistPosition}` : 'Your ticket has been booked successfully'}</p>
        <div class="confirmation-pnr tabular-nums">${UI.escapeHTML(booking.pnrNumber)}</div>
        <div class="confirmation-details">
            <p><strong>Train:</strong> ${UI.escapeHTML(train?.trainName)} (${UI.escapeHTML(train?.trainNumber)})</p>
            <p><strong>Route:</strong> ${UI.escapeHTML(train?.source)} → ${UI.escapeHTML(train?.destination)}</p>
            <p><strong>Date:</strong> ${UI.formatDate(booking.journeyDate || train?.date)}</p>
            <p><strong>Status:</strong> ${UI.statusBadge(booking.status)}</p>
            <p><strong>Passengers:</strong> ${booking.passengers?.length || '—'}</p>
            <p><strong>Amount:</strong> ${UI.formatCurrency(booking.totalPrice)}</p>
        </div>
        <div class="confirmation-actions">
            <button type="button" class="btn btn-primary" id="conf-copy-pnr"><i class="fas fa-copy"></i> Copy PNR</button>
            ${!isWaitlist && !isRac ? `<button type="button" class="btn btn-outline" id="conf-view-ticket"><i class="fas fa-ticket-alt"></i> View Ticket</button>` : ''}
            ${!isWaitlist && !isRac ? `<button type="button" class="btn btn-outline" id="conf-download"><i class="fas fa-download"></i> Download Ticket</button>` : ''}
            <button type="button" class="btn btn-outline" id="conf-bookings"><i class="fas fa-suitcase-rolling"></i> My Bookings</button>
            <button type="button" class="btn btn-outline" id="conf-book-another"><i class="fas fa-train"></i> Book Another Train</button>
            <button type="button" class="btn btn-outline" id="conf-share"><i class="fas fa-share-alt"></i> Share</button>
            <button type="button" class="btn btn-ghost" id="conf-home"><i class="fas fa-home"></i> Home</button>
        </div>`;

    document.getElementById('conf-copy-pnr')?.addEventListener('click', () => UI.copyToClipboard(booking.pnrNumber));
    document.getElementById('conf-view-ticket')?.addEventListener('click', () => viewTicket(getId(booking)));
    document.getElementById('conf-download')?.addEventListener('click', () => downloadTicket(getId(booking)));
    document.getElementById('conf-share')?.addEventListener('click', () => sharePnr({ ...booking, train: train || booking.train }));
    document.getElementById('conf-bookings')?.addEventListener('click', () => {
        if (typeof Dashboard !== 'undefined' && token) Dashboard.enter('bookings');
        else showPage('bookings');
    });
    document.getElementById('conf-book-another')?.addEventListener('click', () => {
        if (typeof Dashboard !== 'undefined' && token) Dashboard.enter('search');
        else showPage('home');
    });
    document.getElementById('conf-home')?.addEventListener('click', () => {
        if (token && typeof Dashboard !== 'undefined') Dashboard.enter('overview');
        else showPage('home');
    });
    showPage('confirmation');
    if (typeof Dashboard !== 'undefined') Dashboard.exit();
}
