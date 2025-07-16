// Global variables
let token = localStorage.getItem('token');
let currentUser = null;
let currentPage = 'home';

// API URLs
const API_URL = '/api';

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize application
    init();

    // Event Listeners
    setupEventListeners();
});

// Initialize application
function init() {
    // Set default page
    showPage('home');

    // Check if user is logged in
    if (token) {
        fetchCurrentUser();
    } else {
        updateAuthUI(false);
    }

    // Set today's date as the default in the date picker
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Fetch current user details
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'x-auth-token': token
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            updateAuthUI(true, currentUser.isAdmin);

            // Update profile page
            if (currentUser) {
                document.getElementById('profile-name').textContent = currentUser.name;
                document.getElementById('profile-email').textContent = currentUser.email;
                document.getElementById('profile-phone').textContent = currentUser.phone;
            }
        } else {
            // Token invalid or expired
            logout();
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        logout();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('#navbar a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.getAttribute('data-page');
            showPage(page);
        });
    });

    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('loginModal');
    });

    document.getElementById('registerBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('registerModal');
    });

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Switch between login and register
    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        closeAllModals();
        openModal('registerModal');
    });

    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        closeAllModals();
        openModal('loginModal');
    });

    // Search form
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        searchTrains();
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        login();
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        register();
    });

    // Booking form
    document.getElementById('booking-form').addEventListener('submit', (e) => {
        e.preventDefault();
        createBooking();
    });

    // Add passenger button
    document.getElementById('add-passenger').addEventListener('click', addPassengerField);

    // Admin tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.getAttribute('data-tab');
            showAdminTab(tab);
        });
    });

    // Add train button
    document.getElementById('add-train-btn').addEventListener('click', () => {
        // Implementation for adding a new train
        alert('Add train functionality would be implemented here');
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Show specific page
function showPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });

    // Show selected page
    const pageElement = document.getElementById(page);
    if (pageElement) {
        pageElement.classList.add('active');
    }

    // Update active link in navbar
    document.querySelectorAll('#navbar a').forEach(link => {
        link.classList.remove('active');
    });

    document.querySelector(`#navbar a[data-page="${page}"]`)?.classList.add('active');

    // Set current page
    currentPage = page;

    // Load page-specific data
    loadPageData(page);
}

// Load page-specific data
function loadPageData(page) {
    switch (page) {
        case 'trains':
            // If coming from search, trains will already be loaded
            // Otherwise, show all trains
            if (!document.getElementById('search-source').textContent) {
                fetchAllTrains();
            }
            break;
        case 'bookings':
            fetchUserBookings();
            break;
        case 'admin':
            if (currentUser?.isAdmin) {
                fetchAdminData('manage-trains');
            }
            break;
    }
}

// Show admin tab
function showAdminTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tab)?.classList.add('active');

    // Update active button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add('active');

    // Load tab data
    fetchAdminData(tab);
}

// Fetch admin data based on tab
async function fetchAdminData(tab) {
    if (!currentUser?.isAdmin) return;

    try {
        switch (tab) {
            case 'manage-trains':
                // Fetch all trains for admin
                const trainsResponse = await fetch(`${API_URL}/trains`, {
                    headers: {
                        'x-auth-token': token
                    }
                });

                if (trainsResponse.ok) {
                    const trains = await trainsResponse.json();
                    displayAdminTrains(trains);
                }
                break;

            case 'manage-bookings':
                // Fetch all bookings for admin
                const bookingsResponse = await fetch(`${API_URL}/bookings/all`, {
                    headers: {
                        'x-auth-token': token
                    }
                });

                if (bookingsResponse.ok) {
                    const bookings = await bookingsResponse.json();
                    displayAdminBookings(bookings);
                }
                break;

            // Implement users management if needed
        }
    } catch (error) {
        console.error(`Error fetching admin data for ${tab}:`, error);
    }
}

