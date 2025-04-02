const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter');

// Define the Notification schema
const NotificationSchema = new Schema({
    id: { 
        type: Number, 
        unique: true 
    },
    sender: {
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, 'sender is required']
    },
    receiver: {
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, 'receiver is required']
    },
    message: { 
        type: String, 
        required: [true, 'Message is required'] 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Pre-save hook to auto-increment the 'id' field using the Counter model
NotificationSchema.pre('save', async function (next) {
    const doc = this;
    console.log('Pre-save hook triggered for notification:', doc);

    if (doc.isNew) {
        try {
            let counter = await Counter.findOneAndUpdate(
                { _id: 'notificationId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            console.log('Counter result:', counter);

            // Vérifier que counter.seq est valide
            doc.id = counter && counter.seq ? counter.seq : Date.now(); // Fallback si counter.seq est inexistant

            console.log('Set notification id to:', doc.id);
            next();
        } catch (error) {
            console.error('Error in pre-save hook:', error);
            next(error);
        }
    } else {
        console.log('Document is not new, skipping id assignment');
        next();
    }
});



// Create and export the Notification model
const Notification = mongoose.model('Notification', NotificationSchema); 
module.exports = Notification;