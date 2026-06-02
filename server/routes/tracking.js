const express = require('express');
const { Application } = require('../models');

const router = express.Router();

/**
 * A minimal 1x1 transparent GIF pixel (35 bytes).
 * Served as the tracking image — no external dependency needed.
 */
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /track/open/:applicationId
 * Public endpoint (no auth) — called when a recruiter opens the email.
 * Returns a 1×1 transparent GIF and updates the application status to "viewed".
 */
router.get('/open/:applicationId', async (req, res) => {
  // Always serve the pixel immediately so the email loads normally
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(TRANSPARENT_PIXEL);

  // Update status in the background — only advance if still at "sent"
  // (don't downgrade from "interview" or "offer" back to "viewed")
  try {
    const app = await Application.findById(req.params.applicationId);
    if (app && app.status === 'sent') {
      app.status = 'viewed';
      app.viewedAt = new Date();
      await app.save();
      console.log(`📧 Email opened: application ${req.params.applicationId} → viewed`);
    }
  } catch (err) {
    // Silently ignore — never break email loading because of a tracking error
    console.error('Tracking pixel error:', err.message);
  }
});

module.exports = router;
