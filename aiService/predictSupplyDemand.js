const Donation = require('../models/Donation');
const RequestNeed = require('../models/RequestNeed');

// Helper function to calculate ISO week number
function getISOWeek(date) {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  // January 4 is always in week 1
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count weeks
  const weekNumber = Math.round(((tempDate - week1) / 86400000 + 1 + (week1.getDay() + 6) % 7) / 7);
  return weekNumber;
}

// Helper function to get the year and ISO week as an object
function getYearAndWeek(date) {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return { year, week };
}

// Helper function to get the next two weeks
function getNextTwoWeeks(year, week) {
  let nextYear1 = year;
  let nextWeek1 = week + 1;
  let nextYear2 = year;
  let nextWeek2 = week + 2;

  // Handle year rollover (if week > 52)
  if (nextWeek1 > 52) {
    nextYear1 = year + 1;
    nextWeek1 = nextWeek1 - 52;
  }
  if (nextWeek2 > 52) {
    nextYear2 = year + 1;
    nextWeek2 = nextWeek2 - 52;
  }
  if (nextWeek2 > 52) {
    nextYear2 = year + 2;
    nextWeek2 = nextWeek2 - 52;
  }

  return [
    `${nextYear1}-W${nextWeek1}`,
    `${nextYear2}-W${nextWeek2}`
  ];
}

async function predictSupplyDemand(period = 'week') {
  try {
    console.log('Fetching donations and requests...');
    const donations = await Donation.find({ isaPost: true })
      .populate('products.product')
      .populate('meals.meal')
      .catch(err => {
        console.error('Error fetching donations:', err);
        return [];
      });
    const requests = await RequestNeed.find({ isaPost: true })
      .populate('requestedProducts.product')
      .populate('requestedMeals.meal')
      .catch(err => {
        console.error('Error fetching requests:', err);
        return [];
      });

    console.log('Donations:', donations.length, 'Requests:', requests.length);
    console.log('Raw Donations:', JSON.stringify(donations, null, 2));

    // Group supply data by week
    const supplyData = donations.reduce((acc, donation) => {
      const date = new Date(donation.createdAt || Date.now());
      const { year, week } = getYearAndWeek(date);
      const key = `${year}-W${week}`;
      if (!acc[key]) acc[key] = { products: 0, meals: 0 };
      if (donation.category === 'packaged_products' && Array.isArray(donation.products)) {
        const productSum = donation.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        console.log(`Donation ${donation._id}: Adding ${productSum} products for key ${key}`);
        acc[key].products += productSum;
      } else if (donation.category === 'prepared_meals') {
        console.log(`Donation ${donation._id}: Adding ${donation.numberOfMeals || 0} meals for key ${key}`);
        acc[key].meals += donation.numberOfMeals || 0;
      }
      return acc;
    }, {});

    console.log('Supply Data:', supplyData);

    // Group demand data by week
    const demandData = requests.reduce((acc, request) => {
      const date = new Date(request.created_at || Date.now());
      const { year, week } = getYearAndWeek(date);
      const key = `${year}-W${week}`;
      if (!acc[key]) acc[key] = { products: 0, meals: 0 };
      if (request.category === 'packaged_products' && Array.isArray(request.requestedProducts)) {
        const productSum = request.requestedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
        console.log(`Request ${request._id}: Adding ${productSum} products for key ${key}`);
        acc[key].products += productSum;
      } else if (request.category === 'prepared_meals') {
        console.log(`Request ${request._id}: Adding ${request.numberOfMeals || 0} meals for key ${key}`);
        acc[key].meals += request.numberOfMeals || 0;
      }
      return acc;
    }, {});

    console.log('Demand Data:', demandData);

    // Predict the next two weeks for each historical week
    const supplyPredictions = {};
    const demandPredictions = {};

    // Process supply predictions
    for (const [key, data] of Object.entries(supplyData)) {
      const [year, week] = key.split('-W').map(Number);
      const [nextWeek1, nextWeek2] = getNextTwoWeeks(year, week);

      // Predict for the first next week
      if (!supplyPredictions[nextWeek1]) supplyPredictions[nextWeek1] = { products: 0, meals: 0 };
      supplyPredictions[nextWeek1].products += Math.round(data.products * 1.1);
      supplyPredictions[nextWeek1].meals += Math.round(data.meals * 1.1);

      // Predict for the second next week
      if (!supplyPredictions[nextWeek2]) supplyPredictions[nextWeek2] = { products: 0, meals: 0 };
      supplyPredictions[nextWeek2].products += Math.round(data.products * 1.2); // Slightly higher growth for second week
      supplyPredictions[nextWeek2].meals += Math.round(data.meals * 1.2);
    }

    // Process demand predictions
    for (const [key, data] of Object.entries(demandData)) {
      const [year, week] = key.split('-W').map(Number);
      const [nextWeek1, nextWeek2] = getNextTwoWeeks(year, week);

      // Predict for the first next week
      if (!demandPredictions[nextWeek1]) demandPredictions[nextWeek1] = { products: 0, meals: 0 };
      demandPredictions[nextWeek1].products += Math.round(data.products * 1.2);
      demandPredictions[nextWeek1].meals += Math.round(data.meals * 1.2);

      // Predict for the second next week
      if (!demandPredictions[nextWeek2]) demandPredictions[nextWeek2] = { products: 0, meals: 0 };
      demandPredictions[nextWeek2].products += Math.round(data.products * 1.3); // Slightly higher growth for second week
      demandPredictions[nextWeek2].meals += Math.round(data.meals * 1.3);
    }

    const result = {
      supply: supplyPredictions,
      demand: demandPredictions,
    };

    console.log('Prediction Result:', result);
    return result;
  } catch (error) {
    console.error('predictSupplyDemand Error:', error.stack);
    throw error;
  }
}

module.exports = { predictSupplyDemand };