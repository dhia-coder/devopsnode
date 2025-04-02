const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter');

// Define Enums
const Category = {
    PREPARED_MEALS: 'prepared_meals',
    PACKAGED_PRODUCTS: 'packaged_products'
};
Object.freeze(Category);

const Status = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PARTIALLY_FULFILLED: 'partially_fulfilled',
    FULFILLED: 'fulfilled',
    CANCELLED: 'cancelled'
};
Object.freeze(Status);

// Define Donation Schema
const donationSchema = new Schema({

    isaPost: { type: Boolean, default: true },
    id: { type: Number, unique: true }, // Auto-incremented custom ID
    donor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Renamed from 'user'
    title: { type: String, required: true, minlength: 3, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    category: { type: String, enum: Object.values(Category), required: true }, // Lowercase naming
    products: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // Reference to Product
        quantity: { type: Number, required: true, min: 0 } // Donated quantity
    }],
    meals: [{
        meal: { 
            type: Schema.Types.ObjectId, 
            ref: 'Meals',
            required: [
                function() { return this.category === 'prepared_meals'; },
                'Meal ID is required for prepared meals'
            ]
        },
        quantity: { 
            type: Number,
            required: [
                function() { return this.category === 'prepared_meals'; },
                'Quantity is required for prepared meals'
            ],
            min: [1, 'Quantity must be at least 1'],
            validate: {
                validator: Number.isInteger,
                message: 'Quantity must be an integer'
            }
        }
    }],
    numberOfMeals: {
        type: Number,
        required: [
            function() { return this.category === 'prepared_meals'; },
            'Number of meals is required for prepared meals'
        ],
        min: [1, 'Number of meals cannot be negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Number of meals must be an integer'
        }
    },
    remainingMeals: { type: Number, min: 0 }, // New field to track remaining meals
    location: { type: String, required: true },
    expirationDate: {
        type: Date,
        required: true,
        validate: {
            validator: (date) => date > new Date(), // Ensure future date
            message: 'Expiration date must be in the future'
        }
    },
    status: { type: String, enum: Object.values(Status), default: Status.PENDING, required: true },
    linkedRequests: [{ type: Schema.Types.ObjectId, ref: 'RequestNeed' }], // Added from concept
    mealName: { type: String },  // Add mealName
    mealDescription: { type: String },  // Add mealDescription
    MealType: { type: String} //Add MealType
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for performance
donationSchema.index({ status: 1 });
donationSchema.index({ category: 1 });
donationSchema.index({ expirationDate: 1 });

// Pre-save hook for auto-incrementing ID
donationSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'DonationId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.id = counter.seq;
        } catch (err) {
            return next(new Error('Failed to generate donation ID: ' + err.message));
        }
    }
    next();
});
// Pre-save hook to ensure numberOfMeals matches the sum of meal quantities
donationSchema.pre('save', async function(next) {
    if (this.category === 'prepared_meals') {
        const totalMeals = this.meals.reduce((sum, mealEntry) => sum + (mealEntry.quantity || 0), 0);
        
    }
    next();
});

// Create and export the Donation model
const Donation = mongoose.model('Donation', donationSchema);
module.exports = Donation;