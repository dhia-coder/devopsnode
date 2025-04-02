const DonationTransaction = require('../models/DonationTransaction');
const RequestNeed = require('../models/RequestNeed');
const Donation = require('../models/Donation');
const Product = require('../models/Product');
const Meal = require('../models/Meals'); // Add Meals model
const Counter = require('../models/Counter');
const nodemailer = require("nodemailer");
const path = require("path");
const User = require('../models/User');

// Function to send email notifications
async function sendEmail(to, subject, text, html, attachments = []) {
    try {
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
            to,
            subject,
            text,
            html,
            attachments,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

// ✅ Get all donation transactions
async function getAllDonationTransactions(req, res) {
    try {
        const transactions = await DonationTransaction.find()
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get donation transaction by ID
async function getDonationTransactionById(req, res) {
    try {
        const { id } = req.params;
        const transaction = await DonationTransaction.findById(id)
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!transaction) {
            return res.status(404).json({ message: 'Donation transaction not found' });
        }

        res.status(200).json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get donation transactions by RequestNeed ID
async function getDonationTransactionsByRequestNeedId(req, res) {
    try {
        const { requestNeedId } = req.params;
        const transactions = await DonationTransaction.find({ requestNeed: requestNeedId })
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!transactions.length) {
            return res.status(404).json({ message: 'No transactions found for this request need' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get donation transactions by Donation ID
async function getDonationTransactionsByDonationId(req, res) {
    try {
        const { donationId } = req.params;
        const transactions = await DonationTransaction.find({ donation: donationId })
            .populate('requestNeed')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!transactions.length) {
            return res.status(404).json({ message: 'No transactions found for this donation' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Get donation transactions by Status
async function getDonationTransactionsByStatus(req, res) {
    try {
        const { status } = req.params;
        const transactions = await DonationTransaction.find({ status })
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!transactions.length) {
            return res.status(404).json({ message: 'No transactions found with this status' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Create a new donation transaction
async function createDonationTransaction(req, res) {
    try {
        const { requestNeed, donation, allocatedProducts, allocatedMeals, status } = req.body;

        // Validate required fields
        if (!requestNeed || !donation || (!allocatedProducts && !allocatedMeals) || !status) {
            return res.status(400).json({ message: 'RequestNeed, donation, at least one of allocatedProducts or allocatedMeals, and status are required' });
        }

        // Validate allocatedProducts if provided
        if (allocatedProducts && (!Array.isArray(allocatedProducts) || !allocatedProducts.length)) {
            return res.status(400).json({ message: 'allocatedProducts must be a non-empty array if provided' });
        }

        // Validate allocatedMeals if provided
        if (allocatedMeals && (!Array.isArray(allocatedMeals) || !allocatedMeals.length)) {
            return res.status(400).json({ message: 'allocatedMeals must be a non-empty array if provided' });
        }

        // Create the donation transaction
        const newTransaction = new DonationTransaction({
            requestNeed,
            donation,
            allocatedProducts: allocatedProducts || [],
            allocatedMeals: allocatedMeals || [],
            status
        });

        await newTransaction.save();
        res.status(201).json({ message: 'Donation transaction created successfully', newTransaction });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create donation transaction', error });
    }
}

// ✅ Update a donation transaction by ID
async function updateDonationTransaction(req, res) {
    try {
        const { id } = req.params;
        const { requestNeed, donation, allocatedProducts, allocatedMeals, status } = req.body;

        const updatedTransaction = await DonationTransaction.findByIdAndUpdate(
            id,
            { requestNeed, donation, allocatedProducts, allocatedMeals, status },
            { new: true }
        )
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!updatedTransaction) {
            return res.status(404).json({ message: 'Donation transaction not found' });
        }

        res.status(200).json({ message: 'Donation transaction updated successfully', updatedTransaction });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update donation transaction', error });
    }
}

// ✅ Delete a donation transaction by ID
async function deleteDonationTransaction(req, res) {
    try {
        const { id } = req.params;
        const deletedTransaction = await DonationTransaction.findByIdAndDelete(id);

        if (!deletedTransaction) {
            return res.status(404).json({ message: 'Donation transaction not found' });
        }

        res.status(200).json({ message: 'Donation transaction deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete donation transaction', error });
    }
}

// ✅ Get transactions by recipient ID
async function getTransactionsByRecipientId(req, res) {
    try {
        const { recipientId } = req.params;
        const transactions = await DonationTransaction.find({ recipient: recipientId })
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal') // Populate allocatedMeals
            .populate('donor');

        if (!transactions.length) {
            return res.status(404).json({ message: 'No transactions found for this recipient' });
        }

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

// ✅ Accept a donation transaction
async function acceptDonationTransaction(req, res) {
    try {
        const { transactionId } = req.params;
        const transaction = await DonationTransaction.findById(transactionId)
            .populate('requestNeed')
            .populate('donation')
            .populate('allocatedProducts.product')
            .populate('allocatedMeals.meal'); // Populate allocatedMeals

        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        if (transaction.status !== 'pending') return res.status(400).json({ message: `Transaction cannot be accepted in its current state (${transaction.status})` });

        const donation = transaction.donation;

        // Update product quantities if category is packaged_products
        if (donation.category === 'packaged_products') {
            for (const allocatedProduct of transaction.allocatedProducts) {
                const donationProduct = donation.products.find(p => p.product.toString() === allocatedProduct.product._id.toString());
                if (donationProduct) {
                    donationProduct.quantity -= allocatedProduct.quantity;
                    if (donationProduct.quantity < 0) donationProduct.quantity = 0;
                }
            }
        }

        // Update meal quantities if category is prepared_meals
        if (donation.category === 'prepared_meals') {
            const totalDonationMeals = donation.meals.reduce((sum, m) => sum + m.quantity, 0);
            let remainingMealsToAllocate = Math.min(requestNeed.numberOfMeals, totalDonationMeals);
        
            // Filter out fully allocated meals instead of setting quantity to 0
            donation.meals = donation.meals.filter(donationMeal => {
                if (remainingMealsToAllocate <= 0) return true; // Keep remaining meals
        
                const availableQty = donationMeal.quantity;
                const allocatedQty = Math.min(availableQty, remainingMealsToAllocate);
                if (allocatedQty > 0) {
                    allocatedMeals.push({
                        meal: donationMeal.meal._id,
                        quantity: allocatedQty
                    });
                    donationMeal.quantity -= allocatedQty;
                    remainingMealsToAllocate -= allocatedQty;
                }
                return donationMeal.quantity > 0; // Only keep meals with quantity > 0
            });
        
            if (allocatedMeals.length === 0) {
                return res.status(400).json({ message: 'No valid meals available to allocate' });
            }
        
            console.log('Allocated meals:', allocatedMeals);
            isFullyFulfilled = remainingMealsToAllocate === 0 && totalDonationMeals >= requestNeed.numberOfMeals;
        }

        await donation.save();

        transaction.status = 'approved';
        transaction.responseDate = new Date();
        await transaction.save();

        await checkRequestFulfillment(transaction.requestNeed._id);

        res.status(200).json({ message: 'Donation accepted successfully', transaction });
    } catch (error) {
        res.status(500).json({ message: 'Failed to accept donation', error: error.message });
    }
}

// ✅ Reject a donation transaction
async function rejectDonationTransaction(req, res) {
    try {
        const { transactionId } = req.params;
        const { rejectionReason } = req.body;

        const transaction = await DonationTransaction.findById(transactionId).populate('donation');
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({ 
                message: `Transaction cannot be rejected in its current state (${transaction.status})`
            });
        }

        transaction.status = 'rejected';
        transaction.responseDate = new Date();
        transaction.rejectionReason = rejectionReason || 'No reason provided';
        await transaction.save();

        const donation = transaction.donation;
        if (donation) {
            donation.status = 'rejected';
            await donation.save();
        }

        res.status(200).json({ 
            message: 'Donation rejected successfully', 
            transaction 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to reject donation', 
            error: error.message 
        });
    }
}

// ✅ Create and accept a donation transaction
// ✅ Create and accept a donation transaction
// ✅ Create and accept a donation transaction
async function createAndAcceptDonationTransaction(req, res) {
    try {
        const { donationId, requestNeedId } = req.body;
        const user = req.user;

        console.log('Creating transaction with:', { donationId, requestNeedId, userId: user?._id });

        // Validate input
        if (!donationId || !requestNeedId) {
            return res.status(400).json({ message: 'donationId and requestNeedId are required' });
        }

        // Fetch donation and populate products and meals
        const donation = await Donation.findById(donationId)
            .populate('products.product')
            .populate('meals.meal'); // Populate meals
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        console.log('Donation fetched:', JSON.stringify(donation, null, 2));

        // Fetch the donor to get their email and name
        const donor = await User.findById(donation.donor);
        if (!donor) return res.status(404).json({ message: 'Donor not found' });

        // Fetch request need
        const requestNeed = await RequestNeed.findById(requestNeedId)
            .populate('requestedProducts')
            .populate('requestedMeals'); // Populate requestedMeals
        if (!requestNeed) return res.status(404).json({ message: 'RequestNeed not found' });
        console.log('RequestNeed fetched:', JSON.stringify(requestNeed, null, 2));

        const recipientId = requestNeed.recipient || user._id;

        // Validate donation status
        if (donation.status !== 'pending') {
            return res.status(400).json({ message: `Donation cannot be used in its current state (${donation.status})` });
        }

        // Validate category match
        if (donation.category !== requestNeed.category) {
            return res.status(400).json({ message: 'Donation and request categories do not match' });
        }

        let allocatedProducts = [];
        let allocatedMeals = [];
        let isFullyFulfilled = false;

        // Handle packaged_products
        if (donation.category === 'packaged_products') {
            const requestProducts = await Product.find({ _id: { $in: requestNeed.requestedProducts } });
            if (!requestProducts.length) {
                return res.status(400).json({ message: 'No products found for this request' });
            }
            console.log('Request products fetched:', JSON.stringify(requestProducts, null, 2));

            const donationMap = new Map(donation.products.map(p => [p.product._id.toString(), p.quantity]));
            console.log('Donation products map:', [...donationMap]);

            const requestMap = new Map(requestProducts.map(p => [p._id.toString(), p.totalQuantity]));
            console.log('Request products map:', [...requestMap]);

            const updatedProducts = [];
            for (const [productId, totalQuantity] of requestMap) {
                const availableQty = donationMap.get(productId) || 0;
                if (availableQty > 0 && totalQuantity > 0) {
                    const allocatedQty = Math.min(availableQty, totalQuantity);
                    allocatedProducts.push({
                        product: productId,
                        quantity: allocatedQty
                    });

                    const product = requestProducts.find(p => p._id.toString() === productId);
                    product.totalQuantity -= allocatedQty;
                    if (product.totalQuantity < 0) product.totalQuantity = 0;
                    updatedProducts.push(product);
                    console.log(`Updated product ${productId} totalQuantity: ${product.totalQuantity}`);
                }
            }

            if (!allocatedProducts.length) {
                return res.status(400).json({ message: 'No matching products available to allocate' });
            }
            console.log('Allocated products:', allocatedProducts);

            for (const product of updatedProducts) {
                await product.save();
                console.log(`Product ${product._id} saved with totalQuantity: ${product.totalQuantity}`);
            }

            // Update numberOfProducts if applicable
            const remainingProducts = donation.products.reduce((sum, p) => sum + p.quantity, 0);
            if (remainingProducts === 0) {
                donation.status = 'fulfilled';
            } else {
                donation.status = 'approved';
                donation.numberOfProducts = remainingProducts;
                donation.markModified('numberOfProducts');
            }

            isFullyFulfilled = requestProducts.every(p => p.totalQuantity === 0);
        }

        // Handle prepared_meals
        // Handle prepared_meals
        // Handle prepared_meals
if (donation.category === 'prepared_meals') {
    console.log('Initial meals array:', JSON.stringify(donation.meals, null, 2));
    console.log('Initial numberOfMeals:', donation.numberOfMeals);
    console.log('Initial remainingMeals:', donation.remainingMeals);
  
    // Calculate total available meals in the donation
    const totalDonationMeals = donation.meals.reduce((sum, m) => sum + m.quantity, 0);
    console.log('Total donation meals:', totalDonationMeals);
  
    // Determine how many meals to allocate
    let remainingMealsToAllocate = Math.min(requestNeed.numberOfMeals, totalDonationMeals);
    console.log('Meals to allocate:', remainingMealsToAllocate);
  
    // Create a map of meals in the donation (meal ID to quantity)
    const donationMealsMap = new Map(donation.meals.map(m => [m.meal._id.toString(), m.quantity]));
    console.log('Donation meals map:', [...donationMealsMap]);
  
    // Allocate meals
    for (const donationMeal of donation.meals) {
      if (remainingMealsToAllocate <= 0) break;
  
      if (!donationMeal.meal || !donationMeal.meal._id) {
        console.warn(`Skipping meal allocation: meal field is missing or not populated for donationMeal: ${JSON.stringify(donationMeal)}`);
        continue;
      }
  
      const mealId = donationMeal.meal._id.toString();
      const availableQty = donationMealsMap.get(mealId) || 0;
      if (availableQty > 0) {
        const allocatedQty = Math.min(availableQty, remainingMealsToAllocate);
        allocatedMeals.push({
          meal: donationMeal.meal._id,
          quantity: allocatedQty
        });
        donationMealsMap.set(mealId, availableQty - allocatedQty);
        remainingMealsToAllocate -= allocatedQty;
        console.log(`Allocated ${allocatedQty} of meal ${mealId}, remaining in donation: ${donationMealsMap.get(mealId)}`);
      }
    }
  
    if (allocatedMeals.length === 0) {
      return res.status(400).json({ message: 'No valid meals available to allocate' });
    }
  
    // Calculate total allocated meals
    const totalAllocatedMeals = allocatedMeals.reduce((sum, meal) => sum + meal.quantity, 0);
    console.log('Total allocated meals:', totalAllocatedMeals);
  
    // Update requestNeed.numberOfMeals
    requestNeed.numberOfMeals -= totalAllocatedMeals;
    if (requestNeed.numberOfMeals < 0) requestNeed.numberOfMeals = 0;
    console.log('Updated requestNeed.numberOfMeals:', requestNeed.numberOfMeals);
  
    // Update the meals array with the new quantities
    donation.meals = donation.meals
      .map(donationMeal => {
        const mealId = donationMeal.meal._id.toString();
        const remainingQty = donationMealsMap.get(mealId) || 0;
        return { ...donationMeal, quantity: remainingQty };
      })
      .filter(donationMeal => donationMeal.quantity > 0);
  
    // Calculate remaining meals in the donation
    const remainingMeals = [...donationMealsMap.values()].reduce((sum, qty) => sum + qty, 0);
    console.log('Remaining meals after allocation:', remainingMeals);
  
    // Update donation status and remainingMeals (NOT numberOfMeals)
    donation.remainingMeals = remainingMeals;
    donation.markModified('remainingMeals');
    console.log('Updated remainingMeals:', donation.remainingMeals);
  
    if (remainingMeals === 0) {
      donation.status = 'fulfilled';
      console.log('All meals allocated, marking donation as fulfilled');
    } else {
      donation.status = 'approved';
      console.log('Donation status set to approved');
    }
  
    console.log('Donation before saving:', JSON.stringify(donation, null, 2));
    await donation.save();
    console.log('Donation saved successfully');
  
    const updatedDonation = await Donation.findById(donationId);
    console.log('Donation after saving:', JSON.stringify(updatedDonation, null, 2));
  
    // Update request status
    const isFullyFulfilled = requestNeed.numberOfMeals === 0;
    requestNeed.status = isFullyFulfilled ? 'fulfilled' : 'partially_fulfilled';
    await requestNeed.save();
    console.log('RequestNeed saved successfully with numberOfMeals:', requestNeed.numberOfMeals, 'and status:', requestNeed.status);
  }

        // Update request status
        requestNeed.status = isFullyFulfilled ? 'fulfilled' : 'partially_fulfilled';
        await requestNeed.save();
        console.log('RequestNeed saved successfully with status:', requestNeed.status);

        // Create transaction
        const counter = await Counter.findOneAndUpdate(
            { _id: 'DonationTransactionId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        if (!counter) throw new Error('Failed to increment DonationTransactionId counter');
        const transactionId = counter.seq;

        const transaction = new DonationTransaction({
            id: transactionId,
            donation: donationId,
            requestNeed: requestNeedId,
            donor: donation.donor,
            recipient: recipientId,
            allocatedProducts,
            allocatedMeals,
            status: 'approved',
            responseDate: new Date()
        });

        await transaction.save();
        console.log('Transaction saved successfully:', transaction);

        // Send email notification to the donor
        if (donor.email) {
            const subject = `Your Donation "${donation.title}" Has Been Accepted`;
            let allocatedItemsText = '';
            if (donation.category === 'packaged_products') {
                const requestProducts = await Product.find({ _id: { $in: requestNeed.requestedProducts } });
                allocatedItemsText = allocatedProducts.map(ap => {
                    const product = requestProducts.find(p => p._id.toString() === ap.product.toString());
                    return `${product?.name || 'Unknown Product'} (Quantity: ${ap.quantity})`;
                }).join(', ');
            } else if (donation.category === 'prepared_meals') {
                const donationMeals = await Meal.find({ _id: { $in: donation.meals.map(m => m.meal?._id).filter(id => id) } });
                allocatedItemsText = allocatedMeals.map(am => {
                    const meal = donationMeals.find(m => m._id.toString() === am.meal.toString());
                    return `${meal?.mealName || 'Unknown Meal'} (Quantity: ${am.quantity})`;
                }).join(', ');
            }

            const text = `Dear ${donor.name || 'Donor'},

Your donation titled "${donation.title}" has been accepted.

Donation Details:
- Title: ${donation.title}
- Request: ${requestNeed.title}
- Allocated Items: ${allocatedItemsText}
- Accepted On: ${new Date().toLocaleDateString()}

Thank you for your generosity!

Best regards,
Your Platform Team`;

            const html = `
                <div style="font-family: Arial, sans-serif; color: black;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                    </div>
                    <h2 style="color: #228b22;">Your Donation Has Been Accepted</h2>
                    <p>Dear ${donor.name || 'Donor'},</p>
                    <p>Your donation titled "<strong>${donation.title}</strong>" has been accepted.</p>
                    <h3>Donation Details:</h3>
                    <ul>
                        <li><strong>Title:</strong> ${donation.title}</li>
                        <li><strong>Request:</strong> ${requestNeed.title}</li>
                        <li><strong>Allocated Items:</strong> ${allocatedItemsText}</li>
                        <li><strong>Accepted On:</strong> ${new Date().toLocaleDateString()}</li>
                    </ul>
                    <p>Thank you for your generosity!</p>
                    <p style="margin-top: 20px;">Best regards,<br>Your Platform Team</p>
                </div>
            `;

            const attachments = [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, '../uploads/logo.png'),
                    cid: 'logo',
                },
            ];

            await sendEmail(donor.email, subject, text, html, attachments);
        } else {
            console.warn(`Donor email not found for donor ID: ${donation.donor}`);
        }

        res.status(201).json({ 
            message: 'Transaction created and accepted successfully', 
            transaction,
            updatedRequest: requestNeed 
        });
    } catch (error) {
        console.error('Error creating and accepting transaction:', error.stack);
        res.status(500).json({ message: 'Failed to create and accept transaction', error: error.message });
    }
}

// ✅ Check request fulfillment
async function checkRequestFulfillment(requestId) {
    const request = await RequestNeed.findById(requestId)
      .populate('requestedProducts')
      .populate('requestedMeals');
    const transactions = await DonationTransaction.find({ 
      requestNeed: requestId, 
      status: 'approved' 
    })
      .populate('allocatedProducts.product')
      .populate('allocatedMeals.meal');
  
    let isFullyFulfilled = false;
  
    if (request.category === 'packaged_products') {
      const requestedMap = new Map(request.requestedProducts.map(p => [p._id.toString(), p.totalQuantity]));
      const allocatedMap = new Map();
  
      transactions.forEach(t => {
        t.allocatedProducts.forEach(ap => {
          const productId = ap.product._id.toString();
          allocatedMap.set(productId, (allocatedMap.get(productId) || 0) + ap.quantity);
        });
      });
  
      isFullyFulfilled = [...requestedMap].every(([productId, requestedQty]) => 
        (allocatedMap.get(productId) || 0) >= requestedQty
      );
    } else if (request.category === 'prepared_meals') {
      const totalRequestedMeals = request.numberOfMeals;
      let totalAllocatedMeals = 0;
  
      transactions.forEach(t => {
        t.allocatedMeals.forEach(am => {
          totalAllocatedMeals += am.quantity;
        });
      });
  
      // Update request.numberOfMeals based on total allocated meals
      request.numberOfMeals = totalRequestedMeals - totalAllocatedMeals;
      if (request.numberOfMeals < 0) request.numberOfMeals = 0;
  
      isFullyFulfilled = request.numberOfMeals === 0;
    }
  
    request.status = isFullyFulfilled ? 'fulfilled' : 'partially_fulfilled';
    await request.save();
    console.log('checkRequestFulfillment updated request:', request);
  }

// ✅ Reject a donation directly (without a transaction)
async function rejectDonation(req, res) {
    try {
        const { donationId } = req.params;
        const { rejectionReason } = req.body;

        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(404).json({ message: 'Donation not found' });
        }

        const donor = await User.findById(donation.donor);
        if (!donor) return res.status(404).json({ message: 'Donor not found' });

        if (donation.status !== 'pending') {
            return res.status(400).json({ 
                message: `Donation cannot be rejected in its current state (${donation.status})`
            });
        }

        donation.status = 'rejected';
        donation.rejectionReason = rejectionReason || 'No reason provided';
        await donation.save();

        if (donor.email) {
            const subject = `Your Donation "${donation.title}" Has Been Rejected`;
            const text = `Dear ${donor.name || 'Donor'},

We regret to inform you that your donation titled "${donation.title}" has been rejected.

Donation Details:
- Title: ${donation.title}
- Rejection Reason: ${rejectionReason || 'No reason provided'}
- Rejected On: ${new Date().toLocaleDateString()}

If you have any questions, please contact our support team.

Best regards,
Your Platform Team`;

            const html = `
                <div style="font-family: Arial, sans-serif; color: black;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Platform Logo" style="max-width: 150px; height: auto;" />
                    </div>
                    <h2 style="color: #dc3545;">Your Donation Has Been Rejected</h2>
                    <p>Dear ${donor.name || 'Donor'},</p>
                    <p>We regret to inform you that your donation titled "<strong>${donation.title}</strong>" has been rejected.</p>
                    <h3>Donation Details:</h3>
                    <ul>
                        <li><strong>Title:</strong> ${donation.title}</li>
                        <li><strong>Rejection Reason:</strong> ${rejectionReason || 'No reason provided'}</li>
                        <li><strong>Rejected On:</strong> ${new Date().toLocaleDateString()}</li>
                    </ul>
                    <p>If you have any questions, please contact our support team.</p>
                    <p style="margin-top: 20px;">Best regards,<br>Your Platform Team</p>
                </div>
            `;

            const attachments = [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, '../uploads/logo.png'),
                    cid: 'logo',
                },
            ];

            await sendEmail(donor.email, subject, text, html, attachments);
        } else {
            console.warn(`Donor email not found for donor ID: ${donation.donor}`);
        }

        res.status(200).json({ 
            message: 'Donation rejected successfully', 
            donation 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to reject donation', 
            error: error.message 
        });
    }
}

module.exports = {
    getAllDonationTransactions,
    getDonationTransactionById,
    getDonationTransactionsByRequestNeedId,
    getDonationTransactionsByDonationId,
    getDonationTransactionsByStatus,
    createDonationTransaction,
    updateDonationTransaction,
    deleteDonationTransaction,
    getTransactionsByRecipientId,
    acceptDonationTransaction,
    rejectDonationTransaction,
    createAndAcceptDonationTransaction,
    rejectDonation,
};