// Display admin trains
function displayAdminTrains(trains) {
    const trainsList = document.getElementById('admin-trains-list');
    trainsList.innerHTML = '';

    if (trains.length === 0) {
        trainsList.innerHTML = '<p>No trains available.</p>';
        return;
    }

    trains.forEach(train => {
        const trainCard = document.createElement('div');
        trainCard.className = 'train-card';

        const formattedDate = new Date(train.date).toLocaleDateString();

        trainCard.innerHTML = `
      <div class="train-info">
        <h3>${train.trainName} (${train.trainNumber})</h3>
        <div class="train-route">
          <p>${train.source}</p>
          <span><i class="fas fa-long-arrow-alt-right"></i></span>
          <p>${train.destination}</p>
        </div>
        <div class="train-details">
          <div class="train-detail">
            <p>Departure</p>
            <p>${train.departureTime}</p>
          </div>
          <div class="train-detail">
            <p>Arrival</p>
            <p>${train.arrivalTime}</p>
          </div>
          <div class="train-detail">
            <p>Date</p>
            <p>${formattedDate}</p>
          </div>
          <div class="train-detail">
            <p>Available Seats</p>
            <p>${train.availableSeats}</p>
          </div>
        </div>
      </div>
      <div class="admin-actions">
        <button class="btn btn-small edit-train" data-id="${train._id}">Edit</button>
        <button class="btn btn-small btn-danger delete-train" data-id="${train._id}">Delete</button>
      </div>
    `;

        trainsList.appendChild(trainCard);

        // Add event listeners for admin actions
        trainCard.querySelector('.edit-train').addEventListener('click', () => {
            // Implementation for editing a train
            alert(`Edit train ${train.trainNumber}`);
        });

        trainCard.querySelector('.delete-train').addEventListener('click', () => {
            // Implementation for deleting a train
            if (confirm(`Are you sure you want to delete train ${train.trainNumber}?`)) {
                deleteTrain(train._id);
            }
        });
    });
}

// Display admin bookings
function displayAdminBookings(bookings) {
    const bookingsList = document.getElementById('admin-bookings-list');
    bookingsList.innerHTML = '';

    if (bookings.length === 0) {
        bookingsList.innerHTML = '<p>No bookings available.</p>';
        return;
    }

    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-card';

        const train = booking.train;
        const user = booking.user;
        const journeyDate = new Date(booking.journeyDate).toLocaleDateString();
        const bookingDate = new Date(booking.bookingDate).toLocaleDateString();

        bookingCard.innerHTML = `
      <div class="booking-header">
        <div class="booking-pnr">PNR: ${booking.pnrNumber}</div>
        <div class="booking-status ${booking.status.toLowerCase()}">${booking.status}</div>
      </div>
      <div class="booking-train-details">
        <p><strong>Train:</strong> ${train.trainName} (${train.trainNumber})</p>
        <p><strong>Route:</strong> ${train.source} to ${train.destination}</p>
        <p><strong>Journey Date:</strong> ${journeyDate}</p>
        <p><strong>Departure:</strong> ${train.departureTime}</p>
      </div>
      <div class="booking-user">
        <p><strong>Booked By:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phone:</strong> ${user.phone}</p>
        <p><strong>Booking Date:</strong> ${bookingDate}</p>
      </div>
      <div class="booking-passengers">
        <p><strong>Passengers:</strong> ${booking.passengers.length}</p>
        <div class="passenger-list">
          ${booking.passengers.map(passenger => `
            <div class="passenger-item">
              <p><strong>Name:</strong> ${passenger.name}</p>
              <p><strong>Age:</strong> ${passenger.age}</p>
              <p><strong>Gender:</strong> ${passenger.gender}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="booking-summary">
        <p><strong>Total Price:</strong> ₹${booking.totalPrice}</p>
        <p><strong>Seat Numbers:</strong> ${booking.seatNumbers.join(', ')}</p>
      </div>
    `;

        bookingsList.appendChild(bookingCard);
    });
}

// Search trains
async function searchTrains() {
    const source = document.getElementById('source').value;
    const destination = document.getElementById('destination').value;
    const date = document.getElementById('date').value;

    if (!source || !destination || !date) {
        alert('Please fill in all search fields');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/trains/search?source=${source}&destination=${destination}&date=${date}`);

        if (response.ok) {
            const trains = await response.json();

            // Show trains page and display results
            showPage('trains');

            // Update search summary
            document.getElementById('search-source').textContent = source;
            document.getElementById('search-destination').textContent = destination;
            document.getElementById('search-date').textContent = new Date(date).toLocaleDateString();

            displayTrains(trains);
        } else {
            alert('Error searching for trains');
        }
    } catch (error) {
        console.error('Error searching trains:', error);
        alert('Error searching for trains');
    }
}

