const PDFDocument = require('pdfkit');

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const generateTicketPdf = (booking) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const train = booking.train || {};

    doc.fontSize(20).fillColor('#0056b3').text('Railway Reservation System', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#333').text('E-Ticket / Journey Confirmation', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#000');
    doc.text(`PNR: ${booking.pnrNumber}`, { continued: true });
    doc.text(`   Status: ${booking.status}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.text(`Booking Date: ${formatDate(booking.bookingDate)}`);
    doc.text(`Journey Date: ${formatDate(booking.journeyDate)}`);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#0056b3').text('Train Details');
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#000');
    doc.text(`Train: ${train.trainName || '-'} (${train.trainNumber || '-'})`);
    doc.text(`Route: ${train.source || '-'} → ${train.destination || '-'}`);
    doc.text(`Departure: ${train.departureTime || '-'}   Arrival: ${train.arrivalTime || '-'}`);
    doc.text(`Class: ${booking.classCode || '-'} ${booking.className ? `(${booking.className})` : ''}`);
    doc.text(`Booking Type: ${booking.bookingType || 'General'}`);
    doc.text(`Seats: ${(booking.seatNumbers || []).join(', ') || 'Waitlisted'}`);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#0056b3').text('Passenger Details');
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#000');
    (booking.passengers || []).forEach((passenger, index) => {
        doc.text(`${index + 1}. ${passenger.name} | Age: ${passenger.age} | Gender: ${passenger.gender}`);
    });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#0056b3').text('Fare Details');
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#000');
    doc.text(`Total Fare: ₹${Number(booking.totalPrice || 0).toLocaleString('en-IN')}`);
    doc.text(`Payment Status: ${booking.paymentStatus || '-'}`);
    doc.moveDown(2);

    doc.fontSize(10).fillColor('#666').text(
        'Please carry a valid ID proof while travelling. This is a computer-generated ticket.',
        { align: 'center' }
    );

    doc.end();
});

module.exports = { generateTicketPdf };
