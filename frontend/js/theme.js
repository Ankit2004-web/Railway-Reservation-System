const Theme = (() => {
    function set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        });
    }

    function toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        set(current === 'dark' ? 'light' : 'dark');
    }

    function init() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        set(saved || (prefersDark ? 'dark' : 'light'));

        document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            btn.addEventListener('click', toggle);
        });
    }

    return { init, set, toggle };
})();

window.Theme = Theme;
