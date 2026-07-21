let adminUser = null;
let allTrains = [];
let allBookings = [];
let allUsers = [];
let allStations = [];
let trainsPage = 1;
let trainsTotalPages = 1;
let trainsSearchDebounce = null;
let chartInstances = {};
let drawerTrainId = null;
let drawerRouteStops = [];
let pendingStationImport = [];

const SECTION_TITLES = {
    'section-dashboard': 'Dashboard',
    'section-trains': 'Trains',
    'section-bookings': 'Bookings',
    'section-users': 'Users',
    'section-stations': 'Stations',
    'section-master-data': 'Master Data',
    'section-reports': 'Reports'
};

document.addEventListener('DOMContentLoaded', async () => {
    Theme.init();
    UI.initModals();
    UI.initDrawers();

    const token = API.getToken();
    if (!token) {
        window.location.href = 'adminLogin.html';
        return;
    }

    try {
        adminUser = await API.get('/auth/me');
    } catch {
        API.setToken(null);
        window.location.href = 'adminLogin.html';
        return;
    }

    if (!adminUser?.isAdmin) {
        window.location.href = 'index.html?error=admin-access-denied';
        return;
    }

    if (adminUser.isBlocked) {
        API.setToken(null);
        window.location.href = 'adminLogin.html';
        return;
    }

    initNavigation();
    initSidebar();
    initWelcome();
    showSection('section-dashboard');
    loadDashboard();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    document.getElementById('admin-logout').addEventListener('click', () => {
        API.setToken(null);
        window.location.href = 'adminLogin.html';
    });

    document.getElementById('add-train-form').addEventListener('submit', handleAddTrain);
    document.getElementById('edit-train-form').addEventListener('submit', handleEditTrain);
    document.getElementById('cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-train-container').style.display = 'none';
    });
    document.getElementById('show-add-train').addEventListener('click', () => {
        document.getElementById('add-train-card').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('filter-bookings-btn').addEventListener('click', loadBookings);
    document.getElementById('refresh-reports-btn').addEventListener('click', loadReports);
    document.getElementById('export-bookings-csv').addEventListener('click', exportBookingsCSV);
    document.getElementById('print-report').addEventListener('click', () => window.print());
    document.getElementById('export-report-csv').addEventListener('click', exportReportCSV);

    document.getElementById('add-station-form').addEventListener('submit', handleAddStation);
    document.getElementById('edit-station-form').addEventListener('submit', handleEditStation);
    document.getElementById('cancel-station-edit').addEventListener('click', () => {
        document.getElementById('edit-station-container').style.display = 'none';
    });

    document.getElementById('refresh-master-data')?.addEventListener('click', loadMasterData);

    document.getElementById('train-search')?.addEventListener('input', () => {
        clearTimeout(trainsSearchDebounce);
        trainsSearchDebounce = setTimeout(() => { trainsPage = 1; loadTrains(); }, 300);
    });
    ['train-filter-type', 'train-filter-status'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => { trainsPage = 1; loadTrains(); });
    });
    ['train-filter-source', 'train-filter-dest'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => {
            clearTimeout(trainsSearchDebounce);
            trainsSearchDebounce = setTimeout(() => { trainsPage = 1; loadTrains(); }, 300);
        });
    });
    document.getElementById('user-search')?.addEventListener('input', renderUsersTable);
    document.getElementById('user-filter')?.addEventListener('change', renderUsersTable);
    document.getElementById('station-search')?.addEventListener('input', renderStationsTable);

    document.getElementById('global-pnr-search')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const pnr = e.target.value.trim();
            if (!pnr) return;
            showSection('section-bookings');
            document.getElementById('filter-pnr').value = pnr;
            loadSection('section-bookings');
        }
    });

    document.querySelectorAll('.quick-action').forEach((btn) => {
        btn.addEventListener('click', () => {
            showSection(btn.dataset.goto);
            loadSection(btn.dataset.goto);
        });
    });

    document.querySelectorAll('.date-preset').forEach((btn) => {
        btn.addEventListener('click', () => applyDatePreset(btn.dataset.preset));
    });

    document.querySelectorAll('.report-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            const days = Number(btn.dataset.days);
            const to = new Date();
            const from = new Date();
            from.setDate(from.getDate() - days);
            document.getElementById('report-from').value = from.toISOString().split('T')[0];
            document.getElementById('report-to').value = to.toISOString().split('T')[0];
            loadReports();
        });
    });

    document.querySelectorAll('[data-report-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-report-tab]').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.report-panel').forEach((p) => {
                p.style.display = p.dataset.reportPanel === tab.dataset.reportTab ? 'block' : 'none';
            });
        });
    });

    document.getElementById('station-import-btn')?.addEventListener('click', () => {
        pendingStationImport = [];
        document.getElementById('station-import-file').value = '';
        document.getElementById('station-import-preview').innerHTML = '';
        document.getElementById('station-import-error').textContent = '';
        document.getElementById('station-import-submit').disabled = true;
        UI.openModal('stationImportModal');
    });

    document.getElementById('station-import-file')?.addEventListener('change', handleStationImportFile);
    document.getElementById('station-import-submit')?.addEventListener('click', submitStationImport);
    document.getElementById('route-edit-add-stop')?.addEventListener('click', addRouteEditStopRow);
    document.getElementById('route-edit-save')?.addEventListener('click', saveRouteEdit);
    document.getElementById('class-edit-save')?.addEventListener('click', saveClassEdit);
});

async function verifyAdmin() {
    try {
        adminUser = await API.get('/auth/me');
        if (!adminUser.isAdmin) return false;
        document.getElementById('admin-user-name').textContent = adminUser.name;
        return true;
    } catch {
        return false;
    }
}

function initWelcome() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('welcome-greeting').textContent = `${greeting}, ${adminUser?.name?.split(' ')[0] || 'Admin'}`;
    const now = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('welcome-date').textContent = now;
    document.getElementById('admin-date-display').textContent = now;
}

function initSidebar() {
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('admin-sidebar').classList.toggle('is-open');
        document.getElementById('sidebar-overlay').classList.toggle('is-open');
    });
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
        document.getElementById('admin-sidebar').classList.remove('is-open');
        document.getElementById('sidebar-overlay').classList.remove('is-open');
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach((el) => el.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    document.getElementById('breadcrumb-section').textContent = SECTION_TITLES[sectionId] || 'Admin';
    document.getElementById('admin-sidebar').classList.remove('is-open');
    document.getElementById('sidebar-overlay').classList.remove('is-open');
}

function initNavigation() {
    document.querySelectorAll('.admin-nav-item[data-section]').forEach((item) => {
        item.addEventListener('click', () => {
            showSection(item.dataset.section);
            loadSection(item.dataset.section);
        });
    });
}

