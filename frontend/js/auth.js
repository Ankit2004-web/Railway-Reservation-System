/**
 * Passenger authentication pages — login, register, forgot password.
 */
const AuthPages = (() => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function initLoginPage() {
        const form = document.getElementById('login-form');
        if (!form) return;

        if (API.getToken()) {
            redirectAfterAuth();
            return;
        }

        UI.setupPasswordToggle('login-password', 'login-password-toggle');
        loadCaptcha('login-captcha');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors('login');
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const remember = document.getElementById('login-remember')?.checked;

            if (!email) return showFieldError('login-email', 'Email is required');
            if (!EMAIL_RE.test(email)) return showFieldError('login-email', 'Enter a valid email address');
            if (!password) return showFieldError('login-password', 'Password is required');

            const btn = document.getElementById('login-submit');
            setLoading(btn, true, 'Signing in...');
            try {
                const data = await API.post('/auth/login', { email, password, rememberMe: remember, ...getCaptchaValues('login-captcha') });
                API.setToken(data.token);
                if (remember) localStorage.setItem('railwayRememberEmail', email);
                else localStorage.removeItem('railwayRememberEmail');
                UI.showToast('Welcome back!', 'success');
                redirectAfterAuth();
            } catch (err) {
                document.getElementById('login-error').textContent = err.message || 'Invalid email or password.';
                loadCaptcha('login-captcha');
            } finally {
                setLoading(btn, false, 'Sign In');
            }
        });

        const remembered = localStorage.getItem('railwayRememberEmail');
        if (remembered) {
            document.getElementById('login-email').value = remembered;
            document.getElementById('login-remember').checked = true;
        }
    }

    function initRegisterPage() {
        const form = document.getElementById('register-form');
        if (!form) return;

        if (API.getToken()) {
            redirectAfterAuth();
            return;
        }

        UI.setupPasswordToggle('register-password', 'register-password-toggle');
        UI.setupPasswordToggle('register-confirm', 'register-confirm-toggle');
        loadCaptcha('register-captcha');

        const passEl = document.getElementById('register-password');
        passEl?.addEventListener('input', updatePasswordStrength);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors('register');
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const phone = document.getElementById('register-phone').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            const terms = document.getElementById('register-terms')?.checked;

            if (!name) return showFieldError('register-name', 'Full name is required');
            if (!email || !EMAIL_RE.test(email)) return showFieldError('register-email', 'Valid email is required');
            if (!/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) return showFieldError('register-phone', 'Enter a valid 10-digit phone number');
            const strength = scorePassword(password);
            if (strength.score < 2) return showFieldError('register-password', 'Password is too weak — use at least 8 characters with mixed case and a number');
            if (password !== confirm) return showFieldError('register-confirm', 'Passwords do not match');
            if (!terms) return showFieldError('register-terms-wrap', 'You must agree to the Terms & Conditions');

            const btn = document.getElementById('register-submit');
            setLoading(btn, true, 'Creating account...');
            try {
                const data = await API.post('/auth/register', {
                    name, email, phone: phone.replace(/\D/g, '').slice(-10), password,
                    ...getCaptchaValues('register-captcha')
                });
                API.setToken(data.token);
                UI.showToast('Account created! Welcome aboard.', 'success');
                redirectAfterAuth();
            } catch (err) {
                document.getElementById('register-error').textContent = err.message || 'Registration failed';
                loadCaptcha('register-captcha');
            } finally {
                setLoading(btn, false, 'Create Account');
            }
        });
    }

    function initForgotPage() {
        const form = document.getElementById('forgot-form');
        if (!form) return;
        loadCaptcha('forgot-captcha');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            const errorEl = document.getElementById('forgot-error');
            const successEl = document.getElementById('forgot-success');
            errorEl.textContent = '';
            successEl.textContent = '';
            if (!EMAIL_RE.test(email)) {
                errorEl.textContent = 'Enter a valid email address';
                return;
            }
            const btn = document.getElementById('forgot-submit');
            setLoading(btn, true, 'Sending...');
            try {
                const data = await API.post('/auth/forgot-password', { email, ...getCaptchaValues('forgot-captcha') });
                successEl.textContent = data.msg || 'Reset request accepted. Check your email or use the link below in demo mode.';
                if (data.devResetUrl) {
                    successEl.innerHTML += `<br><a href="${UI.escapeHTML(data.devResetUrl)}">Open password reset page</a>`;
                }
                form.reset();
                loadCaptcha('forgot-captcha');
            } catch (err) {
                errorEl.textContent = err.message || 'Request failed';
                loadCaptcha('forgot-captcha');
            } finally {
                setLoading(btn, false, 'Send Reset Link');
            }
        });
    }

    function safeRedirect(url) {
        if (!url) return false;
        try {
            const target = new URL(url, window.location.origin);
            if (target.origin !== window.location.origin) return false;
            window.location.href = `${target.pathname}${target.search}${target.hash}`;
            return true;
        } catch {
            return false;
        }
    }

    async function redirectAfterAuth() {
        try {
            const user = await API.get('/auth/me');
            if (user.isAdmin) {
                window.location.href = 'adminPanel.html';
                return;
            }
        } catch {
            API.setToken(null);
            return;
        }
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        if (safeRedirect(redirect)) return;
        const pending = sessionStorage.getItem('pendingBookingIntent');
        window.location.href = pending ? 'index.html?resume=booking' : 'index.html';
    }

    function scorePassword(pw) {
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return { score, label: ['Weak', 'Weak', 'Medium', 'Strong', 'Strong'][score] };
    }

    function updatePasswordStrength() {
        const el = document.getElementById('password-strength');
        const bar = document.getElementById('password-strength-bar');
        if (!el) return;
        const { score, label } = scorePassword(document.getElementById('register-password').value);
        el.textContent = label;
        el.className = `password-strength strength-${label.toLowerCase()}`;
        if (bar) bar.style.width = `${(score / 4) * 100}%`;
    }

    function showFieldError(id, msg) {
        const input = document.getElementById(id);
        input?.classList.add('is-error');
        const err = document.getElementById(`${id}-error`) || document.getElementById(`${id.replace('-wrap', '')}-error`);
        if (err) err.textContent = msg;
    }

    function clearErrors(prefix) {
        document.querySelectorAll(`#${prefix}-form .is-error`).forEach((el) => el.classList.remove('is-error'));
        document.querySelectorAll('.field-error, .error-message').forEach((el) => { if (el.id?.startsWith(prefix)) el.textContent = ''; });
        const main = document.getElementById(`${prefix}-error`);
        if (main) main.textContent = '';
    }

    function setLoading(btn, loading, text) {
        if (!btn) return;
        btn.disabled = loading;
        btn.classList.toggle('is-loading', loading);
        btn.textContent = text;
    }

    return { initLoginPage, initRegisterPage, initForgotPage, redirectAfterAuth };
})();

window.AuthPages = AuthPages;
