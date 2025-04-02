// models/Counter.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Counter schema for managing the auto-incrementing `id`
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
