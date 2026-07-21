/** Auth, profile, and session management */
async function fetchCurrentUser() {
    try {
        currentUser = await API.get('/auth/me');
        if (currentUser.isBlocked) {
            logout();
            UI.showToast('Your account has been blocked. Contact admin.', 'error');
            return;
        }
        updateAuthUI(true, currentUser.isAdmin);
        updateProfileFields(currentUser);
        if (currentUser.isAdmin) {
            window.location.href = 'adminPanel.html';
            return;
        }
        resumeAfterAuth();
    } catch {
        logout();
    }
}

function resumeAfterAuth() {
    const stored = sessionStorage.getItem('pendingBookingIntent');
    if (stored) {
        try { pendingBookingIntent = JSON.parse(stored); } catch { pendingBookingIntent = null; }
        sessionStorage.removeItem('pendingBookingIntent');
    }
    if (pendingBookingIntent) {
        const intent = { ...pendingBookingIntent };
        pendingBookingIntent = null;
        if (typeof Dashboard !== 'undefined') Dashboard.exit();
        showPage(intent.returnPage || 'trains');
        const train = intent.train || allTrainsCache.find((t) => getId(t) === intent.trainId);
        if (train) {
            const journeyDate = intent.date || document.getElementById('date')?.value || train.date;
            const trainWithDate = { ...train, date: journeyDate };
            openBookingModal(getId(trainWithDate), trainWithDate);
            if (intent.classCode) {
                setTimeout(() => {
                    const sel = document.getElementById('booking-class-select');
                    if (sel) { sel.value = intent.classCode; updateBookingPrice(); }
                }, 150);
            }
            if (intent.quota) {
                const quotaEl = document.getElementById('booking-quota');
                if (quotaEl) quotaEl.value = intent.quota;
            }
        }
        return;
    }
    if (typeof Dashboard !== 'undefined') Dashboard.enter('overview');
}

function updateProfileFields(user) {
    if (!user) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('profile-name-input', user.name);
    set('profile-email-input', user.email);
    set('profile-phone-input', user.phone);
    const avatar = document.getElementById('user-avatar');
    const menuName = document.getElementById('user-menu-name');
    if (avatar) avatar.textContent = UI.getInitials(user.name);
    if (menuName) menuName.textContent = user.name?.split(' ')[0] || 'User';
}


function updateProfileStats() {
    const bookings = userBookingsCache;
    const now = new Date();
    const upcoming = bookings.filter((b) => ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status) && new Date(b.journeyDate) >= now).length;
    const completed = bookings.filter((b) => b.status === 'Confirmed' && new Date(b.journeyDate) < now).length;
    const spent = bookings.filter((b) => b.status !== 'Cancelled').reduce((s, b) => s + (b.totalPrice || 0), 0);
    document.getElementById('stat-total-bookings').textContent = bookings.length;
    document.getElementById('stat-upcoming').textContent = upcoming;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-total-spent').textContent = UI.formatCurrency(spent);
}


async function fetchPaymentConfig() {
    try {
        const config = await API.get('/payments/config');
        paymentDevMode = !!config.devMode;
    } catch {
        paymentDevMode = true;
    }
}

async function saveProfile() {
    const errorEl = document.getElementById('profile-error');
    const successEl = document.getElementById('profile-success');
    errorEl.textContent = '';
    successEl.textContent = '';
    try {
        currentUser = await API.put('/auth/profile', {
            name: document.getElementById('profile-name-input').value.trim(),
            phone: document.getElementById('profile-phone-input').value.trim()
        });
        updateProfileFields(currentUser);
        successEl.textContent = 'Profile updated successfully';
        UI.showToast('Profile saved', 'success');
    } catch (err) {
        errorEl.textContent = err.message || 'Could not save profile';
    }
}

async function changePassword() {
    const errorEl = document.getElementById('change-password-error');
    errorEl.textContent = '';
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;
    if (newPass !== confirmPass) {
        errorEl.textContent = 'New passwords do not match';
        return;
    }
    try {
        await API.put('/auth/change-password', {
            currentPassword: document.getElementById('current-password').value,
            newPassword: newPass
        });
        UI.closeAllModals();
        document.getElementById('change-password-form').reset();
        UI.showToast('Password updated successfully', 'success');
    } catch (err) {
        errorEl.textContent = err.message || 'Could not update password';
    }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await API.post('/auth/login', { email, password, ...getCaptchaValues('login-captcha') });
        token = data.token;
        API.setToken(token);
        await fetchCurrentUser();
        UI.closeAllModals();
        if (!currentUser?.isAdmin) UI.showToast('Logged in successfully', 'success');
    } catch (err) {
        document.getElementById('login-error').textContent = err.message || 'Invalid credentials';
        loadCaptcha('login-captcha');
    }
}

async function register() {
    try {
        const data = await API.post('/auth/register', {
            name: document.getElementById('register-name').value,
            email: document.getElementById('register-email').value,
            phone: document.getElementById('register-phone').value,
            password: document.getElementById('register-password').value,
            ...getCaptchaValues('register-captcha')
        });
        token = data.token;
        API.setToken(token);
        await fetchCurrentUser();
        UI.closeAllModals();
        if (!currentUser?.isAdmin) UI.showToast('Registration successful', 'success');
    } catch (err) {
        document.getElementById('register-error').textContent = err.message || 'Registration failed';
        loadCaptcha('register-captcha');
    }
}

async function forgotPassword() {
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    errorEl.textContent = '';
    successEl.textContent = '';
    try {
        const data = await API.post('/auth/forgot-password', {
            email: document.getElementById('forgot-email').value,
            ...getCaptchaValues('forgot-captcha')
        });
        successEl.textContent = data.msg;
        if (data.devResetUrl) successEl.innerHTML += `<br><a href="${UI.escapeHTML(data.devResetUrl)}">Dev reset link</a>`;
        loadCaptcha('forgot-captcha');
    } catch (err) {
        errorEl.textContent = err.message || 'Request failed';
        loadCaptcha('forgot-captcha');
    }
}

function logout() {
    token = null;
    currentUser = null;
    pendingBookingIntent = null;
    API.setToken(null);
    if (typeof Dashboard !== 'undefined') Dashboard.exit();
    updateAuthUI(false);
    window.location.href = 'login.html';
}

function updateAuthUI(isLoggedIn, isAdmin = false) {
    document.body.classList.toggle('user-logged-in', isLoggedIn);
    document.querySelectorAll('.legacy-public-page').forEach((el) => {
        el.style.display = isLoggedIn ? 'none' : '';
    });
    document.querySelectorAll('#navbar .auth-required').forEach((el) => {
        el.style.display = isLoggedIn ? '' : 'none';
    });
    document.querySelectorAll('.auth-not-required').forEach((el) => {
        el.style.display = isLoggedIn ? 'none' : '';
    });
    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = isLoggedIn && isAdmin ? '' : 'none';
    });
    const userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.style.display = isLoggedIn ? 'block' : 'none';

    if (!isLoggedIn && ['bookings', 'profile', 'dashboard'].includes(currentPage)) {
        showPage('home');
    }
}
