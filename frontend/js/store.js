/**
 * Centralized frontend persistence (localStorage).
 * Single source of truth for mock users, bookings, saved passengers.
 */
const Store = (() => {
    const STORE_KEY = 'railwayStore';
    const SESSION_KEY = 'railwaySession';
    const RECENT_KEY = 'railwayRecentSearches';
    const READ_NOTIFS_KEY = 'dashReadNotifs';

    function defaultStore() {
        return {
            version: 1,
            nextUserId: 2,
            nextBookingId: 1,
            nextPassengerId: 1,
            users: [],
            bookings: [],
            savedPassengers: {},
            passwordResets: {}
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return defaultStore();
            const data = JSON.parse(raw);
            return { ...defaultStore(), ...data };
        } catch {
            return defaultStore();
        }
    }

    function save(data) {
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
    }

    function mutate(fn) {
        const data = load();
        fn(data);
        save(data);
        return data;
    }

    function getSession() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        } catch {
            return null;
        }
    }

    function setSession(session) {
        if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else localStorage.removeItem(SESSION_KEY);
    }

    function getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function addRecentSearch(from, to, date) {
        let list = getRecentSearches().filter((s) => !(s.from === from && s.to === to && s.date === date));
        list.unshift({ from, to, date });
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    }

    return {
        STORE_KEY,
        SESSION_KEY,
        RECENT_KEY,
        READ_NOTIFS_KEY,
        load,
        save,
        mutate,
        getSession,
        setSession,
        getRecentSearches,
        addRecentSearch
    };
})();

window.Store = Store;
