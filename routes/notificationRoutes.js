const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create a new notification
router.post('/', notificationController.createNotification);

// Get all notifications for a specific receiver
router.get('/receiver/:receiverId', notificationController.getNotificationsByReceiver);

// Get a single notification by ID
router.get('/:notificationId', notificationController.getNotificationById);

// Mark a notification as read
router.put('/:notificationId/read', notificationController.markNotificationAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

// Get unread notifications count for a user
router.get('/receiver/:receiverId/unread-count', notificationController.getUnreadNotificationsCount);

module.exports = router;