/**
 * Payment processing — simulation (dev/mock) or Razorpay (live API).
 */
let paymentProcessing = false;

function showPaymentProcessing(show, message = 'Processing your payment...') {
    let overlay = document.getElementById('payment-processing-overlay');
    if (!overlay && show) {
        overlay = document.createElement('div');
        overlay.id = 'payment-processing-overlay';
        overlay.className = 'payment-processing-overlay';
        overlay.innerHTML = `<div class="payment-processing-card"><div class="spinner"></div><p>${message}</p></div>`;
        document.body.appendChild(overlay);
    }
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

async function processPayment(booking, options = {}) {
    if (booking.status === 'Waitlisted') {
        UI.showToast(`Added to waitlist! Position: WL/${booking.waitlistPosition}.`, 'info');
        return booking;
    }
    if (booking.status === 'RAC') {
        UI.showToast(`Added to RAC! Position: RAC/${booking.waitlistPosition}.`, 'info');
        return booking;
    }
    if (booking.status !== 'Pending') return booking;
    if (paymentProcessing) throw new Error('Payment already in progress');

    paymentProcessing = true;
    showPaymentProcessing(true);

    try {
        await new Promise((r) => setTimeout(r, 1200));

        const orderData = await API.post('/payments/create-order', {
            bookingId: booking.id,
            amount: booking.totalPrice,
            simulateFailure: options.simulateFailure === true
        });

        if (orderData.devMode || orderData.mockMode) {
            const confirmData = await API.post('/payments/dev-confirm', {
                bookingId: booking.id,
                simulateFailure: options.simulateFailure === true
            });
            showPaymentProcessing(false);
            return confirmData.booking;
        }

        return new Promise((resolve, reject) => {
            showPaymentProcessing(false);
            const optionsRzp = {
                key: orderData.key,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Railway Reservation',
                description: `Booking #${booking.id}`,
                order_id: orderData.orderId,
                handler: async (response) => {
                    showPaymentProcessing(true);
                    try {
                        const verifyData = await API.post('/payments/verify', {
                            bookingId: booking.id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        showPaymentProcessing(false);
                        resolve(verifyData.booking);
                    } catch (err) {
                        showPaymentProcessing(false);
                        reject(err);
                    }
                },
                theme: { color: '#20B8BE' }
            };
            const rzp = new Razorpay(optionsRzp);
            rzp.on('payment.failed', () => reject(new Error('Payment failed')));
            rzp.open();
        });
    } catch (error) {
        showPaymentProcessing(false);
        throw error;
    } finally {
        paymentProcessing = false;
    }
}

window.processPayment = processPayment;
