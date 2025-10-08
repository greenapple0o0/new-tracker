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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/competitive-track';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Updated Schema with better task configuration
const scoreSchema = new mongoose.Schema({
  player1: { type: String, default: 'Nish' },
  player2: { type: String, default: 'Jess' },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  dailyTasks: [{
    name: String,
    type: { type: String, enum: ['checkbox', 'water', 'study', 'workout', 'number'], default: 'checkbox' },
    maxValue: { type: Number, default: 1 },
    player1Value: { type: Number, default: 0 },
    player2Value: { type: Number, default: 0 },
    config: {
      pointsPerUnit: { type: Number, default: 1 },
      unitsPerClick: { type: Number, default: 1 },
      unitLabel: { type: String, default: 'units' }
    }
  }],
  dailyHistory: [{
    date: String,
    player1Score: Number,
    player2Score: Number,
    winner: String,
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

// Updated default tasks with better configuration
const DEFAULT_TASKS = [
  { 
    name: 'Water Drank', 
    type: 'water', 
    maxValue: 3000, 
    player1Value: 0, 
    player2Value: 0 
  },
  { 
    name: 'Studied', 
    type: 'study', 
    maxValue: 8, 
    player1Value: 0, 
    player2Value: 0 
  },
  { 
    name: 'Workout Done', 
    type: 'workout', 
    maxValue: 2, 
    player1Value: 0, 
    player2Value: 0 
  }
];

// Function to ensure default tasks exist
const ensureDefaultTasks = async (scores) => {
  let needsUpdate = false;
  
  DEFAULT_TASKS.forEach(defaultTask => {
    const existingTask = scores.dailyTasks.find(task => task.name === defaultTask.name);
    if (!existingTask) {
      scores.dailyTasks.push(defaultTask);
      needsUpdate = true;
      console.log(`✅ Added default task: ${defaultTask.name}`);
    }
  });

  if (needsUpdate) {
    await scores.save();
  }
  
  return scores;
};

// Function to save daily results to history
const saveDailyHistory = async (scores) => {
  const today = new Date().toISOString().split('T')[0];
  
  let winner = 'tie';
  if (scores.player1Score > scores.player2Score) winner = 'nish';
  else if (scores.player2Score > scores.player1Score) winner = 'jess';

  const tasksCompleted = {
    nish: scores.dailyTasks.filter(task => task.player1Value > 0).length,
    jess: scores.dailyTasks.filter(task => task.player2Value > 0).length
  };

  const existingHistoryIndex = scores.dailyHistory.findIndex(day => day.date === today);
  
  if (existingHistoryIndex >= 0) {
    scores.dailyHistory[existingHistoryIndex] = {
      date: today,
      player1Score: scores.player1Score,
      player2Score: scores.player2Score,
      winner: winner,
      tasksCompleted: tasksCompleted
    };
  } else {
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
    
    await saveDailyHistory(scores);
    
    scores.player1Score = 0;
    scores.player2Score = 0;
    scores.dailyTasks.forEach(task => {
      task.player1Value = 0;
      task.player2Value = 0;
    });
    
    scores.lastReset = now;
    scores.nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    scores.lastUpdated = now;
    
    await scores.save();
    console.log('✅ Scores reset automatically and history saved');
  }
  
  return scores;
};

// Initialize or get scores
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
        dailyTasks: DEFAULT_TASKS,
        dailyHistory: [],
        lastReset: new Date(),
        nextReset: nextReset
      });
      console.log('✅ New scores document created with default tasks');
    } else {
      scores = await ensureDefaultTasks(scores);
    }
    return scores;
  } catch (error) {
    console.error('Error initializing scores:', error);
    throw error;
  }
};

