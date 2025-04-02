const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter'); // Assumes a Counter model exists for auto-incrementing IDs

// Define enums for productType
const ProductType = {
    // Packaged Products - Non-Perishable
    CANNED_GOODS: 'Canned_Goods',        // e.g., canned beans, soups
    DRY_GOODS: 'Dry_Goods',              // e.g., rice, pasta
    BEVERAGES: 'Beverages',              // e.g., bottled water, juice
    SNACKS: 'Snacks',                    // e.g., chips, granola bars
    CEREALS: 'Cereals',                  // e.g., oatmeal, cornflakes (new)
    BAKED_GOODS: 'Baked_Goods',          // e.g., packaged bread, cookies (new)
    CONDIMENTS: 'Condiments',            // e.g., ketchup, sauces (new)

    // Fresh Products
    VEGETABLES: 'Vegetables',            // e.g., carrots, potatoes
    FRUITS: 'Fruits',                    // e.g., apples, bananas
    MEAT: 'Meat',                        // e.g., fresh beef, chicken
    FISH: 'Fish',                        // e.g., fresh salmon, tuna
    DAIRY: 'Dairy',                      // e.g., milk, cheese (new)
    EGGS: 'Eggs',                        // e.g., fresh eggs (new)

    // Miscellaneous
    BABY_FOOD: 'Baby_Food',              // e.g., formula, purees (new)
    PET_FOOD: 'Pet_Food',                // e.g., dog/cat food (new)
    OTHER: 'Other'                       // Catch-all for uncategorized items                // Flexible for both
};
Object.freeze(ProductType); // Prevents changes to the enum
const MealType = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
    DESSERT: 'Dessert',
    SOUP: 'Soup',
    OTHER: 'Other'
};
Object.freeze(MealType);
// Define enums for weight units
const WeightUnit = {
    KG: 'kg',
    G: 'g',
    LB: 'lb',
    OZ: 'oz',
    ML: 'ml',
    L: 'l', // Liters
    
};
Object.freeze(WeightUnit);

// Define enums for product status
const ProductStatus = {
    AVAILABLE: 'available',
    PENDING: 'pending',
    RESERVED: 'reserved',
    OUT_OF_STOCK: 'out_of_stock'
};
Object.freeze(ProductStatus);

// Define the Product schema
const productSchema = new Schema({
    id: { 
        type: Number, 
        unique: true, 
        required: true 
    }, // Auto-incremented unique ID
    name: { 
        type: String, 
        required: true, 
        minlength: 2, 
        maxlength: 100 
    }, // Product name, 2-100 characters
    image: {
        type: String, // Could use Buffer for binary data or String for URL/path
        required: false
    },
    productType: { 
        type: String, 
        enum: Object.values(ProductType), 
        required: true 
    }, 
    MealType: { 
        type: String, 
        enum: Object.values(MealType), 
    }, // Must be one of the ProductType values
    productDescription: { 
        type: String, 
        required: true, 
        maxlength: 500 
    }, // Description, max 500 characters
    weightPerUnit: { 
        type: Number, 
        required: false, // Optional for prepared meals
        min: [0, 'Weight per unit must be non-negative'] 
    }, // Weight per item, if applicable
    weightUnit: { 
        type: String, 
        enum: Object.values(WeightUnit), 
        required: false // Optional for prepared meals
    }, // Unit of weight, if applicable
    weightUnitTotale: { 
        type: String, 
        enum: Object.values(WeightUnit), 
        required: false // Optional for prepared meals
    },
    totalQuantity: { 
        type: Number, 
        required: false, // Optional for prepared meals
        min: [0, 'Total quantity must be non-negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Total quantity must be an integer'
        }
    }, // Total number of units, if applicable
    donation: { type: Schema.Types.ObjectId, ref: 'Donation' }, // Optional
    request: { type: Schema.Types.ObjectId, ref: 'RequestNeed' },// Reference to a Donation

    isArchived: { // New field to mark product as archived
        type: Boolean,
        default: false,
        required: true
    },
    archivedAt: { // Timestamp of when archived
        type: Date,
        default: null
    },
    status: { 
        type: String, 
        enum: Object.values(ProductStatus), 
        default: ProductStatus.AVAILABLE, 
        required: true 
    } // Product availability status
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtual fields in JSON output
    toObject: { virtuals: true } // Include virtual fields in object output
});

// Add a virtual field to calculate total weight
productSchema.virtual('totalWeight').get(function() {
    if (this.weightPerUnit && this.totalQuantity) {
        return this.weightPerUnit * this.totalQuantity;
    }
    return null; // Returns null if weight or quantity is missing
});

// Attach enums to the model for easy access
productSchema.statics.ProductType = ProductType;
productSchema.statics.WeightUnit = WeightUnit;
productSchema.statics.ProductStatus = ProductStatus;

// Auto-increment the ID before saving a new product
productSchema.pre('save', async function(next) {
    if (this.isNew) { // Only for new documents
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'ProductId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.id = counter.seq; // Set the new ID
        } catch (err) {
            return next(new Error('Failed to generate product ID: ' + err.message));
        }
    }
    next(); // Proceed with saving
});

// Add an index for faster queries on donation
productSchema.index({ donation: 1 });
productSchema.index({ isArchived: 1 });

// Create and export the Product model
const Product = mongoose.model('Product', productSchema);
module.exports = Product;