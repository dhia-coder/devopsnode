const RequestNeed = require('../models/RequestNeed');
const Product = require('../models/Product');
const Counter = require('../models/Counter');
const Donation = require('../models/Donation'); // Added import for Donation
const DonationTransaction = require('../models/DonationTransaction');
const nodemailer = require("nodemailer");
const path = require("path");
const mongoose = require('mongoose');
const User = require('../models/User');
const multer = require('multer'); // Import multerz
const Meals=require('../models/Meals');
const fs = require('fs');
const upload = multer().none(); // Create multer instance to handle FormData

// ✅ Get all requests
async function getAllRequests(req, res) {
    try {
        const requests = await RequestNeed.find({isaPost:true})
            .populate('recipient')
            .populate('requestedProducts.product');
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get request by ID
async function getRequestById(req, res) {
    try {
        const { id } = req.params;
        const request = await RequestNeed.findById(id, 'title location expirationDate description category recipient status linkedDonation requestedProducts numberOfMeals mealName mealDescription mealType')
            .populate('recipient')
            .populate('requestedProducts.product');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.status(200).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get requests by Recipient ID
async function getRequestsByRecipientId(req, res) {
    try {
        const { recipientId } = req.params;
        const requests = await RequestNeed.find({ recipient: recipientId,isaPost:true})
            .populate('requestedProducts.product');

        if (!requests.length) {
            return res.status(404).json({ message: 'No requests found for this recipient' });
        }

        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get requests by Status
async function getRequestsByStatus(req, res) {
    try {
        const { status } = req.params;
        const requests = await RequestNeed.find({ status })
            .populate('recipient')
            .populate('requestedProducts.product');

        if (!requests.length) {
            return res.status(404).json({ message: 'No requests found with this status' });
        }

        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Create a new request
async function createRequest(req, res) {
    console.log("Request body received:", req.body);

    try {
        let {
            title,
            location,
            expirationDate,
            description,
            category,
            recipient,
            requestedProducts,
            requestedMeals,
            status,
            linkedDonation,
            numberOfMeals,
        } = req.body;

        // Ensure requestedProducts is parsed correctly
        if (typeof requestedProducts === 'string') {
            try {
                requestedProducts = JSON.parse(requestedProducts);
            } catch (error) {
                return res.status(400).json({ message: "Invalid requestedProducts format" });
            }
        }
        if (!Array.isArray(requestedProducts)) {
            requestedProducts = [];
        }

        // Ensure requestedMeals is parsed correctly
        if (typeof requestedMeals === 'string') {
            try {
                requestedMeals = JSON.parse(requestedMeals);
            } catch (error) {
                return res.status(400).json({ message: "Invalid requestedMeals format" });
            }
        }
        if (!Array.isArray(requestedMeals)) {
            requestedMeals = [];
        }

        // Validate and filter products
        requestedProducts = requestedProducts.map((product, index) => {
            if (!product.name || typeof product.name !== 'string' || !product.name.trim()) {
                throw new Error(`Product at index ${index} is missing a valid name`);
            }
            if (!product.productType || typeof product.productType !== 'string') {
                throw new Error(`Product at index ${index} is missing a valid productType`);
            }
            if (!product.productDescription || typeof product.productDescription !== 'string' || !product.productDescription.trim()) {
                throw new Error(`Product at index ${index} is missing a valid productDescription`);
            }
            const weightPerUnit = parseFloat(product.weightPerUnit);
            if (isNaN(weightPerUnit) || weightPerUnit <= 0) {
                throw new Error(`Product at index ${index} has an invalid weightPerUnit: ${product.weightPerUnit}. Must be a positive number`);
            }
            const totalQuantity = parseInt(product.totalQuantity);
            if (isNaN(totalQuantity) || totalQuantity <= 0) {
                throw new Error(`Product at index ${index} has an invalid totalQuantity: ${product.totalQuantity}. Must be a positive integer`);
            }
            if (!product.status || typeof product.status !== 'string') {
                throw new Error(`Product at index ${index} is missing a valid status`);
            }
            return product;
        });

        // Validate expirationDate
        if (isNaN(new Date(expirationDate).getTime())) {
            return res.status(400).json({ message: "Invalid expiration date format" });
        }

        // Validate numberOfMeals for prepared meals
        let totalMeals = 0;
        if (category === 'prepared_meals') {
            const parsedNumberOfMeals = parseInt(numberOfMeals, 10);
            if (isNaN(parsedNumberOfMeals) || parsedNumberOfMeals <= 0) {
                return res.status(400).json({ message: 'numberOfMeals must be a valid positive integer for prepared meals' });
            }
            totalMeals = parsedNumberOfMeals;
        }

        // Create the request without products or meals first
        const newRequest = new RequestNeed({
            title,
            location,
            expirationDate: new Date(expirationDate),
            description,
            category: category || undefined,
            recipient,
            requestedProducts: [], // Initially empty
            requestedMeals: [],    // Initially empty
            status: status || "pending",
            linkedDonation: linkedDonation || null,
            numberOfMeals: category === 'prepared_meals' ? totalMeals : undefined,
            isaPost:true,
        });

        await newRequest.save(); // Save to obtain the request _id
        const requestId = newRequest._id;

        // Handle products for packaged_products
        if (category === 'packaged_products' && requestedProducts.length > 0) {
            // Get the current counter value and increment it for the number of products
            const counter = await Counter.findOneAndUpdate(
                { _id: 'ProductId' }, 
                { $inc: { seq: requestedProducts.length } }, 
                { new: true, upsert: true }
            );

            const startId = counter.seq - requestedProducts.length + 1;

            // Create Product documents with auto-incremented IDs
            const productDocs = requestedProducts.map((product, index) => ({
                id: startId + index,
                name: product.name,
                productType: product.productType,
                productDescription: product.productDescription,
                weightPerUnit: product.weightPerUnit,
                weightUnit: product.weightUnit,
                weightUnitTotale: product.weightUnitTotale,
                totalQuantity: product.totalQuantity,
                image: product.image,
                status: product.status,
                request: requestId,
            }));

            try {
                const createdProducts = await Product.insertMany(productDocs);
                // Map created products to the requestedProducts array with quantities
                newRequest.requestedProducts = createdProducts.map(product => ({
                    product: product._id,
                    quantity: parseInt(product.totalQuantity),
                }));
            } catch (error) {
                console.error("Product Creation Error:", error);
                return res.status(400).json({ message: "Failed to create products", error: error.message });
            }
        }

        // Save the updated request
        await newRequest.save();

        // Fetch the populated request for the response
        const populatedRequest = await RequestNeed.findById(newRequest._id)
            .populate('recipient')
            .populate('requestedProducts.product') 
            .populate('requestedMeals.meal');

        console.log("Saved request:", populatedRequest);
        res.status(201).json({ message: 'Request created successfully', newRequest: populatedRequest });
    } catch (error) {
        console.error("Request Creation Error:", error);
        res.status(500).json({
            message: "Failed to create request",
            error: error.message || error,
        });
    }
}


// ✅ Update a request by ID
async function updateRequest(req, res) {
    try {
        const { id } = req.params;
        const { requestedProducts, numberOfMeals, mealName, mealDescription, mealType, ...requestData } = req.body;

        // ### Input Validation
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Valid Request ID is required' });
        }

        // Validate required fields
        if (!requestData.title || typeof requestData.title !== 'string' || requestData.title.trim() === '') {
            return res.status(400).json({ message: 'Title is required and must be a non-empty string' });
        }
        if (!requestData.location || typeof requestData.location !== 'string' || requestData.location.trim() === '') {
            return res.status(400).json({ message: 'Location is required and must be a non-empty string' });
        }
        if (!requestData.category || !['packaged_products', 'prepared_meals'].includes(requestData.category)) {
            return res.status(400).json({ message: 'Category must be either "packaged_products" or "prepared_meals"' });
        }
        if (requestData.expirationDate && isNaN(new Date(requestData.expirationDate).getTime())) {
            return res.status(400).json({ message: 'Expiration Date must be a valid date' });
        }
        if (requestData.status && !['available', 'pending', 'reserved'].includes(requestData.status)) {
            return res.status(400).json({ message: 'Status must be one of: available, pending, reserved' });
        }

        // Fetch the existing request to determine its category
        const existingRequest = await RequestNeed.findById(id);
        if (!existingRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate based on category
        let updatedProducts = [];
        if (requestData.category === 'packaged_products') {
            if (!requestedProducts || !Array.isArray(requestedProducts)) {
                return res.status(400).json({ message: 'requestedProducts array is required for packaged_products category' });
            }

            // Validate and process requestedProducts
            for (const item of requestedProducts) {
                if (!item.product || typeof item.product !== 'object') {
                    return res.status(400).json({ message: 'Each requested product must have a product object' });
                }
                if (typeof item.quantity !== 'number' || item.quantity < 0) {
                    return res.status(400).json({ message: `Invalid quantity for product: ${item.quantity}` });
                }

                const { productType, productDescription, weightPerUnit, weightUnit, status } = item.product;

                if (!productType || typeof productType !== 'string' || productType.trim() === '') {
                    return res.status(400).json({ message: 'productType is required for each product' });
                }
                if (!productDescription || typeof productDescription !== 'string' || productDescription.trim() === '') {
                    return res.status(400).json({ message: 'productDescription is required for each product' });
                }
                if (typeof weightPerUnit !== 'number' || weightPerUnit <= 0) {
                    return res.status(400).json({ message: 'weightPerUnit must be a positive number for each product' });
                }
                if (!weightUnit || !['kg', 'g', 'lb', 'oz'].includes(weightUnit)) {
                    return res.status(400).json({ message: 'weightUnit must be one of: kg, g, lb, oz' });
                }
                if (status && !['available', 'pending', 'reserved'].includes(status)) {
                    return res.status(400).json({ message: 'Product status must be one of: available, pending, reserved' });
                }

                // Check if a Product with the same productType and productDescription already exists
                let productDoc = await Product.findOne({
                    productType: productType,
                    productDescription: productDescription
                });

                if (!productDoc) {
                    // Generate a unique id for the Product using the Counter model
                    const counter = await Counter.findOneAndUpdate(
                        { _id: 'ProductId' },
                        { $inc: { seq: 1 } },
                        { new: true, upsert: true }
                    );

                    productDoc = new Product({
                        id: counter.seq.toString(),
                        name: productType,
                        productType: productType,
                        productDescription: productDescription,
                        weightPerUnit: Number(weightPerUnit),
                        weightUnit: weightUnit,
                        weightUnitTotale: weightUnit,
                        totalQuantity: Number(item.quantity),
                        status: status || 'available'
                    });
                    await productDoc.save();
                } else {
                    // Update the existing product's totalQuantity
                    productDoc.totalQuantity = (productDoc.totalQuantity || 0) + Number(item.quantity);
                    await productDoc.save();
                }

                updatedProducts.push({
                    product: productDoc._id,
                    quantity: Number(item.quantity)
                });
            }
        } else if (requestData.category === 'prepared_meals') {
            if (typeof numberOfMeals !== 'number' || numberOfMeals <= 0) {
                return res.status(400).json({ message: 'numberOfMeals must be a positive number for prepared_meals category' });
            }
            if (!mealName || typeof mealName !== 'string' || mealName.trim() === '') {
                return res.status(400).json({ message: 'mealName is required for prepared_meals category' });
            }
            if (!mealDescription || typeof mealDescription !== 'string' || mealDescription.trim() === '') {
                return res.status(400).json({ message: 'mealDescription is required for prepared_meals category' });
            }
            if (!mealType || !['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Other'].includes(mealType)) {
                return res.status(400).json({ message: 'mealType must be one of: Breakfast, Lunch, Dinner, Snack, Dessert, Other' });
            }
            // Clear requestedProducts for prepared_meals
            updatedProducts = [];
        } else {
            return res.status(400).json({ message: 'Invalid request category' });
        }

        // ### Update the Request
        const updatedRequest = await RequestNeed.findByIdAndUpdate(
            id,
            {
                ...requestData,
                requestedProducts: updatedProducts,
                numberOfMeals: requestData.category === 'prepared_meals' ? numberOfMeals : undefined,
                mealName: requestData.category === 'prepared_meals' ? mealName : undefined,
                mealDescription: requestData.category === 'prepared_meals' ? mealDescription : undefined,
                mealType: requestData.category === 'prepared_meals' ? mealType : undefined,
            },
            { new: true }
        )
            .populate('recipient')
            .populate('requestedProducts.product');

        if (!updatedRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.status(200).json({ message: 'Request updated successfully', updatedRequest });
    } catch (error) {
        console.error('Update Request Error:', error);
        res.status(500).json({ message: 'Failed to update request', error: error.message });
    }
}

// ✅ Delete a request by ID
async function deleteRequest(req, res) {
    try {
        const { id } = req.params;
        const deletedRequest = await RequestNeed.findByIdAndDelete(id);

        if (!deletedRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete request', error });
    }
   
}

async function createRequestNeedForExistingDonation(req, res) {
    try {
        const { donationId } = req.params;
        const { recipientId, requestedProducts, requestedMeals, description, numberOfMeals } = req.body;

        // Validate input
        if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
            return res.status(400).json({ message: 'Invalid donation ID' });
        }
        if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: 'Invalid recipient ID' });
        }

        // Fetch the donation and populate its products and meals
        const donation = await Donation.findById(donationId)
            .populate('products.product')
            .populate('meals.meal')
            .populate('donor');
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        // Validate donation state
        if (donation.status !== 'pending') {
            return res.status(400).json({ message: 'Donation is not available for requests (status must be pending)' });
        }
        if (new Date(donation.expirationDate) <= new Date()) {
            return res.status(400).json({ message: 'Donation has expired' });
        }

        // Fetch the recipient to validate their role
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }
        if (!['ong', 'student'].includes(recipient.role)) {
            return res.status(403).json({ message: 'Only users with role "ong" or "student" can create requests' });
        }

        // Determine the donation type (products or meals)
        const isMealDonation = donation.category === 'prepared_meals';
        let validatedProducts = [];
        let validatedMeals = [];
        let totalMeals = 0;

        if (isMealDonation) {
            // Validate requestedMeals
            if (!requestedMeals || !Array.isArray(requestedMeals)) {
                return res.status(400).json({ message: 'requestedMeals must be an array for meal donations' });
            }

            const donationMealMap = new Map(
                donation.meals.map(mealEntry => [mealEntry.meal._id.toString(), { quantity: mealEntry.quantity, meal: mealEntry.meal }])
            );

            for (const { meal: mealId, quantity } of requestedMeals) {
                if (!mongoose.Types.ObjectId.isValid(mealId)) {
                    return res.status(400).json({ message: `Invalid meal ID: ${mealId}` });
                }
                if (!donationMealMap.has(mealId)) {
                    return res.status(400).json({ message: `Meal ${mealId} is not part of this donation` });
                }

                const availableQuantity = donationMealMap.get(mealId).quantity;
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    return res.status(400).json({ message: `Quantity for meal ${mealId} must be a positive integer` });
                }
                if (quantity > availableQuantity) {
                    return res.status(400).json({ message: `Requested quantity (${quantity}) for meal ${mealId} exceeds available quantity (${availableQuantity})` });
                }

                validatedMeals.push({ meal: mealId, quantity });
                totalMeals += quantity;
            }

            if (totalMeals !== numberOfMeals) {
                return res.status(400).json({ message: `Total requested meals (${totalMeals}) do not match provided numberOfMeals (${numberOfMeals})` });
            }
            if (totalMeals > donation.numberOfMeals) {
                return res.status(400).json({ message: `Total requested meals (${totalMeals}) exceed available number of meals (${donation.numberOfMeals})` });
            }
        } else {
            // Validate requestedProducts
            if (!requestedProducts || !Array.isArray(requestedProducts)) {
                return res.status(400).json({ message: 'requestedProducts must be an array for product donations' });
            }

            const donationProductMap = new Map(
                donation.products.map(p => [p.product._id.toString(), { quantity: p.quantity, product: p.product }])
            );

            for (const { product: productId, quantity } of requestedProducts) {
                if (!mongoose.Types.ObjectId.isValid(productId)) {
                    return res.status(400).json({ message: `Invalid product ID: ${productId}` });
                }
                if (!donationProductMap.has(productId)) {
                    return res.status(400).json({ message: `Product ${productId} is not part of this donation` });
                }

                const availableQuantity = donationProductMap.get(productId).quantity;
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    return res.status(400).json({ message: `Quantity for product ${productId} must be a positive integer` });
                }
                if (quantity > availableQuantity) {
                    return res.status(400).json({ message: `Requested quantity (${quantity}) for product ${productId} exceeds available quantity (${availableQuantity})` });
                }

                validatedProducts.push({ product: productId, quantity });
            }
        }

        // Create the new RequestNeed
        const newRequest = new RequestNeed({
            title: `Request for ${donation.title}`,
            location: donation.location,
            expirationDate: donation.expirationDate,
            description: description || '',
            category: donation.category,
            recipient: recipientId,
            requestedProducts: isMealDonation ? [] : validatedProducts,
            requestedMeals: isMealDonation ? validatedMeals : [],
            status: 'pending',
            linkedDonation: [donationId],
            isaPost:false,
            numberOfMeals: isMealDonation ? totalMeals : undefined,
        });

        await newRequest.save();

        // Update the Donation to link the new request
        await Donation.findByIdAndUpdate(
            donationId,
            { $push: { linkedRequests: newRequest._id } },
            { new: true }
        );

        // Fetch the populated request for the response
        const populatedRequest = await RequestNeed.findById(newRequest._id)
            .populate('recipient')
            .populate('requestedProducts.product')
            .populate('requestedMeals.meal');

        // Send notification to donor (if email exists)
        if (donation.donor && donation.donor.email) {
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
                to: donation.donor.email,
                subject: `New Request for Your Donation: ${donation.title}`,
                text: `Dear ${donation.donor.name || 'Donor'},

A new request has been made for your donation titled "${donation.title}".

Request Details:
- Title: ${newRequest.title}
- Recipient: ${recipient.name || 'Unknown Recipient'}
${isMealDonation ? 
    `- Requested Meals: ${validatedMeals.map(item => {
        const mealEntry = donation.meals.find(m => m.meal._id.toString() === item.meal.toString());
        return `${mealEntry.meal.mealName} (Quantity: ${item.quantity})`;
    }).join(', ')} (Total: ${totalMeals})` :
    `- Requested Products: ${validatedProducts.map(item => {
        const productEntry = donation.products.find(p => p.product._id.toString() === item.product.toString());
        return `${productEntry.product.name} (Quantity: ${item.quantity})`;
    }).join(', ')}`
}
- Expiration Date: ${newRequest.expirationDate.toLocaleDateString()}

You can review the request in your dashboard.

Best regards,
Your Platform Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: black;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                        </div>
                        <h2 style="color: #228b22;">New Request for Your Donation</h2>
                        <p>Dear ${donation.donor.name || 'Donor'},</p>
                        <p>A new request has been made for your donation titled "<strong>${donation.title}</strong>".</p>
                        <h3>Request Details:</h3>
                        <ul>
                            <li><strong>Title:</strong> ${newRequest.title}</li>
                            <li><strong>Recipient:</strong> ${recipient.name || 'Unknown Recipient'}</li>
                            ${isMealDonation ? 
                                `<li><strong>Requested Meals:</strong> ${validatedMeals.map(item => {
                                    const mealEntry = donation.meals.find(m => m.meal._id.toString() === item.meal.toString());
                                    return `${mealEntry.meal.mealName} (Quantity: ${item.quantity})`;
                                }).join(', ')} (Total: ${totalMeals})</li>` :
                                `<li><strong>Requested Products:</strong> ${validatedProducts.map(item => {
                                    const productEntry = donation.products.find(p => p.product._id.toString() === item.product.toString());
                                    return `${productEntry.product.name} (Quantity: ${item.quantity})`;
                                }).join(', ')}</li>`
                            }
                            <li><strong>Expiration Date:</strong> ${newRequest.expirationDate.toLocaleDateString()}</li>
                        </ul>
                        <p>You can review the request in your dashboard.</p>
                        <p style="margin-top: 20px;">Best regards,<br>Your Platform Team</p>
                    </div>
                `,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, '../uploads/logo.png'),
                        cid: 'logo',
                    },
                ],
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${donation.donor.email}`);
        }

        res.status(201).json({
            message: 'Request created successfully for the donation',
            request: populatedRequest,
        });
    } catch (error) {
        console.error('Create Request Error:', error);
        res.status(500).json({
            message: 'Failed to create request for the donation',
            error: error.message,
        });
    }
}

async function addDonationToRequest(req, res) {
    try {
        const { requestId } = req.params;
        const { products, meals, donor, expirationDate, numberOfMeals } = req.body;

        // ### Input Validation
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Valid Request ID is required' });
        }

        if (!donor || !mongoose.Types.ObjectId.isValid(donor)) {
            return res.status(400).json({ message: 'Valid Donor ID is required' });
        }

        // Fetch the request with populated fields
        const request = await RequestNeed.findById(requestId)
            .populate('requestedProducts.product')
            .populate('recipient');
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validate based on category
        let donationProducts = [];
        let donationMeals = [];
        if (request.category === 'packaged_products') {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return res.status(400).json({ message: 'Products array is required for packaged_products category' });
            }

            // Create a map of requested products with their quantities
            const productMap = new Map(
                request.requestedProducts.map(p => [p.product?._id.toString(), p.quantity])
            );

            // Validate and map the products from the request body
            donationProducts = products.map(({ product, quantity }) => {
                if (!product || !mongoose.Types.ObjectId.isValid(product)) {
                    throw new Error(`Invalid product ID: ${product}`);
                }
                if (!productMap.has(product)) {
                    throw new Error(`Product ${product} not found in request`);
                }
                const maxQty = productMap.get(product);
                if (typeof quantity !== 'number' || quantity < 0) {
                    throw new Error(`Invalid quantity for product ${product}: ${quantity}`);
                }
                return {
                    product,
                    quantity: Math.min(quantity, maxQty),
                };
            });
        } else if (request.category === 'prepared_meals') {
            if (!meals || !Array.isArray(meals) || meals.length === 0) {
                return res.status(400).json({ message: 'Meals array is required for prepared_meals category' });
            }

            if (typeof numberOfMeals !== 'number' || numberOfMeals <= 0) {
                return res.status(400).json({ message: 'numberOfMeals must be a positive number for prepared_meals category' });
            }

            // Validate meals input
            for (const meal of meals) {
                if (!meal.mealName || typeof meal.mealName !== 'string' || meal.mealName.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealName' });
                }
                if (!meal.mealDescription || typeof meal.mealDescription !== 'string' || meal.mealDescription.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealDescription' });
                }
                if (!meal.mealType || typeof meal.mealType !== 'string' || meal.mealType.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealType' });
                }
                if (typeof meal.quantity !== 'number' || meal.quantity < 1) {
                    return res.status(400).json({ message: `Invalid quantity for meal ${meal.mealName}: ${meal.quantity}` });
                }
            }

            // Create or find Meals documents and build donationMeals
            donationMeals = [];
            for (const meal of meals) {
                // Check if a Meals document already exists with the same mealName and mealType
                let mealDoc = await Meals.findOne({
                    mealName: meal.mealName,
                    mealType: meal.mealType
                });

                // If not found, create a new Meals document
                if (!mealDoc) {
                    // Generate a unique id for the Meals document using the Counter model
                    const counter = await Counter.findOneAndUpdate(
                        { _id: 'MealId' },
                        { $inc: { seq: 1 } },
                        { new: true, upsert: true }
                    );

                    mealDoc = new Meals({
                        id: counter.seq.toString(),
                        mealName: meal.mealName,
                        mealDescription: meal.mealDescription,
                        mealType: meal.mealType,
                        quantity: Number(meal.quantity)
                    });
                    await mealDoc.save();
                }

                // Add to donationMeals with the meal ID
                donationMeals.push({
                    meal: mealDoc._id,
                    quantity: Number(meal.quantity)
                });
            }

            // Validate numberOfMeals
            const totalMeals = donationMeals.reduce((sum, m) => sum + m.quantity, 0);
            if (totalMeals !== numberOfMeals) {
                return res.status(400).json({
                    message: `Total quantity of meals (${totalMeals}) must match numberOfMeals (${numberOfMeals})`
                });
            }
        } else {
            return res.status(400).json({ message: 'Invalid request category' });
        }

        // ### Create New Donation
        const newDonation = new Donation({
            title: request.title,
            donor: donor || req.user._id,
            description: `Donation for request ${request.title}`,
            category: request.category,
            location: request.location,
            products: donationProducts,
            meals: donationMeals,
            numberOfMeals: request.category === 'prepared_meals' ? numberOfMeals : undefined,
            expirationDate: expirationDate || request.expirationDate,
            isaPost:false,
            linkedRequests: [requestId],
        });

        const savedDonation = await newDonation.save();

        // ### Update Request's linkedDonation Field
        if (!request.linkedDonation) {
            request.linkedDonation = [];
        }
        request.linkedDonation.push(savedDonation._id);
        await request.save();

        // ### Send Notification Email
        const recipient = request.recipient;
        if (recipient && recipient.email) {
            const populatedDonation = await Donation.findById(savedDonation._id)
                .populate('donor')
                .populate('meals.meal')
                .populate('products.product');

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

            // Prepare email content with fallbacks
            const productList = populatedDonation.products?.length > 0
                ? populatedDonation.products
                    .map(p => `${p.product?.name || 'Unknown Product'} (Quantity: ${p.quantity || 0})`)
                    .join(', ')
                : 'None';
            const mealList = populatedDonation.meals?.length > 0
                ? populatedDonation.meals
                    .map(m => `${m.meal?.mealName || 'Unknown Meal'} (Type: ${m.meal?.mealType || 'Unknown Type'}, Quantity: ${m.quantity || 0})`)
                    .join(', ')
                : 'None';

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipient.email,
                subject: `New Donation Added to Your Request: ${request.title}`,
                text: `Dear ${recipient.name || 'Recipient'},

A new donation has been added to your request titled "${request.title}".

Donation Details:
- Title: ${populatedDonation.title}
- Donor: ${populatedDonation.donor?.name || 'Unknown Donor'}
${request.category === 'packaged_products' ? `- Products: ${productList}` : `- Meals: ${mealList}`}
- Expiration Date: ${populatedDonation.expirationDate ? new Date(populatedDonation.expirationDate).toLocaleDateString() : 'Not set'}

Thank you for using our platform!

Best regards,
Your Platform Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: black;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                        </div>
                        <h2 style="color: #228b22;">New Donation Added to Your Request</h2>
                        <p>Dear ${recipient.name || 'Recipient'},</p>
                        <p>A new donation has been added to your request titled "<strong>${request.title}</strong>".</p>
                        <h3>Donation Details:</h3>
                        <ul>
                            <li><strong>Title:</strong> ${populatedDonation.title}</li>
                            <li><strong>Donor:</strong> ${populatedDonation.donor?.name || 'Unknown Donor'}</li>
                            ${request.category === 'packaged_products' ? `<li><strong>Products:</strong> ${productList}</li>` : `<li><strong>Meals:</strong> ${mealList}</li>`}
                            <li><strong>Expiration Date:</strong> ${populatedDonation.expirationDate ? new Date(populatedDonation.expirationDate).toLocaleDateString() : 'Not set'}</li>
                        </ul>
                        <p>Thank you for using our platform!</p>
                        <p style="margin-top: 20px;">Best regards,<br>Your Platform Team</p>
                    </div>
                `,
                attachments: [],
            };

            // Add logo attachment if the file exists
            const logoPath = path.join(__dirname, '../uploads/logo.png');
            const fs = require('fs');
            if (fs.existsSync(logoPath)) {
                mailOptions.attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo',
                });
            } else {
                console.warn('Logo file not found at:', logoPath);
                // Remove the logo from the HTML if the file is missing
                mailOptions.html = mailOptions.html.replace('<img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />', '');
            }

            try {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${recipient.email}`);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
                // Continue with the response even if email fails
            }
        } else {
            console.warn('Recipient email not found for request:', requestId);
        }

        // ### Response
        res.status(201).json({
            message: 'Donation added to request successfully',
            donation: savedDonation,
        });
    } catch (error) {
        console.error('Donation Error:', error);
        res.status(500).json({ message: 'Failed to add donation to request', error: error.message });
    }
}
async function UpdateAddDonationToRequest(req, res) {
    try {
        const { requestId } = req.params;
        const { donationId, products, meals, donor, expirationDate, numberOfMeals, fulfilledItems } = req.body;

        // ### Input Validation
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Valid Request ID is required' });
        }

        if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
            return res.status(400).json({ message: 'Valid Donation ID is required' });
        }

        if (!donor || !mongoose.Types.ObjectId.isValid(donor)) {
            return res.status(400).json({ message: 'Valid Donor ID is required' });
        }

        // Fetch the request with populated fields
        const request = await RequestNeed.findById(requestId)
            .populate('requestedProducts.product')
            .populate('recipient');
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Fetch the existing donation
        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        // Validate donor
        if (donation.donor.toString() !== donor) {
            return res.status(403).json({ message: 'Donor does not match the donation owner' });
        }

        // Check if the donation is already assigned to this request
        if (donation.linkedRequests && donation.linkedRequests.includes(requestId)) {
            return res.status(400).json({ message: 'Donation is already assigned to this request' });
        }

        // Validate based on category
        let donationProducts = [];
        let donationMeals = [];
        if (request.category === 'packaged_products') {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return res.status(400).json({ message: 'Products array is required for packaged_products category' });
            }

            // Create a map of requested products with their quantities
            const productMap = new Map(
                request.requestedProducts.map(p => [p.product?._id.toString(), p.quantity])
            );

            // Validate and map the products from the request body
            donationProducts = products.map(({ product, quantity }) => {
                if (!product || !mongoose.Types.ObjectId.isValid(product)) {
                    throw new Error(`Invalid product ID: ${product}`);
                }
                if (!productMap.has(product)) {
                    throw new Error(`Product ${product} not found in request`);
                }
                const maxQty = productMap.get(product);
                if (typeof quantity !== 'number' || quantity < 0) {
                    throw new Error(`Invalid quantity for product ${product}: ${quantity}`);
                }
                return {
                    product,
                    quantity: Math.min(quantity, maxQty),
                };
            });

            // Update donation products
            donation.products = donationProducts;
        } else if (request.category === 'prepared_meals') {
            if (!meals || !Array.isArray(meals) || meals.length === 0) {
                return res.status(400).json({ message: 'Meals array is required for prepared_meals category' });
            }

            if (typeof numberOfMeals !== 'number' || numberOfMeals <= 0) {
                return res.status(400).json({ message: 'numberOfMeals must be a positive number for prepared_meals category' });
            }

            // Validate meals input
            for (const meal of meals) {
                if (!meal.mealName || typeof meal.mealName !== 'string' || meal.mealName.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealName' });
                }
                if (!meal.mealDescription || typeof meal.mealDescription !== 'string' || meal.mealDescription.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealDescription' });
                }
                if (!meal.mealType || typeof meal.mealType !== 'string' || meal.mealType.trim() === '') {
                    return res.status(400).json({ message: 'Each meal must have a valid mealType' });
                }
                if (typeof meal.quantity !== 'number' || meal.quantity < 1) {
                    return res.status(400).json({ message: `Invalid quantity for meal ${meal.mealName}: ${meal.quantity}` });
                }
            }

            // Create or find Meals documents and build donationMeals
            donationMeals = [];
            for (const meal of meals) {
                // Check if a Meals document already exists with the same mealName and mealType
                let mealDoc = await Meals.findOne({
                    mealName: meal.mealName,
                    mealType: meal.mealType
                });

                // If not found, create a new Meals document
                if (!mealDoc) {
                    // Generate a unique id for the Meals document using the Counter model
                    const counter = await Counter.findOneAndUpdate(
                        { _id: 'MealId' },
                        { $inc: { seq: 1 } },
                        { new: true, upsert: true }
                    );

                    mealDoc = new Meals({
                        id: counter.seq.toString(),
                        mealName: meal.mealName,
                        mealDescription: meal.mealDescription,
                        mealType: meal.mealType,
                        quantity: Number(meal.quantity)
                    });
                    await mealDoc.save();
                }

                // Add to donationMeals with the meal ID
                donationMeals.push({
                    meal: mealDoc._id,
                    quantity: Number(meal.quantity)
                });
            }

            // Validate numberOfMeals
            const totalMeals = donationMeals.reduce((sum, m) => sum + m.quantity, 0);
            if (totalMeals !== numberOfMeals) {
                return res.status(400).json({
                    message: `Total quantity of meals (${totalMeals}) must match numberOfMeals (${numberOfMeals})`
                });
            }

            // Update donation meals
            donation.meals = donationMeals;
            donation.numberOfMeals = numberOfMeals;
        } else {
            return res.status(400).json({ message: 'Invalid request category' });
        }

        // ### Update Donation
        if (!donation.linkedRequests) {
            donation.linkedRequests = [];
        }
        donation.linkedRequests.push(requestId);

        // Update expiration date if provided
        if (expirationDate) {
            donation.expirationDate = expirationDate;
        }

        // Calculate total quantity allocated across all linked requests
        let totalAllocated = 0;
        for (const linkedRequestId of donation.linkedRequests) {
            const linkedRequest = await RequestNeed.findById(linkedRequestId);
            if (linkedRequest) {
                const fulfilledForThisRequest = linkedRequest.linkedDonation
                    .filter(d => d.toString() === donationId)
                    .length > 0
                    ? fulfilledItems.reduce((sum, item) => sum + item.quantity, 0)
                    : 0;
                totalAllocated += fulfilledForThisRequest;
            }
        }

        // Calculate total available quantity in the donation
        const totalAvailable = donation.category === 'packaged_products'
            ? donation.products.reduce((sum, p) => sum + p.quantity, 0)
            : donation.numberOfMeals || 0;

        // Update donation status
        donation.status = totalAllocated >= totalAvailable ? "fulfilled" : "partially_fulfilled";

        await donation.save();

        // ### Update Request's linkedDonation Field
        if (!request.linkedDonation) {
            request.linkedDonation = [];
        }
        if (!request.linkedDonation.includes(donationId)) {
            request.linkedDonation.push(donationId);
        }

        // Calculate and update request status based on fulfilled items
        const totalFulfilledForRequest = fulfilledItems.reduce((total, item) => total + item.quantity, 0);
        request.status = totalFulfilledForRequest >= request.numberOfMeals
            ? "fulfilled"
            : "partially_fulfilled";

        await request.save();

        // ### Send Notification Email
        const recipient = request.recipient;
        if (recipient && recipient.email) {
            const populatedDonation = await Donation.findById(donationId)
                .populate('donor')
                .populate('meals.meal')
                .populate('products.product');

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

            // Prepare email content with fallbacks
            const productList = populatedDonation.products?.length > 0
                ? populatedDonation.products
                    .map(p => `${p.product?.name || 'Unknown Product'} (Quantity: ${p.quantity || 0})`)
                    .join(', ')
                : 'None';
            const mealList = populatedDonation.meals?.length > 0
                ? populatedDonation.meals
                    .map(m => `${m.meal?.mealName || 'Unknown Meal'} (Type: ${m.meal?.mealType || 'Unknown Type'}, Quantity: ${m.quantity || 0})`)
                    .join(', ')
                : 'None';

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipient.email,
                subject: `Donation Assigned to Your Request: ${request.title}`,
                text: `Dear ${recipient.name || 'Recipient'},

A donation has been assigned to your request titled "${request.title}".

Donation Details:
- Title: ${populatedDonation.title}
- Donor: ${populatedDonation.donor?.name || 'Unknown Donor'}
${request.category === 'packaged_products' ? `- Products: ${productList}` : `- Meals: ${mealList}`}
- Expiration Date: ${populatedDonation.expirationDate ? new Date(populatedDonation.expirationDate).toLocaleDateString() : 'Not set'}

Thank you for using our platform!

Best regards,
Your Platform Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: black;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                        </div>
                        <h2 style="color: #228b22;">Donation Assigned to Your Request</h2>
                        <p>Dear ${recipient.name || 'Recipient'},</p>
                        <p>A donation has been assigned to your request titled "<strong>${request.title}</strong>".</p>
                        <h3>Donation Details:</h3>
                        <ul>
                            <li><strong>Title:</strong> ${populatedDonation.title}</li>
                            <li><strong>Donor:</strong> ${populatedDonation.donor?.name || 'Unknown Donor'}</li>
                            ${request.category === 'packaged_products' ? `<li><strong>Products:</strong> ${productList}</li>` : `<li><strong>Meals:</strong> ${mealList}</li>`}
                            <li><strong>Expiration Date:</strong> ${populatedDonation.expirationDate ? new Date(populatedDonation.expirationDate).toLocaleDateString() : 'Not set'}</li>
                        </ul>
                        <p>Thank you for using our platform!</p>
                        <p style="margin-top: 20px;">Best regards,<br>Your Platform Team</p>
                    </div>
                `,
                attachments: [],
            };

            // Add logo attachment if the file exists
            const logoPath = path.join(__dirname, '../uploads/logo.png');
            if (fs.existsSync(logoPath)) {
                mailOptions.attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo',
                });
            } else {
                console.warn('Logo file not found at:', logoPath);
                // Remove the logo from the HTML if the file is missing
                mailOptions.html = mailOptions.html.replace('<img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />', '');
            }

            try {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${recipient.email}`);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
                // Continue with the response even if email fails
            }
        } else {
            console.warn('Recipient email not found for request:', requestId);
        }

        // ### Response
        res.status(200).json({
            message: 'Donation assigned to request successfully',
            donation,
        });
    } catch (error) {
        console.error('Donation Assignment Error:', error);
        res.status(500).json({ message: 'Failed to assign donation to request', error: error.message });
    }
}


async function getRequestWithDonations(req, res) {
    try {
        const { requestId } = req.params;
        
        // Get the request with its donations and transactions
        const request = await RequestNeed.findById(requestId)
            .populate('recipient')
            .populate('requestedProducts.product')
            .populate('linkedDonation');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Get all transactions related to this request
        const transactions = await DonationTransaction.find({ requestNeed: requestId })
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('donor');

        res.status(200).json({
            request,
            transactions
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
}

async function getRequestsByDonationId(req, res) {
    try {
        const { donationId } = req.params;
        console.log(`Fetching requests for donationId: ${donationId}`);

        // Validate donationId
        if (!mongoose.Types.ObjectId.isValid(donationId)) {
            return res.status(400).json({ message: 'Invalid donation ID' });
        }

        // Step 1: Find the requests and populate necessary fields
        const requests = await RequestNeed.find({
            $or: [
                { linkedDonation: donationId },
                { linkedDonation: { $in: [donationId] } }
            ]
        })
            .populate('recipient') // Populate the recipient field
            .populate('requestedProducts.product') // Populate the product field in requestedProducts
            .populate('requestedMeals.meal'); // Populate the meal field in requestedMeals

        console.log(`Found ${requests.length} requests for donationId: ${donationId}`);
        if (!requests.length) {
            return res.status(404).json({ message: 'No requests found for this donation' });
        }

        // Log the populated requests
        console.log('Populated requests:', JSON.stringify(requests, null, 2));

        // Step 2: Clean up the response (optional, as frontend handles most edge cases)
        const cleanedRequests = requests.map(request => {
            // Convert Mongoose document to plain object
            const requestObj = request.toObject();

            // Ensure recipient is an object, even if population failed
            if (!requestObj.recipient) {
                console.warn(`Recipient not found for request ${requestObj._id}`);
                requestObj.recipient = { firstName: 'Unknown', lastName: '', role: 'N/A' };
            }

            // Clean up requestedProducts if category is packaged_products
            if (requestObj.category === 'packaged_products') {
                requestObj.requestedProducts = requestObj.requestedProducts?.map(item => {
                    if (!item.product) {
                        console.warn(`Product not found for requestedProduct in request ${requestObj._id}`);
                        return {
                            product: { name: 'N/A', productType: 'N/A', weightPerUnit: 0, weightUnit: 'N/A' },
                            quantity: item.quantity || 0
                        };
                    }
                    return item;
                }) || [];
            }

            // Clean up requestedMeals if category is prepared_meals
            if (requestObj.category === 'prepared_meals') {
                requestObj.requestedMeals = requestObj.requestedMeals?.map(item => {
                    if (!item.meal) {
                        console.warn(`Meal not found for requestedMeal in request ${requestObj._id}`);
                        return {
                            meal: { mealName: 'N/A', mealType: 'N/A', mealDescription: 'N/A' },
                            quantity: item.quantity || 0
                        };
                    }
                    return item;
                }) || [];
            }

            return requestObj;
        });

        res.status(200).json(cleanedRequests);
    } catch (error) {
        console.error('Error in getRequestsByDonationId:', error.message, error.stack);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

module.exports = {
    addDonationToRequest,
    getAllRequests,
    getRequestById,
    getRequestsByRecipientId,
    getRequestsByStatus,
    createRequest,
    updateRequest,
    deleteRequest,
    createRequestNeedForExistingDonation,
    getRequestWithDonations,
    getRequestsByDonationId,UpdateAddDonationToRequest
};