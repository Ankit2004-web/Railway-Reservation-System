/**
 * Service adapter — routes to MockService (frontend-first) or live REST API.
 */
const API = (() => {
    const BASE = '/api';

    function getToken() {
        return localStorage.getItem('token');
    }

    function setToken(token) {
        if (token) localStorage.setItem('token', token);
        else localStorage.removeItem('token');
    }

    function authHeaders(extra = {}) {
        const headers = { 'Content-Type': 'application/json', ...extra };
        const token = getToken();
        if (token) headers['x-auth-token'] = token;
        return headers;
    }

    function shouldUseMock() {
        return typeof AppConfig !== 'undefined' && AppConfig.useMock() && typeof MockService !== 'undefined';
    }

    async function request(path, options = {}) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        if (shouldUseMock()) {
            const method = options.method || 'GET';
            const body = options.body ? JSON.parse(options.body) : null;
            return MockService.handle(method, normalizedPath, body);
        }

        const response = await fetch(`${BASE}${normalizedPath}`, {
            ...options,
            headers: { ...authHeaders(), ...options.headers }
        });

        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json().catch(() => ({}));
        } else if (response.ok && options.raw) {
            return response;
        }

        if (!response.ok) {
            const err = new Error(data?.msg || data?.message || `Request failed (${response.status})`);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    }

    const get = (path) => request(path);
    const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
    const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
    const del = (path) => request(path, { method: 'DELETE' });

    async function download(path, filename) {
        if (shouldUseMock()) {
            const result = await MockService.download(path.startsWith('/') ? path : `/${path}`);
            const url = window.URL.createObjectURL(result.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || result.filename;
            link.click();
            window.URL.revokeObjectURL(url);
            return;
        }

        const response = await fetch(`${BASE}${path}`, {
            headers: { 'x-auth-token': getToken() || '' }
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.msg || 'Download failed');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    return {
        BASE,
        getToken,
        setToken,
        authHeaders,
        request,
        get,
        post,
        put,
        del,
        download,
        isMockMode: shouldUseMock
    };
})();

window.API = API;
window.API_URL = API.BASE;

function authHeaders() {
    return API.authHeaders();
}

function getId(item) {
    return item?.id ?? item?._id;
}
