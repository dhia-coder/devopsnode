const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Helper function to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ### Create a new notification
const createNotification = async (req, res) => {
    try {
        const { sender, receiver, message } = req.body;

        // Input validation
        if (!sender || !isValidObjectId(sender)) {
            return res.status(400).json({ message: 'Valid sender ID is required' });
        }
        if (!receiver || !isValidObjectId(receiver)) {
            return res.status(400).json({ message: 'Valid receiver ID is required' });
        }
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ message: 'Message is required and must be a non-empty string' });
        }

        // Check if sender and receiver exist
        const senderUser = await User.findById(sender);
        if (!senderUser) {
            return res.status(404).json({ message: 'Sender not found' });
        }
        const receiverUser = await User.findById(receiver);
        if (!receiverUser) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

        // Create a new notification
        const newNotification = new Notification({
            sender,
            receiver,
            message,
            isRead: false,
        });

        console.log('Creating notification with data:', newNotification);

        const savedNotification = await newNotification.save();

        console.log('Notification saved successfully:', savedNotification);

        // ### Send Notification Email to Receiver (Optional)
        if (receiverUser.email) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
                tls: {
                    rejectUnauthorized: false,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: receiverUser.email,
                subject: `New Notification from ${senderUser.name || 'a user'}`,
                text: `Dear ${receiverUser.name || 'User'},

You have received a new notification:

Message: ${message}

You can view this notification in your account.

Best regards,
Your Platform Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: black;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                        </div>
                        <h2 style="color: #228b22;">New Notification</h2>
                        <p>Dear ${receiverUser.name || 'User'},</p>
                        <p>You have received a new notification:</p>
                        <p><strong>Message:</strong> ${message}</p>
                        <p>You can view this notification in your account.</p>
                        <p>Best regards,<br>Your Platform Team</p>
                    </div>
                `,
                attachments: [],
            };

            const logoPath = path.join(__dirname, '../uploads/logo.png');
            if (fs.existsSync(logoPath)) {
                mailOptions.attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo',
                });
            } else {
                console.warn('Logo file not found at:', logoPath);
                mailOptions.html = mailOptions.html.replace('<img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />', '');
            }

            try {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${receiverUser.email}`);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
            }
        } else {
            console.warn('Receiver email not found for user:', receiver);
        }

        // Response
        res.status(201).json({
            message: 'Notification created successfully',
            notification: savedNotification,
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ message: 'Failed to create notification', error: error.message });
    }
};

// Rest of the controller methods (unchanged)
const getNotificationsByReceiver = async (req, res) => {
    try {
        const { receiverId } = req.params;

        if (!receiverId || !isValidObjectId(receiverId)) {
            return res.status(400).json({ message: 'Valid receiver ID is required' });
        }

        const notifications = await Notification.find({ receiver: receiverId })
            .populate('sender', 'name email photo')
            .populate('receiver', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Notifications retrieved successfully',
            notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId || !isValidObjectId(notificationId)) {
            return res.status(400).json({ message: 'Valid notification ID is required' });
        }

        const notification = await Notification.findById(notificationId)
            .populate('sender', 'name email')
            .populate('receiver', 'name email');

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({
            message: 'Notification retrieved successfully',
            notification,
        });
    } catch (error) {
        console.error('Error fetching notification:', error);
        res.status(500).json({ message: 'Failed to fetch notification', error: error.message });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId || !isValidObjectId(notificationId)) {
            return res.status(400).json({ message: 'Valid notification ID is required' });
        }

        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        notification.isRead = true;
        const updatedNotification = await notification.save();

        res.status(200).json({
            message: 'Notification marked as read successfully',
            notification: updatedNotification,
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId || !isValidObjectId(notificationId)) {
            return res.status(400).json({ message: 'Valid notification ID is required' });
        }

        const notification = await Notification.findByIdAndDelete(notificationId);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({
            message: 'Notification deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Failed to delete notification', error: error.message });
    }
};

const getUnreadNotificationsCount = async (req, res) => {
    try {
        const { receiverId } = req.params;

        if (!receiverId || !isValidObjectId(receiverId)) {
            return res.status(400).json({ message: 'Valid receiver ID is required' });
        }

        const unreadCount = await Notification.countDocuments({
            receiver: receiverId,
            isRead: false,
        });

        res.status(200).json({
            message: 'Unread notifications count retrieved successfully',
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching unread notifications count:', error);
        res.status(500).json({ message: 'Failed to fetch unread notifications count', error: error.message });
    }
};

module.exports = {
    createNotification,
    getNotificationsByReceiver,
    getNotificationById,
    markNotificationAsRead,
    deleteNotification,
    getUnreadNotificationsCount,
};