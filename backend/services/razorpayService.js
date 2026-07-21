const crypto = require('crypto');

let razorpayClient = null;

const isConfigured = () => Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

const getClient = () => {
    if (!isConfigured()) return null;
    if (!razorpayClient) {
        try {
            const Razorpay = require('razorpay');
            razorpayClient = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });
        } catch (error) {
            return null;
        }
    }
    return razorpayClient;
};

const createOrder = async (amount, bookingId) => {
    const amountPaise = Math.round(Number(amount) * 100);

    if (!isConfigured()) {
        return {
            devMode: true,
            id: `dev_order_${bookingId}_${Date.now()}`,
            amount: amountPaise,
            currency: 'INR',
            key: 'dev_mode'
        };
    }

    const client = getClient();
    if (!client) {
        return {
            devMode: true,
            id: `dev_order_${bookingId}_${Date.now()}`,
            amount: amountPaise,
            currency: 'INR',
            key: 'dev_mode'
        };
    }

    const order = await client.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `booking_${bookingId}`,
        notes: { bookingId: String(bookingId) }
    });

    return {
        devMode: false,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
    };
};

const verifyPayment = ({ orderId, paymentId, signature }) => {
    if (String(orderId).startsWith('dev_order_')) {
        return true;
    }

    if (!isConfigured()) return false;

    const body = `${orderId}|${paymentId}`;
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    return expected === signature;
};

module.exports = {
    isConfigured,
    createOrder,
    verifyPayment
};
