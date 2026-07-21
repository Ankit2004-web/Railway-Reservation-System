/** Train search, filters, autocomplete, and results */
function isTrainTatkalEligible(train) {
    if (!train?.date) return false;
    const journey = new Date(`${train.date}T00:00:00`);
    const days = (journey - new Date()) / 86400000;
    return days >= 0 && days <= 2;
}

function setupFilters() {
    const depContainer = document.getElementById('filter-departure');
    const availContainer = document.getElementById('filter-availability');
    if (depContainer) {
        ['Morning (06-12)', 'Afternoon (12-18)', 'Evening (18-24)', 'Night (00-06)'].forEach((label, i) => {
            depContainer.innerHTML += `<label><input type="checkbox" class="filter-dep" value="${i}"> ${label}</label>`;
        });
    }
    if (availContainer) {
        ['Available', 'Waitlist', 'RAC'].forEach((label) => {
            availContainer.innerHTML += `<label><input type="checkbox" class="filter-avail" value="${label.toLowerCase()}"> ${label}</label>`;
        });
    }

    const classContainer = document.getElementById('filter-class');
    if (classContainer) {
        ['SL', '3A', '2A', '1A', '2S', 'CC'].forEach((code) => {
            classContainer.innerHTML += `<label><input type="checkbox" class="filter-class-cb" value="${code}"> ${code}</label>`;
        });
    }

    const typeContainer = document.getElementById('filter-train-type');
    if (typeContainer) {
        ['Premium', 'Express'].forEach((type) => {
            typeContainer.innerHTML += `<label><input type="checkbox" class="filter-train-type-cb" value="${type}"> ${type}</label>`;
        });
    }

    document.getElementById('sort-trains')?.addEventListener('change', () => applyTrainFilters());
    document.querySelectorAll('.filter-dep, .filter-avail, .filter-class-cb, .filter-train-type-cb').forEach((el) => {
        el.addEventListener('change', () => applyTrainFilters());
    });
    document.getElementById('reset-filters-btn')?.addEventListener('click', resetTrainFilters);

    document.getElementById('mobile-filter-btn')?.addEventListener('click', () => {
        document.getElementById('results-sidebar')?.classList.add('is-open');
        document.getElementById('filter-overlay')?.classList.add('is-open');
    });
    document.getElementById('close-filter-btn')?.addEventListener('click', closeFilterDrawer);
    document.getElementById('filter-overlay')?.addEventListener('click', closeFilterDrawer);
    document.getElementById('edit-search-btn')?.addEventListener('click', () => showPage('home'));
}

function resetTrainFilters() {
    document.querySelectorAll('.filter-dep, .filter-avail, .filter-class-cb, .filter-train-type-cb').forEach((cb) => {
        cb.checked = false;
    });
    const sort = document.getElementById('sort-trains');
    if (sort) sort.value = 'departure';
    applyTrainFilters();
    UI.showToast('Filters reset', 'info');
}

function closeFilterDrawer() {
    document.getElementById('results-sidebar')?.classList.remove('is-open');
    document.getElementById('filter-overlay')?.classList.remove('is-open');
}


function setupStationAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    let debounceTimer = null;
    let selectedIndex = -1;

    const hide = () => { list.classList.remove('active'); list.innerHTML = ''; selectedIndex = -1; };

    const selectStation = (station) => { input.value = station.name; hide(); };

    const render = (stations) => {
        list.innerHTML = '';
        selectedIndex = -1;
        if (!stations.length) { hide(); return; }
        stations.forEach((station, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `<strong>${UI.escapeHTML(station.name)}</strong><span class="station-code">${UI.escapeHTML(station.code)}</span><span>${UI.escapeHTML(station.city)}</span>`;
            item.addEventListener('mousedown', (e) => { e.preventDefault(); selectStation(station); });
            list.appendChild(item);
        });
        list.classList.add('active');
    };

    input.addEventListener('input', () => {
        const query = input.value.trim();
        clearTimeout(debounceTimer);
        if (query.length < 2) { hide(); return; }
        debounceTimer = setTimeout(async () => {
            try {
                const stations = await API.get(`/stations/search?q=${encodeURIComponent(query)}`);
                render(stations);
            } catch (err) { console.error(err); }
        }, 250);
    });

    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); }
        else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); items[selectedIndex].dispatchEvent(new Event('mousedown')); return; }
        else if (e.key === 'Escape') { hide(); return; }
        else return;
        items.forEach((item, i) => item.classList.toggle('selected', i === selectedIndex));
    });

    input.addEventListener('blur', () => setTimeout(hide, 150));
}