// Helper function to calculate points for different task types
const calculatePoints = (taskType, value, config = null) => {
  switch (taskType) {
    case 'water':
      // 500mL = 1 point, so 750mL = 1.5 points, but we want 750mL = 1 point
      return Math.floor(value / 750); // 750mL per point
    
    case 'workout':
      // 30 minutes = 1 point, so 0.5 hours = 1 point
      return Math.floor(value * 2); // Multiply by 2 because 0.5 hours = 1 point
    
    case 'study':
      // 1 hour = 1 point
      return Math.floor(value);
    
    case 'number':
      if (config) {
        return Math.floor(value * config.pointsPerUnit);
      }
      return Math.floor(value);
    
    case 'checkbox':
    default:
      return Math.floor(value);
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
      scores = await ensureDefaultTasks(scores);
      scores = await checkAndResetScores(scores);
    }
    
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
    
    scores = await ensureDefaultTasks(scores);
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

// Increment/decrement number tasks
app.post('/api/scores/task/:taskIndex/increment', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    const { player, change } = req.body;
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
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
    
    let pointChange = 0;
    let newValue = task[playerKey];
    
    if (change > 0) {
      // Increment
      const potentialNewValue = task.type === 'number' && task.config ? 
        task[playerKey] + (change * (task.config.unitsPerClick || 1)) :
        task[playerKey] + change;
      
      if (potentialNewValue <= task.maxValue) {
        newValue = potentialNewValue;
        const oldPoints = calculatePoints(task.type, task[playerKey], task.config);
        const newPoints = calculatePoints(task.type, newValue, task.config);
        pointChange = newPoints - oldPoints;
      }
    } else if (change < 0) {
      // Decrement
      const potentialNewValue = task.type === 'number' && task.config ? 
        task[playerKey] + (change * (task.config.unitsPerClick || 1)) :
        task[playerKey] + change;
      
      if (potentialNewValue >= 0) {
        newValue = potentialNewValue;
        const oldPoints = calculatePoints(task.type, task[playerKey], task.config);
        const newPoints = calculatePoints(task.type, newValue, task.config);
        pointChange = newPoints - oldPoints;
      }
    }
    
    // Only update if there's an actual change
    if (pointChange !== 0) {
      task[playerKey] = newValue;
      scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
      
      scores.lastUpdated = new Date();
      await scores.save();
    }
    
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

// Water update endpoint
app.post('/api/scores/task/water/increment', async (req, res) => {
  try {
    const { player, amount } = req.body;
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    // Find water task
    const waterTask = scores.dailyTasks.find(task => task.type === 'water');
    if (!waterTask) {
      return res.status(404).json({ error: 'Water task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    const oldValue = waterTask[playerKey];
    const newValue = Math.max(0, Math.min(oldValue + amount, waterTask.maxValue));
    
    // Calculate points: 750mL = 1 point
    const oldPoints = calculatePoints('water', oldValue);
    const newPoints = calculatePoints('water', newValue);
    const pointChange = newPoints - oldPoints;
    
    waterTask[playerKey] = newValue;
    scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    console.error('Error in water increment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Workout update endpoint
app.post('/api/scores/task/workout/increment', async (req, res) => {
  try {
    const { player, hours } = req.body;
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    // Find workout task
    const workoutTask = scores.dailyTasks.find(task => task.type === 'workout');
    if (!workoutTask) {
      return res.status(404).json({ error: 'Workout task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    const oldValue = workoutTask[playerKey];
    const newValue = Math.max(0, Math.min(oldValue + hours, workoutTask.maxValue));
    
    // Calculate points: 30 minutes = 1 point (0.5 hours = 1 point)
    const oldPoints = calculatePoints('workout', oldValue);
    const newPoints = calculatePoints('workout', newValue);
    const pointChange = newPoints - oldPoints;
    
    workoutTask[playerKey] = newValue;
    scores[scoreKey] = Math.max(0, scores[scoreKey] + pointChange);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
    const now = new Date();
    const timeUntilReset = scores.nextReset - now;
    
    res.json({
      ...scores.toObject(),
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    console.error('Error in workout increment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task name endpoint
app.put('/api/scores/task/:taskIndex/rename', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    const { newName } = req.body;
    
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ error: 'Task name is required' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    
    // Check if this is a default task (prevent renaming)
    const isDefaultTask = DEFAULT_TASKS.some(defaultTask => defaultTask.name === task.name);
    if (isDefaultTask) {
      return res.status(400).json({ error: 'Cannot rename default tasks' });
    }
    
    // Check if new name already exists
    const existingTask = scores.dailyTasks.find((t, i) => i !== index && t.name === newName.trim());
    if (existingTask) {
      return res.status(400).json({ error: 'Task name already exists' });
    }
    
    task.name = newName.trim();
    scores.lastUpdated = new Date();
    await scores.save();
    
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
    const { name, type, maxValue, pointsPerUnit, unitsPerClick, unitLabel } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Task name is required' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const existingTask = scores.dailyTasks.find(task => task.name === name.trim());
    if (existingTask) {
      return res.status(400).json({ error: 'Task already exists' });
    }
    
    const newTask = {
      name: name.trim(),
      type: type || 'checkbox',
      maxValue: maxValue || 1,
      player1Value: 0,
      player2Value: 0
    };
    
    // Add configuration for number tasks
    if (type === 'number') {
      newTask.config = {
        pointsPerUnit: pointsPerUnit || 1,
        unitsPerClick: unitsPerClick || 1,
        unitLabel: unitLabel || 'units'
      };
    }
    
    scores.dailyTasks.push(newTask);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
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

// Delete a task (only custom tasks, not default ones)
app.delete('/api/scores/task/:taskIndex', async (req, res) => {
  try {
    const { taskIndex } = req.params;
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const index = parseInt(taskIndex);
    if (index < 0 || index >= scores.dailyTasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = scores.dailyTasks[index];
    
    // Check if this is a default task (prevent deletion)
    const isDefaultTask = DEFAULT_TASKS.some(defaultTask => defaultTask.name === task.name);
    if (isDefaultTask) {
      return res.status(400).json({ error: 'Cannot delete default tasks' });
    }
    
    // Remove points associated with this task
    const nishPoints = calculatePoints(task.type, task.player1Value, task.config);
    const jessPoints = calculatePoints(task.type, task.player2Value, task.config);
    
    scores.player1Score = Math.max(0, scores.player1Score - nishPoints);
    scores.player2Score = Math.max(0, scores.player2Score - jessPoints);
    
    scores.dailyTasks.splice(index, 1);
    
    scores.lastUpdated = new Date();
    await scores.save();
    
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
  console.log(`📊 Default tasks: Water, Study, Workout`);
  console.log(`🎯 Scoring: 750mL water = 1 point, 30min workout = 1 point`);
  console.log(`📅 7-day history calendar`);
});