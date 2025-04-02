const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Ton app.js complet

const mongoUri = 'mongodb://localhost:27017/sustainafood'; // ⚠️ Ta base de développement

beforeAll(async () => {
  await mongoose.connect(mongoUri, {
    // (Tu peux retirer les warnings ici aussi, voir plus bas)
  });
});

afterAll(async () => {
  await mongoose.connection.close(); // Ne pas supprimer la base, attention !
});

describe('✅ TEST SIGN IN SUR DONNEES EXISTANTES', () => {

  it('✅ Devrait se connecter avec un utilisateur existant', async () => {
    const res = await request(app).post('/users/login').send({
      email: "carrefour@gmail.com", // Met ton email existant ici
      password: "carrefour"        // Met ton mot de passe correspondant
    });

    console.log(res.body); // 🔹 Pour voir la réponse complète dans la console

    // ✅ Attentes
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('role'); // Optionnel : tu peux préciser le role attendu
    expect(res.body).toHaveProperty('id');
  });

  it('❌ Devrait échouer avec un mauvais mot de passe pour cet email', async () => {
    const res = await request(app).post('/users/login').send({
      email: "carrefour@gmail.com", // Même email
      password: "WrongPassword" // Mauvais mot de passe
    });

    console.log(res.body); // Pour voir la réponse complète dans la console

    // ✅ Attentes
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

});
