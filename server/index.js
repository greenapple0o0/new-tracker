const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Updated Schema with Daily History
const scoreSchema = new mongoose.Schema({
  player1: { type: String, default: 'Nish' },
  player2: { type: String, default: 'Jess' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  dailyTasks: [{
    name: String,
    type: { type: String, enum: ['checkbox', 'water', 'study', 'workout'], default: 'checkbox' },
    maxValue: { type: Number, default: 1 }, // For tracking limits
    player1Value: { type: Number, default: 0 },
    player2Value: { type: Number, default: 0 }
  }],
  dailyHistory: [{
    date: String, // YYYY-MM-DD format
    player1Score: Number,
    player2Score: Number,
    winner: String, // 'nish', 'jess', 'tie'
    tasksCompleted: {
      nish: Number,
      jess: Number
    }
  }],
  lastReset: { type: Date, default: Date.now },
  nextReset: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  lastUpdated: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// Initialize default tasks
const initializeDefaultTasks = (scores) => {
  if (scores.dailyTasks.length === 0) {
    scores.dailyTasks = [
      { name: 'Water Drank (cups)', type: 'water', maxValue: 8, player1Value: 0, player2Value: 0 },
      { name: 'Studied (hours)', type: 'study', maxValue: 8, player1Value: 0, player2Value: 0 },
      { name: 'Workout Done (hours)', type: 'workout', maxValue: 2, player1Value: 0, player2Value: 0 },
      { name: 'Morning Routine', type: 'checkbox', maxValue: 1, player1Value: 0, player2Value: 0 },
      { name: 'Healthy Eating', type: 'checkbox', maxValue: 1, player1Value: 0, player2Value: 0 },
      { name: 'No Sugar', type: 'checkbox', maxValue: 1, player1Value: 0, player2Value: 0 },
      { name: 'Meditation', type: 'checkbox', maxValue: 1, player1Value: 0, player2Value: 0 }
    ];
  }
  return scores;
};

// Function to save daily results to history
const saveDailyHistory = async (scores) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Calculate winner
  let winner = 'tie';
  if (scores.player1Score > scores.player2Score) winner = 'nish';
  else if (scores.player2Score > scores.player1Score) winner = 'jess';

  // Count completed tasks
  const tasksCompleted = {
    nish: scores.dailyTasks.filter(task => task.player1Value > 0).length,
    jess: scores.dailyTasks.filter(task => task.player2Value > 0).length
  };

  // Check if today's history already exists
  const existingHistoryIndex = scores.dailyHistory.findIndex(day => day.date === today);
  
  if (existingHistoryIndex >= 0) {
    // Update existing entry
    scores.dailyHistory[existingHistoryIndex] = {
      date: today,
      player1Score: scores.player1Score,
      player2Score: scores.player2Score,
      winner: winner,
      tasksCompleted: tasksCompleted
    };
  } else {
    // Add new entry (keep only last 7 days)
    scores.dailyHistory.unshift({
      date: today,
      player1Score: scores.player1Score,
      player2Score: scores.player2Score,
      winner: winner,
      tasksCompleted: tasksCompleted
    });
    
    // Keep only last 7 days
    scores.dailyHistory = scores.dailyHistory.slice(0, 7);
  }
};

// Function to check and perform auto-reset if needed
const checkAndResetScores = async (scores) => {
  const now = new Date();
  
  if (now >= scores.nextReset) {
    console.log('🔄 Performing automatic 24-hour reset...');
    
    // Save current day to history before resetting
    await saveDailyHistory(scores);
    
    // Reset scores and task values
    scores.player1Score = 0;
    scores.player2Score = 0;
    scores.dailyTasks.forEach(task => {
      task.player1Value = 0;
      task.player2Value = 0;
    });
    
    // Set next reset time (24 hours from now)
    scores.lastReset = now;
    scores.nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    scores.lastUpdated = now;
    
    await scores.save();
    console.log('✅ Scores reset automatically and history saved');
  }
  
  return scores;
};

// Initialize default scores
const initializeScores = async () => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      const nextReset = new Date(Date.now() + 24 * 60 * 60 * 1000);
      scores = await Score.create({
        player1: 'Nish',
        player2: 'Jess',
        player1Score: 0,
        player2Score: 0,
        dailyTasks: [],
        dailyHistory: [],
        lastReset: new Date(),
        nextReset: nextReset
      });
      scores = initializeDefaultTasks(scores);
      await scores.save();
      console.log('✅ Default scores and tasks initialized');
    }
    return scores;
  } catch (error) {
    console.error('Error initializing scores:', error);
    throw error;
  }
};

// API Routes

// Get current scores, tasks, and history
app.get('/api/scores', async (req, res) => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    } else {
      scores = await checkAndResetScores(scores);
    }
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task value (checkbox, water, study, workout)
app.post('/api/scores/task/:taskIndex/update', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    const { player, value } = req.body; // player: 1 or 2, value: number
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    // Ensure value is within bounds
    const newValue = Math.max(0, Math.min(value, task.maxValue));
    const oldValue = task[playerKey];
    
    // Update task value
    task[playerKey] = newValue;
    
    // Update score based on change
    const pointChange = newValue - oldValue;
    scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle checkbox task
app.post('/api/scores/task/:taskIndex/toggle', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    const { player } = req.body;
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    if (task.type !== 'checkbox') {
      return res.status(400).json({ error: 'This task is not a checkbox type' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    // Toggle checkbox (0 or 1)
    const newValue = task[playerKey] === 0 ? 1 : 0;
    const pointChange = newValue - task[playerKey];
    
    task[playerKey] = newValue;
    scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Increment/decrement value tasks (water, study, workout)
app.post('/api/scores/task/:taskIndex/increment', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    const { player, change } = req.body; // change: 1 or -1
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    if (task.type === 'checkbox') {
      return res.status(400).json({ error: 'Use toggle for checkbox tasks' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    // Calculate new value within bounds
    const newValue = Math.max(0, Math.min(task[playerKey] + change, task.maxValue));
    const pointChange = newValue - task[playerKey];
    
    task[playerKey] = newValue;
    scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add custom task
app.post('/api/scores/task', async (req, res) => {
  try {
    const { name, type, maxValue } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Task name is required' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    // Check if task already exists
    const existingTask = scores.dailyTasks.find(task => task.name === name.trim());
    if (existingTask) {
      return res.status(400).json({ error: 'Task already exists' });
    }
    
    // Add new task
    scores.dailyTasks.push({
      name: name.trim(),
      type: type || 'checkbox',
      maxValue: maxValue || 1,
      player1Value: 0,
      player2Value: 0
    });
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a task
app.delete('/api/scores/task/:taskIndex', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    
    // Remove points from players
    scores.player1Score = Math.max(0, scores.player1Score - task.player1Value);
    scores.player2Score = Math.max(0, scores.player2Score - task.player2Value);
    
    // Remove the task
    scores.dailyTasks.splice(index, 1);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    // Calculate time until next reset
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving frontend from: ${path.join(__dirname, '../client')}`);
  console.log(`👥 Players: Nish vs Jess`);
  console.log(`🔄 Auto-reset: Every 24 hours`);
  console.log(`📊 Tracking: Checkboxes, Water, Study, Workout`);
  console.log(`📅 7-day history calendar`);
});