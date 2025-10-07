const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: String,
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 }
});

const scoreSchema = new mongoose.Schema({
  player1: { type: String, default: 'You' },
  player2: { type: String, default: 'Girlfriend' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  categories: [categorySchema],
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Score', scoreSchema);