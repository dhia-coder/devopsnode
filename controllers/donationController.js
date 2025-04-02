const Donation = require('../models/Donation');
const Product = require('../models/Product');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');
const Meal = require('../models/Meals');         // Adjust path to your model


const { classifyFoodItem } = require('../aiService/classifyFoodItem');
const { predictSupplyDemand } = require('../aiService/predictSupplyDemand');

async function createDonation(req, res) {
  let newDonation;

  try {
    let {
      title,
      location,
      expirationDate,
      description,
      category,
      type,
      donor,
      products,
      numberOfMeals,
      status,
      meals
    } = req.body;

    // Log the incoming request body for debugging
    console.log("Incoming Request Body:", req.body);

    // Ensure products is an array
    if (!Array.isArray(products)) {
      if (typeof products === 'string') {
        try {
          products = JSON.parse(products);
        } catch (error) {
          throw new Error('Invalid products format: must be a valid JSON array');
        }
      } else {
        products = [];
      }
    }

    // Ensure meals is an array
    if (!Array.isArray(meals)) {
      if (typeof meals === 'string') {
        try {
          meals = JSON.parse(meals);
        } catch (error) {
          throw new Error('Invalid meals format: must be a valid JSON array');
        }
      } else {
        meals = [];
      }
    }

    // Log the parsed products and meals for debugging
    console.log("Parsed Products:", products);
    console.log("Parsed Meals:", meals);

    // Validate mealType values
    const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Other'];

    // Validate and filter meals
    const validMeals = meals
      .map((meal, index) => {
        if (!meal.mealName || typeof meal.mealName !== 'string' || !meal.mealName.trim()) {
          throw new Error(`Meal at index ${index} is missing a valid mealName`);
        }
        if (!meal.mealDescription || typeof meal.mealDescription !== 'string' || !meal.mealDescription.trim()) {
          throw new Error(`Meal at index ${index} is missing a valid mealDescription`);
        }
        if (!meal.mealType || !validMealTypes.includes(meal.mealType)) {
          throw new Error(`Meal at index ${index} has an invalid mealType: ${meal.mealType}. Must be one of ${validMealTypes.join(', ')}`);
        }
        const quantity = parseInt(meal.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Meal at index ${index} has an invalid quantity: ${meal.quantity}. Must be a positive integer`);
        }
        return {
          mealName: meal.mealName,
          mealDescription: meal.mealDescription,
          mealType: meal.mealType,
          quantity: quantity
        };
      })
      .filter(meal => meal);

    // Validate and filter products
    const validProducts = products
      .map((product, index) => {
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
        return {
          name: product.name,
          productType: product.productType,
          productDescription: product.productDescription,
          weightPerUnit: weightPerUnit,
          weightUnit: product.weightUnit || 'kg',
          weightUnitTotale: product.weightUnitTotale || 'kg',
          totalQuantity: totalQuantity,
          image: product.image || '',
          status: product.status || 'available'
        };
      })
      .filter(product => product);

    // Log the valid products and meals for debugging
    console.log("Valid Products After Filtering:", validProducts);
    console.log("Valid Meals After Filtering:", validMeals);

    // Validate required fields
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Missing or invalid required field: title');
    }
    if (!location || typeof location !== 'string' || !location.trim()) {
      throw new Error('Missing or invalid required field: location');
    }
    if (!expirationDate || isNaN(new Date(expirationDate).getTime())) {
      throw new Error('Missing or invalid required field: expirationDate');
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      throw new Error('Missing or invalid required field: description');
    }
    if (!donor || !mongoose.Types.ObjectId.isValid(donor)) {
      throw new Error('Missing or invalid required field: donor');
    }

    if (category === 'prepared_meals' && validMeals.length === 0) {
      throw new Error('At least one valid meal is required for prepared_meals category');
    }
    if (category === 'packaged_products' && validProducts.length === 0) {
      throw new Error('At least one valid product is required for packaged_products category');
    }

    // Calculate numberOfMeals
    const calculatedNumberOfMeals = category === 'prepared_meals'
      ? validMeals.reduce((sum, meal) => sum + meal.quantity, 0)
      : undefined;

    // Validate provided numberOfMeals
    const providedNumberOfMeals = parseInt(numberOfMeals);
    if (category === 'prepared_meals' && !isNaN(providedNumberOfMeals) && providedNumberOfMeals !== calculatedNumberOfMeals) {
      throw new Error(`Provided numberOfMeals (${providedNumberOfMeals}) does not match the calculated total (${calculatedNumberOfMeals})`);
    }

    // Create the donation object
    newDonation = new Donation({
      title,
      location,
      expirationDate: new Date(expirationDate),
      description,
      category: category || 'prepared_meals',
      type: type || 'donation',
      donor,
      meals: [],
      numberOfMeals: category === 'prepared_meals' ? (providedNumberOfMeals || calculatedNumberOfMeals) : undefined,
      remainingMeals: category === 'prepared_meals' ? numberOfMeals : undefined, // Initialize remainingMeals
      products: [],
      status: status || 'pending'
    });

    // Process meals: Create Meal documents and link them
    let mealEntries = [];
    if (category === 'prepared_meals' && validMeals.length > 0) {
      for (let meal of validMeals) {
        const counter = await Counter.findOneAndUpdate(
          { _id: 'mealId' },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );

        if (!counter) {
          throw new Error('Failed to generate meal ID');
        }

        const newMeal = new Meal({
          id: counter.seq,
          mealName: meal.mealName,
          mealDescription: meal.mealDescription,
          mealType: meal.mealType,
          quantity: meal.quantity,
          donation: newDonation._id
        });

        await newMeal.save();
        console.log(`Created Meal Document: ${newMeal._id}`);
        mealEntries.push({
          meal: newMeal._id,
          quantity: meal.quantity
        });
      }
    }

    // Process products: Create Product documents and link them
    let productEntries = [];
    if (category === 'packaged_products' && validProducts.length > 0) {
      for (let product of validProducts) {
        const counter = await Counter.findOneAndUpdate(
          { _id: 'ProductId' },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );

        if (!counter) {
          throw new Error('Failed to generate product ID');
        }

        const newProduct = new Product({
          id: counter.seq,
          name: product.name,
          productType: product.productType,
          productDescription: product.productDescription,
          weightPerUnit: product.weightPerUnit,
          weightUnit: product.weightUnit,
          weightUnitTotale: product.weightUnitTotale,
          totalQuantity: product.totalQuantity,
          image: product.image,
          status: product.status,
          donation: newDonation._id
        });

        await newProduct.save();
        console.log(`Created Product Document: ${newProduct._id}`);
        productEntries.push({
          product: newProduct._id,
          quantity: product.totalQuantity
        });
      }
    }

    // Assign the meal and product entries to the donation
    newDonation.meals = mealEntries;
    newDonation.products = productEntries;

    // Log the donation before saving
    console.log("Donation Before Save:", newDonation);

    // Save the donation
    await newDonation.save();

    // Populate the response
    const populatedDonation = await Donation.findById(newDonation._id)
      .populate('donor')
      .populate('products.product')
      .populate('meals.meal');

    res.status(201).json({ message: 'Donation created successfully', donation: populatedDonation });
  } catch (error) {
    // Rollback
    if (newDonation && newDonation._id) {
      if (newDonation.meals && newDonation.meals.length > 0) {
        const mealIds = newDonation.meals.map(entry => entry.meal);
        await Meal.deleteMany({ _id: { $in: mealIds } });
      }
      if (newDonation.products && newDonation.products.length > 0) {
        const productIds = newDonation.products.map(entry => entry.product);
        await Product.deleteMany({ _id: { $in: productIds } });
      }
      await Donation.deleteOne({ _id: newDonation._id });
    }
    console.error("Error creating donation:", error);
    res.status(400).json({
      message: "Failed to create donation",
      error: error.message || error
    });
  }
}
// ✅ Update a donation (also updates related products)
async function updateDonation(req, res) {
  try {
    const { id } = req.params; // Donation ID
    const { products, meals, ...donationData } = req.body;

    // **Validate Donation ID**
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid donation ID' });
    }

    // **Fetch Existing Donation**
    const existingDonation = await Donation.findById(id).populate('meals.meal');
    if (!existingDonation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    // **Process Products**
    let updatedProducts = existingDonation.products || [];
    if (products !== undefined) {
      if (!Array.isArray(products)) {
        return res.status(400).json({ message: 'Products must be an array' });
      }
      updatedProducts = [];
      for (const item of products) {
        if (item.quantity !== undefined && (typeof item.quantity !== 'number' || item.quantity < 0)) {
          return res.status(400).json({ message: 'Invalid quantity in products array' });
        }

        let productId;
        if (item.id) {
          const product = await Product.findOne({ id: item.id });
          if (!product) {
            return res.status(404).json({ message: `Product with id ${item.id} not found` });
          }
          product.name = item.name ?? product.name;
          product.productDescription = item.productDescription ?? product.productDescription;
          product.productType = item.productType ?? product.productType;
          product.weightPerUnit = item.weightPerUnit ?? product.weightPerUnit;
          product.weightUnit = item.weightUnit ?? product.weightUnit;
          product.totalQuantity = item.totalQuantity ?? product.totalQuantity;
          product.status = item.status ?? product.status;
          await product.save();
          productId = product._id;
        } else {
          const counter = await Counter.findOneAndUpdate(
            { _id: 'ProductId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
          );
          const newProduct = new Product({
            id: counter.seq,
            name: item.name,
            productDescription: item.productDescription,
            productType: item.productType,
            weightPerUnit: item.weightPerUnit,
            weightUnit: item.weightUnit,
            totalQuantity: item.totalQuantity,
            status: item.status || 'available',
            donation: id
          });
          await newProduct.save();
          productId = newProduct._id;
        }
        updatedProducts.push({ product: productId, quantity: item.quantity || 1 });
      }
    }

    // **Process Meals**
    let updatedMeals = [];
    if (meals !== undefined) {
      if (!Array.isArray(meals)) {
        return res.status(400).json({ message: 'Meals must be an array' });
      }

      // **Identify Meals to Delete**
      const existingMealIds = existingDonation.meals.map(mealEntry => mealEntry.meal.id.toString());
      const updatedMealIds = meals
        .filter(item => item.id)
        .map(item => item.id.toString());

      const mealsToDelete = existingMealIds.filter(mealId => !updatedMealIds.includes(mealId));
      if (mealsToDelete.length > 0) {
        await Meal.deleteMany({ id: { $in: mealsToDelete } });
      }

      // **Process Updated/New Meals**
      updatedMeals = [];
      for (const item of meals) {
        if (item.quantity === undefined || typeof item.quantity !== 'number' || item.quantity < 1) {
          return res.status(400).json({ message: 'Invalid or missing quantity in meals array' });
        }

        let mealId;
        if (item.id) {
          const meal = await Meal.findOne({ id: item.id });
          if (!meal) {
            return res.status(404).json({ message: `Meal with id ${item.id} not found` });
          }
          meal.mealName = item.mealName ?? meal.mealName;
          meal.mealDescription = item.mealDescription ?? meal.mealDescription;
          meal.mealType = item.mealType ?? meal.mealType;
          meal.quantity = item.quantity; // Update the quantity in the Meal document
          await meal.save();
          mealId = meal._id;
        } else {
          const counter = await Counter.findOneAndUpdate(
            { _id: 'mealId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
          );
          const newMeal = new Meal({
            id: counter.seq,
            mealName: item.mealName,
            mealDescription: item.mealDescription,
            mealType: item.mealType,
            quantity: item.quantity,
            donation: id
          });
          await newMeal.save();
          mealId = newMeal._id;
        }
        updatedMeals.push({ meal: mealId, quantity: item.quantity });
      }
    } else {
      updatedMeals = existingDonation.meals.map(mealEntry => ({
        meal: mealEntry.meal._id,
        quantity: mealEntry.quantity,
      }));
    }

    // **Update Donation Fields**
    const allowedFields = [
      'title',
      'location',
      'expirationDate',
      'type',
      'category',
      'description',
      'numberOfMeals'
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (donationData[field] !== undefined) {
        updateData[field] = donationData[field];
      }
    });

    // **Save Updated Donation**
    const updatedDonation = await Donation.findByIdAndUpdate(
      id,
      { ...updateData, products: updatedProducts, meals: updatedMeals },
      { new: true }
    )
      .populate('donor')
      .populate('products.product')
      .populate('meals.meal');

    if (!updatedDonation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    // **Success Response**
    res.status(200).json({
      message: 'Donation updated successfully',
      data: updatedDonation
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({
      message: 'Failed to update donation',
      error: error.message
    });
  }
}
// ✅ Delete a donation (also deletes related products)
// ✅ Delete a Donation
async function deleteDonation(req, res) {
  try {
      const { id } = req.params;
      const donation = await Donation.findById(id);

      if (!donation) {
          return res.status(404).json({ message: 'Donation not found' });
      }

      // Delete associated products and meals
      await Product.deleteMany({ _id: { $in: donation.products } });
      await Meal.deleteMany({ _id: { $in: donation.meals } });

      // Delete donation
      await Donation.findByIdAndDelete(id);

      res.status(200).json({ message: 'Donation and related items deleted successfully' });
  } catch (error) {
      console.error('Error deleting donation:', error);
      res.status(500).json({ message: 'Failed to delete donation', error: error.message });
  }
}

// ✅ Get Donations by Status
async function getDonationsByStatus(req, res) {
  try {
      const { status } = req.params;
      const donations = await Donation.find({ status })
          .populate('donor')
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donations found with this status' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donations by status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get All Donations
async function getAllDonations(req, res) {
  try {
      const donations = await Donation.find({ isaPost: true }) // Only fetch posted donations
          .populate('donor')
          .populate('products.product')
          .populate('meals.meal')
          .populate('linkedRequests');

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching all donations:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donation by ID
async function getDonationById(req, res) {
  try {
    const { id } = req.params;
    const donation = await Donation.findById(id)
      .populate('donor')
      .populate('products.product')
      .populate('meals.meal');

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    console.log('Fetched donation for getDonationById:', donation);
    res.status(200).json(donation);
  } catch (error) {
    console.error('Error fetching donation by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donations by User ID
async function getDonationsByUserId(req, res) {
  try {
      const { userId } = req.params;
      const donations = await Donation.find({ donor: userId, isaPost: true })
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donations found for this user' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donations by user ID:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donations by Date
async function getDonationsByDate(req, res) {
  try {
      const { date } = req.params;
      const donations = await Donation.find({ expirationDate: new Date(date) })
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donations found for this date' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donations by date:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donations by Type
async function getDonationsByType(req, res) {
  try {
      const { type } = req.params;
      const donations = await Donation.find({ Type: type }) // Ensure case consistency
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donations found for this type' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donations by type:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donations by Category
async function getDonationsByCategory(req, res) {
  try {
      const { category } = req.params;
      const donations = await Donation.find({ Category: category }) // Ensure case consistency
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donations found for this category' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donations by category:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

// ✅ Get Donation by Request ID
async function getDonationByRequestId(req, res) {
  try {
      const { requestId } = req.params;
      const donations = await Donation.find({ linkedRequests: requestId }) // Should return an array
          .populate('products.product')
          .populate('meals.meal');

      if (donations.length === 0) {
          return res.status(404).json({ message: 'No donation found for this request' });
      }

      res.status(200).json(donations);
  } catch (error) {
      console.error('Error fetching donation by request ID:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
}

//AI PART 
// ✅ Classify a food item
async function classifyFood(req, res) {
  try {
      const { name, description, category } = req.body;

      if (!name || !description || !category) {
          return res.status(400).json({ message: 'Name, description, and category are required' });
      }

      if (!['packaged_products', 'prepared_meals'].includes(category)) {
          return res.status(400).json({ message: 'Invalid category' });
      }

      const classification = await classifyFoodItem({ name, description, category });
      res.status(200).json(classification);
  } catch (error) {
      console.error('Error classifying food item:', error);
      res.status(500).json({ message: 'Failed to classify food item', error: error.message });
  }
}
async function getSupplyDemandPrediction(req, res) {
  console.log('getSupplyDemandPrediction called');
  try {
    const { period } = req.query;
    console.log('Fetching predictions for period:', period || 'week'); // Changed default to 'week'
    const predictions = await predictSupplyDemand(period || 'week');
    console.log('Predictions:', predictions);
    if (!predictions.supply || !predictions.demand) {
      throw new Error('Prediction data is incomplete');
    }
    res.status(200).json(predictions);
  } catch (error) {
    console.error('Prediction Error Details:', error.stack);
    res.status(500).json({ message: 'Failed to predict supply and demand', error: error.message });
  }
}


async function matchDonationToRequests(donation) {
  const { category, products, meals, expirationDate, numberOfMeals: donatedMeals } = donation;

  // Find pending requests that match the donation's category
  const requests = await RequestNeed.find({
      category: donation.category,
      status: 'pending',
      expirationDate: { $gte: new Date() } // Ensure request is still valid
  })
      .populate('recipient'); // Only populate recipient, no need for requestedMeals

  const matches = [];
  for (const request of requests) {
      let matchScore = 0;
      let fulfilledItems = [];

      // Check if the request's needs match the donation
      if (category === 'packaged_products') {
          // Keep the existing logic for packaged_products
          for (const reqProduct of request.requestedProducts || []) {
              const matchingProduct = products.find(p => p.product.productType === reqProduct.product.productType);
              if (matchingProduct) {
                  const fulfilledQty = Math.min(matchingProduct.quantity, reqProduct.quantity);
                  fulfilledItems.push({ product: reqProduct.product._id, quantity: fulfilledQty });
                  matchScore += fulfilledQty * 10; // Score based on quantity fulfilled
              }
          }
      } else if (category === 'prepared_meals') {
          // For prepared_meals, match based on numberOfMeals
          const requestedMeals = request.numberOfMeals || 0;
          if (requestedMeals > 0 && donatedMeals > 0) {
              // Calculate how many meals can be fulfilled
              const fulfilledQty = Math.min(donatedMeals, requestedMeals);
              fulfilledItems.push({ quantity: fulfilledQty }); // No specific meal, just the quantity
              matchScore += fulfilledQty * 10; // Score based on quantity fulfilled
          }
      }

      if (fulfilledItems.length > 0) {
          // Adjust score based on expiration date
          const daysUntilExpiration = (expirationDate - new Date()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiration < 3) matchScore += 50; // Boost for near-expiring items
          else if (daysUntilExpiration < 7) matchScore += 20; // Moderate boost for items expiring soon

          // Adjust score based on recipient type
          if (request.recipient.type === 'RELIEF' && daysUntilExpiration < 7) {
              matchScore += 30; // Boost for relief organizations needing urgent supplies
          } else if (request.recipient.type === 'SOCIAL_WELFARE') {
              matchScore += 10; // Slight boost for social welfare organizations
          }

          matches.push({
              request,
              fulfilledItems,
              matchScore
          });
      }
  }

  // Sort matches by score (descending)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}
// Ensure this function isn’t miscalled with a request ID

module.exports = {matchDonationToRequests,getDonationByRequestId,getSupplyDemandPrediction,classifyFood,getDonationsByUserId ,getAllDonations, getDonationById, getDonationsByDate, getDonationsByType, getDonationsByCategory, createDonation, updateDonation, deleteDonation , getDonationsByStatus };