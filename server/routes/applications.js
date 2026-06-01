const express = require('express');
const { Application } = require('../models');

const router = express.Router();

/**
 * GET /api/applications
 * List all applications, optional ?status= filter.
 */
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const applications = await Application.find(filter).sort({ updatedAt: -1 });

    return res.status(200).json({
      applications,
      total: applications.length,
    });
  } catch (error) {
    console.error('List applications error:', error);
    return res.status(500).json({ error: `Failed to list applications: ${error.message}` });
  }
});

/**
 * GET /api/applications/stats
 * Return counts grouped by status.
 */
router.get('/stats', async (req, res) => {
  try {
    const statuses = ['draft', 'applied', 'sent', 'viewed', 'interview', 'rejected', 'offer'];
    const stats = {};

    for (const s of statuses) {
      stats[s] = await Application.countDocuments({ status: s, userId: req.user._id });
    }
    stats.total = await Application.countDocuments({ userId: req.user._id });

    return res.status(200).json({ stats });
  } catch (error) {
    console.error('Application stats error:', error);
    return res.status(500).json({ error: `Failed to get stats: ${error.message}` });
  }
});

/**
 * GET /api/applications/:id
 * Get a single application detail.
 */
router.get('/:id', async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, userId: req.user._id });
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    return res.status(500).json({ error: `Failed to get application: ${error.message}` });
  }
});

/**
 * PUT /api/applications/:id/status
 * Update the status of an application.
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'applied', 'sent', 'viewed', 'interview', 'rejected', 'offer'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const application = await Application.findOne({ _id: req.params.id, userId: req.user._id });
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    application.status = status;
    await application.save();

    return res.status(200).json({ message: `Status updated to "${status}".`, application });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ error: `Failed to update status: ${error.message}` });
  }
});

module.exports = router;
