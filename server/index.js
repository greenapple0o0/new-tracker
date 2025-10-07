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
    maxValue: { type: Number, default: 1 },
    player1Value: { type: Number, default: 0 },
    player2Value: { type: Number, default: 0 }
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

// Updated default tasks - Only Water (3000mL), Study, and Workout
const DEFAULT_TASKS = [
  { name: 'Water Drank (mL)', type: 'water', maxValue: 3000, player1Value: 0, player2Value: 0 },
  { name: 'Studied (hours)', type: 'study', maxValue: 8, player1Value: 0, player2Value: 0 },
  { name: 'Workout Done (hours)', type: 'workout', maxValue: 2, player1Value: 0, player2Value: 0 }
];

// Function to ensure default tasks exist
const ensureDefaultTasks = async (scores) => {
  let needsUpdate = false;
  
  // Remove any tasks that are not in the new default list
  const tasksToRemove = [];
  scores.dailyTasks.forEach((task, index) => {
    const isDefaultInNewList = DEFAULT_TASKS.some(defaultTask => defaultTask.name === task.name);
    if (!isDefaultInNewList && ['Water Drank (cups)', 'Morning Routine', 'Healthy Eating', 'No Sugar', 'Meditation'].includes(task.name)) {
      tasksToRemove.push(index);
    }
  });
  
  // Remove tasks in reverse order to avoid index issues
  for (let i = tasksToRemove.length - 1; i >= 0; i--) {
    scores.dailyTasks.splice(tasksToRemove[i], 1);
    needsUpdate = true;
  }
  
  // Check if any default tasks are missing
  DEFAULT_TASKS.forEach(defaultTask => {
    const existingTask = scores.dailyTasks.find(task => task.name === defaultTask.name);
    if (!existingTask) {
      scores.dailyTasks.push(defaultTask);
      needsUpdate = true;
      console.log(`✅ Added default task: ${defaultTask.name}`);
    } else if (defaultTask.name === 'Water Drank (mL)' && existingTask.maxValue !== 3000) {
      // Update water task to 3000mL if it exists with wrong maxValue
      existingTask.maxValue = 3000;
      existingTask.name = 'Water Drank (mL)';
      needsUpdate = true;
      console.log(`✅ Updated water task to 3000mL`);
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
    const pointChange = newValue - task[playerKey]; // This should be 1 or -1
    
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

// Increment/decrement number tasks (for study)
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
    
    // For study task, 1 hour = 1 point
    if (change > 0) {
      // Increment
      const potentialNewValue = task[playerKey] + 1;
      if (potentialNewValue <= task.maxValue) {
        newValue = potentialNewValue;
        pointChange = 1;
      }
    } else if (change < 0) {
      // Decrement
      const potentialNewValue = task[playerKey] - 1;
      if (potentialNewValue >= 0) {
        newValue = potentialNewValue;
        pointChange = -1;
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

// Custom water input endpoint
app.post('/api/scores/task/water/update', async (req, res) => {
  try {
    const { player, amount } = req.body; // amount in mL
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const waterTask = scores.dailyTasks.find(task => task.name === 'Water Drank (mL)');
    if (!waterTask) {
      return res.status(404).json({ error: 'Water task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    const oldValue = waterTask[playerKey];
    const newValue = Math.max(0, Math.min(amount, waterTask.maxValue));
    
    // Calculate points: 750mL = 1 point
    const oldPoints = Math.floor(oldValue / 750);
    const newPoints = Math.floor(newValue / 750);
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
    res.status(500).json({ error: error.message });
  }
});

// Custom workout input endpoint
app.post('/api/scores/task/workout/update', async (req, res) => {
  try {
    const { player, minutes } = req.body; // minutes of workout
    
    if (![1, 2].includes(player)) {
      return res.status(400).json({ error: 'Invalid player. Use 1 for Nish or 2 for Jess' });
    }
    
    let scores = await Score.findOne();
    if (!scores) {
      scores = await initializeScores();
    }
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const workoutTask = scores.dailyTasks.find(task => task.name === 'Workout Done (hours)');
    if (!workoutTask) {
      return res.status(404).json({ error: 'Workout task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    // Convert minutes to hours for storage
    const hours = minutes / 60;
    const oldValue = workoutTask[playerKey];
    const newValue = Math.max(0, Math.min(hours, workoutTask.maxValue));
    
    // Calculate points: 30 minutes = 1 point
    const oldPoints = Math.floor(oldValue * 60 / 30); // Convert hours to minutes, then calculate points
    const newPoints = Math.floor(minutes / 30);
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
    
    scores = await ensureDefaultTasks(scores);
    scores = await checkAndResetScores(scores);
    
    const existingTask = scores.dailyTasks.find(task => task.name === name.trim());
    if (existingTask) {
      return res.status(400).json({ error: 'Task already exists' });
    }
    
    scores.dailyTasks.push({
      name: name.trim(),
      type: type || 'checkbox',
      maxValue: maxValue || 1,
      player1Value: 0,
      player2Value: 0
    });
    
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
    
    scores.player1Score = Math.max(0, scores.player1Score - task.player1Value);
    scores.player2Score = Math.max(0, scores.player2Score - task.player2Value);
    
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
  console.log(`📊 Default tasks: Water (3000mL), Study, Workout`);
  console.log(`📅 7-day history calendar`);
});