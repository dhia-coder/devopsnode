const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter'); // Assumes a Counter model for auto-incrementing IDs

// Define the status enum
const RequestStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FULFILLED: 'fulfilled',
    PARTIALLY_FULFILLED: 'partially_fulfilled',
};
Object.freeze(RequestStatus);

// Define the category enum
const Category = {
    PREPARED_MEALS: 'prepared_meals',
    PACKAGED_PRODUCTS: 'packaged_products',
};
Object.freeze(Category);

// Define the ProductRequest subdocument schema (embedded in RequestNeed)


// Define the RequestNeed schema
const requestNeedSchema = new Schema({
    isaPost: { type: Boolean, default: true },
    id: { type: Number },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: [100, 'Title cannot exceed 100 characters'],
        trim: true
    },
    location: { 
        type: String, 
        required: [true, 'Location is required'],
        trim: true 
    },
    expirationDate: {
        type: Date,
        required: [true, 'Expiration date is required'],
        validate: {
            validator: (date) => date > new Date(), // Ensure future date
            message: 'Expiration date must be in the future'
        }
    },
    description: { 
        type: String, 
        maxlength: [500, 'Description cannot exceed 500 characters'],
        trim: true 
    },
    category: { 
        type: String, 
        enum: Object.values(Category), 
        required: [true, 'Category is required'] 
    },
    recipient: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, 'Recipient is required'] 
    },
    status: { 
        type: String, 
        enum: Object.values(RequestStatus), 
        default: RequestStatus.PENDING, 
        required: [true, 'Status is required'] 
    },
    linkedDonation:[ { 
        type: Schema.Types.ObjectId, 
        ref: 'Donation', 
        required: false ,
        default: []
    }],
    requestedProducts: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, min: 0, default: 1 }
      }],
      requestedMeals: [{
        meal: { type: Schema.Types.ObjectId, ref: 'Meals' },
        quantity: { type: Number, min: 0, default: 1 }
      }],


      numberOfMeals: {
        type: Number,
        required: [
            function() { return this.category === 'prepared_meals'; },
            'required for prepared meals'
        ],
        min: [0, 'Number of meals cannot be negative'],
        validate: {
            validator: function(value) {
                // Skip validation if value is null/undefined and not required
                if (value == null && this.category !== 'prepared_meals') return true;
                return Number.isInteger(value);
            },
            message: 'Number of meals must be an integer'
        }
    },
 
}, {
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } // Map to your custom field names
});

// Pre-save hook to auto-increment the ID
requestNeedSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'RequestNeedId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.id = counter.seq;
            next();
        } catch (err) {
            next(new Error(`Failed to generate request ID: ${err.message}`));
        }
    } else {
        next();
    }
});

// Create and export the model
const RequestNeed = mongoose.model('RequestNeed', requestNeedSchema);
module.exports = RequestNeed;