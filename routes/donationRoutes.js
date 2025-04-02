const express = require('express');
const multer = require('multer');
const upload = multer(); // Pour parser les champs sans fichier
const router = express.Router();
const Donation = require('../models/Donation'); // Import the Donation model
const RequestNeed = require('../models/RequestNeed');
// Route to get recommendations for a donation
router.get('/donation/:donationId/recommendations', async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.donationId)
            .populate('products.product')
            .populate('meals.meal')
            .populate('donor');
        if (!donation) {
            return res.status(404).json({ message: "Donation not found" });
        }
        const matches = await matchDonationToRequests(donation);
        res.status(200).json(matches);
    } catch (error) {
        res.status(500).json({ message: "Failed to get recommendations", error: error.message });
    }
});
// The matchDonationToRequests function (as previously defined)
async function matchDonationToRequests(donation) {
    const { category, products, meals, expirationDate, numberOfMeals: donatedMeals } = donation;

    const requests = await RequestNeed.find({
        category: donation.category,
        status: 'pending',
        expirationDate: { $gte: new Date() }
    }).populate('recipient');

    const matches = [];
    for (const request of requests) {
        let matchScore = 0;
        let fulfilledItems = [];

        if (category === 'packaged_products') {
            for (const reqProduct of request.requestedProducts || []) {
                const matchingProduct = products.find(p => p.product.productType === reqProduct.product.productType);
                if (matchingProduct) {
                    const fulfilledQty = Math.min(matchingProduct.quantity, reqProduct.quantity);
                    fulfilledItems.push({ product: reqProduct.product._id, quantity: fulfilledQty });
                    matchScore += fulfilledQty * 10;
                }
            }
        } else if (category === 'prepared_meals') {
            const requestedMeals = request.numberOfMeals || 0;
            if (requestedMeals > 0 && donatedMeals > 0) {
                const fulfilledQty = Math.min(donatedMeals, requestedMeals);
                fulfilledItems.push({ quantity: fulfilledQty });
                matchScore += fulfilledQty * 10;
            }
        }

        if (fulfilledItems.length > 0) {
            const daysUntilExpiration = (expirationDate - new Date()) / (1000 * 60 * 60 * 24);
            if (daysUntilExpiration < 3) matchScore += 50;
            else if (daysUntilExpiration < 7) matchScore += 20;

            if (request.recipient.type === 'RELIEF' && daysUntilExpiration < 7) {
                matchScore += 30;
            } else if (request.recipient.type === 'SOCIAL_WELFARE') {
                matchScore += 10;
            }

            matches.push({
                request,
                fulfilledItems,
                matchScore
            });
        }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// Other routes (e.g., for getting donations by user ID)
router.get('/user/:userId', async (req, res) => {
    try {
        const donations = await Donation.find({ donor: req.params.userId })
            .populate('products.product')
            .populate('meals.meal')
            .populate('donor');
        res.status(200).json(donations);
    } catch (error) {
        res.status(500).json({ message: "Failed to get donations", error: error.message });
    }
});

const donationController = require('../controllers/donationController');
router.post('/donations/classify-food', donationController.classifyFood);
// Log to confirm this route is hit
router.get('/donations/predict-supply-demand', (req, res, next) => {
    console.log('Route /donations/predict-supply-demand matched');
    next();
  }, donationController.getSupplyDemandPrediction);
  
  // Log to confirm this route is hit
  router.get('/donations/:requestId', (req, res, next) => {
    console.log('Route /donations/:requestId matched with:', req.params.requestId);
    next();
  }, donationController.getDonationByRequestId);
// ✅ Get all donations
router.get('/', donationController.getAllDonations);

// ✅ Get donation by ID
router.get('/:id', donationController.getDonationById);

// ✅ Get donations by User ID
router.get('/user/:userId', donationController.getDonationsByUserId);

// ✅ Get donations by Date
router.get('/date/:date', donationController.getDonationsByDate);

// ✅ Get donations by Type (donation/request)
router.get('/type/:type', donationController.getDonationsByType);

// ✅ Get donations by Category (Prepared_Meals, Packaged_Products)
router.get('/category/:category', donationController.getDonationsByCategory);

// ✅ Create a new donation (with associated products)
// Ajout de "upload.none()" pour parser les champs du FormData
router.post('/', upload.none(), donationController.createDonation);

// ✅ Update a donation (and update associated products)
router.put('/:id', donationController.updateDonation);

// ✅ Delete a donation (and delete associated products)
router.delete('/:id', donationController.deleteDonation);
router.get('/donations/:requestId',donationController.getDonationByRequestId)


module.exports = router;