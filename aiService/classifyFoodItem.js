// aiService/classifyFoodItem.js
const ProductType = {
    CANNED_GOODS: 'Canned_Goods',
    DRY_GOODS: 'Dry_Goods',
    BEVERAGES: 'Beverages',
    SNACKS: 'Snacks',
    CEREALS: 'Cereals',
    BAKED_GOODS: 'Baked_Goods',
    CONDIMENTS: 'Condiments',
    VEGETABLES: 'Vegetables',
    FRUITS: 'Fruits',
    MEAT: 'Meat',
    FISH: 'Fish',
    DAIRY: 'Dairy',
    EGGS: 'Eggs',
    BABY_FOOD: 'Baby_Food',
    PET_FOOD: 'Pet_Food',
    OTHER: 'Other'
};

const MealType = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
    DESSERT: 'Dessert',
    SOUP: 'Soup',
    OTHER: 'Other'
};

// Simple keyword-based classification logic (you can replace this with a more advanced ML model)
const classifyFoodItem = async (item) => {
    const { name = '', description = '', category } = item;

    // Normalize the input for better matching
    const text = `${name.toLowerCase()} ${description.toLowerCase()}`.trim();

    if (!text) {
        return category === 'prepared_meals' ? { mealType: MealType.OTHER } : { productType: ProductType.OTHER };
    }

    if (category === 'packaged_products') {
        // Keyword-based classification for packaged products
        if (text.includes('canned') || text.includes('tin') || text.includes('beans') || text.includes('soup')) {
            return { productType: ProductType.CANNED_GOODS };
        } else if (text.includes('rice') || text.includes('pasta') || text.includes('flour') || text.includes('grain')) {
            return { productType: ProductType.DRY_GOODS };
        } else if (text.includes('water') || text.includes('juice') || text.includes('soda') || text.includes('drink')) {
            return { productType: ProductType.BEVERAGES };
        } else if (text.includes('chips') || text.includes('nuts') || text.includes('crackers') || text.includes('snack')) {
            return { productType: ProductType.SNACKS };
        } else if (text.includes('cereal') || text.includes('oatmeal') || text.includes('cornflakes')) {
            return { productType: ProductType.CEREALS };
        } else if (text.includes('bread') || text.includes('cookies') || text.includes('cake') || text.includes('pastry')) {
            return { productType: ProductType.BAKED_GOODS };
        } else if (text.includes('ketchup') || text.includes('sauce') || text.includes('mustard') || text.includes('condiment')) {
            return { productType: ProductType.CONDIMENTS };
        } else if (text.includes('carrot') || text.includes('potato') || text.includes('tomato') || text.includes('vegetable')) {
            return { productType: ProductType.VEGETABLES };
        } else if (text.includes('apple') || text.includes('banana') || text.includes('orange') || text.includes('fruit')) {
            return { productType: ProductType.FRUITS };
        } else if (text.includes('beef') || text.includes('chicken') || text.includes('pork') || text.includes('meat')) {
            return { productType: ProductType.MEAT };
        } else if (text.includes('salmon') || text.includes('tuna') || text.includes('fish')) {
            return { productType: ProductType.FISH };
        } else if (text.includes('milk') || text.includes('cheese') || text.includes('yogurt') || text.includes('dairy')) {
            return { productType: ProductType.DAIRY };
        } else if (text.includes('egg')) {
            return { productType: ProductType.EGGS };
        } else if (text.includes('baby food') || text.includes('formula') || text.includes('puree')) {
            return { productType: ProductType.BABY_FOOD };
        } else if (text.includes('pet food') || text.includes('dog food') || text.includes('cat food')) {
            return { productType: ProductType.PET_FOOD };
        } else {
            return { productType: ProductType.OTHER };
        }
    } else if (category === 'prepared_meals') {
        // Keyword-based classification for prepared meals
        if (text.includes('breakfast') || text.includes('pancake') || text.includes('omelette') || text.includes('cereal')) {
            return { mealType: MealType.BREAKFAST };
        } else if (text.includes('lunch') || text.includes('sandwich') || text.includes('salad') || text.includes('burger')) {
            return { mealType: MealType.LUNCH };
        } else if (text.includes('dinner') || text.includes('steak') || text.includes('pasta') || text.includes('roast')) {
            return { mealType: MealType.DINNER };
        } else if (text.includes('snack') || text.includes('chips') || text.includes('nuts') || text.includes('fruit')) {
            return { mealType: MealType.SNACK };
        } else if (text.includes('dessert') || text.includes('cake') || text.includes('ice cream') || text.includes('pie')) {
            return { mealType: MealType.DESSERT };
        } else if (text.includes('soup') || text.includes('stew') || text.includes('broth')) {
            return { mealType: MealType.SOUP };
        } else {
            return { mealType: MealType.OTHER };
        }
    } else {
        throw new Error('Invalid category provided');
    }
};

module.exports = { classifyFoodItem };