const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../Middleware/Upload'); // Import your Multer configuration

// Routes
router.get('/all', productController.getAllProducts);
router.get('/:id', productController.getProductById); // Get product by ID
router.get('/donation/:idDonation', productController.getProductsByDonationId);
router.get('/status/:status', productController.getProductsByStatus);

// Create a new product with image upload
router.post(
    '/create',
    upload.single('image'), // Use Multer to handle a single file upload for the 'image' field
    productController.createProduct
);

// Update a product with optional image upload
router.put(
    '/update/:id',
    upload.single('image'), // Use Multer to handle a single file upload for the 'image' field
    productController.updateProduct
);

router.delete('/delete/:id', productController.deleteProduct);

module.exports = router;