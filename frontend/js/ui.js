/**
 * Shared UI utilities for RailYatra
 */
const UI = (() => {
    let confirmResolve = null;
    let activeModal = null;
    let activeDrawer = null;

    function escapeHTML(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHTML(message)}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function openModal(modalId) {
        closeAllModals();

        const el = document.getElementById(modalId);
        if (!el) return;

        if (el.classList.contains('modal-overlay')) {
            el.classList.add('is-open');
            el.setAttribute('aria-hidden', 'false');
        } else {
            el.style.display = 'flex';
            el.classList.add('is-open');
            el.setAttribute('aria-hidden', 'false');
        }

        activeModal = el;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');

        const focusable = el.querySelector('input, button, select, textarea, [tabindex]');
        focusable?.focus();

        el.querySelectorAll('.error-message, .success-message').forEach((n) => {
            n.textContent = '';
        });

        if (modalId === 'loginModal' && typeof loadCaptcha === 'function') loadCaptcha('login-captcha');
        if (modalId === 'registerModal' && typeof loadCaptcha === 'function') loadCaptcha('register-captcha');
        if (modalId === 'forgotPasswordModal' && typeof loadCaptcha === 'function') loadCaptcha('forgot-captcha');
    }

    function closeModal(modalId) {
        const el = modalId ? document.getElementById(modalId) : activeModal;
        if (!el) return;

        if (el.classList.contains('modal-overlay')) {
            el.classList.remove('is-open');
        } else {
            el.style.display = 'none';
            el.classList.remove('is-open');
        }
        el.setAttribute('aria-hidden', 'true');

        if (activeModal === el) {
            activeModal = null;
            document.body.style.overflow = '';
            document.body.classList.remove('modal-open');
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal, .modal-overlay').forEach((modal) => {
            modal.classList.remove('is-open');
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        });
        activeModal = null;
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
    }

    function initModals() {
        document.querySelectorAll('.modal, .modal-overlay').forEach((modal) => {
            modal.classList.remove('is-open');
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        });

        document.querySelectorAll('.modal-close, .close').forEach((btn) => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal, .modal-overlay');
                if (modal?.id) closeModal(modal.id);
                else closeAllModals();
            });
        });

        document.querySelectorAll('.modal, .modal-overlay').forEach((modal) => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal.id);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (activeDrawer) closeDrawer();
                else if (activeModal) closeAllModals();
            }
        });
    }

    function openDrawer(drawerId) {
        const overlay = document.getElementById(drawerId);
        if (!overlay) return;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        activeDrawer = overlay;
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer(drawerId) {
        const overlay = drawerId ? document.getElementById(drawerId) : activeDrawer;
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        if (activeDrawer === overlay) {
            activeDrawer = null;
            document.body.style.overflow = '';
        }
    }

    function initDrawers() {
        document.querySelectorAll('.drawer-overlay').forEach((overlay) => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeDrawer(overlay.id);
            });
            overlay.querySelector('.drawer-close')?.addEventListener('click', () => closeDrawer(overlay.id));
        });
    }

    function confirmDialog({ title = 'Confirm', message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('confirm-modal-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'confirm-modal-overlay';
                overlay.className = 'modal-overlay';
                overlay.innerHTML = `
                    <div class="modal" role="dialog" aria-modal="true">
                        <div class="modal-header"><h3 id="confirm-title"></h3></div>
                        <div class="modal-body"><p id="confirm-message"></p></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="confirm-cancel">${escapeHTML(cancelText)}</button>
                            <button type="button" class="btn" id="confirm-ok">${escapeHTML(confirmText)}</button>
                        </div>
                    </div>`;
                document.body.appendChild(overlay);
            }

            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            const okBtn = document.getElementById('confirm-ok');
            okBtn.textContent = confirmText;
            okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

            confirmResolve = resolve;
            openModal('confirm-modal-overlay');

            const cleanup = () => {
                okBtn.removeEventListener('click', onOk);
                document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); closeModal('confirm-modal-overlay'); resolve(true); };
            const onCancel = () => { cleanup(); closeModal('confirm-modal-overlay'); resolve(false); };

            okBtn.addEventListener('click', onOk);
            document.getElementById('confirm-cancel').addEventListener('click', onCancel);
        });
    }

    function renderSkeleton(container, type = 'card', count = 3) {
        if (!container) return;
        container.innerHTML = Array(count).fill(0).map(() => {
            if (type === 'table') {
                return '<div class="skeleton skeleton-text" style="height:48px;margin-bottom:8px"></div>';
            }
            if (type === 'train') {
                return '<div class="skeleton skeleton-card" style="height:160px;margin-bottom:16px"></div>';
            }
            return '<div class="skeleton skeleton-card"></div>';
        }).join('');
    }

    function renderEmptyState(container, { icon = 'fa-inbox', title, message, ctaText, ctaAction }) {
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas ${icon}"></i></div>
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
                ${ctaText ? `<button type="button" class="btn btn-primary empty-cta">${escapeHTML(ctaText)}</button>` : ''}
            </div>`;
        if (ctaAction) {
            container.querySelector('.empty-cta')?.addEventListener('click', ctaAction);
        }
    }

    function renderErrorState(container, message, onRetry) {
        if (!container) return;
        container.innerHTML = `
            <div class="error-state">
                <div class="empty-state-icon"><i class="fas fa-wifi"></i></div>
                <p>${escapeHTML(message || 'We couldn\'t load this information.')}</p>
                ${onRetry ? '<button type="button" class="btn btn-outline retry-btn"><i class="fas fa-redo"></i> Retry</button>' : ''}
            </div>`;
        container.querySelector('.retry-btn')?.addEventListener('click', onRetry);
    }

    function formatCurrency(amount) {
        return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    }

    function formatDate(value, options = {}) {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('en-IN', options);
    }

    function formatDateTime(value) {
        if (!value) return '-';
        return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function statusBadge(status) {
        const cls = (status || '').toLowerCase().replace(/\s+/g, '');
        return `<span class="badge badge-${cls} status-badge ${cls}">${escapeHTML(status)}</span>`;
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    }

    function setupPasswordToggle(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;
        btn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'success');
        }).catch(() => showToast('Could not copy', 'error'));
    }

    function paginate(items, page = 1, perPage = 25) {
        const total = items.length;
        const pages = Math.ceil(total / perPage) || 1;
        const start = (page - 1) * perPage;
        return {
            items: items.slice(start, start + perPage),
            page,
            pages,
            total,
            perPage
        };
    }

    function renderPagination(container, { page, pages, onPage }) {
        if (!container || pages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        let html = '<div class="pagination">';
        html += `<button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= pages; i++) {
            if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - page) > 1) {
                if (i === 3 || i === pages - 2) html += '<span>...</span>';
                continue;
            }
            html += `<button type="button" data-page="${i}" class="${i === page ? 'active' : ''}">${i}</button>`;
        }
        html += `<button type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        html += '</div>';
        container.innerHTML = html;
        container.querySelectorAll('[data-page]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = Number(btn.dataset.page);
                if (p >= 1 && p <= pages) onPage(p);
            });
        });
    }

    function exportCSV(filename, rows, headers) {
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [headers.map(escape).join(',')];
        rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    return {
        escapeHTML,
        showToast,
        openModal,
        closeModal,
        closeAllModals,
        initModals,
        openDrawer,
        closeDrawer,
        initDrawers,
        confirmDialog,
        renderSkeleton,
        renderEmptyState,
        renderErrorState,
        formatCurrency,
        formatDate,
        formatDateTime,
        statusBadge,
        getInitials,
        setupPasswordToggle,
        copyToClipboard,
        paginate,
        renderPagination,
        exportCSV
    };
})();

window.UI = UI;
window.showToast = UI.showToast;
window.openModal = UI.openModal;
window.closeAllModals = UI.closeAllModals;
