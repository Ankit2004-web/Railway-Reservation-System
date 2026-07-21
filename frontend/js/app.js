let token = API.getToken();
let currentUser = null;
let currentPage = 'home';
let allTrainsCache = [];
let userBookingsCache = [];
let currentBookingTab = 'upcoming';
let bookingStep = 1;
let pendingCancelBookingId = null;
let selectedTrainForBooking = null;
let preferredQuota = 'General';
let paymentDevMode = true;
let pendingBookingIntent = null;

const RECENT_SEARCHES_KEY = 'railwayRecentSearches';
const MAX_RECENT_SEARCHES = 5;

const POPULAR_ROUTES = [
    { from: 'New Delhi', to: 'Mumbai' },
    { from: 'New Delhi', to: 'Kolkata' },
    { from: 'Mumbai', to: 'Ahmedabad' },
    { from: 'Chennai', to: 'Bengaluru' }
];

document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    UI.initModals();
    UI.initDrawers();
    UI.setupPasswordToggle('login-password', 'login-password-toggle');
    UI.setupPasswordToggle('register-password', 'register-password-toggle');
    init();
    setupEventListeners();
    setupMobileMenu();
    setupUserMenu();
    setupStationAutocomplete('source', 'source-suggestions');
    setupStationAutocomplete('destination', 'destination-suggestions');
    renderPopularRoutes();
    renderPublicRecentSearches();
    setupFilters();

    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'admin-access-denied') {
        UI.showToast('Access denied. Admin privileges required.', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('resume') === 'booking' && token) {
        resumeAfterAuth();
    }
});

function init() {
    showPage('home');
    if (token) fetchCurrentUser();
    else updateAuthUI(false);

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.min = today;
        dateInput.value = today;
    }
}

function renderPublicRecentSearches() {
    const container = document.getElementById('public-recent-searches');
    if (!container) return;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { recent = []; }
    if (!recent.length) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    container.innerHTML = `
        <h3>Recent Searches</h3>
        <div class="route-chips">${recent.slice(0, MAX_RECENT_SEARCHES).map((s) =>
            `<button type="button" class="chip recent-search-chip" data-from="${UI.escapeHTML(s.from)}" data-to="${UI.escapeHTML(s.to)}" data-date="${UI.escapeHTML(s.date)}">${UI.escapeHTML(s.from)} → ${UI.escapeHTML(s.to)} · ${UI.formatDate(s.date)}</button>`
        ).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" id="clear-public-recent">Clear</button>`;
    container.querySelectorAll('.recent-search-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.getElementById('source').value = btn.dataset.from;
            document.getElementById('destination').value = btn.dataset.to;
            document.getElementById('date').value = btn.dataset.date;
            searchTrains();
        });
    });
    document.getElementById('clear-public-recent')?.addEventListener('click', () => {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
        renderPublicRecentSearches();
    });
}

function saveRecentSearch(source, destination, date) {
    if (!source || !destination || !date) return;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { recent = []; }
    recent = recent.filter((s) => !(s.from === source && s.to === destination && s.date === date));
    recent.unshift({ from: source, to: destination, date });
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)));
    renderPublicRecentSearches();
}

function renderPopularRoutes() {
    const container = document.getElementById('popular-routes');
    if (!container) return;
    container.innerHTML = POPULAR_ROUTES.map((r) =>
        `<button type="button" class="chip popular-route" data-from="${UI.escapeHTML(r.from)}" data-to="${UI.escapeHTML(r.to)}">${UI.escapeHTML(r.from)} → ${UI.escapeHTML(r.to)}</button>`
    ).join('');
    container.querySelectorAll('.popular-route').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.getElementById('source').value = btn.dataset.from;
            document.getElementById('destination').value = btn.dataset.to;
            searchTrains();
        });
    });
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('main-nav');
    menuBtn?.addEventListener('click', () => nav.classList.toggle('nav-open'));
    nav?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => nav.classList.remove('nav-open'));
    });
}

function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');
    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', () => dropdown?.classList.remove('is-open'));
    dropdown?.querySelectorAll('[data-page]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            if (page === 'dashboard' || (token && ['bookings', 'profile'].includes(page))) {
                Dashboard.enter(page === 'dashboard' ? 'overview' : page);
            } else {
                showPage(page);
            }
            dropdown.classList.remove('is-open');
        });
    });
}