function loadSection(section) {
    const loaders = {
        'section-dashboard': loadDashboard,
        'section-trains': loadTrains,
        'section-bookings': loadBookings,
        'section-users': loadUsers,
        'section-stations': loadStations,
        'section-master-data': loadMasterData,
        'section-reports': loadReports
    };
    loaders[section]?.();
}

function getTrainPayload(prefix) {
    return {
        trainNumber: document.getElementById(`${prefix}trainNumber`).value,
        trainName: document.getElementById(`${prefix}trainName`).value,
        source: document.getElementById(`${prefix}source`).value,
        destination: document.getElementById(`${prefix}destination`).value,
        departureTime: document.getElementById(`${prefix}departureTime`).value,
        arrivalTime: document.getElementById(`${prefix}arrivalTime`).value,
        duration: document.getElementById(`${prefix}duration`).value,
        distance: parseInt(document.getElementById(`${prefix}distance`).value, 10),
        availableSeats: parseInt(document.getElementById(`${prefix}availableSeats`).value, 10),
        price: parseFloat(document.getElementById(`${prefix}price`).value),
        date: document.getElementById(`${prefix}date`).value,
        runningDays: document.getElementById(`${prefix}runningDays`).value,
        runningStatus: document.getElementById(`${prefix}runningStatus`).value
    };
}

async function loadDashboard() {
    const tbody = document.getElementById('recent-bookings-list');
    UI.renderSkeleton(tbody, 'table', 5);
    try {
        const [data] = await Promise.all([
            API.get('/admin/dashboard'),
            loadDashboardRefunds()
        ]);
        const s = data.stats;

        document.getElementById('stat-users').textContent = s.totalUsers;
        document.getElementById('stat-trains').textContent = s.totalTrains;
        document.getElementById('stat-bookings').textContent = s.totalBookings;
        document.getElementById('stat-revenue').textContent = UI.formatCurrency(s.totalRevenue);
        document.getElementById('stat-confirmed').textContent = s.confirmedBookings;
        document.getElementById('stat-waitlist').textContent = s.waitlistedBookings;
        document.getElementById('stat-cancelled').textContent = s.cancelledBookings;
        document.getElementById('stat-today').textContent = s.todayBookings;

        const alerts = document.getElementById('dashboard-alerts');
        alerts.innerHTML = '';
        if (s.waitlistedBookings > 0) {
            alerts.innerHTML += `<div class="alert-item"><i class="fas fa-clock"></i> ${s.waitlistedBookings} waitlisted passengers</div>`;
        }
        if (s.cancelledBookings > 0) {
            alerts.innerHTML += `<div class="alert-item alert-info"><i class="fas fa-info-circle"></i> ${s.cancelledBookings} total cancellations</div>`;
        }

        tbody.innerHTML = data.recentBookings.length
            ? data.recentBookings.map((b) => `<tr>
                <td>${UI.escapeHTML(b.pnrNumber)}</td>
                <td>${UI.escapeHTML(b.trainNumber)} - ${UI.escapeHTML(b.trainName)}</td>
                <td>${UI.escapeHTML(b.userName)}</td>
                <td>${UI.statusBadge(b.status)}</td>
                <td>${UI.formatCurrency(b.totalPrice)}</td>
                <td>${UI.formatDate(b.bookingDate)}</td>
            </tr>`).join('')
            : '<tr><td colspan="6"><div class="empty-state" style="padding:24px"><p>No bookings yet</p></div></td></tr>';

        renderDashboardCharts(data, dashboardRefunds);
    } catch (err) {
        UI.renderErrorState(tbody.parentElement?.parentElement, err.message, loadDashboard);
    }
}

let dashboardRefunds = { summary: { totalRefunded: 0 } };

async function loadDashboardRefunds() {
    try {
        dashboardRefunds = await API.get('/admin/reports/refunds');
    } catch {
        dashboardRefunds = { summary: { totalRefunded: 0 } };
    }
}