// Fetch all trains
async function fetchAllTrains() {
    try {
        const response = await fetch(`${API_URL}/trains`);

        if (response.ok) {
            const trains = await response.json();
            displayTrains(trains);
        } else {
            alert('Error fetching trains');
        }
    } catch (error) {
        console.error('Error fetching trains:', error);
        alert('Error fetching trains');
    }
}

// Display trains
function displayTrains(trains) {
    const trainsList = document.getElementById('trains-list');
    trainsList.innerHTML = '';

    if (trains.length === 0) {
        trainsList.innerHTML = '<p>No trains found for your search criteria.</p>';
        return;
    }

    trains.forEach(train => {
        const trainCard = document.createElement('div');
        trainCard.className = 'train-card';

        const formattedDate = new Date(train.date).toLocaleDateString();

        trainCard.innerHTML = `
      <div class="train-info">
        <h3>${train.trainName} (${train.trainNumber})</h3>
        <div class="train-route">
          <p>${train.source}</p>
          <span><i class="fas fa-long-arrow-alt-right"></i></span>
          <p>${train.destination}</p>
        </div>
        <div class="train-details">
          <div class="train-detail">
            <p>Departure</p>
            <p>${train.departureTime}</p>
          </div>
          <div class="train-detail">
            <p>Arrival</p>
            <p>${train.arrivalTime}</p>
          </div>
          <div class="train-detail">
            <p>Duration</p>
            <p>${train.duration}</p>
          </div>
          <div class="train-detail">
            <p>Date</p>
            <p>${formattedDate}</p>
          </div>
        </div>
      </div>
      <div class="train-price">
        <p>₹${train.price}</p>
        <p>Available: ${train.availableSeats}</p>
        <button class="btn book-btn" data-id="${train._id}" data-price="${train.price}" data-date="${train.date}">Book Now</button>
      </div>
    `;

        trainsList.appendChild(trainCard);

        // Add event listener for book button
        trainCard.querySelector('.book-btn').addEventListener('click', (e) => {
            if (!token) {
                alert('Please login to book tickets');
                openModal('loginModal');
                return;
            }

            const trainId = e.target.getAttribute('data-id');
            const price = e.target.getAttribute('data-price');
            const journeyDate = e.target.getAttribute('data-date');

            openBookingModal(trainId, price, journeyDate, train);
        });
    });
}

// Open booking modal
function openBookingModal(trainId, price, journeyDate, train) {
    // Set train details
    document.getElementById('booking-train-id').value = trainId;
    document.getElementById('booking-journey-date').value = journeyDate;
    document.getElementById('price-per-ticket').textContent = price;
    document.getElementById('total-price').textContent = price; // Initial price for 1 passenger

    // Reset passenger fields
    document.getElementById('passengers-container').innerHTML = `
    <div class="passenger-details">
      <div class="form-group">
        <label>Passenger Name</label>
        <input type="text" class="passenger-name" required>
      </div>
      <div class="form-group">
        <label>Age</label>
        <input type="number" class="passenger-age" min="1" max="120" required>
      </div>
      <div class="form-group">
        <label>Gender</label>
        <select class="passenger-gender" required>
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>
  `;

    // Reset passenger count
    document.getElementById('passenger-count').textContent = "1";

    // Display train details
    const formattedDate = new Date(train.date).toLocaleDateString();
    document.getElementById('booking-train-details').innerHTML = `
    <h3>${train.trainName} (${train.trainNumber})</h3>
    <p><strong>Route:</strong> ${train.source} to ${train.destination}</p>
    <p><strong>Date:</strong> ${formattedDate}</p>
    <p><strong>Departure:</strong> ${train.departureTime}</p>
    <p><strong>Arrival:</strong> ${train.arrivalTime}</p>
    <p><strong>Available Seats:</strong> ${train.availableSeats}</p>
  `;

    // Open modal
    openModal('bookingModal');
}

