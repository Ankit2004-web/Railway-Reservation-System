const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const isEmailConfigured = () => Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const getTransporter = () => nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
    if (!isEmailConfigured()) {
        return { sent: false, devMode: true };
    }

    const transporter = getTransporter();
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Railway Reservation - Password Reset',
        html: `
            <p>You requested a password reset.</p>
            <p><a href="${resetUrl}">Reset your password</a></p>
            <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        `
    });

    logger.info('Password reset email sent', { to });
    return { sent: true, devMode: false };
};

const sendBookingConfirmationEmail = async ({ to, booking, ticketUrl }) => {
    const train = booking.train || {};
    const subject = `Booking Confirmed — PNR ${booking.pnrNumber}`;
    const html = `
        <h2>Your train booking is confirmed</h2>
        <p><strong>PNR:</strong> ${booking.pnrNumber}</p>
        <p><strong>Train:</strong> ${train.trainName} (${train.trainNumber})</p>
        <p><strong>Route:</strong> ${train.source} → ${train.destination}</p>
        <p><strong>Journey Date:</strong> ${new Date(booking.journeyDate).toLocaleDateString('en-IN')}</p>
        <p><strong>Class:</strong> ${booking.classCode || '-'}</p>
        <p><strong>Total Fare:</strong> ₹${booking.totalPrice}</p>
        <p>Download your e-ticket from My Bookings after logging in.</p>
    `;

    if (!isEmailConfigured()) {
        logger.info('Booking confirmation (dev mode)', { to, pnr: booking.pnrNumber });
        return { sent: false, devMode: true };
    }

    const transporter = getTransporter();
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html
    });

    logger.info('Booking confirmation email sent', { to, pnr: booking.pnrNumber });
    return { sent: true, devMode: false };
};

module.exports = {
    isEmailConfigured,
    sendPasswordResetEmail,
    sendBookingConfirmationEmail
};