async function searchTrains() {
    const source = document.getElementById('source').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const date = document.getElementById('date').value;
    preferredQuota = document.getElementById('search-quota')?.value || 'General';

    if (!source || !destination || !date) {
        UI.showToast('Please fill in all search fields', 'warning');
        return;
    }

    saveRecentSearch(source, destination, date);

    const list = document.getElementById('trains-list');
    UI.renderSkeleton(list, 'train', 4);

    const searchClass = document.getElementById('search-class')?.value || '';
    if (searchClass) {
        document.querySelectorAll('.filter-class-cb').forEach((cb) => {
            cb.checked = cb.value === searchClass;
        });
    }

    try {
        const trains = await API.get(`/trains/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&date=${date}`);
        allTrainsCache = trains;
        showPage('trains');
        document.getElementById('search-source').textContent = source;
        document.getElementById('search-destination').textContent = destination;
        document.getElementById('search-date').textContent = UI.formatDate(date);
        document.getElementById('search-result-count').textContent = `${trains.length} train${trains.length !== 1 ? 's' : ''}`;
        document.getElementById('search-summary-bar').style.display = 'flex';
        applyTrainFilters();
    } catch {
        UI.renderErrorState(list, 'Error searching for trains. Please try again.', searchTrains);
    }
}

async function fetchAllTrains() {
    const list = document.getElementById('trains-list');
    list.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Search trains between stations</h3>
            <p class="form-hint">Enter source, destination, and journey date on the home page to search ${typeof allTrainsCache !== 'undefined' ? '5,000+' : ''} imported trains.</p>
            <button type="button" class="btn btn-primary btn-sm" onclick="showPage('home')">Go to Search</button>
        </div>`;
}

function parseHour(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) || 0;
}

function getDepartureSlot(hour) {
    if (hour >= 6 && hour < 12) return 0;
    if (hour >= 12 && hour < 18) return 1;
    if (hour >= 18) return 2;
    return 3;
}

function applyTrainFilters() {
    let trains = [...allTrainsCache];
    const depFilters = [...document.querySelectorAll('.filter-dep:checked')].map((c) => Number(c.value));
    const availFilters = [...document.querySelectorAll('.filter-avail:checked')].map((c) => c.value);
    const classFilters = [...document.querySelectorAll('.filter-class-cb:checked')].map((c) => c.value);
    const typeFilters = [...document.querySelectorAll('.filter-train-type-cb:checked')].map((c) => c.value);

    if (depFilters.length) {
        trains = trains.filter((t) => depFilters.includes(getDepartureSlot(parseHour(t.departureTime))));
    }
    if (classFilters.length) {
        trains = trains.filter((t) => (t.classes || []).some((c) => classFilters.includes(c.classCode)));
    }
    if (typeFilters.length) {
        trains = trains.filter((t) => typeFilters.includes(t.trainType || 'Express'));
    }
    if (availFilters.length) {
        trains = trains.filter((t) => {
            const classList = t.classes || [];
            const hasSeats = (t.availableSeats || 0) > 0 || classList.some((c) => c.availableSeats > 0);
            const anyFull = classList.some((c) => c.availableSeats === 0);
            if (availFilters.includes('available') && hasSeats) return true;
            if (availFilters.includes('waitlist') && anyFull) return true;
            if (availFilters.includes('rac') && anyFull) return true;
            return false;
        });
    }

    const sort = document.getElementById('sort-trains')?.value || 'departure';
    trains.sort((a, b) => {
        if (sort === 'fare') return (a.lowestPrice || a.price) - (b.lowestPrice || b.price);
        if (sort === 'duration') return (a.duration || '').localeCompare(b.duration || '');
        if (sort === 'arrival') return (a.arrivalTime || '').localeCompare(b.arrivalTime || '');
        return (a.departureTime || '').localeCompare(b.departureTime || '');
    });

    displayTrains(trains);
}

function promptGuestAuth(intent) {
    pendingBookingIntent = intent;
    sessionStorage.setItem('pendingBookingIntent', JSON.stringify(intent));
    const summary = document.getElementById('auth-required-summary');
    if (summary && intent?.train) {
        const train = intent.train;
        summary.innerHTML = `
            <div class="auth-required-trip card card-body">
                <strong>${UI.escapeHTML(train.trainName || 'Train')} (${UI.escapeHTML(train.trainNumber || '')})</strong>
                <p class="form-hint">${UI.escapeHTML(train.source || '')} → ${UI.escapeHTML(train.destination || '')}</p>
                <p class="form-hint">${UI.formatDate(intent.date || train.date || document.getElementById('date')?.value)}${intent.classCode ? ` · Class ${UI.escapeHTML(intent.classCode)}` : ''}${intent.quota ? ` · ${UI.escapeHTML(intent.quota)}` : ''}</p>
            </div>`;
        summary.style.display = 'block';
    } else if (summary) {
        summary.innerHTML = '';
        summary.style.display = 'none';
    }
    UI.openModal('authRequiredModal');
}

function buildBookingIntent(train, classCode = '') {
    return {
        trainId: getId(train),
        train,
        date: train.date || document.getElementById('date')?.value,
        classCode,
        quota: preferredQuota,
        returnPage: currentPage === 'trains' ? 'trains' : 'trains'
    };
}

function displayTrains(trains) {
    const list = document.getElementById('trains-list');
    if (!trains.length) {
        UI.renderEmptyState(list, {
            icon: 'fa-train',
            title: 'No trains found',
            message: 'No trains match your search criteria. Try different stations or dates.',
            ctaText: 'Modify Search',
            ctaAction: () => showPage('home')
        });
        return;
    }

    list.innerHTML = trains.map((train) => {
        const trainId = getId(train);
        const classes = train.classes && train.classes.length ? train.classes : [];
        const classBlocks = classes.map((cls) => {
            const avail = cls.availableSeats;
            const availClass = avail > 0 ? 'avail-available' : 'avail-waitlist';
            const availText = avail > 0 ? `AVAILABLE ${avail}` : 'WL/RAC';
            return `<div class="class-option" data-class="${cls.classCode}" data-train="${trainId}">
                <div class="class-code">${UI.escapeHTML(cls.classCode)}</div>
                <div class="class-name">${UI.escapeHTML(cls.className || '')}</div>
                <div class="class-fare">${UI.formatCurrency(cls.price)}</div>
                <div class="class-avail ${availClass}">${availText}</div>
            </div>`;
        }).join('');

        return `<article class="train-result-card" data-id="${trainId}">
            <div class="train-result-main">
                <div>
                    <div class="train-result-header">
                        <span class="train-number">${UI.escapeHTML(train.trainNumber)}</span>
                        <span class="train-name">${UI.escapeHTML(train.trainName)}</span>
                        ${train.trainType === 'Premium' ? '<span class="badge badge-premium">Premium</span>' : ''}
                        ${isTrainTatkalEligible(train) ? '<span class="badge badge-tatkal tatkal-badge">Tatkal</span>' : ''}
                        ${train.runningDays ? `<span class="train-running">${UI.escapeHTML(train.runningDays)}</span>` : ''}
                    </div>
                    <div class="train-timeline">
                        <div class="train-time-block">
                            <div class="time tabular-nums">${UI.escapeHTML(train.departureTime)}</div>
                            <div class="station">${UI.escapeHTML(train.source)}</div>
                        </div>
                        <div class="train-duration-line"><span>${UI.escapeHTML(train.duration || '')}</span></div>
                        <div class="train-time-block">
                            <div class="time tabular-nums">${UI.escapeHTML(train.arrivalTime)}</div>
                            <div class="station">${UI.escapeHTML(train.destination)}</div>
                        </div>
                    </div>
                </div>
                <div class="train-result-actions">
                    <button type="button" class="btn btn-outline btn-sm route-btn" data-id="${trainId}"><i class="fas fa-route"></i> Route</button>
                    <button type="button" class="btn btn-primary btn-sm book-btn" data-id="${trainId}"><i class="fas fa-ticket-alt"></i> Book</button>
                </div>
            </div>
            <div class="class-options">${classBlocks || `<span class="form-hint">From ${UI.formatCurrency(train.lowestPrice || train.price)}</span>`}</div>
        </article>`;
    }).join('');

    list.querySelectorAll('.book-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const train = trains.find((t) => getId(t) === Number(btn.dataset.id));
            if (!train) return;
            if (!token) { promptGuestAuth(buildBookingIntent(train)); return; }
            openBookingModal(getId(train), train);
        });
    });

    list.querySelectorAll('.class-option').forEach((block) => {
        block.addEventListener('click', () => {
            const train = trains.find((t) => getId(t) === Number(block.dataset.train));
            if (!train) return;
            if (!token) { promptGuestAuth(buildBookingIntent(train, block.dataset.class)); return; }
            openBookingModal(getId(train), train);
            setTimeout(() => {
                const sel = document.getElementById('booking-class-select');
                if (sel) { sel.value = block.dataset.class; updateBookingPrice(); }
            }, 100);
        });
    });

    list.querySelectorAll('.route-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const train = trains.find((t) => getId(t) === Number(btn.dataset.id));
            viewTrainRoute(Number(btn.dataset.id), train?.trainName || 'Train');
        });
    });
}

async function viewTrainRoute(trainId, trainName) {
    try {
        const data = await API.get(`/trains/${trainId}/route`);
        document.getElementById('route-modal-title').textContent = `Route — ${trainName}`;
        const container = document.getElementById('route-stops-list');
        if (!data.stops?.length) {
            container.innerHTML = '<p class="form-hint">No route information available.</p>';
        } else {
            container.innerHTML = `<div class="route-timeline">${data.stops.map((stop, i) => {
                const cls = stop.isSource || i === 0 ? 'origin' : (stop.isDestination || i === data.stops.length - 1 ? 'destination' : '');
                const arr = stop.arrival || stop.arrivalTime || '—';
                const dep = stop.departure || stop.departureTime || '—';
                const day = (stop.departureDayOffset ?? stop.arrivalDayOffset ?? 0) + 1;
                return `<div class="route-stop ${cls}">
                    <div class="route-stop-header">
                        <span class="route-stop-code">${UI.escapeHTML(stop.stationCode || '')}</span>
                        <strong>${UI.escapeHTML(stop.stationName)}</strong>
                    </div>
                    <div class="route-stop-times">
                        Arr: ${UI.escapeHTML(arr)} | Dep: ${UI.escapeHTML(dep)} |
                        Day: ${day} | Halt: ${stop.haltMinutes != null ? stop.haltMinutes + ' min' : '—'} |
                        Dist: ${stop.distanceKm != null ? stop.distanceKm + ' km' : '—'} |
                        Platform: ${stop.platform ? UI.escapeHTML(stop.platform) : '—'}
                    </div>
                </div>`;
            }).join('')}</div>`;
        }
        UI.openModal('routeModal');
    } catch (err) {
        UI.showToast(err.message || 'Error loading route', 'error');
    }
}
