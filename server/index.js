const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/couple-tracker';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Score Schema
const scoreSchema = new mongoose.Schema({
  player1: { type: String, default: 'You' },
  player2: { type: String, default: 'Girlfriend' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  categories: [{
    name: String,
    player1Score: Number,
    player2Score: Number
  }],
  lastUpdated: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// Routes
app.get('/api/scores', async (req, res) => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      scores = await Score.create({});
    }
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scores', async (req, res) => {
  try {
    const { player1, player2, player1Score, player2Score, categories } = req.body;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = new Score();
    }
    
    if (player1) scores.player1 = player1;
    if (player2) scores.player2 = player2;
    if (player1Score !== undefined) scores.player1Score = player1Score;
    if (player2Score !== undefined) scores.player2Score = player2Score;
    if (categories) scores.categories = categories;
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scores/category', async (req, res) => {
  try {
    const { name } = req.body;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = new Score();
    }
    
    // Check if category already exists
    const existingCategory = scores.categories.find(cat => cat.name === name);
    if (!existingCategory) {
      scores.categories.push({
        name,
        player1Score: 0,
        player2Score: 0
      });
      await scores.save();
    }
    
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});