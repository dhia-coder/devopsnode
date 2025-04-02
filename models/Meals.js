const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter');

// Define the Meal schema
const mealSchema = new Schema({
    id: { 
        type: Number, 
        unique: true, 
        required: true 
    }, 
    quantity:{
        type : Number,
    },
    mealName: { 
        type: String,
        required: true // Suggested addition for data integrity
    },  
    donation: { 
        type: Schema.Types.ObjectId, 
        ref: 'Donation' 
    }, // Optional reference to Donation
    mealDescription: { 
        type: String 
    }, 
    mealType: { 
        type: String,
        // Optionally, add an enum to restrict possible meal types
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Other'] // Example values
    }
});

// Pre-save hook to auto-increment the 'id' field using the Counter model
mealSchema.pre('save', async function (next) {
    const doc = this;
    if (doc.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'mealId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            doc.id = counter.seq;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// Create and export the Meal model
const Meal = mongoose.model('Meals', mealSchema); // Change 'Meal' to 'Meals'
module.exports = Meal; // Corrected export name