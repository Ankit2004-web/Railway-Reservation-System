/**
 * Application configuration — live API by default when served from the app server.
 * Set localStorage.railwayUseMock = 'true' to use offline mock data.
 */
const AppConfig = (() => {
    const MOCK_DELAY_MS = 350;

    function useMock() {
        if (localStorage.getItem('railwayUseMock') === 'true') return true;
        if (localStorage.getItem('railwayUseApi') === 'false') return true;
        if (window.location.protocol === 'file:') return true;
        return false;
    }

    function useApi() {
        return !useMock();
    }

    function setUseApi(enabled) {
        if (enabled) {
            localStorage.setItem('railwayUseApi', 'true');
            localStorage.removeItem('railwayUseMock');
        } else {
            localStorage.setItem('railwayUseMock', 'true');
            localStorage.removeItem('railwayUseApi');
        }
    }

    function delay(ms = MOCK_DELAY_MS) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    return { MOCK_DELAY_MS, useMock, useApi, setUseApi, delay };
})();

window.AppConfig = AppConfig;