// Add passenger field
function addPassengerField() {
    const passengersContainer = document.getElementById('passengers-container');
    const passengerCount = passengersContainer.querySelectorAll('.passenger-details').length;

    // Check if adding more passengers is possible (limit to available seats)
    const availableSeatsText = document.getElementById('booking-train-details').querySelector('p:last-child').textContent;
    const availableSeats = parseInt(availableSeatsText.match(/\d+/)[0]);

    if (passengerCount >= availableSeats) {
        alert('Cannot add more passengers than available seats');
        return;
    }

    const newPassenger = document.createElement('div');
    newPassenger.className = 'passenger-details';
    newPassenger.innerHTML = `
    <div class="form-group">
      <label>Passenger Name</label>
      <input type="text" class="passenger-name" required>
    </div>
    <div class="form-group">
      <label>Age</label>
      <input type="number" class="passenger-age" min="1" max="120" required>
    </div>
    <div class="form-group">
      <label>Gender</label>
      <select class="passenger-gender" required>
        <option value="">Select</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <button type="button" class="btn btn-small remove-passenger">Remove</button>
  `;

    passengersContainer.appendChild(newPassenger);

    // Update passenger count
    const newCount = passengerCount + 1;
    document.getElementById('passenger-count').textContent = newCount;

    // Update total price
    const pricePerTicket = parseInt(document.getElementById('price-per-ticket').textContent);
    const totalPrice = pricePerTicket * newCount;
    document.getElementById('total-price').textContent = totalPrice;

    // Add event listener for remove button
    newPassenger.querySelector('.remove-passenger').addEventListener('click', function () {
        this.parentElement.remove();

        // Update passenger count
        const updatedCount = document.getElementById('passengers-container').querySelectorAll('.passenger-details').length;
        document.getElementById('passenger-count').textContent = updatedCount;

        // Update total price
        const updatedTotalPrice = pricePerTicket * updatedCount;
        document.getElementById('total-price').textContent = updatedTotalPrice;
    });
}

// Create booking
async function createBooking() {
    if (!token) {
        alert('Please login to book tickets');
        closeAllModals();
        openModal('loginModal');
        return;
    }

    const trainId = document.getElementById('booking-train-id').value;
    const journeyDate = document.getElementById('booking-journey-date').value;
    const passengerElements = document.querySelectorAll('.passenger-details');

    // Collect passenger details
    const passengers = [];
    passengerElements.forEach(elem => {
        const name = elem.querySelector('.passenger-name').value;
        const age = elem.querySelector('.passenger-age').value;
        const gender = elem.querySelector('.passenger-gender').value;

        if (name && age && gender) {
            passengers.push({
                name,
                age: parseInt(age),
                gender
            });
        }
    });

    if (passengers.length === 0) {
        document.getElementById('booking-error').textContent = 'Please add at least one passenger';
        return;
    }

    // Create booking object
    const bookingData = {
        trainId,
        passengers,
        journeyDate
    };

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Booking successful! Your PNR number is: ' + data.pnrNumber);
            closeAllModals();
            showPage('bookings');
            fetchUserBookings(); // Refresh bookings list
        } else {
            document.getElementById('booking-error').textContent = data.msg || 'Error creating booking';
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        document.getElementById('booking-error').textContent = 'Network error. Please try again.';
    }
}

// Fetch user bookings
async function fetchUserBookings() {
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            headers: {
                'x-auth-token': token
            }
        });

        if (response.ok) {
            const bookings = await response.json();
            displayUserBookings(bookings);
        } else {
            document.getElementById('bookings-list').innerHTML = '<p>Error fetching bookings</p>';
        }
    } catch (error) {
        console.error('Error fetching bookings:', error);
        document.getElementById('bookings-list').innerHTML = '<p>Error fetching bookings</p>';
    }
}

