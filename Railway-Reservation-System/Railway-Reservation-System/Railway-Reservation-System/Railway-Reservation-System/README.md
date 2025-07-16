# Railway Reservation System

A complete Railway Reservation System with Node.js, Express, MongoDB, and vanilla JavaScript frontend.

## Features

- User authentication (login/register)
- Search for trains by source, destination, and date
- Book train tickets for multiple passengers
- View and manage bookings
- Cancel bookings
- Admin panel for managing trains and bookings

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)

## Project Structure

```
├── models/            # MongoDB models
│   ├── User.js        # User model
│   ├── Train.js       # Train model
│   └── Booking.js     # Booking model
├── routes/            # API routes
│   ├── auth.js        # Authentication routes
│   ├── trains.js      # Train routes
│   └── bookings.js    # Booking routes
├── middleware/        # Custom middleware
│   └── auth.js        # Authentication middleware
├── public/            # Frontend files
│   ├── css/           # CSS files
│   │   └── style.css  # Main stylesheet
│   ├── js/            # JavaScript files
│   │   └── app.js     # Main JavaScript file
│   └── index.html     # Main HTML file
├── .env.example       # Example environment variables
├── package.json       # Project dependencies
└── server.js          # Express server
```

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the `.env.example` file:
   ```
   MONGODB_URI=your_mongodb_uri_here
   JWT_SECRET=your_jwt_secret_here
   PORT=5000
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info (requires auth)

### Trains

- `GET /api/trains` - Get all trains
- `GET /api/trains/search` - Search trains by source, destination, and date
- `GET /api/trains/:id` - Get train by ID
- `POST /api/trains` - Add a new train (admin only)
- `PUT /api/trains/:id` - Update a train (admin only)
- `DELETE /api/trains/:id` - Delete a train (admin only)

### Bookings

- `GET /api/bookings` - Get all bookings for current user
- `GET /api/bookings/all` - Get all bookings (admin only)
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create a new booking
- `PUT /api/bookings/:id` - Update booking status (cancel booking)

## License

MIT 