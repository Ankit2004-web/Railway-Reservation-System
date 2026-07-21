const API_URL = '/api';

async function loadCaptcha(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    try {
        const data = typeof API !== 'undefined'
            ? await API.get('/captcha')
            : await (await fetch(`${API_URL}/captcha`)).json();

        container.innerHTML = `
            <label for="${containerId}-answer">Security Check: ${data.question}</label>
            <input type="number" id="${containerId}-answer" class="form-control" required placeholder="Answer">
            <input type="hidden" id="${containerId}-id" value="${data.captchaId}">
            <button type="button" class="btn btn-small captcha-refresh" data-target="${containerId}">Refresh</button>
        `;

        container.querySelector('.captcha-refresh').addEventListener('click', () => {
            loadCaptcha(containerId);
        });

        return {
            getValues: () => ({
                captchaId: document.getElementById(`${containerId}-id`).value,
                captchaAnswer: document.getElementById(`${containerId}-answer`).value
            })
        };
    } catch {
        container.innerHTML = '<p class="error-message">Could not load captcha</p>';
        return null;
    }
}

function getCaptchaValues(containerId) {
    const captchaId = document.getElementById(`${containerId}-id`)?.value;
    const captchaAnswer = document.getElementById(`${containerId}-answer`)?.value;
    return { captchaId, captchaAnswer };
}

window.loadCaptcha = loadCaptcha;
window.getCaptchaValues = getCaptchaValues;
