const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter'); // Assumes a Counter model for auto-incrementing IDs

// Define the status enum
const TransactionStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};
Object.freeze(TransactionStatus); // Prevents changes to the enum



// Define the DonationTransaction schema
const donationTransactionSchema = new Schema({
    id: {
        type: Number,
        unique: true,
        required: true
    },
    requestNeed: { 
        type: Schema.Types.ObjectId, 
        ref: 'RequestNeed', 
        required: true 
    },
    donation: { 
        type: Schema.Types.ObjectId, 
        ref: 'Donation', 
        required: true 
    },
    allocatedProducts: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, required: true, min: 1 }
    }],
    allocatedMeals: [{ // New field for allocated meals
        meal: { type: Schema.Types.ObjectId, ref: 'Meals' },
        quantity: { type: Number, required: true, min: 1 }
    }] ,
    status: { 
        type: String, 
        enum: Object.values(TransactionStatus), 
        default: TransactionStatus.PENDING, 
        required: true 
    },
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    donor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    responseDate: {
        type: Date
    },
    rejectionReason: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Pre-save hook to auto-increment the ID
// Pre-save hook to auto-increment the ID
donationTransactionSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            console.log('Running pre-save hook for DonationTransaction');
            const counter = await Counter.findOneAndUpdate(
                { _id: 'DonationTransactionId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            if (!counter) {
                throw new Error('Counter not found or created');
            }
            this.id = counter.seq;
            console.log(`Assigned ID: ${this.id}`);
        } catch (err) {
            console.error('Pre-save hook error:', err);
            return next(new Error('Failed to generate transaction ID: ' + err.message));
        }
    }
    next();
});

// Add indexes for better query performance
donationTransactionSchema.index({ requestNeed: 1 });
donationTransactionSchema.index({ donation: 1 });
donationTransactionSchema.index({ status: 1 });

// Create and export the model
const DonationTransaction = mongoose.model('DonationTransaction', donationTransactionSchema);
module.exports = DonationTransaction;