// Display user bookings
function displayUserBookings(bookings) {
    const bookingsList = document.getElementById('bookings-list');
    bookingsList.innerHTML = '';

    if (bookings.length === 0) {
        bookingsList.innerHTML = '<p>You have no bookings yet.</p>';
        return;
    }

    bookings.forEach(booking => {
        const bookingCard = document.createElement('div');
        bookingCard.className = 'booking-card';

        const train = booking.train;
        const journeyDate = new Date(booking.journeyDate).toLocaleDateString();

        bookingCard.innerHTML = `
      <div class="booking-header">
        <div class="booking-pnr">PNR: ${booking.pnrNumber}</div>
        <div class="booking-status ${booking.status.toLowerCase()}">${booking.status}</div>
      </div>
      <div class="booking-train-details">
        <p><strong>Train:</strong> ${train.trainName} (${train.trainNumber})</p>
        <p><strong>Route:</strong> ${train.source} to ${train.destination}</p>
        <p><strong>Journey Date:</strong> ${journeyDate}</p>
        <p><strong>Departure:</strong> ${train.departureTime}</p>
      </div>
      <div class="booking-passengers">
        <p><strong>Passengers:</strong> ${booking.passengers.length}</p>
        <div class="passenger-list">
          ${booking.passengers.map(passenger => `
            <div class="passenger-item">
              <p><strong>Name:</strong> ${passenger.name}</p>
              <p><strong>Age:</strong> ${passenger.age}</p>
              <p><strong>Gender:</strong> ${passenger.gender}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="booking-summary">
        <p><strong>Total Price:</strong> ₹${booking.totalPrice}</p>
        <p><strong>Seat Numbers:</strong> ${booking.seatNumbers.join(', ')}</p>
      </div>
      ${booking.status === 'Confirmed' ? `
        <button class="btn btn-cancel" data-id="${booking._id}">Cancel Booking</button>
      ` : ''}
    `;

        bookingsList.appendChild(bookingCard);

        // Add event listener for cancel button
        if (booking.status === 'Confirmed') {
            bookingCard.querySelector('.btn-cancel').addEventListener('click', () => {
                if (confirm('Are you sure you want to cancel this booking?')) {
                    cancelBooking(booking._id);
                }
            });
        }
    });
}

// Cancel booking
async function cancelBooking(bookingId) {
    try {
        const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ status: 'Cancelled' })
        });

        if (response.ok) {
            alert('Booking cancelled successfully');
            fetchUserBookings();
        } else {
            alert('Error cancelling booking');
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Error cancelling booking');
    }
}

// Delete train (admin only)
async function deleteTrain(trainId) {
    try {
        const response = await fetch(`${API_URL}/trains/${trainId}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });

        if (response.ok) {
            alert('Train deleted successfully');
            fetchAdminData('manage-trains');
        } else {
            alert('Error deleting train');
        }
    } catch (error) {
        console.error('Error deleting train:', error);
        alert('Error deleting train');
    }
}

// Login
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            token = data.token;

            // Save token to localStorage
            localStorage.setItem('token', token);

            // Fetch user data
            await fetchCurrentUser();

            // Close modal
            closeAllModals();

            // Refresh current page data
            loadPageData(currentPage);
        } else {
            const error = await response.json();
            document.getElementById('login-error').textContent = error.msg || 'Invalid credentials';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('login-error').textContent = 'Error logging in';
    }
}

// Register
async function register() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, phone, password })
        });

        if (response.ok) {
            const data = await response.json();
            token = data.token;

            // Save token to localStorage
            localStorage.setItem('token', token);

            // Fetch user data
            await fetchCurrentUser();

            // Close modal
            closeAllModals();

            // Show home page
            showPage('home');
        } else {
            const error = await response.json();
            document.getElementById('register-error').textContent = error.msg || 'Error registering';
        }
    } catch (error) {
        console.error('Register error:', error);
        document.getElementById('register-error').textContent = 'Error registering';
    }
}

// Logout
function logout() {
    // Clear token and user data
    token = null;
    currentUser = null;
    localStorage.removeItem('token');

    // Update UI
    updateAuthUI(false);

    // Show home page
    showPage('home');
}

// Update auth UI based on login status
function updateAuthUI(isLoggedIn, isAdmin = false) {
    if (isLoggedIn) {
        // Show elements for logged in users
        document.querySelectorAll('.auth-required').forEach(elem => {
            elem.style.display = 'block';
        });
        document.querySelectorAll('.auth-not-required').forEach(elem => {
            elem.style.display = 'none';
        });

        // Show admin elements if user is admin
        if (isAdmin) {
            document.querySelectorAll('.admin-only').forEach(elem => {
                elem.style.display = 'block';
            });
        } else {
            document.querySelectorAll('.admin-only').forEach(elem => {
                elem.style.display = 'none';
            });
        }
    } else {
        // Show elements for guests
        document.querySelectorAll('.auth-required').forEach(elem => {
            elem.style.display = 'none';
        });
        document.querySelectorAll('.auth-not-required').forEach(elem => {
            elem.style.display = 'block';
        });
        document.querySelectorAll('.admin-only').forEach(elem => {
            elem.style.display = 'none';
        });
    }
}

// Open modal
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';

    // Clear error messages
    document.querySelectorAll('.error-message').forEach(elem => {
        elem.textContent = '';
    });
}

// Close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
} 