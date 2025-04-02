const Product = require('../models/Product');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');

// ✅ Get all products
async function getAllProducts(req, res) {
    try {
        const products = await Product.find().populate('donation');
        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// ✅ Get product by ID
async function getProductById(req, res) {
    try {
        const { id } = req.params;

        // Check if 'id' is a valid integer
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            return res.status(400).json({ message: 'Invalid product ID. Must be an integer.' });
        }

        const product = await Product.findById(parsedId).populate('donation');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("Error in getProductById:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// ✅ Get products by Donation ID
async function getProductsByDonationId(req, res) {
    try {
        const { idDonation } = req.params;

        if (!mongoose.Types.ObjectId.isValid(idDonation)) {
            return res.status(400).json({ message: 'Invalid Donation ID format' });
        }

        const products = await Product.find({ donation: idDonation });

        if (!products.length) {
            return res.status(404).json({ message: 'No products found for this donation' });
        }

        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getProductsByDonationId:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// ✅ Get products by Status
async function getProductsByStatus(req, res) {
    try {
        const { status } = req.params;
        const products = await Product.find({ status });

        if (!products.length) {
            return res.status(404).json({ message: 'No products found with this status' });
        }

        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getProductsByStatus:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// ✅ Create a new product
async function createProduct(req, res) {
    try {
        console.log('Received request to create product:', req.body);
        const { name, productType, productDescription, weightPerUnit, weightUnit, totalQuantity, donation, status } = req.body;

        // Validate required fields
        if (!name || !productType || !productDescription || !donation || !status) {
            console.log('Validation failed: Missing required fields');
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }

        // Check if an image file was uploaded
        let imagePath = null;
        if (req.files && req.files.image && req.files.image[0]) {
            imagePath = req.files.image[0].path;
            console.log('Image uploaded:', imagePath);
        }

        // Generate the ID using the Counter model
        console.log('Generating ID for new Product');
        const counter = await Counter.findOneAndUpdate(
            { _id: 'ProductId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        if (!counter) {
            console.log('Counter not found or created for ProductId');
            throw new Error('Counter not found or created for ProductId');
        }
        const productId = counter.seq;
        console.log(`Assigned ID: ${productId} to new Product`);

        // Build the product object
        const productData = {
            id: productId,
            name,
            productType,
            productDescription,
            weightPerUnit,
            weightUnit,
            totalQuantity,
            donation,
            status,
            image: imagePath,
            isArchived: false,
        };

        // Create the product
        console.log('Saving new product:', productData);
        const newProduct = new Product(productData);
        await newProduct.save();

        console.log('Product created successfully:', newProduct);
        res.status(201).json(newProduct);
    } catch (error) {
        console.error("Error in createProduct:", error);
        res.status(400).json({ message: 'Failed to create product', error: error.message });
    }
}

// ✅ Update a product by ID
async function updateProduct(req, res) {
    try {
        const { id } = req.params;

        // Check if 'id' is a valid integer
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            return res.status(400).json({ message: 'Invalid product ID. Must be an integer.' });
        }

        const { name, productType, productDescription, weightPerUnit, weightUnit, totalQuantity, donation, status } = req.body;

        // Find the product by ID
        const product = await Product.findById(parsedId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if a new image file was uploaded
        if (req.files && req.files.image && req.files.image[0]) {
            product.image = req.files.image[0].path; // Update the image path
        }

        // Update other fields if provided
        if (name) product.name = name;
        if (productType) product.productType = productType;
        if (productDescription) product.productDescription = productDescription;
        if (weightPerUnit) product.weightPerUnit = weightPerUnit;
        if (weightUnit) product.weightUnit = weightUnit;
        if (totalQuantity) product.totalQuantity = totalQuantity;
        if (donation) product.donation = donation;
        if (status) product.status = status;

        // Save the updated product
        const updatedProduct = await product.save();

        res.status(200).json({ message: 'Product updated successfully', updatedProduct });
    } catch (error) {
        console.error("Error in updateProduct:", error);
        res.status(500).json({ message: 'Failed to update product', error: error.message });
    }
}

// ✅ Delete a product by ID
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;

        // Check if 'id' is a valid integer
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            return res.status(400).json({ message: 'Invalid product ID. Must be an integer.' });
        }

        const deletedProduct = await Product.findOneAndDelete({id: parsedId});

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error in deleteProduct:", error);
        res.status(500).json({ message: 'Failed to delete product', error: error.message });
    }
}

module.exports = { getAllProducts, getProductById, getProductsByDonationId, getProductsByStatus, createProduct, updateProduct, deleteProduct };