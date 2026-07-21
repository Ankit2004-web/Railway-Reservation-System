document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = parseInt(params.get('id'), 10);
    const container = document.getElementById('ticket-container');

    if (!API.getToken()) {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    if (!bookingId) {
        renderTicketError(container, 'Invalid ticket link. Booking ID is missing.');
        return;
    }

    try {
        const booking = await API.get(`/bookings/${bookingId}`);
        if (booking.status !== 'Confirmed') {
            renderTicketError(container, `Ticket not available. Booking status: ${booking.status}`);
            return;
        }
        renderTicket(container, booking);
        document.getElementById('ticket-print-btn')?.addEventListener('click', () => window.print());
        document.getElementById('ticket-download-btn')?.addEventListener('click', () => {
            downloadTicket(bookingId).catch((err) => UI.showToast(err.message || 'Download failed', 'error'));
        });
    } catch (err) {
        renderTicketError(container, err.message || 'Could not load ticket');
    }
});

function renderTicketError(container, message) {
    container.innerHTML = `
        <div class="ticket-error">
            <i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px"></i>
            <h2>Ticket Unavailable</h2>
            <p class="form-hint">${UI.escapeHTML(message)}</p>
            <a href="index.html" class="btn btn-primary" style="margin-top:16px">Go to Dashboard</a>
        </div>`;
}

function renderTicket(container, booking) {
    const train = booking.train || {};
    const passengerRows = (booking.passengers || []).map((p) =>
        `<tr>
            <td>${UI.escapeHTML(p.name)}</td>
            <td>${p.age}</td>
            <td>${UI.escapeHTML(p.gender)}</td>
            <td>${UI.escapeHTML(p.passengerStatus || booking.status)}</td>
            <td>${UI.escapeHTML(p.coach || '—')}</td>
            <td>${UI.escapeHTML(p.seatNumber || p.berth || '—')}</td>
        </tr>`
    ).join('');

    container.innerHTML = `
        <article class="ticket-card">
            <div class="ticket-card-header">
                <img src="/assets/logo.png" alt="RailYatra" height="40" style="margin-bottom:12px">
                <h1>Electronic Reservation Slip (E-Ticket)</h1>
                <div class="ticket-pnr tabular-nums">${UI.escapeHTML(booking.pnrNumber)}</div>
                <p style="margin:8px 0 0;opacity:0.85">Status: ${UI.escapeHTML(booking.status)}</p>
            </div>
            <div class="ticket-card-body">
                <div class="ticket-route">${UI.escapeHTML(train.source)} → ${UI.escapeHTML(train.destination)}</div>
                <div class="ticket-meta-grid">
                    <div class="ticket-meta-item"><label>Train</label><span>${UI.escapeHTML(train.trainName)} (${UI.escapeHTML(train.trainNumber)})</span></div>
                    <div class="ticket-meta-item"><label>Journey Date</label><span>${UI.formatDate(booking.journeyDate)}</span></div>
                    <div class="ticket-meta-item"><label>Class</label><span>${UI.escapeHTML(booking.classCode || '—')} ${UI.escapeHTML(booking.className || '')}</span></div>
                    <div class="ticket-meta-item"><label>Quota</label><span>${UI.escapeHTML(booking.quota || 'General')}</span></div>
                    <div class="ticket-meta-item"><label>Departure</label><span>${UI.escapeHTML(train.departureTime || '—')}</span></div>
                    <div class="ticket-meta-item"><label>Arrival</label><span>${UI.escapeHTML(train.arrivalTime || '—')}</span></div>
                    <div class="ticket-meta-item"><label>Total Paid</label><span>${UI.formatCurrency(booking.totalPrice)}</span></div>
                    ${booking.contactEmail ? `<div class="ticket-meta-item"><label>Contact Email</label><span>${UI.escapeHTML(booking.contactEmail)}</span></div>` : ''}
                    ${booking.contactPhone ? `<div class="ticket-meta-item"><label>Contact Phone</label><span>${UI.escapeHTML(booking.contactPhone)}</span></div>` : ''}
                </div>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Passenger</th><th>Age</th><th>Gender</th><th>Status</th><th>Coach</th><th>Seat/Berth</th></tr></thead>
                        <tbody>${passengerRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
                    </table>
                </div>
                <p class="ticket-disclaimer">This is a computer-generated development e-ticket for demo purposes. Not an official government/IRCTC ticket.</p>
            </div>
        </article>`;
}

async function downloadTicket(bookingId) {
    await API.download(`/bookings/${bookingId}/ticket`, `ticket-${bookingId}.html`);
    UI.showToast('Ticket downloaded', 'success');
}
