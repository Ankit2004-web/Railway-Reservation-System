/** User bookings, PNR, tickets, cancellation */
async function fetchUserBookings() {
    if (!token) return [];
    const list = document.getElementById('bookings-list');
    UI.renderSkeleton(list, 'card', 3);
    try {
        userBookingsCache = await API.get('/bookings');
        displayUserBookings(userBookingsCache);
        updateBookingsStats(userBookingsCache);
        return userBookingsCache;
    } catch {
        UI.renderErrorState(list, 'Could not load bookings.', fetchUserBookings);
        return [];
    }
}

function filterBookingsByTab(bookings) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    switch (currentBookingTab) {
        case 'upcoming':
            return bookings.filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now);
        case 'completed':
            return bookings.filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) < now);
        case 'rac':
            return bookings.filter((b) => b.status === 'RAC');
        case 'waitlisted':
            return bookings.filter((b) => b.status === 'Waitlisted');
        case 'cancelled':
            return bookings.filter((b) => b.status === 'Cancelled');
        default:
            return bookings;
    }
}

function updateBookingsStats(bookings) {
    const stats = document.getElementById('bookings-stats');
    if (!stats) return;
    const now = new Date();
    const upcoming = bookings.filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now).length;
    stats.innerHTML = `
        <span class="bookings-stat">Upcoming: <strong>${upcoming}</strong></span>
        <span class="bookings-stat">RAC: <strong>${bookings.filter((b) => b.status === 'RAC').length}</strong></span>
        <span class="bookings-stat">Waitlisted: <strong>${bookings.filter((b) => b.status === 'Waitlisted').length}</strong></span>
        <span class="bookings-stat">Cancelled: <strong>${bookings.filter((b) => b.status === 'Cancelled').length}</strong></span>`;
}


function displayUserBookings(bookings) {
    const list = document.getElementById('bookings-list');
    const filtered = filterBookingsByTab(bookings);

    if (!filtered.length) {
        UI.renderEmptyState(list, {
            icon: 'fa-suitcase-rolling',
            title: currentBookingTab === 'upcoming' ? 'No upcoming journeys' : 'No bookings found',
            message: 'You haven\'t booked a journey in this category yet.',
            ctaText: 'Search Trains',
            ctaAction: () => showPage('home')
        });
        return;
    }

    list.innerHTML = filtered.map((booking) => {
        const train = booking.train;
        const bookingId = getId(booking);
        const statusCls = (booking.status || '').toLowerCase();
        return `<article class="booking-card status-${statusCls}">
            <div class="booking-card-body">
                <div class="booking-header">
                    <span class="booking-pnr">PNR ${UI.escapeHTML(booking.pnrNumber)}</span>
                    ${UI.statusBadge(booking.status)}${booking.waitlistPosition ? ` <span class="badge ${booking.status === 'RAC' ? 'badge-rac' : 'badge-waitlisted'}">${booking.status === 'RAC' ? 'RAC' : 'WL'}/${booking.waitlistPosition}</span>` : ''}
                </div>
                <div class="booking-route">${UI.escapeHTML(train?.source)} → ${UI.escapeHTML(train?.destination)}</div>
                <div class="booking-meta">
                    <span><i class="fas fa-train"></i> ${UI.escapeHTML(train?.trainName)} (${UI.escapeHTML(train?.trainNumber)})</span>
                    <span><i class="fas fa-calendar"></i> ${UI.formatDate(booking.journeyDate)}</span>
                    ${booking.classCode ? `<span><i class="fas fa-chair"></i> ${UI.escapeHTML(booking.classCode)}</span>` : ''}
                    <span><i class="fas fa-rupee-sign"></i> ${UI.formatCurrency(booking.totalPrice)}</span>
                </div>
                <div class="booking-actions">
                    <button type="button" class="btn btn-ghost btn-sm btn-view-detail" data-id="${bookingId}"><i class="fas fa-eye"></i> Details</button>
                    ${['Confirmed', 'Waitlisted', 'Pending', 'RAC'].includes(booking.status) ? `<button type="button" class="btn btn-outline btn-sm btn-cancel" data-id="${bookingId}">Cancel</button>` : ''}
                    ${booking.status === 'Confirmed' ? `<button type="button" class="btn btn-outline btn-sm btn-view-ticket" data-ticket="${bookingId}"><i class="fas fa-ticket-alt"></i> View</button>` : ''}
                    ${booking.status === 'Confirmed' ? `<button type="button" class="btn btn-primary btn-sm btn-ticket" data-ticket="${bookingId}"><i class="fas fa-download"></i> E-Ticket</button>` : ''}
                    <button type="button" class="btn btn-ghost btn-sm btn-view-pnr" data-pnr="${UI.escapeHTML(booking.pnrNumber)}">View PNR</button>
                </div>
            </div>
        </article>`;
    }).join('');

    list.querySelectorAll('.btn-view-detail').forEach((btn) => {
        btn.addEventListener('click', () => openBookingDetail(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.btn-cancel').forEach((btn) => {
        btn.addEventListener('click', () => openCancelModal(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.btn-view-ticket').forEach((btn) => {
        btn.addEventListener('click', () => viewTicket(Number(btn.dataset.ticket)));
    });
    list.querySelectorAll('.btn-ticket').forEach((btn) => {
        btn.addEventListener('click', () => downloadTicket(Number(btn.dataset.ticket)));
    });
    list.querySelectorAll('.btn-view-pnr').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.getElementById('pnr-input').value = btn.dataset.pnr;
            showPage('pnr');
            checkPnrStatus();
        });
    });
}

