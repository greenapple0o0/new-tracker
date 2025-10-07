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

// Updated Score Schema for Task System with Reset Tracking
const scoreSchema = new mongoose.Schema({
  player1: { type: String, default: 'Nish' },
  player2: { type: String, default: 'Jess' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  tasks: [{
    name: String,
    points: { type: Number, default: 1 },
    completedBy: { type: Number, default: null } // 1 for Nish, 2 for Jess, null for not completed
  }],
  lastReset: { type: Date, default: Date.now },
  nextReset: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }, // 24 hours from now
  lastUpdated: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// Function to check and perform auto-reset if needed
const checkAndResetScores = async (scores) => {
  const now = new Date();
  
  if (now >= scores.nextReset) {
    console.log('🔄 Performing automatic 24-hour reset...');
    
    // Reset scores and task completions
    scores.player1Score = 0;
    scores.player2Score = 0;
    scores.tasks.forEach(task => {
      task.completedBy = null;
    });
    
    // Set next reset time (24 hours from now)
    scores.lastReset = now;
    scores.nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    scores.lastUpdated = now;
    
    await scores.save();
    console.log('✅ Scores reset automatically');
  }
  
  return scores;
};

// Initialize default scores with fixed names
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
        tasks: [],
        lastReset: new Date(),
        nextReset: nextReset
      });
      console.log('✅ Default scores initialized');
      console.log(`⏰ First auto-reset scheduled for: ${nextReset}`);
    }
    return scores;
  } catch (error) {
    console.error('Error initializing scores:', error);
    throw error;
  }
};

// API Routes

// Get current scores and tasks with reset timer
app.get('/api/scores', async (req, res) => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    } else {
      // Check if auto-reset is needed
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

// Update scores and tasks
app.put('/api/scores', async (req, res) => {
  try {
    const { player1Score, player2Score, tasks } = req.body;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    // Always keep names fixed
    scores.player1 = 'Nish';
    scores.player2 = 'Jess';
    
    if (player1Score !== undefined) scores.player1Score = player1Score;
    if (player2Score !== undefined) scores.player2Score = player2Score;
    if (tasks) scores.tasks = tasks;
    
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

// Add new task
app.post('/api/scores/task', async (req, res) => {
  try {
    const { name, points } = req.body;
    
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
    const existingTask = scores.tasks.find(task => task.name === name.trim());
    if (existingTask) {
      return res.status(400).json({ error: 'Task already exists' });
    }
    
    // Add new task
    scores.tasks.push({
      name: name.trim(),
      points: points || 1,
      completedBy: null
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

// Toggle task completion
app.post('/api/scores/task/:taskId/toggle', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { player } = req.body; // 1 for Nish, 2 for Jess
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const taskIndex = parseInt(taskId);
    if (taskIndex < 0 || taskIndex >= scores.tasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.tasks[taskIndex];
    const points = task.points || 1;
    
    // Toggle completion
    if (task.completedBy === player) {
      // Undo completion - remove points
      task.completedBy = null;
      if (player === 1) {
        scores.player1Score = Math.max(0, scores.player1Score - points);
      } else {
        scores.player2Score = Math.max(0, scores.player2Score - points);
      }
    } else {
      // Complete task - add points
      task.completedBy = player;
      if (player === 1) {
        scores.player1Score += points;
      } else {
        scores.player2Score += points;
      }
    }
    
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
app.delete('/api/scores/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Check auto-reset first
    scores = await checkAndResetScores(scores);
    
    const taskIndex = parseInt(taskId);
    if (taskIndex < 0 || taskIndex >= scores.tasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.tasks[taskIndex];
    
    // If task was completed, remove points from the player
    if (task.completedBy === 1) {
      scores.player1Score = Math.max(0, scores.player1Score - (task.points || 1));
    } else if (task.completedBy === 2) {
      scores.player2Score = Math.max(0, scores.player2Score - (task.points || 1));
    }
    
    // Remove the task
    scores.tasks.splice(taskIndex, 1);
    
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

// Manual reset endpoint (optional - can be removed if you don't want any reset button)
app.post('/api/scores/manual-reset', async (req, res) => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    // Reset scores and task completions
    scores.player1Score = 0;
    scores.player2Score = 0;
    scores.tasks.forEach(task => {
      task.completedBy = null;
    });
    
    // Set next reset time (24 hours from now)
    const now = new Date();
    scores.lastReset = now;
    scores.nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    scores.lastUpdated = now;
    
    await scores.save();
    
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
  console.log(`🎯 Task-based scoring system ready!`);
});