function renderDashboardCharts(data, refunds) {
    if (typeof Chart === 'undefined') return;

    const bookingsByDay = {};
    (data.recentBookings || []).forEach((b) => {
        const d = UI.formatDate(b.bookingDate);
        bookingsByDay[d] = (bookingsByDay[d] || 0) + 1;
    });
    const labels = Object.keys(bookingsByDay);
    const values = Object.values(bookingsByDay);

    destroyChart('chart-bookings');
    chartInstances['chart-bookings'] = new Chart(document.getElementById('chart-bookings'), {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No data'],
            datasets: [{ label: 'Bookings', data: values.length ? values : [0], backgroundColor: '#20B8BE', borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const s = data.stats;
    destroyChart('chart-status');
    chartInstances['chart-status'] = new Chart(document.getElementById('chart-status'), {
        type: 'doughnut',
        data: {
            labels: ['Confirmed', 'Waitlisted', 'Cancelled', 'Pending'],
            datasets: [{
                data: [s.confirmedBookings, s.waitlistedBookings, s.cancelledBookings, Math.max(0, s.totalBookings - s.confirmedBookings - s.waitlistedBookings - s.cancelledBookings)],
                backgroundColor: ['#16A34A', '#F59E0B', '#DC2626', '#0284C7']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    destroyChart('chart-revenue-refunds');
    const revenue = Number(s.totalRevenue || 0);
    const refunded = Number(refunds?.summary?.totalRefunded || 0);
    chartInstances['chart-revenue-refunds'] = new Chart(document.getElementById('chart-revenue-refunds'), {
        type: 'bar',
        data: {
            labels: ['Total Revenue', 'Total Refunded'],
            datasets: [{
                data: [revenue, refunded],
                backgroundColor: ['#20B8BE', '#DC2626'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

async function loadTrains() {
    const tbody = document.getElementById('trains-list');
    UI.renderSkeleton(tbody, 'table', 8);
    try {
        const params = new URLSearchParams({
            page: trainsPage,
            pageSize: 25,
            search: document.getElementById('train-search')?.value || '',
            trainType: document.getElementById('train-filter-type')?.value || '',
            source: document.getElementById('train-filter-source')?.value || '',
            destination: document.getElementById('train-filter-dest')?.value || '',
            status: document.getElementById('train-filter-status')?.value || ''
        });
        const result = await API.get(`/admin/trains?${params}`);
        allTrains = result.items || [];
        trainsTotalPages = result.totalPages || 1;
        renderTrainsTable(result);
    } catch (err) {
        UI.renderErrorState(tbody.parentElement?.parentElement, err.message, loadTrains);
    }
}

function renderTrainsTable(result) {
    const tbody = document.getElementById('trains-list');
    const items = result?.items || allTrains;

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:24px"><p>No trains found</p></div></td></tr>';
        UI.renderPagination(document.getElementById('trains-pagination'), { page: 1, pages: 1, onPage: () => {} });
        return;
    }

    tbody.innerHTML = items.map((train) => {
        const trainId = getId(train);
        const src = train.sourceStationCode ? `${train.sourceStationCode}` : train.source;
        const dst = train.destStationCode ? `${train.destStationCode}` : train.destination;
        const runningLabel = train.runningDaysList?.length
            ? train.runningDaysLabel || train.runningDays
            : (train.runningDays || 'Not in source dataset');

        return `<tr>
            <td>${UI.escapeHTML(train.trainNumber)}</td>
            <td>${UI.escapeHTML(train.trainName)}</td>
            <td>${UI.escapeHTML(src)}</td>
            <td>${UI.escapeHTML(dst)}</td>
            <td>${UI.escapeHTML(train.trainTypeCode || train.trainType || '—')}</td>
            <td>${UI.escapeHTML(runningLabel)}</td>
            <td>${train.stopCount ?? '—'}</td>
            <td>${UI.statusBadge(train.runningStatus || 'Running')}</td>
            <td class="action-buttons">
                <button type="button" class="btn btn-sm btn-outline" data-view="${trainId}" title="View Details"><i class="fas fa-eye"></i></button>
                <button type="button" class="btn btn-sm btn-outline" data-route="${trainId}" title="View Route"><i class="fas fa-route"></i></button>
                <button type="button" class="btn btn-sm btn-edit" data-edit="${trainId}">Edit</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const train = items.find((t) => getId(t) === Number(btn.dataset.edit));
            openEditTrainForm(train);
        });
    });

    tbody.querySelectorAll('[data-view]').forEach((btn) => {
        btn.addEventListener('click', () => openTrainDrawer(Number(btn.dataset.view)));
    });

    tbody.querySelectorAll('[data-route]').forEach((btn) => {
        btn.addEventListener('click', () => openTrainDrawer(Number(btn.dataset.route)));
    });

    UI.renderPagination(document.getElementById('trains-pagination'), {
        page: result?.page || trainsPage,
        pages: result?.totalPages || trainsTotalPages,
        onPage: (p) => { trainsPage = p; loadTrains(); }
    });
}

async function openTrainDrawer(trainId) {
    drawerTrainId = trainId;
    let train = allTrains.find((t) => getId(t) === trainId);
    if (!train) {
        try { train = await API.get(`/admin/trains/${trainId}`); } catch { return; }
    }

    document.getElementById('train-drawer-title').textContent = `${train.trainName} (${train.trainNumber})`;
    const body = document.getElementById('train-drawer-body');
    body.innerHTML = '<div class="skeleton skeleton-card" style="height:200px"></div>';

    UI.openDrawer('train-drawer-overlay');

    let routeStops = [];
    let routeHtml = '<p class="form-hint">No route stops configured.</p>';
    try {
        const route = await API.get(`/trains/${trainId}/route`);
        routeStops = route.stops || [];
        drawerRouteStops = routeStops;
        if (routeStops.length) {
            routeHtml = `<div class="route-timeline">${routeStops.map((stop, i) => {
                const cls = stop.isSource || i === 0 ? 'origin' : (stop.isDestination || i === routeStops.length - 1 ? 'destination' : '');
                const arrLabel = stop.arrival || (stop.isSource ? 'START' : '—');
                const depLabel = stop.departure || (stop.isDestination ? 'END' : '—');
                const dayNum = (stop.departureDayOffset ?? stop.arrivalDayOffset ?? 0) + 1;
                return `<div class="route-stop ${cls}">
                    <div class="route-stop-header"><strong>${UI.escapeHTML(stop.stationCode || '')}</strong> ${UI.escapeHTML(stop.stationName)}</div>
                    <div class="route-stop-times">
                        Arr: ${UI.escapeHTML(arrLabel)} | Dep: ${UI.escapeHTML(depLabel)} |
                        Halt: ${stop.haltMinutes != null ? stop.haltMinutes + ' min' : '—'} |
                        Day: ${dayNum} |
                        Dist: ${stop.distanceKm != null ? stop.distanceKm + ' km' : '—'} |
                        Platform: ${stop.platform ? UI.escapeHTML(stop.platform) : '—'}
                    </div></div>`;
            }).join('')}</div>`;
        }
    } catch {
        routeHtml = '<p class="form-hint">Could not load route.</p>';
        drawerRouteStops = [];
    }

    const classesHtml = (train.classes || []).map((c) =>
        `<tr><td>${UI.escapeHTML(c.classCode)}</td><td>${UI.escapeHTML(c.className || '')}</td><td>${c.availableSeats}/${c.totalSeats}</td><td>${UI.formatCurrency(c.price)}</td>
            <td><button type="button" class="btn btn-sm btn-edit" data-edit-class="${c.id}" data-class-code="${UI.escapeHTML(c.classCode)}" data-class-name="${UI.escapeHTML(c.className || '')}" data-class-price="${c.price}" data-class-total="${c.totalSeats}" data-class-available="${c.availableSeats}">Edit</button></td></tr>`
    ).join('') || '<tr><td colspan="5">No class data</td></tr>';

    body.innerHTML = `
        <div class="detail-section">
            <h4>Overview</h4>
            <dl class="detail-grid">
                <dt>Train Number</dt><dd>${UI.escapeHTML(train.trainNumber)}</dd>
                <dt>Train Name</dt><dd>${UI.escapeHTML(train.trainName)}</dd>
                <dt>Type</dt><dd>${UI.escapeHTML(train.trainTypeCode || train.trainType || '—')}</dd>
                <dt>Route</dt><dd>${UI.escapeHTML(train.sourceStationCode || train.source)} → ${UI.escapeHTML(train.destStationCode || train.destination)}</dd>
                <dt>Running Days</dt><dd>${UI.escapeHTML(train.runningDaysLabel || train.runningDays || 'Not in source dataset')}</dd>
                <dt>Total Stops</dt><dd>${train.stopCount ?? routeStops.length ?? '—'}</dd>
                <dt>Total Distance</dt><dd>${train.distance ? train.distance + ' km' : '—'}</dd>
                <dt>Data Source</dt><dd>${UI.escapeHTML(train.dataSourceName || '—')}</dd>
                <dt>Status</dt><dd>${UI.statusBadge(train.runningStatus || 'Running')}</dd>
            </dl>
        </div>
        <div class="detail-section">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h4 style="margin:0">Route Timeline</h4>
                <button type="button" class="btn btn-outline btn-sm" id="edit-route-btn"><i class="fas fa-edit"></i> Edit Route</button>
            </div>
            ${routeHtml}
        </div>
        <div class="detail-section"><h4>Classes</h4>
            <div class="table-wrap"><table class="admin-table"><thead><tr><th>Code</th><th>Name</th><th>Seats</th><th>Fare</th><th></th></tr></thead><tbody>${classesHtml}</tbody></table></div>
        </div>`;

    document.getElementById('edit-route-btn')?.addEventListener('click', () => openRouteEditModal(train));
    body.querySelectorAll('[data-edit-class]').forEach((btn) => {
        btn.addEventListener('click', () => openClassEditModal({
            id: Number(btn.dataset.editClass),
            classCode: btn.dataset.classCode,
            className: btn.dataset.className,
            price: Number(btn.dataset.classPrice),
            totalSeats: Number(btn.dataset.classTotal),
            availableSeats: Number(btn.dataset.classAvailable)
        }));
    });
}

function openEditTrainForm(train) {
    document.getElementById('edit-trainId').value = getId(train);
    document.getElementById('edit-trainNumber').value = train.trainNumber;
    document.getElementById('edit-trainName').value = train.trainName;
    document.getElementById('edit-source').value = train.source;
    document.getElementById('edit-destination').value = train.destination;
    document.getElementById('edit-departureTime').value = train.departureTime;
    document.getElementById('edit-arrivalTime').value = train.arrivalTime;
    document.getElementById('edit-duration').value = train.duration;
    document.getElementById('edit-distance').value = train.distance;
    document.getElementById('edit-availableSeats').value = train.availableSeats;
    document.getElementById('edit-price').value = train.price;
    document.getElementById('edit-date').value = new Date(train.date).toISOString().split('T')[0];
    document.getElementById('edit-runningDays').value = train.runningDays || 'Daily';
    document.getElementById('edit-runningStatus').value = train.runningStatus || 'Running';
    document.getElementById('edit-train-container').style.display = 'block';
}

async function handleAddTrain(e) {
    e.preventDefault();
    try {
        await API.post('/trains', getTrainPayload(''));
        document.getElementById('add-train-error').textContent = '';
        e.target.reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        UI.showToast('Train added', 'success');
        loadTrains();
    } catch (err) {
        document.getElementById('add-train-error').textContent = err.message;
    }
}

async function handleEditTrain(e) {
    e.preventDefault();
    const trainId = document.getElementById('edit-trainId').value;
    try {
        await API.put(`/trains/${trainId}`, getTrainPayload('edit-'));
        document.getElementById('edit-train-container').style.display = 'none';
        UI.showToast('Train updated', 'success');
        loadTrains();
    } catch (err) {
        document.getElementById('edit-train-error').textContent = err.message;
    }
}

function applyDatePreset(preset) {
    const to = new Date();
    const from = new Date();
    if (preset === 'today') from.setDate(from.getDate());
    else if (preset === 'week') from.setDate(from.getDate() - 7);
    else if (preset === 'month') from.setMonth(from.getMonth() - 1);
    document.getElementById('filter-from').value = from.toISOString().split('T')[0];
    document.getElementById('filter-to').value = to.toISOString().split('T')[0];
    loadBookings();
}

async function loadBookings() {
    const tbody = document.getElementById('bookings-list');
    UI.renderSkeleton(tbody, 'table', 8);

    const params = new URLSearchParams();
    const pnr = document.getElementById('filter-pnr')?.value.trim();
    const status = document.getElementById('filter-status')?.value;
    const from = document.getElementById('filter-from')?.value;
    const to = document.getElementById('filter-to')?.value;
    if (pnr) params.set('pnr', pnr);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        allBookings = await API.get(`/admin/bookings?${params}`);
        renderBookingsKPI(allBookings);
        renderBookingsTable(allBookings);
    } catch (err) {
        UI.renderErrorState(tbody.parentElement?.parentElement, err.message, loadBookings);
    }
}

function renderBookingsKPI(bookings) {
    const kpi = document.getElementById('bookings-kpi');
    if (!kpi) return;
    const confirmed = bookings.filter((b) => b.status === 'Confirmed').length;
    const waitlisted = bookings.filter((b) => b.status === 'Waitlisted').length;
    const rac = bookings.filter((b) => b.status === 'RAC').length;
    const cancelled = bookings.filter((b) => b.status === 'Cancelled').length;
    const revenue = bookings.filter((b) => b.status !== 'Cancelled').reduce((s, b) => s + (b.totalPrice || 0), 0);
    kpi.innerHTML = `
        <div class="stat-card"><div class="stat-label">Results</div><div class="stat-value">${bookings.length}</div></div>
        <div class="stat-card stat-success"><div class="stat-label">Confirmed</div><div class="stat-value">${confirmed}</div></div>
        <div class="stat-card stat-warning"><div class="stat-label">Waitlisted</div><div class="stat-value">${waitlisted}</div></div>
        <div class="stat-card"><div class="stat-label">RAC</div><div class="stat-value">${rac}</div></div>
        <div class="stat-card stat-danger"><div class="stat-label">Cancelled</div><div class="stat-value">${cancelled}</div></div>
        <div class="stat-card stat-brand"><div class="stat-label">Revenue</div><div class="stat-value">${UI.formatCurrency(revenue)}</div></div>`;
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-list');
    if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:24px"><p>No bookings found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = bookings.map((b) => {
        const passengers = (b.passengers || []).map((p) => p.name).join(', ');
        const canCancel = ['Confirmed', 'Pending', 'Waitlisted', 'RAC'].includes(b.status);
        const canPromote = b.status === 'Waitlisted';
        return `<tr>
            <td><button type="button" class="btn btn-ghost btn-sm" data-detail="${b.id}">${UI.escapeHTML(b.pnrNumber)}</button></td>
            <td>${UI.escapeHTML(b.train?.trainNumber || '')} ${UI.escapeHTML(b.train?.trainName || '')}</td>
            <td>${UI.escapeHTML(b.user?.name || '—')}</td>
            <td>${UI.escapeHTML(b.classCode || '—')}</td>
            <td>${UI.formatDate(b.journeyDate)}</td>
            <td>${UI.statusBadge(b.status)}${b.waitlistPosition ? ` ${b.status === 'RAC' ? 'RAC' : 'WL'}/${b.waitlistPosition}` : ''}</td>
            <td>${UI.formatCurrency(b.totalPrice)}</td>
            <td>${UI.escapeHTML(passengers || '—')}</td>
            <td class="action-buttons">
                ${canCancel ? `<button type="button" class="btn btn-sm btn-delete" data-cancel="${b.id}">Cancel</button>` : ''}
                ${canPromote ? `<button type="button" class="btn btn-sm btn-primary" data-promote="${b.id}" data-train="${b.train?.id}" data-class="${b.classCode}" data-date="${(b.journeyDate || '').split('T')[0]}">Promote</button>` : ''}
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-detail]').forEach((btn) => {
        btn.addEventListener('click', () => openBookingDrawer(Number(btn.dataset.detail)));
    });

    tbody.querySelectorAll('[data-cancel]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const ok = await UI.confirmDialog({ title: 'Cancel Booking', message: 'Cancel this booking?', danger: true });
            if (!ok) return;
            try {
                await API.put(`/bookings/${btn.dataset.cancel}`, { status: 'Cancelled' });
                UI.showToast('Booking cancelled', 'success');
                loadBookings();
                loadDashboard();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    });

    tbody.querySelectorAll('[data-promote]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                await API.post('/admin/waitlist/promote', {
                    trainId: Number(btn.dataset.train),
                    classCode: btn.dataset.class,
                    journeyDate: btn.dataset.date
                });
                UI.showToast('Passenger promoted to pending (payment required)', 'success');
                loadBookings();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    });
}

function openBookingDrawer(bookingId) {
    const b = allBookings.find((x) => x.id === bookingId);
    if (!b) return;
    const body = document.getElementById('booking-drawer-body');
    const passengers = (b.passengers || []).map((p) =>
        `<tr><td>${UI.escapeHTML(p.name)}</td><td>${p.age}</td><td>${UI.escapeHTML(p.gender)}</td><td>${UI.escapeHTML((b.seatNumbers || []).join(', ') || '—')}</td></tr>`
    ).join('');

    body.innerHTML = `
        <dl class="detail-grid">
            <dt>PNR</dt><dd>${UI.escapeHTML(b.pnrNumber)}</dd>
            <dt>User</dt><dd>${UI.escapeHTML(b.user?.name)} (${UI.escapeHTML(b.user?.email)})</dd>
            <dt>Train</dt><dd>${UI.escapeHTML(b.train?.trainName)} (${UI.escapeHTML(b.train?.trainNumber)})</dd>
            <dt>Route</dt><dd>${UI.escapeHTML(b.train?.source)} → ${UI.escapeHTML(b.train?.destination)}</dd>
            <dt>Journey</dt><dd>${UI.formatDate(b.journeyDate)}</dd>
            <dt>Class / Quota</dt><dd>${UI.escapeHTML(b.classCode || '—')} / ${UI.escapeHTML(b.quota || 'General')}</dd>
            <dt>Amount</dt><dd>${UI.formatCurrency(b.totalPrice)}</dd>
            <dt>Status</dt><dd>${UI.statusBadge(b.status)}</dd>
            <dt>Payment</dt><dd>${UI.escapeHTML(b.paymentStatus || 'N/A')}</dd>
        </dl>
        <div class="detail-section"><h4>Passengers</h4>
            <div class="table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Seat</th></tr></thead><tbody>${passengers}</tbody></table></div>
        </div>
        ${b.refund ? `<p><strong>Refund:</strong> ${UI.formatCurrency(b.refund.refundAmount)}</p>` : ''}`;

    UI.openDrawer('booking-drawer-overlay');
}

function exportBookingsCSV() {
    if (!allBookings.length) { UI.showToast('No bookings to export', 'warning'); return; }
    UI.exportCSV('bookings.csv', allBookings.map((b) => ({
        PNR: b.pnrNumber,
        Train: `${b.train?.trainNumber} ${b.train?.trainName}`,
        User: b.user?.name,
        Journey: UI.formatDate(b.journeyDate),
        Status: b.status,
        Amount: b.totalPrice
    })), ['PNR', 'Train', 'User', 'Journey', 'Status', 'Amount']);
    UI.showToast('CSV exported', 'success');
}

async function loadUsers() {
    const tbody = document.getElementById('users-list');
    UI.renderSkeleton(tbody, 'table', 6);
    try {
        allUsers = await API.get('/admin/users');
        if (!allBookings.length) {
            try { allBookings = await API.get('/admin/bookings'); } catch { /* optional for booking counts */ }
        }
        renderUsersTable();
    } catch (err) {
        UI.renderErrorState(tbody.parentElement?.parentElement, err.message, loadUsers);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-list');
    const query = (document.getElementById('user-search')?.value || '').toLowerCase();
    const filter = document.getElementById('user-filter')?.value || 'all';

    let users = allUsers.filter((u) => {
        const matchQuery = !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
        const matchFilter =
            filter === 'all' ||
            (filter === 'admin' && u.isAdmin) ||
            (filter === 'blocked' && u.isBlocked) ||
            (filter === 'active' && !u.isBlocked);
        return matchQuery && matchFilter;
    });

    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="padding:24px"><p>No users found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = users.map((u) => `<tr>
        <td><button type="button" class="btn btn-ghost btn-sm" data-user-view="${u.id}">${UI.escapeHTML(u.name)}</button></td>
        <td>${UI.escapeHTML(u.email)}</td>
        <td>${UI.escapeHTML(u.phone)}</td>
        <td>${UI.formatDate(u.createdAt)}</td>
        <td>${u.isAdmin ? '<span class="badge badge-admin">Admin</span>' : 'User'}</td>
        <td>${u.isBlocked ? '<span class="badge badge-blocked">Blocked</span>' : '<span class="badge badge-active">Active</span>'}</td>
        <td class="action-buttons">
            <button type="button" class="toggle-btn ${u.isAdmin ? 'on' : 'off'}" data-admin="${u.id}" data-value="${!u.isAdmin}">${u.isAdmin ? 'Revoke Admin' : 'Make Admin'}</button>
            <button type="button" class="toggle-btn ${u.isBlocked ? 'on' : 'off'}" data-block="${u.id}" data-value="${!u.isBlocked}">${u.isBlocked ? 'Unblock' : 'Block'}</button>
        </td>
    </tr>`).join('');

    tbody.querySelectorAll('[data-user-view]').forEach((btn) => {
        btn.addEventListener('click', () => openUserDrawer(Number(btn.dataset.userView)));
    });

    tbody.querySelectorAll('[data-admin]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const makeAdmin = btn.dataset.value === 'true';
            const ok = await UI.confirmDialog({
                title: makeAdmin ? 'Grant Admin' : 'Revoke Admin',
                message: `Are you sure you want to ${makeAdmin ? 'grant' : 'revoke'} admin access?`
            });
            if (!ok) return;
            try {
                await API.put(`/admin/users/${btn.dataset.admin}`, { isAdmin: makeAdmin });
                UI.showToast('User updated', 'success');
                loadUsers();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    });

    tbody.querySelectorAll('[data-block]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const block = btn.dataset.value === 'true';
            const ok = await UI.confirmDialog({
                title: block ? 'Block User' : 'Unblock User',
                message: `Are you sure you want to ${block ? 'block' : 'unblock'} this user?`,
                danger: block
            });
            if (!ok) return;
            try {
                await API.put(`/admin/users/${btn.dataset.block}`, { isBlocked: block });
                UI.showToast('User updated', 'success');
                loadUsers();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    });
}

async function loadStations() {
    const tbody = document.getElementById('stations-list');
    UI.renderSkeleton(tbody, 'table', 6);
    try {
        allStations = await API.get('/stations');
        renderStationsTable();
    } catch (err) {
        UI.renderErrorState(tbody.parentElement?.parentElement, err.message, loadStations);
    }
}

function renderStationsTable() {
    const tbody = document.getElementById('stations-list');
    const query = (document.getElementById('station-search')?.value || '').toLowerCase();
    const stations = allStations.filter((s) =>
        !query || s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query) || s.city.toLowerCase().includes(query)
    );

    if (!stations.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:24px"><p>No stations found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = stations.map((s) => `<tr>
        <td><strong>${UI.escapeHTML(s.code)}</strong></td>
        <td>${UI.escapeHTML(s.name)}</td>
        <td>${UI.escapeHTML(s.city)}</td>
        <td>${UI.escapeHTML(s.state)}</td>
        <td class="action-buttons">
            <button type="button" class="btn btn-sm btn-edit" data-edit-station="${s.id}">Edit</button>
            <button type="button" class="btn btn-sm btn-delete" data-delete-station="${s.id}">Delete</button>
        </td>
    </tr>`).join('');

    tbody.querySelectorAll('[data-edit-station]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const station = allStations.find((s) => s.id === Number(btn.dataset.editStation));
            document.getElementById('edit-stationId').value = station.id;
            document.getElementById('edit-stationCode').value = station.code;
            document.getElementById('edit-stationName').value = station.name;
            document.getElementById('edit-stationCity').value = station.city;
            document.getElementById('edit-stationState').value = station.state;
            document.getElementById('edit-station-container').style.display = 'block';
        });
    });

    tbody.querySelectorAll('[data-delete-station]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const ok = await UI.confirmDialog({ title: 'Delete Station', message: 'Delete this station?', danger: true });
            if (!ok) return;
            try {
                await API.del(`/stations/${btn.dataset.deleteStation}`);
                UI.showToast('Station deleted', 'success');
                loadStations();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    });
}

async function handleAddStation(e) {
    e.preventDefault();
    try {
        await API.post('/stations', {
            code: document.getElementById('stationCode').value.toUpperCase(),
            name: document.getElementById('stationName').value,
            city: document.getElementById('stationCity').value,
            state: document.getElementById('stationState').value
        });
        e.target.reset();
        document.getElementById('add-station-error').textContent = '';
        UI.showToast('Station added', 'success');
        loadStations();
    } catch (err) {
        document.getElementById('add-station-error').textContent = err.message;
    }
}

async function handleEditStation(e) {
    e.preventDefault();
    const id = document.getElementById('edit-stationId').value;
    try {
        await API.put(`/stations/${id}`, {
            code: document.getElementById('edit-stationCode').value.toUpperCase(),
            name: document.getElementById('edit-stationName').value,
            city: document.getElementById('edit-stationCity').value,
            state: document.getElementById('edit-stationState').value
        });
        document.getElementById('edit-station-container').style.display = 'none';
        UI.showToast('Station updated', 'success');
        loadStations();
    } catch (err) {
        document.getElementById('edit-station-error').textContent = err.message;
    }
}

async function loadMasterData() {
    const tbody = document.getElementById('master-data-imports-list');
    const alerts = document.getElementById('master-data-alerts');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';

    try {
        const data = await API.get('/admin/data-import/status');
        const counts = data.masterDataCounts || {};

        document.getElementById('md-stations').textContent = Number(counts.stations || 0).toLocaleString();
        document.getElementById('md-trains').textContent = Number(counts.trains || 0).toLocaleString();
        document.getElementById('md-stops').textContent = Number(counts.trainStops || 0).toLocaleString();
        document.getElementById('md-classes').textContent = Number(counts.trainClasses || 0).toLocaleString();
        document.getElementById('md-running-days').textContent = Number(counts.runningDayRecords || 0).toLocaleString();
        document.getElementById('md-segments').textContent = Number(data.segmentBookingRecords || 0).toLocaleString();

        if (alerts) {
            const warnings = data.lastImportReport?.warnings || data.limitations || [];
            alerts.innerHTML = warnings.length
                ? warnings.map((w) => `<div class="alert alert-warning"><i class="fas fa-info-circle"></i> ${UI.escapeHTML(w)}</div>`).join('')
                : '';
        }

        const report = data.lastImportReport;
        const reportCard = document.getElementById('master-data-report-card');
        if (report && reportCard) {
            reportCard.style.display = 'block';
            document.getElementById('master-data-report-meta').innerHTML = `
                <strong>${UI.escapeHTML(report.source || 'Import')}</strong> — ${UI.escapeHTML(report.importedAt || '')}<br>
                Inserted: ${Number(report.counts?.inserted || 0).toLocaleString()} · Updated: ${Number(report.counts?.updated || 0).toLocaleString()} · Failed: ${Number(report.counts?.failed || 0).toLocaleString()}`;
            const limEl = document.getElementById('master-data-limitations');
            if (limEl) {
                limEl.innerHTML = (data.limitations || []).map((item) => `<li>${UI.escapeHTML(item)}</li>`).join('');
            }
        }

        tbody.innerHTML = (data.latestImports || []).map((row) => `<tr>
            <td>${UI.escapeHTML(row.sourceName || row.sourceKey || '—')}</td>
            <td>${row.importedAt ? UI.formatDateTime(row.importedAt) : '—'}</td>
            <td>${Number(row.recordCount || 0).toLocaleString()}</td>
            <td>${UI.escapeHTML(row.status || '—')}</td>
            <td>${UI.escapeHTML(row.notes || '—')}</td>
        </tr>`).join('') || '<tr><td colspan="5">No import records yet. Run <code>npm run import:datameet</code>.</td></tr>';

        const classBody = document.getElementById('master-data-classification');
        if (classBody && data.dataClassification) {
            classBody.innerHTML = Object.entries(data.dataClassification).map(([key, desc]) => `<tr>
                <td><strong>${UI.escapeHTML(key)}</strong></td>
                <td>${UI.escapeHTML(desc)}</td>
            </tr>`).join('');
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">${UI.escapeHTML(err.message || 'Failed to load import status')}</td></tr>`;
        UI.showToast(err.message || 'Failed to load master data status', 'error');
    }
}

let reportData = {};

async function loadReports() {
    const from = document.getElementById('report-from')?.value;
    const to = document.getElementById('report-to')?.value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const [revenue, occupancy, cancellations, refunds] = await Promise.all([
            API.get(`/admin/reports/revenue?${params}`),
            API.get('/admin/reports/occupancy'),
            API.get(`/admin/reports/cancellations?${params}`),
            API.get('/admin/reports/refunds')
        ]);

        reportData = { revenue, occupancy, cancellations, refunds };

        document.getElementById('report-total-revenue').textContent = UI.formatCurrency(revenue.totalRevenue);
        document.getElementById('report-total-cancellations').textContent = cancellations.totalCancellations;
        document.getElementById('report-total-refunds').textContent = UI.formatCurrency(refunds.summary.totalRefunded);
        document.getElementById('report-refund-count').textContent = refunds.summary.totalRefunds;

        renderReportCharts(revenue, cancellations);

        document.getElementById('refunds-list').innerHTML = refunds.refunds.slice(0, 20).map((row) => `<tr>
            <td>${UI.escapeHTML(row.pnrNumber)}</td>
            <td>${UI.escapeHTML(row.userName)}</td>
            <td>${UI.formatCurrency(row.originalAmount)}</td>
            <td>${UI.formatCurrency(row.refundAmount)}</td>
            <td>${row.refundPercent}%</td>
            <td>${UI.escapeHTML(row.reason || '—')}</td>
        </tr>`).join('') || '<tr><td colspan="6">No refunds yet</td></tr>';

        document.getElementById('occupancy-list').innerHTML = occupancy.slice(0, 25).map((row) => {
            const pct = row.occupancyPercent;
            return `<tr>
                <td>${UI.escapeHTML(row.trainNumber)} - ${UI.escapeHTML(row.trainName)}</td>
                <td>${UI.escapeHTML(row.classCode)}</td>
                <td>${row.bookedSeats}/${row.totalSeats}</td>
                <td><div class="occupancy-bar"><div class="occupancy-fill ${pct >= 80 ? 'high' : ''}" style="width:${pct}%"></div></div> ${pct}%</td>
            </tr>`;
        }).join('') || '<tr><td colspan="4">No occupancy data</td></tr>';
    } catch (err) {
        UI.showToast(err.message || 'Failed to load reports', 'error');
    }
}

function renderReportCharts(revenue, cancellations) {
    if (typeof Chart === 'undefined') return;

    const revLabels = (revenue.report || []).slice(-14).map((d) => String(d.date).slice(5));
    const revValues = (revenue.report || []).slice(-14).map((d) => d.revenue);

    destroyChart('revenue-chart');
    chartInstances['revenue-chart'] = new Chart(document.getElementById('revenue-chart'), {
        type: 'line',
        data: {
            labels: revLabels.length ? revLabels : ['No data'],
            datasets: [{ label: 'Revenue', data: revValues.length ? revValues : [0], borderColor: '#20B8BE', backgroundColor: 'rgba(32,184,190,0.1)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const canLabels = (cancellations.report || []).slice(-14).map((d) => String(d.date).slice(5));
    const canValues = (cancellations.report || []).slice(-14).map((d) => d.cancellationCount);

    destroyChart('cancellation-chart');
    chartInstances['cancellation-chart'] = new Chart(document.getElementById('cancellation-chart'), {
        type: 'bar',
        data: {
            labels: canLabels.length ? canLabels : ['No data'],
            datasets: [{ label: 'Cancellations', data: canValues.length ? canValues : [0], backgroundColor: '#DC2626', borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function openUserDrawer(userId) {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return;

    document.getElementById('user-drawer-body').innerHTML = '<div class="skeleton skeleton-card" style="height:120px"></div>';
    UI.openDrawer('user-drawer-overlay');

    API.get(`/admin/users/${userId}/stats`).then(({ stats }) => {
        document.getElementById('user-drawer-body').innerHTML = `
            <dl class="detail-grid">
                <dt>Name</dt><dd>${UI.escapeHTML(user.name)}</dd>
                <dt>Email</dt><dd>${UI.escapeHTML(user.email)}</dd>
                <dt>Phone</dt><dd>${UI.escapeHTML(user.phone)}</dd>
                <dt>Joined</dt><dd>${UI.formatDate(user.createdAt)}</dd>
                <dt>Role</dt><dd>${user.isAdmin ? '<span class="badge badge-admin">Admin</span>' : 'User'}</dd>
                <dt>Status</dt><dd>${user.isBlocked ? '<span class="badge badge-blocked">Blocked</span>' : '<span class="badge badge-active">Active</span>'}</dd>
                <dt>Total Bookings</dt><dd>${stats.totalBookings ?? 0}</dd>
                <dt>Confirmed</dt><dd>${stats.confirmedBookings ?? 0}</dd>
                <dt>Waitlisted / RAC</dt><dd>${stats.waitlistedBookings ?? 0}</dd>
                <dt>Cancelled</dt><dd>${stats.cancelledBookings ?? 0}</dd>
                <dt>Total Spent</dt><dd>${UI.formatCurrency(stats.totalSpent || 0)}</dd>
            </dl>`;
    }).catch(() => {
        document.getElementById('user-drawer-body').innerHTML = `<p class="form-hint">Could not load user statistics.</p>`;
    });
}

function openRouteEditModal(train) {
    document.getElementById('route-edit-title').textContent = `Edit Route — ${train.trainName}`;
    renderRouteEditRows(drawerRouteStops.length ? drawerRouteStops : [
        { stationName: train.source, stopOrder: 1, arrivalTime: '', departureTime: train.departureTime, haltMinutes: 0, distanceKm: 0 },
        { stationName: train.destination, stopOrder: 2, arrivalTime: train.arrivalTime, departureTime: '', haltMinutes: 0, distanceKm: null }
    ]);
    UI.openModal('routeEditModal');
}

function renderRouteEditRows(stops) {
    const body = document.getElementById('route-edit-body');
    body.innerHTML = `<div class="table-wrap"><table class="admin-table route-edit-table"><thead><tr>
        <th>#</th><th>Station</th><th>Arrival</th><th>Departure</th><th>Halt (min)</th><th>Distance (km)</th><th></th>
    </tr></thead><tbody id="route-edit-rows">${stops.map((stop, i) => routeEditRowHtml(stop, i + 1)).join('')}</tbody></table></div>`;
    body.querySelectorAll('[data-remove-stop]').forEach((btn) => {
        btn.addEventListener('click', () => {
            btn.closest('tr')?.remove();
            renumberRouteEditRows();
        });
    });
}

function routeEditRowHtml(stop, order) {
    return `<tr>
        <td class="route-order">${order}</td>
        <td><input type="text" class="form-control route-station" value="${UI.escapeHTML(stop.stationName || '')}" required></td>
        <td><input type="text" class="form-control route-arrival" value="${UI.escapeHTML(stop.arrivalTime || '')}" placeholder="HH:MM"></td>
        <td><input type="text" class="form-control route-departure" value="${UI.escapeHTML(stop.departureTime || '')}" placeholder="HH:MM"></td>
        <td><input type="number" class="form-control route-halt" value="${stop.haltMinutes ?? 0}" min="0"></td>
        <td><input type="number" class="form-control route-distance" value="${stop.distanceKm ?? ''}" min="0"></td>
        <td><button type="button" class="btn btn-ghost btn-sm" data-remove-stop aria-label="Remove"><i class="fas fa-times"></i></button></td>
    </tr>`;
}

function renumberRouteEditRows() {
    document.querySelectorAll('#route-edit-rows tr').forEach((row, i) => {
        row.querySelector('.route-order').textContent = i + 1;
    });
}

function addRouteEditStopRow() {
    const tbody = document.getElementById('route-edit-rows');
    const order = tbody.querySelectorAll('tr').length + 1;
    tbody.insertAdjacentHTML('beforeend', routeEditRowHtml({}, order));
    tbody.querySelector(`tr:last-child [data-remove-stop]`)?.addEventListener('click', (e) => {
        e.target.closest('tr')?.remove();
        renumberRouteEditRows();
    });
}

function collectRouteEditStops() {
    return [...document.querySelectorAll('#route-edit-rows tr')].map((row, i) => ({
        stationName: row.querySelector('.route-station')?.value.trim(),
        stopOrder: i + 1,
        arrivalTime: row.querySelector('.route-arrival')?.value.trim() || null,
        departureTime: row.querySelector('.route-departure')?.value.trim() || null,
        haltMinutes: parseInt(row.querySelector('.route-halt')?.value, 10) || 0,
        distanceKm: row.querySelector('.route-distance')?.value ? parseInt(row.querySelector('.route-distance').value, 10) : null
    })).filter((s) => s.stationName);
}

async function saveRouteEdit() {
    const stops = collectRouteEditStops();
    if (!stops.length) {
        UI.showToast('Add at least one stop', 'warning');
        return;
    }
    try {
        await API.put(`/admin/trains/${drawerTrainId}/stops`, { stops });
        UI.closeAllModals();
        UI.showToast('Route updated', 'success');
        openTrainDrawer(drawerTrainId);
        loadTrains();
    } catch (err) {
        UI.showToast(err.message, 'error');
    }
}

function openClassEditModal(cls) {
    document.getElementById('class-edit-id').value = cls.id;
    document.getElementById('class-edit-code').value = cls.classCode;
    document.getElementById('class-edit-name').value = cls.className;
    document.getElementById('class-edit-price').value = cls.price;
    document.getElementById('class-edit-total').value = cls.totalSeats;
    document.getElementById('class-edit-available').value = cls.availableSeats;
    document.getElementById('class-edit-error').textContent = '';
    UI.openModal('classEditModal');
}

async function saveClassEdit() {
    const classId = document.getElementById('class-edit-id').value;
    const payload = {
        className: document.getElementById('class-edit-name').value.trim(),
        price: parseFloat(document.getElementById('class-edit-price').value),
        totalSeats: parseInt(document.getElementById('class-edit-total').value, 10),
        availableSeats: parseInt(document.getElementById('class-edit-available').value, 10)
    };
    try {
        await API.put(`/admin/train-classes/${classId}`, payload);
        UI.closeAllModals();
        UI.showToast('Class updated', 'success');
        await loadTrains();
        if (drawerTrainId) openTrainDrawer(drawerTrainId);
    } catch (err) {
        document.getElementById('class-edit-error').textContent = err.message;
    }
}

function parseStationCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const stations = [];
    lines.forEach((line, index) => {
        const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        if (index === 0 && /^code$/i.test(parts[0])) return;
        if (parts.length < 4 || !parts[0]) return;
        stations.push({
            code: parts[0].toUpperCase(),
            name: parts[1],
            city: parts[2],
            state: parts[3]
        });
    });
    return stations;
}

function handleStationImportFile(e) {
    const file = e.target.files?.[0];
    const preview = document.getElementById('station-import-preview');
    const submitBtn = document.getElementById('station-import-submit');
    const errorEl = document.getElementById('station-import-error');
    errorEl.textContent = '';
    pendingStationImport = [];

    if (!file) {
        preview.innerHTML = '';
        submitBtn.disabled = true;
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        pendingStationImport = parseStationCSV(String(reader.result || ''));
        if (!pendingStationImport.length) {
            preview.innerHTML = '<p class="form-hint">No valid rows found.</p>';
            submitBtn.disabled = true;
            return;
        }
        preview.innerHTML = `<p><strong>${pendingStationImport.length}</strong> station(s) ready to import.</p>
            <div class="table-wrap" style="max-height:200px;overflow:auto;margin-top:8px">
            <table class="admin-table"><thead><tr><th>Code</th><th>Name</th><th>City</th><th>State</th></tr></thead>
            <tbody>${pendingStationImport.slice(0, 10).map((s) => `<tr><td>${UI.escapeHTML(s.code)}</td><td>${UI.escapeHTML(s.name)}</td><td>${UI.escapeHTML(s.city)}</td><td>${UI.escapeHTML(s.state)}</td></tr>`).join('')}
            ${pendingStationImport.length > 10 ? `<tr><td colspan="4">…and ${pendingStationImport.length - 10} more</td></tr>` : ''}
            </tbody></table></div>`;
        submitBtn.disabled = false;
    };
    reader.readAsText(file);
}

async function submitStationImport() {
    if (!pendingStationImport.length) return;
    const submitBtn = document.getElementById('station-import-submit');
    submitBtn.disabled = true;
    try {
        const result = await API.post('/admin/stations/import', { stations: pendingStationImport });
        UI.closeAllModals();
        UI.showToast(`Import complete: ${result.created || 0} added, ${result.skipped || 0} skipped`, 'success');
        pendingStationImport = [];
        loadStations();
    } catch (err) {
        document.getElementById('station-import-error').textContent = err.message;
        submitBtn.disabled = false;
    }
}

function exportReportCSV() {
    const rows = (reportData.revenue?.report || []).map((r) => ({
        Date: r.date,
        Revenue: r.revenue
    }));
    if (!rows.length) { UI.showToast('No report data to export', 'warning'); return; }
    UI.exportCSV('revenue-report.csv', rows, ['Date', 'Revenue']);
    UI.showToast('Report exported', 'success');
}