async function openCancelModal(bookingId) {
    pendingCancelBookingId = bookingId;
    const previewEl = document.getElementById('cancel-refund-preview');
    previewEl.innerHTML = '<p>Loading refund estimate...</p>';
    UI.openModal('cancelModal');
    try {
        const preview = await API.get(`/bookings/${bookingId}/refund-preview`);
        previewEl.innerHTML = `<p>Are you sure you want to cancel this booking?</p>
            <div class="booking-summary-box" style="margin-top:12px">
                <p><strong>Estimated refund:</strong> ${UI.formatCurrency(preview.refundAmount)}</p>
                <p class="form-hint">${UI.escapeHTML(preview.rule || '')}</p>
            </div>`;
    } catch {
        previewEl.innerHTML = '<p>Are you sure you want to cancel this booking?</p>';
    }
}

async function confirmCancelBooking() {
    if (!pendingCancelBookingId) return;
    try {
        const data = await API.put(`/bookings/${pendingCancelBookingId}`, { status: 'Cancelled' });
        UI.closeAllModals();
        const refundMsg = data.refund?.refundAmount ? ` Refund: ${UI.formatCurrency(data.refund.refundAmount)}.` : '';
        UI.showToast(`Booking cancelled.${refundMsg}`, 'success');
        pendingCancelBookingId = null;
        fetchUserBookings();
        if (typeof Dashboard !== 'undefined') Dashboard.onBookingsUpdated();
    } catch (err) {
        UI.showToast(err.message || 'Cancellation failed', 'error');
    }
}

function viewTicket(bookingId) {
    window.open(`ticket.html?id=${bookingId}`, '_blank', 'noopener');
}

async function downloadTicket(bookingId) {
    try {
        await API.download(`/bookings/${bookingId}/ticket`, `ticket-${bookingId}.html`);
        UI.showToast('Ticket downloaded', 'success');
    } catch (err) {
        UI.showToast(err.message || 'Download failed', 'error');
    }
}

async function checkPnrStatus() {
    const pnrInput = document.getElementById('pnr-input');
    const errorDisplay = document.getElementById('pnr-error');
    const resultContainer = document.getElementById('pnr-result');
    const pnr = pnrInput.value.trim();
    errorDisplay.textContent = '';
    resultContainer.innerHTML = '';

    if (!/^\d{10}$/.test(pnr)) {
        errorDisplay.textContent = 'Please enter a valid 10-digit PNR number';
        return;
    }

    resultContainer.innerHTML = '<div class="skeleton skeleton-card" style="height:320px"></div>';
    try {
        const data = await API.get(`/bookings/pnr/${pnr}`);
        const classInfo = data.classCode ? `${data.classCode} - ${data.className || ''}` : '—';
        const passengerRows = (data.passengers || []).map((p) =>
            `<tr><td>${UI.escapeHTML(p.name)}</td><td>${p.age}</td><td>${UI.escapeHTML(p.gender)}</td><td>${UI.escapeHTML(p.berthPreference || '—')}</td><td>${UI.statusBadge(p.passengerStatus || data.status)}</td></tr>`
        ).join('');

        resultContainer.innerHTML = `
            <div class="pnr-ticket no-print">
                <div class="pnr-ticket-header">
                    <div><div class="form-hint" style="color:rgba(255,255,255,0.7)">PNR STATUS</div>
                    <div class="confirmation-pnr" style="color:white;margin:0;font-size:1.5rem">${UI.escapeHTML(data.pnrNumber)}</div></div>
                    ${UI.statusBadge(data.status)}
                </div>
                <div class="pnr-ticket-body">
                    <div class="pnr-ticket-route">${UI.escapeHTML(data.train.source)} → ${UI.escapeHTML(data.train.destination)}</div>
                    <div class="pnr-detail-grid">
                        <div class="pnr-detail-item"><label>Train</label><span>${UI.escapeHTML(data.train.trainName)} (${UI.escapeHTML(data.train.trainNumber)})</span></div>
                        <div class="pnr-detail-item"><label>Journey Date</label><span>${UI.formatDate(data.journeyDate)}</span></div>
                        <div class="pnr-detail-item"><label>Class</label><span>${UI.escapeHTML(classInfo)}</span></div>
                        <div class="pnr-detail-item"><label>Quota</label><span>${UI.escapeHTML(data.quota || 'General')}</span></div>
                        <div class="pnr-detail-item"><label>Departure</label><span>${UI.escapeHTML(data.train.departureTime)}</span></div>
                        ${token ? `<div class="pnr-detail-item"><label>Total Fare</label><span>${UI.formatCurrency(data.totalPrice)}</span></div>` : ''}
                    </div>
                    ${data.waitlistPosition ? `<p class="badge ${data.status === 'RAC' ? 'badge-rac' : 'badge-waitlisted'}">${data.status === 'RAC' ? 'RAC' : 'Waitlist WL'}/${data.waitlistPosition}</p>` : ''}
                    <p><strong>Seats:</strong> ${(data.seatNumbers || []).join(', ') || (data.status === 'RAC' ? 'RAC' : data.status === 'Waitlisted' ? 'Waitlisted' : '—')}</p>
                    <div class="table-wrap" style="margin-top:16px">
                        <table class="data-table"><thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Berth Pref.</th><th>Status</th></tr></thead><tbody>${passengerRows}</tbody></table>
                    </div>
                    ${token && data.refund ? `<p style="margin-top:12px"><strong>Refund:</strong> ${UI.formatCurrency(data.refund.refundAmount)} (${data.refund.refundPercent}%)</p>` : ''}
                    <div class="confirmation-actions" style="margin-top:20px">
                        <button type="button" class="btn btn-outline btn-sm" id="pnr-copy"><i class="fas fa-copy"></i> Copy PNR</button>
                        <button type="button" class="btn btn-outline btn-sm" id="pnr-share"><i class="fas fa-share-alt"></i> Share</button>
                        <button type="button" class="btn btn-outline btn-sm" id="pnr-print"><i class="fas fa-print"></i> Print</button>
                    </div>
                </div>
            </div>`;

        document.getElementById('pnr-copy')?.addEventListener('click', () => UI.copyToClipboard(data.pnrNumber));
        document.getElementById('pnr-share')?.addEventListener('click', () => sharePnr(data));
        document.getElementById('pnr-print')?.addEventListener('click', () => window.print());
    } catch (err) {
        resultContainer.innerHTML = '';
        errorDisplay.textContent = err.message || 'PNR not found';
    }
}

