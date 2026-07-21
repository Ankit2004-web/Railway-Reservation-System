let selectedSeats = [];

const BERTH_LABELS = {
    LB: 'Lower',
    MB: 'Middle',
    UB: 'Upper',
    SL: 'Side Lower',
    SU: 'Side Upper',
    WS: 'Seat'
};

function resetSeatSelection() {
    selectedSeats = [];
}

function getSelectedSeats() {
    return [...selectedSeats];
}

function renderSeatMap(seats, maxSelectable, onChange) {
    const container = document.getElementById('seat-map-container');
    if (!container) return;

    container.innerHTML = '';

    if (!seats.length) {
        container.innerHTML = '<p class="seat-map-empty">No seats available for this class.</p>';
        return;
    }

    const legend = document.createElement('div');
    legend.className = 'seat-legend';
    legend.innerHTML = `
        <span><i class="seat-box available"></i> Available</span>
        <span><i class="seat-box selected"></i> Selected</span>
        <span><i class="seat-box booked"></i> Booked</span>`;
    container.appendChild(legend);

    const grid = document.createElement('div');
    grid.className = 'seat-grid';

    seats.forEach((seat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `seat-box ${seat.status.toLowerCase()}`;
        btn.textContent = seat.seatNumber;
        btn.title = `${BERTH_LABELS[seat.berthType] || 'Seat'} ${seat.seatNumber}`;
        btn.dataset.seat = seat.seatNumber;

        if (seat.status !== 'Available') {
            btn.disabled = true;
        } else {
            btn.addEventListener('click', () => {
                const num = seat.seatNumber;
                const idx = selectedSeats.indexOf(num);

                if (idx >= 0) {
                    selectedSeats.splice(idx, 1);
                    btn.classList.remove('selected');
                    btn.classList.add('available');
                } else if (selectedSeats.length < maxSelectable) {
                    selectedSeats.push(num);
                    btn.classList.remove('available');
                    btn.classList.add('selected');
                } else if (typeof UI !== 'undefined') {
                    UI.showToast(`You can only select ${maxSelectable} seat(s)`, 'warning');
                }

                document.getElementById('selected-seats-display').textContent =
                    selectedSeats.length ? selectedSeats.sort((a, b) => a - b).join(', ') : 'None';

                if (onChange) onChange(selectedSeats);
            });
        }

        grid.appendChild(btn);
    });

    container.appendChild(grid);
    document.getElementById('selected-seats-display').textContent = 'None';
}

async function loadSeatMap(trainId, classCode, journeyDate, passengerCount) {
    const container = document.getElementById('seat-map-container');
    if (container) {
        container.innerHTML = '<div class="skeleton skeleton-card" style="height:120px"></div>';
    }

    resetSeatSelection();

    try {
        const data = await API.get(
            `/trains/${trainId}/seats?classCode=${encodeURIComponent(classCode)}&journeyDate=${encodeURIComponent(journeyDate)}`
        );
        const seats = (data.seats || []).map((seat) => ({
            ...seat,
            status: seat.status || (seat.isBooked ? 'Booked' : seat.isAvailable !== false ? 'Available' : 'Booked')
        }));
        const tatkalRadio = document.getElementById('booking-type-tatkal');
        if (tatkalRadio) {
            tatkalRadio.disabled = !data.tatkalEligible;
            document.getElementById('tatkal-hint').textContent = data.tatkalEligible
                ? 'Tatkal available (+30% fare)'
                : 'Tatkal only 1-2 days before journey';
        }

        renderSeatMap(seats, passengerCount);
        return { ...data, seats };
    } catch (error) {
        if (container) container.innerHTML = '<p class="error-message">Could not load seat map.</p>';
        return null;
    }
}