function setupEventListeners() {
    document.querySelectorAll('#navbar a[data-page], .nav-link-page[data-page], .site-brand[data-page]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.getAttribute('data-page'));
        });
    });

    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        UI.openModal('registerModal');
    });
    document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        UI.openModal('loginModal');
    });
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        UI.openModal('forgotPasswordModal');
        loadCaptcha('forgot-captcha');
    });
    document.getElementById('profile-forgot-btn')?.addEventListener('click', () => {
        UI.openModal('forgotPasswordModal'); loadCaptcha('forgot-captcha');
    });
    document.getElementById('profile-change-password-btn')?.addEventListener('click', () => {
        UI.openModal('changePasswordModal');
    });
    document.getElementById('profile-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile();
    });
    document.getElementById('change-password-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        changePassword();
    });

    fetchPaymentConfig();

    document.getElementById('search-form')?.addEventListener('submit', (e) => { e.preventDefault(); searchTrains(); });
    document.getElementById('pnr-form')?.addEventListener('submit', (e) => { e.preventDefault(); checkPnrStatus(); });
    document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); login(); });
    document.getElementById('register-form')?.addEventListener('submit', (e) => { e.preventDefault(); register(); });
    document.getElementById('booking-form')?.addEventListener('submit', (e) => { e.preventDefault(); createBooking(); });
    document.getElementById('forgot-password-form')?.addEventListener('submit', (e) => { e.preventDefault(); forgotPassword(); });

    document.getElementById('swap-stations')?.addEventListener('click', () => {
        const src = document.getElementById('source');
        const dst = document.getElementById('destination');
        [src.value, dst.value] = [dst.value, src.value];
    });

    document.getElementById('booking-class-select')?.addEventListener('change', updateBookingPrice);
    document.getElementById('booking-quota')?.addEventListener('change', updateBookingPrice);
    document.querySelectorAll('input[name="booking-type"]').forEach((r) => r.addEventListener('change', updateBookingPrice));
    document.getElementById('add-passenger')?.addEventListener('click', addPassengerField);

    document.getElementById('join-waitlist')?.addEventListener('change', (e) => {
        if (e.target.checked) document.getElementById('join-rac').checked = false;
    });
    document.getElementById('join-rac')?.addEventListener('change', (e) => {
        if (e.target.checked) document.getElementById('join-waitlist').checked = false;
    });

    document.getElementById('booking-next')?.addEventListener('click', () => advanceBookingStep(1));
    document.getElementById('booking-prev')?.addEventListener('click', () => advanceBookingStep(-1));
    document.getElementById('edit-journey-btn')?.addEventListener('click', () => setBookingStep(1));
    document.getElementById('edit-passengers-btn')?.addEventListener('click', () => setBookingStep(3));
    document.getElementById('retry-payment-btn')?.addEventListener('click', () => {
        document.getElementById('payment-failure-view').style.display = 'none';
        document.querySelector('input[name="payment-outcome"][value="success"]').checked = true;
    });
    document.getElementById('back-to-review-btn')?.addEventListener('click', () => setBookingStep(4));
    document.querySelectorAll('.payment-method').forEach((el) => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.payment-method').forEach((m) => m.classList.remove('active'));
            el.classList.add('active');
        });
    });
    document.getElementById('confirm-cancel-btn')?.addEventListener('click', confirmCancelBooking);

    document.getElementById('apply-saved-passenger')?.addEventListener('click', () => {
        const idx = document.getElementById('saved-passenger-select')?.value;
        if (idx !== '' && idx != null && typeof Dashboard !== 'undefined') {
            Dashboard.applySavedPassengerToForm(idx);
        } else {
            UI.showToast('Select a saved passenger first', 'warning');
        }
    });

    document.getElementById('auth-required-login')?.addEventListener('click', () => {
        UI.openModal('loginModal');
    });
    document.getElementById('auth-required-register')?.addEventListener('click', () => {
        UI.openModal('registerModal');
    });

    document.querySelectorAll('#bookings-tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bookings-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentBookingTab = btn.dataset.bookingTab;
            displayUserBookings(userBookingsCache);
        });
    });
}

function showPage(page) {
    if (page === 'dashboard') {
        if (!token) {
            UI.showToast('Please login to continue', 'warning');
            UI.openModal('loginModal');
            return;
        }
        Dashboard.enter('overview');
        return;
    }

    const dashRedirect = { bookings: 'bookings', profile: 'profile', pnr: 'pnr' };
    if (token && dashRedirect[page] && typeof Dashboard !== 'undefined') {
        Dashboard.enter(dashRedirect[page]);
        return;
    }

    if (Dashboard.isActive()) Dashboard.exit();

    const authPages = ['bookings', 'profile'];
    if (authPages.includes(page) && !token) {
        UI.showToast('Please login to continue', 'warning');
        UI.openModal('loginModal');
        return;
    }

    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    document.getElementById(page)?.classList.add('active');
    document.querySelectorAll('#navbar a[data-page]').forEach((l) => l.classList.remove('active'));
    document.querySelector(`#navbar a[data-page="${page}"]`)?.classList.add('active');
    currentPage = page;
    document.title = {
        home: 'RailYatra | Search & Book Trains',
        dashboard: 'Dashboard | RailYatra',
        trains: 'Search Results | RailYatra',
        pnr: 'PNR Status | RailYatra',
        bookings: 'My Bookings | RailYatra',
        profile: 'My Profile | RailYatra',
        confirmation: 'Booking Confirmed | RailYatra'
    }[page] || 'RailYatra';
    loadPageData(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadPageData(page) {
    if (page === 'trains' && !document.getElementById('search-source')?.textContent) fetchAllTrains();
    if (page === 'bookings') fetchUserBookings();
    if (page === 'profile') { fetchUserBookings().then(() => updateProfileStats()); }
}

window.showPage = showPage;

