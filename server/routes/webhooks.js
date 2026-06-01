const express = require('express');
const crypto = require('crypto');
const { User } = require('../models');

const router = express.Router();

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook endpoint.
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('Webhook failed: RAZORPAY_WEBHOOK_SECRET not set');
      return res.status(500).send('Webhook secret not configured');
    }

    const signature = req.headers['x-razorpay-signature'];
    
    // Express raw middleware should be used for webhooks, but in our index.js we already use express.json globally.
    // If req.body is already an object, we need to stringify it to verify the signature. 
    // A better approach is usually to capture the raw body, but stringify usually works for Razorpay if no modifications were made.
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Invalid signature on webhook');
      return res.status(400).send('Invalid signature');
    }

    // Parse the JSON payload
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Handle Subscription Charged (Successful Payment)
    if (event.event === 'subscription.charged') {
      const subscription = event.payload.subscription.entity;
      const customerId = subscription.customer_id;
      const subId = subscription.id;

      // Find user by customerId
      const user = await User.findOne({ razorpayCustomerId: customerId });
      
      if (user) {
        user.tier = 'premium';
        user.razorpaySubscriptionId = subId;
        user.subscriptionStatus = 'active';
        await user.save();
        console.log(`Upgraded user ${user.email} to premium via webhook.`);
      } else {
        console.warn(`Webhook received for customer ${customerId} but no user found in DB.`);
      }
    }

    // Handle Subscription Cancelled or Halted
    if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted') {
      const subscription = event.payload.subscription.entity;
      const customerId = subscription.customer_id;

      const user = await User.findOne({ razorpayCustomerId: customerId });
      
      if (user) {
        user.tier = 'free';
        user.subscriptionStatus = event.event === 'subscription.cancelled' ? 'cancelled' : 'halted';
        await user.save();
        console.log(`Downgraded user ${user.email} to free via webhook (${event.event}).`);
      }
    }

    // Acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;
