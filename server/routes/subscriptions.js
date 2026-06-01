const express = require('express');
const Razorpay = require('razorpay');
const { User } = require('../models');

const router = express.Router();

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys are not configured in environment variables.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

/**
 * POST /api/subscriptions/create
 * Creates a Razorpay subscription for the authenticated user.
 */
router.post('/create', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.tier === 'premium' && user.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'User is already on a premium plan.' });
    }

    const planId = process.env.RAZORPAY_PLAN_ID;
    if (!planId) {
      return res.status(500).json({ error: 'RAZORPAY_PLAN_ID is not configured on the server.' });
    }

    const instance = getRazorpayInstance();

    // 1. Create or get Razorpay Customer
    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      const customer = await instance.customers.create({
        email: user.email,
        fail_existing: 0, // Returns existing customer if email exists
      });
      customerId = customer.id;
      user.razorpayCustomerId = customerId;
      await user.save();
    }

    // 2. Create Subscription
    const subscription = await instance.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 120, // 10 years for a monthly plan
      customer_id: customerId,
    });

    // We don't save the subscription ID to the user yet, we wait for the webhook or success callback.
    
    return res.status(200).json({
      subscription_id: subscription.id,
      key_id: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    return res.status(500).json({ error: `Failed to create subscription: ${error.message}` });
  }
});

module.exports = router;