function sharePnr(data) {
    const text = `PNR: ${data.pnrNumber}\nTrain: ${data.train.trainName} (${data.train.trainNumber})\n${data.train.source} → ${data.train.destination}\nDate: ${UI.formatDate(data.journeyDate)}\nStatus: ${data.status}`;
    if (navigator.share) {
        navigator.share({ title: 'PNR Status', text }).catch(() => UI.copyToClipboard(text));
    } else {
        UI.copyToClipboard(text);
    }
}

function openBookingDetail(bookingId) {
    const booking = userBookingsCache.find((b) => getId(b) === bookingId);
    if (!booking) return;
    const train = booking.train;
    const passengers = (booking.passengers || []).map((p) =>
        `<tr><td>${UI.escapeHTML(p.name)}</td><td>${p.age}</td><td>${UI.escapeHTML(p.gender)}</td><td>${UI.escapeHTML(p.berthPreference || '—')}</td><td>${UI.statusBadge(p.passengerStatus || booking.status)}</td></tr>`
    ).join('');
    const seatLabel = (booking.seatNumbers || []).join(', ') || (booking.status === 'RAC' ? 'RAC' : booking.status === 'Waitlisted' ? 'Waitlisted' : '—');

    document.getElementById('booking-detail-body').innerHTML = `
        <p><strong>PNR:</strong> ${UI.escapeHTML(booking.pnrNumber)} ${UI.statusBadge(booking.status)}${booking.waitlistPosition ? ` <span class="badge ${booking.status === 'RAC' ? 'badge-rac' : 'badge-waitlisted'}">${booking.status === 'RAC' ? 'RAC' : 'WL'}/${booking.waitlistPosition}</span>` : ''}</p>
        <p><strong>Train:</strong> ${UI.escapeHTML(train?.trainName)} (${UI.escapeHTML(train?.trainNumber)})</p>
        <p><strong>Route:</strong> ${UI.escapeHTML(train?.source)} → ${UI.escapeHTML(train?.destination)}</p>
        <p><strong>Journey:</strong> ${UI.formatDate(booking.journeyDate)}</p>
        <p><strong>Class:</strong> ${UI.escapeHTML(booking.classCode || '—')} | <strong>Quota:</strong> ${UI.escapeHTML(booking.quota || 'General')}</p>
        <p><strong>Seats:</strong> ${seatLabel}</p>
        <p><strong>Amount:</strong> ${UI.formatCurrency(booking.totalPrice)} | <strong>Payment:</strong> ${UI.escapeHTML(booking.paymentStatus || 'N/A')}</p>
        ${booking.refund ? `<p><strong>Refund:</strong> ${UI.formatCurrency(booking.refund.refundAmount)}</p>` : ''}
        <div class="table-wrap" style="margin-top:16px"><table class="data-table"><thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Berth Pref.</th><th>Status</th></tr></thead><tbody>${passengers || '<tr><td colspan="5">—</td></tr>'}</tbody></table></div>`;
    UI.openDrawer('booking-detail-overlay');
}
