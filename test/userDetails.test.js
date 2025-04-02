const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Adjust the path if needed

// --- Database Setup ---
const mongoUri = 'mongodb://localhost:27017/sustainafood';

beforeAll(async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected for userDetails tests.');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed for userDetails tests.');
});

// --- Test Suite for Get User By ID ---
describe('✅ TEST Get User By ID (GET /users/details/:id)', () => {

  // Using the specific ID from your database
  const EXISTING_USER_ID = '67bdf9511252b84ad112abc0';

  // A plausible but likely non-existent ObjectId
  const NON_EXISTENT_USER_ID = '111111111111111111111111';

  // An invalid format ID
  const INVALID_FORMAT_USER_ID = 'this-is-not-an-object-id';

  it('✅ Should retrieve an existing user by their valid ID', async () => {
    // The ID is now correctly set above, no need for the placeholder check.

    const res = await request(app).get(`/users/details/${EXISTING_USER_ID}`);

    console.log(`GET /users/details/${EXISTING_USER_ID} Response Status:`, res.statusCode);
    console.log(`GET /users/details/${EXISTING_USER_ID} Response Body:`, res.body);

    // Assertions
    expect(res.statusCode).toBe(200); // Expect success
    expect(res.body).toHaveProperty('_id');
    expect(res.body._id).toBe(EXISTING_USER_ID); // Check the ID matches
    expect(res.body).toHaveProperty('email', 'wala.ammar@esprit.tn'); // Check specific email
    expect(res.body).toHaveProperty('name', 'wala ammar'); // Check specific name
    expect(res.body).toHaveProperty('role', 'admin'); // Check specific role
    expect(res.body).toHaveProperty('phone', 26745248); // Check specific phone
    // Add any other assertions for fields you want to verify for this specific user
    expect(res.body.isBlocked).toBe(false);
    expect(res.body.isActive).toBe(true); // Based on your DB data
    expect(res.body).toHaveProperty('photo'); // Check if photo path exists
  });

  it('❌ Should return 404 Not Found for a non-existent user ID', async () => {
    const res = await request(app).get(`/users/details/${NON_EXISTENT_USER_ID}`);

    console.log(`GET /users/details/${NON_EXISTENT_USER_ID} Response Status:`, res.statusCode);
    console.log(`GET /users/details/${NON_EXISTENT_USER_ID} Response Body:`, res.body);

    // Assertions
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('User not found');
  });

  it('❌ Should return 500 Internal Server Error for an invalid ID format', async () => {
    const res = await request(app).get(`/users/details/${INVALID_FORMAT_USER_ID}`);

    console.log(`GET /users/details/${INVALID_FORMAT_USER_ID} Response Status:`, res.statusCode);
    console.log(`GET /users/details/${INVALID_FORMAT_USER_ID} Response Body:`, res.body);

    // Assertions
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

});
