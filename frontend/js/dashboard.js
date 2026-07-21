/**
 * Passenger User Dashboard — integrates with app.js shared state & APIs
 */
const Dashboard = (() => {
    let active = false;
    let currentDashPage = 'overview';
    let dashBookingTab = 'all';
    let dashTripsTab = 'upcoming';
    let dashBookingSearch = '';
    let dashBookingStatusFilter = '';
    let dashBookingDateFrom = '';
    let dashBookingDateTo = '';
    let previewTab = 'upcoming';
    let notifFilterTab = 'all';
    let bookingsLoadError = null;
    const stationCodeCache = {};
    const readNotifIds = new Set(JSON.parse(localStorage.getItem('dashReadNotifs') || '[]'));
    const RECENT_SEARCHES_KEY = 'railwayRecentSearches';
    const MAX_RECENT = 5;
    let savedPassengersCache = [];
    let editingPassengerId = null;

    const FAQ_SECTIONS = [
        {
            title: 'Booking Help',
            faqs: [
                { q: 'How do I book a train?', a: 'Use Search Trains from the dashboard, select a train and class, add passengers, choose seats or join waitlist/RAC, then complete payment.' },
                { q: 'How do I use saved passengers?', a: 'Save passengers under Saved Passengers. When booking, use the dropdown on the passenger step to auto-fill details.' }
            ]
        },
        {
            title: 'Cancellation & Refund',
            faqs: [
                { q: 'How do I cancel a booking?', a: 'Open the booking and click Cancel. You will see an estimated refund before confirming. Refunds follow the system cancellation rules based on time before journey.' },
                { q: 'How are refunds processed?', a: 'Refunds are calculated when you cancel. The amount depends on how far in advance you cancel. Refund details appear on cancelled bookings.' }
            ]
        },
        {
            title: 'PNR Help',
            faqs: [
                { q: 'How do I check my PNR?', a: 'Go to PNR Status and enter your 10-digit PNR number. You can also view PNR from any booking card.' },
                { q: 'What does WL mean?', a: 'WL (Waitlist) means your booking is queued. You will be assigned a waitlist position until seats become available.' },
                { q: 'What does RAC mean?', a: 'RAC (Reservation Against Cancellation) allows travel without a confirmed berth until a cancellation frees a seat.' }
            ]
        },
        {
            title: 'Payment Help',
            faqs: [
                { q: 'How do I download my ticket?', a: 'For confirmed bookings, use View Ticket or Download Ticket from your booking. A printable e-ticket page will open.' }
            ]
        },
        {
            title: 'Account Help',
            faqs: [
                { q: 'How do I update my profile?', a: 'Go to Profile & Account, edit your name and phone, then save. Email cannot be changed.' },
                { q: 'How do I change my password?', a: 'Open Profile & Account and click Change Password. Enter your current password and new password.' }
            ]
        }
    ];

    const PAGE_TITLES = {
        overview: 'Dashboard',
        search: 'Search Trains',
        bookings: 'My Bookings',
        pnr: 'PNR Status',
        trips: 'My Trips',
        passengers: 'Saved Passengers',
        notifications: 'Notifications',
        profile: 'Profile & Account',
        help: 'Help & Support'
    };

    const POPULAR_ROUTES = [
        { from: 'New Delhi', to: 'Mumbai' },
        { from: 'New Delhi', to: 'Kolkata' },
        { from: 'Mumbai', to: 'Ahmedabad' },
        { from: 'Chennai', to: 'Bengaluru' }
    ];

    function init() {
        bindNavigation();
        bindTopbar();
        setupDashAutocomplete('dash-source', 'dash-source-suggestions');
        setupDashAutocomplete('dash-destination', 'dash-destination-suggestions');
        document.getElementById('dash-search-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            syncDashSearchFromPageForm();
            dashSearchTrains();
        });
        document.getElementById('dash-overview-search-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            showPage('search');
            dashSearchTrains();
        });
        document.getElementById('dash-search-swap')?.addEventListener('click', () => {
            const a = document.getElementById('dash-search-source');
            const b = document.getElementById('dash-search-dest');
            [a.value, b.value] = [b.value, a.value];
        });
        document.getElementById('dash-booking-filter-btn')?.addEventListener('click', () => renderBookingsPage());
        document.getElementById('dash-booking-search')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); renderBookingsPage(); }
        });

        setupDashAutocomplete('dash-search-source', 'dash-search-source-suggestions');
        setupDashAutocomplete('dash-search-dest', 'dash-search-dest-suggestions');
        document.getElementById('dash-swap-stations')?.addEventListener('click', () => {
            const a = document.getElementById('dash-source');
            const b = document.getElementById('dash-destination');
            [a.value, b.value] = [b.value, a.value];
        });
        document.getElementById('dash-pnr-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            checkDashPnr();
        });
        document.getElementById('dash-profile-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDashProfile();
        });
        document.getElementById('dash-change-password-btn')?.addEventListener('click', () => {
            UI.openModal('changePasswordModal');
        });
        document.getElementById('dash-clear-recent')?.addEventListener('click', clearRecentSearches);
        document.getElementById('dash-add-passenger-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            addSavedPassenger();
        });
        document.getElementById('dash-cancel-edit-passenger')?.addEventListener('click', cancelEditPassenger);
        document.getElementById('dash-faq-search')?.addEventListener('input', (e) => filterFaqList(e.target.value));
        document.getElementById('dash-retry-bookings')?.addEventListener('click', () => loadPageData(currentDashPage));

        document.querySelectorAll('#dash-notif-tabs .tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                notifFilterTab = btn.dataset.notifTab;
                renderNotificationsPage();
            });
        });

        document.querySelectorAll('#dash-preview-tabs .tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                previewTab = btn.dataset.previewTab;
                renderBookingsPreview(userBookingsCache || []);
            });
        });

        document.querySelectorAll('.dash-mobile-nav-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.dashMobile;
                if (page) navigateDashPage(page);
            });
        });

        const today = new Date().toISOString().split('T')[0];
        const dateEl = document.getElementById('dash-date');
        if (dateEl) {
            dateEl.min = today;
            dateEl.value = today;
        }
    }

    function bindNavigation() {
        document.querySelectorAll('[data-dash-page]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.dataset.dashPage;
                if (page === 'public-home') {
                    exit();
                    closeMobileSidebar();
                    if (typeof window.showPage === 'function') window.showPage('home');
                    return;
                }
                if (page === 'logout') {
                    if (typeof logout === 'function') logout();
                    return;
                }
                showPage(page);
                closeMobileSidebar();
            });
        });
    }

    function navigateDashPage(page) {
        showPage(page);
    }

    function bindTopbar() {
        document.getElementById('dash-menu-btn')?.addEventListener('click', () => {
            document.getElementById('dash-sidebar')?.classList.toggle('is-open');
            document.getElementById('dash-sidebar-overlay')?.classList.toggle('is-open');
        });
        document.getElementById('dash-sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

        document.getElementById('dash-notif-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('dash-notif-dropdown')?.classList.toggle('is-open');
        });
        document.addEventListener('click', () => {
            document.getElementById('dash-notif-dropdown')?.classList.remove('is-open');
        });

        document.getElementById('dash-user-trigger')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('dash-user-dropdown')?.classList.toggle('is-open');
        });
    }

    function closeMobileSidebar() {
        document.getElementById('dash-sidebar')?.classList.remove('is-open');
        document.getElementById('dash-sidebar-overlay')?.classList.remove('is-open');
    }

    function enter(page = 'overview') {
        if (!API.getToken()) return;
        active = true;
        document.body.classList.add('dashboard-mode');
        document.getElementById('passenger-dashboard')?.classList.add('is-active');
        updateUserDisplay();
        showPage(page);
    }

    function exit() {
        active = false;
        document.body.classList.remove('dashboard-mode');
        document.getElementById('passenger-dashboard')?.classList.remove('is-active');
    }

    function isActive() {
        return active;
    }

    function showPage(page) {
        currentDashPage = page;
        document.querySelectorAll('.dash-page').forEach((p) => p.classList.remove('active'));
        document.getElementById(`dash-${page}`)?.classList.add('active');
        document.querySelectorAll('.dash-nav-item[data-dash-page]').forEach((item) => {
            item.classList.toggle('active', item.dataset.dashPage === page);
        });
        document.querySelectorAll('.dash-mobile-nav-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.dashMobile === page);
        });
        const titleEl = document.getElementById('dash-page-title');
        if (titleEl) titleEl.textContent = PAGE_TITLES[page] || 'Dashboard';
        document.title = `${PAGE_TITLES[page] || 'Dashboard'} | RailYatra`;
        loadPageData(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function loadPageData(page) {
        if (['overview', 'bookings', 'trips', 'notifications'].includes(page)) {
            const nextEl = document.getElementById('dash-next-journey');
            const statsEl = document.getElementById('dash-stats-row');
            if (page === 'overview') {
                if (nextEl) nextEl.innerHTML = '<div class="skeleton skeleton-card" style="height:220px"></div>';
                if (statsEl) statsEl.innerHTML = Array(5).fill('<div class="skeleton skeleton-card" style="height:80px"></div>').join('');
            }
            if (page === 'bookings') {
                const list = document.getElementById('dash-bookings-list');
                if (list) UI.renderSkeleton(list, 'card', 3);
            }
            await refreshBookings();
        }
        switch (page) {
            case 'overview': await renderOverview(); break;
            case 'search': syncDashSearchToPageForm(); renderDashSearchExtras(); break;
            case 'bookings': renderBookingsPage(); break;
            case 'pnr': break;
            case 'trips': renderTripsPage(); break;
            case 'passengers': renderSavedPassengers(); break;
            case 'notifications': renderNotificationsPage(); break;
            case 'profile': renderProfilePage(); break;
            case 'help': renderHelpPage(); break;
        }
        renderNotifDropdown();
    }

    async function refreshBookings() {
        bookingsLoadError = null;
        try {
            userBookingsCache = await API.get('/bookings');
            return userBookingsCache;
        } catch (err) {
            bookingsLoadError = err.message || 'Could not load bookings';
            console.error(err);
            return userBookingsCache || [];
        }
    }

    function renderBookingsLoadError(containerId) {
        const el = document.getElementById(containerId);
        if (!el || !bookingsLoadError) return;
        UI.renderErrorState(el, "We couldn't load your journeys.", () => loadPageData(currentDashPage));
    }

    async function resolveStationCode(name) {
        if (!name) return '—';
        const key = name.trim().toLowerCase();
        if (stationCodeCache[key]) return stationCodeCache[key];
        try {
            const stations = await API.get(`/stations/search?q=${encodeURIComponent(name.trim())}`);
            const exact = stations.find((s) => s.name.toLowerCase() === key);
            const match = exact || stations[0];
            if (match?.code) {
                stationCodeCache[key] = match.code;
                return match.code;
            }
        } catch { /* fallback below */ }
        const words = name.trim().split(/\s+/);
        const fallback = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 4).toUpperCase() : name.slice(0, 4).toUpperCase();
        stationCodeCache[key] = fallback;
        return fallback;
    }

    function isOvernightTrain(train) {
        if (!train?.departureTime || !train?.arrivalTime) return false;
        const dep = parseInt(train.departureTime.split(':')[0], 10);
        const arr = parseInt(train.arrivalTime.split(':')[0], 10);
        return !Number.isNaN(dep) && !Number.isNaN(arr) && arr < dep;
    }

    function stationCode(name) {
        if (!name) return '—';
        const key = name.trim().toLowerCase();
        return stationCodeCache[key] || name.slice(0, 4).toUpperCase();
    }

    async function enrichNextJourneyCodes(booking) {
        if (!booking?.train) return;
        await Promise.all([
            resolveStationCode(booking.train.source),
            resolveStationCode(booking.train.destination)
        ]);
    }

    function updateUserDisplay() {
        const user = currentUser;
        if (!user) return;
        const first = user.name?.split(' ')[0] || 'Traveler';
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const welcomeEl = document.getElementById('dash-welcome-text');
        if (welcomeEl) welcomeEl.textContent = `${greet}, ${first}`;
        const initials = UI.getInitials(user.name);
        document.querySelectorAll('#dash-user-avatar, #dash-sidebar-avatar').forEach((el) => { el.textContent = initials; });
        const nameEls = document.querySelectorAll('#dash-user-name, #dash-sidebar-name');
        nameEls.forEach((el) => { el.textContent = user.name; });
        const dateEl = document.getElementById('dash-welcome-date');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
    }

    function getBookingStats(bookings) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcoming = bookings.filter((b) =>
            ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now
        ).length;
        const waitlisted = bookings.filter((b) => ['Waitlisted', 'RAC'].includes(b.status)).length;
        const completed = bookings.filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) < now).length;
        const cancelled = bookings.filter((b) => b.status === 'Cancelled').length;
        const spent = bookings.filter((b) => b.status !== 'Cancelled').reduce((s, b) => s + (b.totalPrice || 0), 0);
        return { upcoming, total: bookings.length, waitlisted, completed, cancelled, spent };
    }

    function getNextJourney(bookings) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcoming = bookings
            .filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now)
            .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate));
        return upcoming[0] || null;
    }

    function stationCodeSync(name) {
        if (!name) return '—';
        const key = name.trim().toLowerCase();
        return stationCodeCache[key] || name.slice(0, 4).toUpperCase();
    }

    async function renderOverview() {
        updateUserDisplay();
        if (bookingsLoadError) {
            renderBookingsLoadError('dash-bookings-preview');
            document.getElementById('dash-next-journey').innerHTML = '';
            document.getElementById('dash-stats-row').innerHTML = '';
            return;
        }
        const bookings = userBookingsCache || [];
        const stats = getBookingStats(bookings);
        const next = getNextJourney(bookings);

        renderStatsRow(stats);
        if (next) {
            document.getElementById('dash-next-journey').innerHTML = '<div class="skeleton skeleton-card" style="height:220px"></div>';
            await enrichNextJourneyCodes(next);
            renderNextJourney(next);
        } else {
            renderNextJourney(null);
        }
        renderAlerts(bookings);
        renderBookingsPreview(bookings);
        renderRecentSearches();
        renderPopularRoutes('dash-popular-routes');
    }

    function renderStatsRow(stats) {
        const el = document.getElementById('dash-stats-row');
        if (!el) return;
        el.innerHTML = `
            <div class="dash-stat-card"><div class="dash-stat-icon"><i class="fas fa-calendar-check"></i></div><div><div class="dash-stat-value">${stats.upcoming}</div><div class="dash-stat-label">Upcoming Trips</div></div></div>
            <div class="dash-stat-card"><div class="dash-stat-icon"><i class="fas fa-ticket-alt"></i></div><div><div class="dash-stat-value">${stats.total}</div><div class="dash-stat-label">Total Bookings</div></div></div>
            <div class="dash-stat-card"><div class="dash-stat-icon"><i class="fas fa-clock"></i></div><div><div class="dash-stat-value">${stats.waitlisted}</div><div class="dash-stat-label">Waitlisted / RAC</div></div></div>
            <div class="dash-stat-card"><div class="dash-stat-icon"><i class="fas fa-check-circle"></i></div><div><div class="dash-stat-value">${stats.completed}</div><div class="dash-stat-label">Completed</div></div></div>
            <div class="dash-stat-card"><div class="dash-stat-icon"><i class="fas fa-rupee-sign"></i></div><div><div class="dash-stat-value">${UI.formatCurrency(stats.spent).replace('.00', '')}</div><div class="dash-stat-label">Total Spent</div></div></div>`;
    }

    function renderNextJourney(booking) {
        const el = document.getElementById('dash-next-journey');
        if (!el) return;
        if (!booking) {
            el.innerHTML = `
                <div class="empty-state" style="padding:32px;text-align:center">
                    <div class="empty-state-icon"><i class="fas fa-train"></i></div>
                    <h3>No upcoming journeys</h3>
                    <p>Ready to plan your next trip?</p>
                    <button type="button" class="btn btn-primary" data-dash-page="search">Search Trains</button>
                </div>`;
            el.querySelector('[data-dash-page]')?.addEventListener('click', () => showPage('search'));
            return;
        }
        const train = booking.train || {};
        const srcCode = stationCodeSync(train.source);
        const dstCode = stationCodeSync(train.destination);
        const overnight = isOvernightTrain(train);
        const canCancel = ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(booking.status);
        const canTicket = booking.status === 'Confirmed';
        el.innerHTML = `
            <div class="dash-next-journey-label">Upcoming Journey</div>
            <div class="dash-journey-train">${UI.escapeHTML(train.trainNumber || '')} <span>${UI.escapeHTML(train.trainName || '')}</span></div>
            <p class="form-hint" style="margin-bottom:16px"><i class="fas fa-calendar"></i> ${UI.formatDate(booking.journeyDate)}</p>
            <div class="dash-journey-timeline">
                <div class="dash-journey-station">
                    <div class="dash-journey-code">${UI.escapeHTML(srcCode)}</div>
                    <div class="dash-journey-time tabular-nums">${UI.escapeHTML(train.departureTime || '—')}</div>
                    <div class="dash-journey-name">${UI.escapeHTML(train.source || '')}</div>
                </div>
                <div class="dash-journey-line">
                    <div>●━━━━━━━━━━●</div>
                    <div class="dash-journey-duration">${UI.escapeHTML(train.duration || '')}</div>
                </div>
                <div class="dash-journey-station">
                    <div class="dash-journey-code">${UI.escapeHTML(dstCode)}</div>
                    <div class="dash-journey-time tabular-nums">${UI.escapeHTML(train.arrivalTime || '—')}</div>
                    <div class="dash-journey-name">${UI.escapeHTML(train.destination || '')}</div>
                </div>
            </div>
            <div class="dash-journey-meta">
                <div class="dash-journey-meta-item"><label>PNR</label><span class="tabular-nums">${UI.escapeHTML(booking.pnrNumber)}</span></div>
                <div class="dash-journey-meta-item"><label>Class</label><span>${UI.escapeHTML(booking.classCode || '—')}</span></div>
                <div class="dash-journey-meta-item"><label>Quota</label><span>${UI.escapeHTML(booking.quota || 'General')}</span></div>
                <div class="dash-journey-meta-item"><label>Passengers</label><span>${booking.passengers?.length || '—'}</span></div>
                <div class="dash-journey-meta-item"><label>Status</label><span>${UI.statusBadge(booking.status)}</span></div>
            </div>
            <div class="dash-journey-actions">
                ${canTicket ? `<button type="button" class="btn btn-primary btn-sm" data-action="ticket" data-id="${getId(booking)}"><i class="fas fa-ticket-alt"></i> View Ticket</button>` : ''}
                <button type="button" class="btn btn-outline btn-sm" data-action="pnr" data-pnr="${UI.escapeHTML(booking.pnrNumber)}"><i class="fas fa-search"></i> View PNR</button>
                <button type="button" class="btn btn-outline btn-sm" data-action="detail" data-id="${getId(booking)}"><i class="fas fa-eye"></i> View Details</button>
                ${canTicket ? `<button type="button" class="btn btn-outline btn-sm" data-action="download" data-id="${getId(booking)}"><i class="fas fa-download"></i> Download</button>` : ''}
                ${canCancel ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel" data-id="${getId(booking)}">Cancel</button>` : ''}
            </div>`;
        bindBookingActions(el);
    }

    function renderAlerts(bookings) {
        const el = document.getElementById('dash-alerts');
        if (!el) return;
        const alerts = buildAlerts(bookings);
        if (!alerts.length) {
            el.innerHTML = '';
            el.style.display = 'none';
            return;
        }
        el.style.display = 'block';
        el.innerHTML = `<h3 style="margin-bottom:12px;font-size:1rem">Important Alerts</h3>${alerts.map((a) => `
            <div class="dash-alert dash-alert-${a.type}">
                <i class="fas fa-${a.icon}"></i>
                <div class="dash-alert-body">
                    <div class="dash-alert-title">${UI.escapeHTML(a.title)}</div>
                    <div class="dash-alert-desc">${UI.escapeHTML(a.desc)}</div>
                </div>
                ${a.action ? `<button type="button" class="btn btn-sm btn-outline" data-alert-action="${a.action}" data-alert-id="${a.id || ''}" data-alert-pnr="${a.pnr || ''}">${UI.escapeHTML(a.actionLabel)}</button>` : ''}
            </div>`).join('')}`;
        el.querySelectorAll('[data-alert-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.dataset.alertAction === 'booking') showPage('bookings');
                else if (btn.dataset.alertAction === 'detail') openBookingDetail(Number(btn.dataset.alertId));
                else if (btn.dataset.alertAction === 'pnr') {
                    showPage('pnr');
                    document.getElementById('dash-pnr-input').value = btn.dataset.alertPnr;
                    checkDashPnr();
                }
            });
        });
    }

    function buildAlerts(bookings) {
        const alerts = [];
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        bookings.forEach((b) => {
            const jDate = new Date(b.journeyDate);
            jDate.setHours(0, 0, 0, 0);
            if (b.status === 'Waitlisted' && b.waitlistPosition) {
                alerts.push({ type: 'warning', icon: 'clock', title: 'Waitlisted booking', desc: `PNR ${b.pnrNumber} is currently WL/${b.waitlistPosition}.`, action: 'detail', actionLabel: 'View Booking', id: getId(b) });
            }
            if (b.status === 'RAC' && b.waitlistPosition) {
                alerts.push({ type: 'warning', icon: 'exclamation-circle', title: 'RAC booking', desc: `PNR ${b.pnrNumber} is RAC/${b.waitlistPosition}.`, action: 'detail', actionLabel: 'View Booking', id: getId(b) });
            }
            if (b.status === 'Confirmed' && jDate.getTime() === tomorrow.getTime()) {
                alerts.push({ type: 'journey', icon: 'train', title: 'Journey tomorrow', desc: `${b.train?.trainName || 'Train'} to ${b.train?.destination || ''} departs tomorrow.`, action: 'detail', actionLabel: 'View Details', id: getId(b) });
            }
            if (b.status === 'Cancelled' && b.refund) {
                alerts.push({ type: 'success', icon: 'undo', title: 'Refund processed', desc: `PNR ${b.pnrNumber}: ${UI.formatCurrency(b.refund.refundAmount)} refunded.`, action: 'detail', actionLabel: 'View Details', id: getId(b) });
            }
        });
        return alerts.slice(0, 5);
    }

    function renderBookingsPreview(bookings) {
        const el = document.getElementById('dash-bookings-preview');
        if (!el) return;

        document.querySelectorAll('#dash-preview-tabs .tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.previewTab === previewTab);
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let preview;
        if (previewTab === 'upcoming') {
            preview = bookings.filter((b) =>
                ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now
            ).sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate));
        } else if (previewTab === 'waitlisted') {
            preview = bookings.filter((b) => ['Waitlisted', 'RAC'].includes(b.status));
        } else {
            preview = bookings.filter((b) => b.status !== 'Cancelled')
                .sort((a, b) => new Date(b.bookingDate || b.journeyDate) - new Date(a.bookingDate || a.journeyDate));
        }
        preview = preview.slice(0, 5);

        if (!preview.length) {
            const emptyMsg = previewTab === 'waitlisted' ? 'No waitlisted bookings' : previewTab === 'recent' ? 'No recent bookings' : 'No upcoming journeys';
            el.innerHTML = `<div class="empty-state" style="padding:24px"><p>${emptyMsg}</p><button type="button" class="btn btn-primary btn-sm" data-dash-page="search">Search Trains</button></div>`;
            el.querySelector('[data-dash-page]')?.addEventListener('click', () => showPage('search'));
            return;
        }
        el.innerHTML = preview.map((b) => compactBookingHtml(b)).join('');
        bindBookingActions(el);
    }

    function compactBookingHtml(b) {
        const train = b.train || {};
        return `<div class="dash-booking-compact">
            <div class="dash-booking-compact-header">
                <div><div class="dash-booking-compact-train">${UI.escapeHTML(train.trainName || 'Train')} ${UI.statusBadge(b.status)}</div>
                <div class="dash-booking-compact-route">PNR ${UI.escapeHTML(b.pnrNumber)} · ${UI.escapeHTML(train.source || '')} → ${UI.escapeHTML(train.destination || '')}</div></div>
            </div>
            <div class="dash-booking-compact-meta">
                <span><i class="fas fa-calendar"></i> ${UI.formatDate(b.journeyDate)}</span>
                <span>${UI.escapeHTML(b.classCode || '')}</span>
            </div>
            <div class="dash-booking-compact-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-action="detail" data-id="${getId(b)}">View</button>
                ${b.status === 'Confirmed' ? `<button type="button" class="btn btn-primary btn-sm" data-action="ticket" data-id="${getId(b)}">Ticket</button>` : ''}
            </div>
        </div>`;
    }

    function renderBookingsPage() {
        const stats = getBookingStats(userBookingsCache || []);
        const summary = document.getElementById('dash-bookings-summary');
        if (summary) {
            summary.innerHTML = `
                <span class="dash-summary-pill">Upcoming: <strong>${stats.upcoming}</strong></span>
                <span class="dash-summary-pill">Waitlisted/RAC: <strong>${stats.waitlisted}</strong></span>
                <span class="dash-summary-pill">Completed: <strong>${stats.completed}</strong></span>
                <span class="dash-summary-pill">Cancelled: <strong>${stats.cancelled}</strong></span>`;
        }

        document.querySelectorAll('#dash-bookings-tabs .tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.dashBookingTab === dashBookingTab);
            btn.onclick = () => {
                dashBookingTab = btn.dataset.dashBookingTab;
                renderBookingsPage();
            };
        });

        const searchVal = document.getElementById('dash-booking-search')?.value ?? dashBookingSearch;
        dashBookingSearch = searchVal;
        dashBookingStatusFilter = document.getElementById('dash-booking-status-filter')?.value ?? dashBookingStatusFilter;
        dashBookingDateFrom = document.getElementById('dash-booking-date-from')?.value ?? dashBookingDateFrom;
        dashBookingDateTo = document.getElementById('dash-booking-date-to')?.value ?? dashBookingDateTo;

        let filtered = filterDashBookings(userBookingsCache || [], dashBookingTab);
        if (dashBookingSearch.trim()) {
            const q = dashBookingSearch.toLowerCase();
            filtered = filtered.filter((b) =>
                (b.pnrNumber || '').includes(q) ||
                (b.train?.trainName || '').toLowerCase().includes(q) ||
                (b.train?.trainNumber || '').toLowerCase().includes(q) ||
                (b.train?.source || '').toLowerCase().includes(q) ||
                (b.train?.destination || '').toLowerCase().includes(q)
            );
        }
        if (dashBookingStatusFilter) {
            filtered = filtered.filter((b) => b.status === dashBookingStatusFilter);
        }
        if (dashBookingDateFrom) {
            const from = new Date(dashBookingDateFrom);
            from.setHours(0, 0, 0, 0);
            filtered = filtered.filter((b) => new Date(b.journeyDate) >= from);
        }
        if (dashBookingDateTo) {
            const to = new Date(dashBookingDateTo);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter((b) => new Date(b.journeyDate) <= to);
        }

        const list = document.getElementById('dash-bookings-list');
        if (!list) return;
        if (bookingsLoadError) {
            UI.renderErrorState(list, "We couldn't load your bookings.", () => loadPageData('bookings'));
            return;
        }
        if (!filtered.length) {
            UI.renderEmptyState(list, {
                icon: 'fa-suitcase-rolling',
                title: 'No bookings found',
                message: 'Try adjusting filters or search for trains.',
                ctaText: 'Search Trains',
                ctaAction: () => showPage('search')
            });
            return;
        }
        list.innerHTML = filtered.map((b) => fullBookingCardHtml(b)).join('');
        bindBookingActions(list);
    }

    function filterDashBookings(bookings, tab) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        switch (tab) {
            case 'upcoming':
                return bookings.filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now);
            case 'waitlisted':
                return bookings.filter((b) => ['Waitlisted', 'RAC'].includes(b.status));
            case 'completed':
                return bookings.filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) < now);
            case 'cancelled':
                return bookings.filter((b) => b.status === 'Cancelled');
            default:
                return [...bookings];
        }
    }

    function fullBookingCardHtml(b) {
        const train = b.train || {};
        const overnight = isOvernightTrain(train);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const isPast = new Date(b.journeyDate) < now;
        const isCompleted = b.status === 'Confirmed' && isPast;
        const canCancel = !isPast && ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status);
        const canTicket = b.status === 'Confirmed';
        const isCancelled = b.status === 'Cancelled';
        return `<article class="dash-booking-card">
            <div class="dash-booking-card-header">
                <div><strong>${UI.escapeHTML(train.trainNumber || '')}</strong> ${UI.escapeHTML(train.trainName || '')}</div>
                ${UI.statusBadge(b.status)}${b.waitlistPosition ? ` <span class="badge ${b.status === 'RAC' ? 'badge-rac' : 'badge-waitlisted'}">${b.status === 'RAC' ? 'RAC' : 'WL'}/${b.waitlistPosition}</span>` : ''}
            </div>
            <div class="dash-booking-card-body">
                <div class="dash-booking-journey-row">
                    <div class="dash-booking-station-block">
                        <div class="dash-booking-station-code">${UI.escapeHTML(stationCodeSync(train.source))}</div>
                        <div>${UI.escapeHTML(train.source || '')}</div>
                        <div class="tabular-nums">${UI.escapeHTML(train.departureTime || '')}</div>
                    </div>
                    <div class="dash-booking-arrow"><i class="fas fa-arrow-right"></i><br>${UI.formatDate(b.journeyDate)}<br>${UI.escapeHTML(train.duration || '')}</div>
                    <div class="dash-booking-station-block">
                        <div class="dash-booking-station-code">${UI.escapeHTML(stationCodeSync(train.destination))}</div>
                        <div>${UI.escapeHTML(train.destination || '')}</div>
                        <div class="tabular-nums">${UI.escapeHTML(train.arrivalTime || '')}</div>
                    </div>
                </div>
                <div class="dash-booking-details-grid">
                    <div><label>PNR</label><span class="tabular-nums">${UI.escapeHTML(b.pnrNumber)}</span></div>
                    <div><label>Class</label><span>${UI.escapeHTML(b.classCode || '—')}</span></div>
                    <div><label>Quota</label><span>${UI.escapeHTML(b.quota || 'General')}</span></div>
                    <div><label>Passengers</label><span>${b.passengers?.length || '—'}</span></div>
                    <div><label>Amount</label><span>${UI.formatCurrency(b.totalPrice)}</span></div>
                </div>
                <div class="dash-booking-card-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="detail" data-id="${getId(b)}">View Details</button>
                    ${canTicket ? `<button type="button" class="btn btn-outline btn-sm" data-action="ticket" data-id="${getId(b)}"><i class="fas fa-ticket-alt"></i> View Ticket</button>` : ''}
                    ${canTicket ? `<button type="button" class="btn btn-primary btn-sm" data-action="download" data-id="${getId(b)}"><i class="fas fa-download"></i> Download</button>` : ''}
                    ${!isCompleted ? `<button type="button" class="btn btn-outline btn-sm" data-action="pnr" data-pnr="${UI.escapeHTML(b.pnrNumber)}">Check PNR</button>` : ''}
                    ${canCancel ? `<button type="button" class="btn btn-outline btn-sm" data-action="cancel" data-id="${getId(b)}">Cancel</button>` : ''}
                    ${isCompleted ? `<button type="button" class="btn btn-outline btn-sm" data-action="book-again" data-from="${UI.escapeHTML(train.source || '')}" data-to="${UI.escapeHTML(train.destination || '')}">Book Again</button>` : ''}
                    ${isCancelled && b.refund ? `<span class="form-hint">Refund: ${UI.formatCurrency(b.refund.refundAmount)} (${UI.escapeHTML(b.refund.status || 'Processed')})</span>` : ''}
                </div>
            </div>
        </article>`;
    }

    function bindBookingActions(container) {
        container.querySelectorAll('[data-action="detail"]').forEach((btn) => {
            btn.addEventListener('click', () => openBookingDetail(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-action="ticket"]').forEach((btn) => {
            btn.addEventListener('click', () => viewTicket(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-action="download"]').forEach((btn) => {
            btn.addEventListener('click', () => downloadTicket(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
            btn.addEventListener('click', () => openCancelModal(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-action="pnr"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                showPage('pnr');
                document.getElementById('dash-pnr-input').value = btn.dataset.pnr;
                checkDashPnr();
            });
        });
        container.querySelectorAll('[data-action="book-again"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('dash-source').value = btn.dataset.from;
                document.getElementById('dash-destination').value = btn.dataset.to;
                showPage('search');
            });
        });
    }

    async function openBookingDetail(bookingId) {
        let booking = (userBookingsCache || []).find((b) => getId(b) === bookingId);
        if (!booking?.passengers?.length) {
            try {
                booking = await API.get(`/bookings/${bookingId}`);
            } catch (err) {
                UI.showToast(err.message, 'error');
                return;
            }
        }
        const train = booking.train || {};
        const passengers = (booking.passengers || []).map((p) =>
            `<tr><td>${UI.escapeHTML(p.name)}</td><td>${p.age}</td><td>${UI.escapeHTML(p.gender)}</td><td>${UI.escapeHTML(p.berthPreference || '—')}</td><td>${UI.statusBadge(p.passengerStatus || booking.status)}</td><td>${(booking.seatNumbers || []).join(', ') || '—'}</td></tr>`
        ).join('');

        document.getElementById('dash-booking-detail-body').innerHTML = `
            <div class="detail-section"><h4>Booking Information</h4>
            <dl class="detail-grid">
                <dt>PNR</dt><dd class="tabular-nums">${UI.escapeHTML(booking.pnrNumber)}</dd>
                <dt>Booking ID</dt><dd>#${getId(booking)}</dd>
                <dt>Booking Date</dt><dd>${UI.formatDateTime(booking.bookingDate)}</dd>
                <dt>Status</dt><dd>${UI.statusBadge(booking.status)}</dd>
            </dl></div>
            <div class="detail-section"><h4>Train</h4>
            <p>${UI.escapeHTML(train.trainNumber || '')} — ${UI.escapeHTML(train.trainName || '')}</p></div>
            <div class="detail-section"><h4>Journey</h4>
            <dl class="detail-grid">
                <dt>From</dt><dd>${UI.escapeHTML(train.source || '')}</dd>
                <dt>To</dt><dd>${UI.escapeHTML(train.destination || '')}</dd>
                <dt>Date</dt><dd>${UI.formatDate(booking.journeyDate)}</dd>
                <dt>Departure</dt><dd>${UI.escapeHTML(train.departureTime || '—')}</dd>
                <dt>Arrival</dt><dd>${UI.escapeHTML(train.arrivalTime || '—')}</dd>
                <dt>Duration</dt><dd>${UI.escapeHTML(train.duration || '—')}</dd>
            </dl></div>
            <div class="detail-section"><h4>Travel Details</h4>
            <p>Class: ${UI.escapeHTML(booking.classCode || '')} ${UI.escapeHTML(booking.className || '')} · Quota: ${UI.escapeHTML(booking.quota || 'General')} · Type: ${UI.escapeHTML(booking.bookingType || 'General')}</p></div>
            <div class="detail-section"><h4>Passengers</h4>
            <div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Berth</th><th>Status</th><th>Seat</th></tr></thead><tbody>${passengers || '<tr><td colspan="6">—</td></tr>'}</tbody></table></div></div>
            <div class="detail-section"><h4>Payment</h4>
            <p>Total: ${UI.formatCurrency(booking.totalPrice)} · Status: ${UI.escapeHTML(booking.paymentStatus || 'N/A')}</p></div>
            ${booking.refund ? `<div class="detail-section"><h4>Refund</h4><p>${UI.formatCurrency(booking.refund.refundAmount)} (${booking.refund.refundPercent}% — ${UI.escapeHTML(booking.refund.rule || '')})</p></div>` : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
                ${booking.status === 'Confirmed' ? `<button type="button" class="btn btn-primary btn-sm" id="dash-detail-ticket">View Ticket</button>` : ''}
                ${['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(booking.status) ? `<button type="button" class="btn btn-outline btn-sm" id="dash-detail-cancel">Cancel</button>` : ''}
            </div>`;
        document.getElementById('dash-detail-ticket')?.addEventListener('click', () => { UI.closeDrawer('dash-booking-detail-overlay'); viewTicket(bookingId); });
        document.getElementById('dash-detail-cancel')?.addEventListener('click', () => { UI.closeDrawer('dash-booking-detail-overlay'); openCancelModal(bookingId); });
        UI.openDrawer('dash-booking-detail-overlay');
    }

    function viewTicket(bookingId) {
        window.location.href = `ticket.html?id=${bookingId}`;
    }

    function renderTripsPage() {
        document.querySelectorAll('#dash-trips-tabs .tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.dashTripsTab === dashTripsTab);
            btn.onclick = () => { dashTripsTab = btn.dataset.dashTripsTab; renderTripsPage(); };
        });

        const bookings = userBookingsCache || [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let filtered;
        if (dashTripsTab === 'upcoming') {
            filtered = bookings.filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now);
        } else if (dashTripsTab === 'completed') {
            filtered = bookings.filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) < now);
        } else {
            filtered = bookings.filter((b) => b.status === 'Cancelled');
        }

        renderTravelInsights(bookings);
        const list = document.getElementById('dash-trips-list');
        if (!list) return;
        if (!filtered.length) {
            UI.renderEmptyState(list, { icon: 'fa-route', title: `No ${dashTripsTab} trips`, message: 'Your travel history will appear here.', ctaText: 'Search Trains', ctaAction: () => showPage('search') });
            return;
        }

        if (dashTripsTab === 'completed') {
            const byYear = filtered.reduce((acc, b) => {
                const y = new Date(b.journeyDate).getFullYear();
                if (!acc[y]) acc[y] = [];
                acc[y].push(b);
                return acc;
            }, {});
            list.innerHTML = Object.keys(byYear).sort((a, b) => b - a).map((year) =>
                `<div class="dash-trip-year-group"><h3>${year}</h3>${byYear[year].map((b) => tripCardHtml(b)).join('')}</div>`
            ).join('');
        } else {
            list.innerHTML = filtered.map((b) => tripCardHtml(b)).join('');
        }
        bindTripActions(list);
    }

    function tripCardHtml(b) {
        const train = b.train || {};
        return `<div class="dash-booking-compact">
            <div class="dash-booking-compact-header">
                <div class="dash-booking-compact-train">${UI.escapeHTML(train.trainName || '')} ${UI.statusBadge(b.status)}</div>
                <div class="dash-booking-compact-route">${UI.escapeHTML(train.source || '')} → ${UI.escapeHTML(train.destination || '')}</div>
            </div>
            <div class="dash-booking-compact-meta">
                <span>${UI.formatDate(b.journeyDate)}</span><span>${UI.escapeHTML(b.classCode || '')}</span><span>${b.passengers?.length || 0} pax</span>
            </div>
            <div class="dash-booking-compact-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-trip-action="detail" data-id="${getId(b)}">View Trip</button>
                ${b.status === 'Confirmed' ? `<button type="button" class="btn btn-outline btn-sm" data-trip-action="ticket" data-id="${getId(b)}">Download Ticket</button>` : ''}
                <button type="button" class="btn btn-primary btn-sm" data-trip-action="book-again" data-from="${UI.escapeHTML(train.source || '')}" data-to="${UI.escapeHTML(train.destination || '')}">Book Again</button>
            </div>
        </div>`;
    }

    function bindTripActions(container) {
        container.querySelectorAll('[data-trip-action="detail"]').forEach((btn) => {
            btn.addEventListener('click', () => openBookingDetail(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-trip-action="ticket"]').forEach((btn) => {
            btn.addEventListener('click', () => downloadTicket(Number(btn.dataset.id)));
        });
        container.querySelectorAll('[data-trip-action="book-again"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('dash-source').value = btn.dataset.from;
                document.getElementById('dash-destination').value = btn.dataset.to;
                showPage('search');
            });
        });
    }

    function renderTravelInsights(bookings) {
        const el = document.getElementById('dash-travel-insights');
        if (!el) return;
        const completed = bookings.filter((b) => b.status === 'Confirmed');
        const routes = {};
        const classes = {};
        completed.forEach((b) => {
            const route = `${b.train?.source || ''} → ${b.train?.destination || ''}`;
            routes[route] = (routes[route] || 0) + 1;
            if (b.classCode) classes[b.classCode] = (classes[b.classCode] || 0) + 1;
        });
        const topRoute = Object.entries(routes).sort((a, b) => b[1] - a[1])[0];
        const topClass = Object.entries(classes).sort((a, b) => b[1] - a[1])[0];
        const spent = bookings.filter((b) => b.status !== 'Cancelled').reduce((s, b) => s + (b.totalPrice || 0), 0);
        el.innerHTML = `
            <div class="dash-insight-card"><label>Total Journeys</label><span>${completed.length}</span></div>
            <div class="dash-insight-card"><label>Most Travelled Route</label><span>${topRoute ? UI.escapeHTML(topRoute[0]) : '—'}</span></div>
            <div class="dash-insight-card"><label>Most Used Class</label><span>${topClass ? UI.escapeHTML(topClass[0]) : '—'}</span></div>
            <div class="dash-insight-card"><label>Total Spent</label><span>${UI.formatCurrency(spent)}</span></div>`;
    }

    async function checkDashPnr() {
        const input = document.getElementById('dash-pnr-input');
        const errorEl = document.getElementById('dash-pnr-error');
        const resultEl = document.getElementById('dash-pnr-result');
        const pnr = input?.value.trim();
        errorEl.textContent = '';
        resultEl.innerHTML = '';
        if (!/^\d{10}$/.test(pnr)) {
            errorEl.textContent = 'Please enter a valid 10-digit PNR number';
            return;
        }
        resultEl.innerHTML = '<div class="skeleton skeleton-card" style="height:280px"></div>';
        try {
            const data = await API.get(`/bookings/pnr/${pnr}`);
            const ownedBooking = (userBookingsCache || []).find((b) => b.pnrNumber === pnr);
            const rows = (data.passengers || []).map((p) =>
                `<tr><td>${UI.escapeHTML(p.name)}</td><td>${UI.statusBadge(p.passengerStatus || data.status)}</td><td>${UI.statusBadge(p.passengerStatus || data.status)}</td><td>—</td><td>${(data.seatNumbers || []).join(', ') || '—'}</td></tr>`
            ).join('');
            resultEl.innerHTML = `
                <div class="pnr-ticket no-print" style="margin-top:24px">
                    <div class="pnr-ticket-header"><div><div class="form-hint" style="color:rgba(255,255,255,0.7)">PNR STATUS</div>
                    <div class="confirmation-pnr tabular-nums" style="color:white;margin:0">${UI.escapeHTML(data.pnrNumber)}</div></div>${UI.statusBadge(data.status)}</div>
                    <div class="pnr-ticket-body">
                        <div class="pnr-ticket-route">${UI.escapeHTML(data.train.source)} → ${UI.escapeHTML(data.train.destination)}</div>
                        <p><strong>${UI.escapeHTML(data.train.trainName)}</strong> (${UI.escapeHTML(data.train.trainNumber)}) · ${UI.formatDate(data.journeyDate)}</p>
                        <p>Class: ${UI.escapeHTML(data.classCode || '')} · Quota: ${UI.escapeHTML(data.quota || 'General')}</p>
                        ${data.waitlistPosition ? `<p class="badge ${data.status === 'RAC' ? 'badge-rac' : 'badge-waitlisted'}">${data.status === 'RAC' ? 'RAC' : 'WL'}/${data.waitlistPosition}</p>` : ''}
                        <div class="table-wrap" style="margin-top:16px"><table class="data-table"><thead><tr><th>Passenger</th><th>Booking Status</th><th>Current Status</th><th>Coach</th><th>Seat/Berth</th></tr></thead><tbody>${rows}</tbody></table></div>
                        <div class="confirmation-actions" style="margin-top:16px">
                            <button type="button" class="btn btn-outline btn-sm" id="dash-pnr-copy"><i class="fas fa-copy"></i> Copy PNR</button>
                            <button type="button" class="btn btn-outline btn-sm" id="dash-pnr-print"><i class="fas fa-print"></i> Print</button>
                            <button type="button" class="btn btn-outline btn-sm" id="dash-pnr-share"><i class="fas fa-share-alt"></i> Share</button>
                            ${data.status === 'Confirmed' && ownedBooking ? `<button type="button" class="btn btn-primary btn-sm" id="dash-pnr-download"><i class="fas fa-download"></i> Download Ticket</button>` : ''}
                        </div>
                    </div>
                </div>`;
            document.getElementById('dash-pnr-copy')?.addEventListener('click', () => UI.copyToClipboard(data.pnrNumber));
            document.getElementById('dash-pnr-print')?.addEventListener('click', () => window.print());
            document.getElementById('dash-pnr-share')?.addEventListener('click', () => sharePnr(data));
            document.getElementById('dash-pnr-download')?.addEventListener('click', () => downloadTicket(getId(ownedBooking)));
        } catch (err) {
            resultEl.innerHTML = '';
            errorEl.textContent = err.message || 'PNR not found';
        }
    }

    function renderProfilePage() {
        const user = currentUser;
        if (!user) return;
        document.getElementById('dash-profile-name').textContent = user.name;
        document.getElementById('dash-profile-email').textContent = user.email;
        document.getElementById('dash-profile-phone-display').textContent = user.phone || '—';
        const memberEl = document.getElementById('dash-profile-member-since');
        if (memberEl) {
            memberEl.textContent = user.createdAt
                ? `Member since ${UI.formatDate(user.createdAt.split('T')[0])}`
                : '';
        }
        document.getElementById('dash-profile-avatar-lg').textContent = UI.getInitials(user.name);
        document.getElementById('dash-profile-name-input').value = user.name;
        document.getElementById('dash-profile-phone-input').value = user.phone || '';
        document.getElementById('dash-profile-email-input').value = user.email;
        const stats = getBookingStats(userBookingsCache || []);
        document.getElementById('dash-profile-stats').innerHTML = `
            <div class="profile-stat-item"><div class="num">${stats.total}</div><div class="lbl">Total Bookings</div></div>
            <div class="profile-stat-item"><div class="num">${stats.upcoming}</div><div class="lbl">Upcoming</div></div>
            <div class="profile-stat-item"><div class="num">${stats.completed}</div><div class="lbl">Completed</div></div>
            <div class="profile-stat-item"><div class="num">${UI.formatCurrency(stats.spent)}</div><div class="lbl">Total Spent</div></div>`;
    }

    async function saveDashProfile() {
        try {
            currentUser = await API.put('/auth/profile', {
                name: document.getElementById('dash-profile-name-input').value.trim(),
                phone: document.getElementById('dash-profile-phone-input').value.trim()
            });
            updateProfileFields(currentUser);
            updateUserDisplay();
            renderProfilePage();
            UI.showToast('Profile saved', 'success');
        } catch (err) {
            document.getElementById('dash-profile-error').textContent = err.message;
        }
    }

    async function fetchSavedPassengers() {
        if (!token) {
            savedPassengersCache = [];
            return [];
        }
        try {
            savedPassengersCache = await API.get('/passengers/saved');
        } catch {
            savedPassengersCache = [];
        }
        return savedPassengersCache;
    }

    async function getSavedPassengers() {
        if (!savedPassengersCache.length) await fetchSavedPassengers();
        return savedPassengersCache;
    }

    async function renderSavedPassengers() {
        const list = await fetchSavedPassengers();
        const el = document.getElementById('dash-saved-passengers-list');
        if (!el) return;
        if (!list.length) {
            UI.renderEmptyState(el, { icon: 'fa-users', title: 'No saved passengers', message: 'Save frequent travelers to speed up future bookings.', ctaText: 'Add Passenger', ctaAction: () => document.getElementById('dash-add-passenger-form')?.scrollIntoView({ behavior: 'smooth' }) });
            return;
        }
        el.innerHTML = list.map((p) => `
            <div class="dash-passenger-saved-card">
                <div><strong>${UI.escapeHTML(p.name)}</strong><br><span class="form-hint">Age ${p.age} · ${UI.escapeHTML(p.gender)} · ${UI.escapeHTML(p.berthPreference || 'No Preference')}</span></div>
                <div class="action-buttons">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit-passenger="${p.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-ghost btn-sm" data-remove-passenger="${p.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
        el.querySelectorAll('[data-edit-passenger]').forEach((btn) => {
            btn.addEventListener('click', () => startEditPassenger(Number(btn.dataset.editPassenger)));
        });
        el.querySelectorAll('[data-remove-passenger]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.dataset.removePassenger);
                try {
                    await API.del(`/passengers/saved/${id}`);
                    if (editingPassengerId === id) cancelEditPassenger();
                    await renderSavedPassengers();
                    await renderSavedPassengerPicker();
                    UI.showToast('Passenger removed', 'info');
                } catch (err) {
                    UI.showToast(err.message || 'Could not remove passenger', 'error');
                }
            });
        });
    }

    function startEditPassenger(id) {
        const p = savedPassengersCache.find((x) => x.id === id);
        if (!p) return;
        editingPassengerId = id;
        document.getElementById('dash-sp-form-title').textContent = 'Edit Passenger';
        document.getElementById('dash-sp-name').value = p.name;
        document.getElementById('dash-sp-age').value = p.age;
        document.getElementById('dash-sp-gender').value = p.gender;
        document.getElementById('dash-sp-berth').value = p.berthPreference || 'No Preference';
        document.getElementById('dash-sp-submit-btn').textContent = 'Update Passenger';
        document.getElementById('dash-cancel-edit-passenger').style.display = 'inline-flex';
        document.getElementById('dash-add-passenger-form').scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEditPassenger() {
        editingPassengerId = null;
        document.getElementById('dash-sp-form-title').textContent = 'Add Passenger';
        document.getElementById('dash-add-passenger-form').reset();
        document.getElementById('dash-sp-submit-btn').textContent = 'Save Passenger';
        document.getElementById('dash-cancel-edit-passenger').style.display = 'none';
    }

    async function addSavedPassenger() {
        const name = document.getElementById('dash-sp-name').value.trim();
        const age = parseInt(document.getElementById('dash-sp-age').value, 10);
        const gender = document.getElementById('dash-sp-gender').value;
        const berthPreference = document.getElementById('dash-sp-berth').value;
        if (!name || !age || !gender) return;
        const payload = { name, age, gender, berthPreference };
        try {
            if (editingPassengerId !== null) {
                await API.put(`/passengers/saved/${editingPassengerId}`, payload);
                UI.showToast('Passenger updated', 'success');
            } else {
                await API.post('/passengers/saved', payload);
                UI.showToast('Passenger saved', 'success');
            }
            await fetchSavedPassengers();
            cancelEditPassenger();
            await renderSavedPassengers();
            await renderSavedPassengerPicker();
        } catch (err) {
            UI.showToast(err.message || 'Could not save passenger', 'error');
        }
    }

    async function renderSavedPassengerPicker() {
        const wrap = document.getElementById('saved-passengers-picker');
        const select = document.getElementById('saved-passenger-select');
        if (!wrap || !select) return;
        const list = await getSavedPassengers();
        if (!list.length) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = 'block';
        select.innerHTML = '<option value="">Select saved passenger...</option>' +
            list.map((p) => `<option value="${p.id}">${UI.escapeHTML(p.name)} (${p.age}, ${UI.escapeHTML(p.gender)})</option>`).join('');
    }

    async function applySavedPassengerToForm(idStr) {
        const id = parseInt(idStr, 10);
        const list = await getSavedPassengers();
        const p = list.find((x) => x.id === id);
        if (!p || typeof applyPassengerDataToBooking !== 'function') return;
        applyPassengerDataToBooking(p);
        UI.showToast(`Applied ${p.name}`, 'success');
    }

    function buildNotifications(bookings) {
        const notifs = [];
        bookings.forEach((b) => {
            const id = `b-${getId(b)}`;
            if (b.status === 'Confirmed') {
                notifs.push({ id, type: 'booking', title: 'Booking Confirmed', desc: `${b.train?.trainName || 'Train'} — PNR ${b.pnrNumber}`, time: b.bookingDate, action: () => openBookingDetail(getId(b)) });
            }
            if (b.status === 'Waitlisted') {
                notifs.push({ id, type: 'waitlist', title: 'Waitlisted', desc: `PNR ${b.pnrNumber} — WL/${b.waitlistPosition || '?'}`, time: b.bookingDate, action: () => openBookingDetail(getId(b)) });
            }
            if (b.status === 'RAC') {
                notifs.push({ id, type: 'waitlist', title: 'RAC Booking', desc: `PNR ${b.pnrNumber} — RAC/${b.waitlistPosition || '?'}`, time: b.bookingDate, action: () => openBookingDetail(getId(b)) });
            }
            if (b.status === 'Cancelled') {
                notifs.push({ id, type: 'cancel', title: 'Booking Cancelled', desc: `PNR ${b.pnrNumber} cancelled${b.refund ? ` — refund ${UI.formatCurrency(b.refund.refundAmount)}` : ''}`, time: b.bookingDate, action: () => openBookingDetail(getId(b)) });
            }
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const jDate = new Date(b.journeyDate);
            jDate.setHours(0, 0, 0, 0);
            if (b.status === 'Confirmed' && jDate.getTime() === tomorrow.getTime()) {
                notifs.push({ id: `${id}-journey`, type: 'journey', title: 'Journey Tomorrow', desc: `${b.train?.trainName || 'Train'} to ${b.train?.destination || ''}`, time: b.journeyDate, action: () => openBookingDetail(getId(b)) });
            }
        });
        return notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    function renderNotifDropdown() {
        const notifs = buildNotifications(userBookingsCache || []);
        const unread = notifs.filter((n) => !readNotifIds.has(n.id)).length;
        const badge = document.getElementById('dash-notif-badge');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread ? 'flex' : 'none';
        }
        const list = document.getElementById('dash-notif-list');
        if (!list) return;
        if (!notifs.length) {
            list.innerHTML = '<p class="form-hint" style="padding:16px">No notifications</p>';
            return;
        }
        list.innerHTML = notifs.slice(0, 5).map((n) => `
            <div class="dash-notif-item ${readNotifIds.has(n.id) ? '' : 'unread'}" data-notif-id="${n.id}">
                <div class="dash-notif-item-title">${UI.escapeHTML(n.title)}</div>
                <div class="dash-notif-item-desc">${UI.escapeHTML(n.desc)}</div>
                <div class="dash-notif-item-time">${UI.formatDateTime(n.time)}</div>
            </div>`).join('');
        list.querySelectorAll('.dash-notif-item').forEach((item) => {
            item.addEventListener('click', () => {
                const n = notifs.find((x) => x.id === item.dataset.notifId);
                readNotifIds.add(item.dataset.notifId);
                localStorage.setItem('dashReadNotifs', JSON.stringify([...readNotifIds]));
                n?.action?.();
                renderNotifDropdown();
            });
        });
    }

    function renderNotificationsPage() {
        const allNotifs = buildNotifications(userBookingsCache || []);
        document.querySelectorAll('#dash-notif-tabs .tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.notifTab === notifFilterTab);
        });
        const notifs = notifFilterTab === 'all' ? allNotifs : allNotifs.filter((n) => {
            if (notifFilterTab === 'booking') return n.type === 'booking';
            if (notifFilterTab === 'waitlist') return n.type === 'waitlist';
            if (notifFilterTab === 'cancel') return n.type === 'cancel';
            if (notifFilterTab === 'journey') return n.type === 'journey';
            return true;
        });
        const el = document.getElementById('dash-notifications-list');
        if (!el) return;
        if (!notifs.length) {
            UI.renderEmptyState(el, { icon: 'fa-bell', title: "You're all caught up", message: notifFilterTab === 'all' ? 'Notifications from your bookings will appear here.' : 'No notifications in this category.' });
            return;
        }
        el.innerHTML = notifs.map((n) => `
            <div class="dash-booking-compact ${readNotifIds.has(n.id) ? '' : 'dash-notif-item unread'}" style="cursor:pointer" data-notif-page-id="${n.id}">
                <div><strong>${UI.escapeHTML(n.title)}</strong><p class="form-hint">${UI.escapeHTML(n.desc)}</p><span class="form-hint">${UI.formatDateTime(n.time)}</span></div>
            </div>`).join('');
        el.querySelectorAll('[data-notif-page-id]').forEach((item) => {
            item.addEventListener('click', () => {
                const n = notifs.find((x) => x.id === item.dataset.notifPageId);
                readNotifIds.add(item.dataset.notifPageId);
                localStorage.setItem('dashReadNotifs', JSON.stringify([...readNotifIds]));
                n?.action?.();
            });
        });
    }

    function renderHelpPage() {
        const el = document.getElementById('dash-faq-list');
        if (!el) return;
        renderFaqSections(FAQ_SECTIONS);
        el.dataset.rendered = '1';
    }

    function renderFaqSections(sections) {
        const el = document.getElementById('dash-faq-list');
        if (!el) return;
        if (!sections.length) {
            el.innerHTML = '<p class="form-hint">No matching help topics found.</p>';
            return;
        }
        el.innerHTML = sections.map((section) => `
            <div class="dash-help-section">
                <h3 class="dash-help-section-title">${UI.escapeHTML(section.title)}</h3>
                ${section.faqs.map((f) => `
                    <div class="dash-faq-item">
                        <button type="button" class="dash-faq-question">${UI.escapeHTML(f.q)} <i class="fas fa-chevron-down"></i></button>
                        <div class="dash-faq-answer">${UI.escapeHTML(f.a)}</div>
                    </div>`).join('')}
            </div>`).join('');
        el.querySelectorAll('.dash-faq-question').forEach((btn) => {
            btn.addEventListener('click', () => btn.closest('.dash-faq-item')?.classList.toggle('is-open'));
        });
    }

    function filterFaqList(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            renderFaqSections(FAQ_SECTIONS);
            return;
        }
        const filtered = FAQ_SECTIONS.map((section) => ({
            title: section.title,
            faqs: section.faqs.filter((f) =>
                f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || section.title.toLowerCase().includes(q)
            )
        })).filter((section) => section.faqs.length);
        renderFaqSections(filtered);
    }

    function getRecentSearches() {
        try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { return []; }
    }

    function addRecentSearch(from, to, date) {
        let list = getRecentSearches().filter((s) => !(s.from === from && s.to === to));
        list.unshift({ from, to, date });
        list = list.slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    }

    function clearRecentSearches() {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
        renderRecentSearches();
        UI.showToast('Recent searches cleared', 'info');
    }

    function renderRecentSearches() {
        const el = document.getElementById('dash-recent-searches');
        if (!el) return;
        const list = getRecentSearches();
        if (!list.length) { el.innerHTML = '<p class="form-hint">No recent searches</p>'; return; }
        el.innerHTML = list.map((s) => `
            <div class="dash-recent-item">
                <span>${UI.escapeHTML(s.from)} → ${UI.escapeHTML(s.to)} · ${UI.formatDate(s.date)}</span>
                <button type="button" class="btn btn-ghost btn-sm" data-recent-from="${UI.escapeHTML(s.from)}" data-recent-to="${UI.escapeHTML(s.to)}" data-recent-date="${s.date}">Search Again</button>
            </div>`).join('');
        el.querySelectorAll('[data-recent-from]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('dash-source').value = btn.dataset.recentFrom;
                document.getElementById('dash-destination').value = btn.dataset.recentTo;
                document.getElementById('dash-date').value = btn.dataset.recentDate;
                showPage('search');
            });
        });
    }

    function renderPopularRoutes(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = POPULAR_ROUTES.map((r) =>
            `<button type="button" class="chip" data-from="${UI.escapeHTML(r.from)}" data-to="${UI.escapeHTML(r.to)}">${UI.escapeHTML(r.from)} → ${UI.escapeHTML(r.to)}</button>`
        ).join('');
        el.querySelectorAll('.chip').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('dash-source').value = btn.dataset.from;
                document.getElementById('dash-destination').value = btn.dataset.to;
                showPage('search');
            });
        });
    }

    function renderDashSearchExtras() {
        renderRecentSearches();
        renderPopularRoutes('dash-search-popular');
    }

    function syncDashSearchFromPageForm() {
        document.getElementById('dash-source').value = document.getElementById('dash-search-source')?.value || '';
        document.getElementById('dash-destination').value = document.getElementById('dash-search-dest')?.value || '';
        document.getElementById('dash-date').value = document.getElementById('dash-search-date')?.value || '';
        const cls2 = document.getElementById('dash-search-class-2')?.value;
        if (cls2 !== undefined && document.getElementById('dash-search-class')) {
            document.getElementById('dash-search-class').value = cls2;
        }
        const quota2 = document.getElementById('dash-search-quota-2')?.value;
        if (quota2 !== undefined && document.getElementById('dash-search-quota')) {
            document.getElementById('dash-search-quota').value = quota2;
        }
    }

    function syncDashSearchToPageForm() {
        const src = document.getElementById('dash-search-source');
        const dst = document.getElementById('dash-search-dest');
        const dt = document.getElementById('dash-search-date');
        if (src) src.value = document.getElementById('dash-source')?.value || '';
        if (dst) dst.value = document.getElementById('dash-destination')?.value || '';
        if (dt) dt.value = document.getElementById('dash-date')?.value || '';
    }

    async function dashSearchTrains() {
        const source = document.getElementById('dash-source')?.value.trim();
        const destination = document.getElementById('dash-destination')?.value.trim();
        const date = document.getElementById('dash-date')?.value;
        const classCode = document.getElementById('dash-search-class')?.value || '';
        const quota = document.getElementById('dash-search-quota-2')?.value
            || document.getElementById('dash-search-quota')?.value || 'General';

        if (!source || !destination || !date) {
            UI.showToast('Please fill in all search fields', 'warning');
            return;
        }

        addRecentSearch(source, destination, date);
        preferredQuota = quota;

        document.getElementById('source').value = source;
        document.getElementById('destination').value = destination;
        document.getElementById('date').value = date;
        if (document.getElementById('search-class')) document.getElementById('search-class').value = classCode;
        if (document.getElementById('search-quota')) document.getElementById('search-quota').value = quota;

        const list = document.getElementById('dash-trains-list');
        UI.renderSkeleton(list, 'train', 3);

        try {
            const trains = await API.get(`/trains/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&date=${date}`);
            allTrainsCache = trains;
            if (classCode) {
                allTrainsCache = trains.filter((t) => (t.classes || []).some((c) => c.classCode === classCode));
            }
            renderDashTrainResults(allTrainsCache);
        } catch (err) {
            UI.renderErrorState(list?.parentElement, err.message || 'Search failed', dashSearchTrains);
        }
    }

    function renderDashTrainResults(trains) {
        const list = document.getElementById('dash-trains-list');
        if (!list) return;
        if (!trains.length) {
            UI.renderEmptyState(list, { icon: 'fa-train', title: 'No trains found', message: 'Try different stations or dates.' });
            return;
        }
        list.innerHTML = trains.map((train) => {
            const trainId = getId(train);
            const classes = train.classes || [];
            const classBlocks = classes.map((cls) => {
                const avail = cls.availableSeats;
                const availText = avail > 0 ? `AVL ${avail}` : 'WL/RAC';
                return `<div class="class-option" data-class="${cls.classCode}" data-train="${trainId}">
                    <div class="class-code">${UI.escapeHTML(cls.classCode)}</div>
                    <div class="class-fare">${UI.formatCurrency(cls.price)}</div>
                    <div class="class-avail ${avail > 0 ? 'avail-available' : 'avail-waitlist'}">${availText}</div>
                </div>`;
            }).join('');
            return `<article class="train-result-card">
                <div class="train-result-main">
                    <div><div class="train-result-header"><span class="train-number">${UI.escapeHTML(train.trainNumber)}</span> <span class="train-name">${UI.escapeHTML(train.trainName)}</span></div>
                    <div class="train-timeline"><div class="train-time-block"><div class="time">${UI.escapeHTML(train.departureTime)}</div><div class="station">${UI.escapeHTML(train.source)}</div></div>
                    <div class="train-duration-line"><span>${UI.escapeHTML(train.duration || '')}</span></div>
                    <div class="train-time-block"><div class="time">${UI.escapeHTML(train.arrivalTime)}</div><div class="station">${UI.escapeHTML(train.destination)}</div></div></div></div>
                    <button type="button" class="btn btn-primary btn-sm dash-book-btn" data-id="${trainId}">Book</button>
                </div>
                <div class="class-options">${classBlocks}</div>
            </article>`;
        }).join('');

        list.querySelectorAll('.dash-book-btn, .class-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                const trainId = Number(btn.dataset.id || btn.dataset.train);
                const train = trains.find((t) => getId(t) === trainId);
                if (train && typeof openBookingModal === 'function') {
                    openBookingModal(trainId, train);
                    if (btn.dataset.class) {
                        setTimeout(() => {
                            const sel = document.getElementById('booking-class-select');
                            if (sel) { sel.value = btn.dataset.class; updateBookingPrice(); }
                        }, 100);
                    }
                }
            });
        });
    }

    function setupDashAutocomplete(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        if (!input || !list) return;
        let debounceTimer = null;
        let selectedIndex = -1;
        const hide = () => { list.classList.remove('active'); list.innerHTML = ''; selectedIndex = -1; };
        input.addEventListener('input', () => {
            const query = input.value.trim();
            clearTimeout(debounceTimer);
            if (query.length < 2) { hide(); return; }
            debounceTimer = setTimeout(async () => {
                try {
                    const stations = await API.get(`/stations/search?q=${encodeURIComponent(query)}`);
                    list.innerHTML = '';
                    stations.forEach((station, index) => {
                        const item = document.createElement('div');
                        item.className = 'autocomplete-item';
                        item.innerHTML = `<strong>${UI.escapeHTML(station.name)}</strong><span class="station-code">${UI.escapeHTML(station.code)}</span>`;
                        item.addEventListener('mousedown', (e) => { e.preventDefault(); input.value = station.name; hide(); });
                        list.appendChild(item);
                    });
                    if (stations.length) list.classList.add('active');
                    else hide();
                } catch { hide(); }
            }, 250);
        });
        input.addEventListener('blur', () => setTimeout(hide, 150));
    }

    function onBookingsUpdated() {
        if (!active) return;
        loadPageData(currentDashPage);
        renderNotifDropdown();
    }

    function getNextConfirmedBooking() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return (userBookingsCache || [])
            .filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) >= now)
            .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate))[0] || null;
    }

    function getNextCancellableBooking() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return (userBookingsCache || [])
            .filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now)
            .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate))[0] || null;
    }

    function handleQuickAction(action) {
        switch (action) {
            case 'search': showPage('search'); break;
            case 'pnr': showPage('pnr'); break;
            case 'bookings': showPage('bookings'); break;
            case 'passengers': showPage('passengers'); break;
            case 'download-ticket': {
                const b = getNextConfirmedBooking();
                if (b) downloadTicket(getId(b));
                else { UI.showToast('No confirmed upcoming booking for download', 'warning'); showPage('bookings'); }
                break;
            }
            case 'view-next-ticket': {
                const b = getNextConfirmedBooking();
                if (b) window.location.href = `ticket.html?id=${getId(b)}`;
                else { UI.showToast('No confirmed upcoming booking found', 'warning'); showPage('bookings'); }
                break;
            }
            case 'cancel-booking': {
                const b = getNextCancellableBooking();
                if (b) openCancelModal(getId(b));
                else { UI.showToast('No cancellable booking found', 'warning'); showPage('bookings'); }
                break;
            }
            default: break;
        }
    }

    return {
        init,
        enter,
        exit,
        isActive,
        showPage,
        onBookingsUpdated,
        handleQuickAction,
        renderSavedPassengerPicker,
        applySavedPassengerToForm,
        getSavedPassengers
    };
})();

window.Dashboard = Dashboard;

document.addEventListener('DOMContentLoaded', () => {
    Dashboard.init();
    document.querySelectorAll('[data-quick-action]').forEach((btn) => {
        btn.addEventListener('click', () => Dashboard.handleQuickAction(btn.dataset.quickAction));
    });
});
