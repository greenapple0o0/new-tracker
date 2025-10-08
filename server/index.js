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
});

// Schema
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

// Default tasks
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

// Enhanced duplicate prevention
const ensureDefaultTasks = async (scores) => {
  let needsUpdate = false;
  
  const taskMap = new Map();
  const tasksToKeep = [];
  
  for (let i = scores.dailyTasks.length - 1; i >= 0; i--) {
    const task = scores.dailyTasks[i];
    if (taskMap.has(task.name)) {
      console.log(`🗑️ Removing duplicate task: "${task.name}"`);
      needsUpdate = true;
      scores.dailyTasks.splice(i, 1);
    } else {
      taskMap.set(task.name, task);
      tasksToKeep.unshift(task);
    }
  }
  
  if (needsUpdate) {
    scores.dailyTasks = tasksToKeep;
  }
  
  DEFAULT_TASKS.forEach(defaultTask => {
    const existingTaskIndex = scores.dailyTasks.findIndex(task => task.name === defaultTask.name);
    
    if (existingTaskIndex === -1) {
      scores.dailyTasks.push({ ...defaultTask });
      needsUpdate = true;
      console.log(`✅ Added missing default task: "${defaultTask.name}"`);
    } else {
      const existingTask = scores.dailyTasks[existingTaskIndex];
      let taskUpdated = false;
      
      if (existingTask.type !== defaultTask.type) {
        existingTask.type = defaultTask.type;
        taskUpdated = true;
      }
      if (existingTask.maxValue !== defaultTask.maxValue) {
        existingTask.maxValue = defaultTask.maxValue;
        taskUpdated = true;
      }
      
      if (taskUpdated) {
        needsUpdate = true;
        console.log(`🔄 Updated default task configuration: "${defaultTask.name}"`);
      }
    }
  });

  if (needsUpdate) {
    await scores.save();
  }
  
  return scores;
};

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

const initializeScores = async () => {
  try {
    let scores = await Score.findOne();
    if (!scores) {
      console.log('📝 No scores document found, creating new one...');
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
    const nextReset = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return {
      player1: 'Nish',
      player2: 'Jess', 
      player1Score: 0,
      player2Score: 0,
      dailyTasks: DEFAULT_TASKS,
      dailyHistory: [],
      lastReset: new Date(),
      nextReset: nextReset,
      timeUntilReset: 24 * 60 * 60 * 1000
    };
  }
};

const calculatePoints = (taskType, value, config = null) => {
  switch (taskType) {
    case 'water':
      return Math.floor(value / 750);
    case 'workout':
      return Math.floor(value * 2);
    case 'study':
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
app.get('/api/scores', async (req, res) => {
  try {
    let scores;
    try {
      scores = await Score.findOne();
      if (!scores) {
        scores = await initializeScores();
      } else {
        scores = await ensureDefaultTasks(scores);
        scores = await checkAndResetScores(scores);
      }
    } catch (dbError) {
      console.error('Database error, returning default scores:', dbError);
      scores = {
        player1: 'Nish',
        player2: 'Jess',
        player1Score: 0,
        player2Score: 0,
        dailyTasks: DEFAULT_TASKS,
        dailyHistory: [],
        timeUntilReset: 24 * 60 * 60 * 1000
      };
    }
    
    const now = new Date();
    const timeUntilReset = scores.nextReset ? scores.nextReset - now : 24 * 60 * 60 * 1000;
    
    res.json({
      ...scores,
      timeUntilReset: Math.max(0, timeUntilReset)
    });
  } catch (error) {
    console.error('Error in /api/scores:', error);
    res.json({
      player1: 'Nish',
      player2: 'Jess',
      player1Score: 0,
      player2Score: 0,
      dailyTasks: DEFAULT_TASKS,
      dailyHistory: [],
      timeUntilReset: 24 * 60 * 60 * 1000
    });
  }
});

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
    
    const waterTask = scores.dailyTasks.find(task => task.type === 'water');
    if (!waterTask) {
      return res.status(404).json({ error: 'Water task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    const oldValue = waterTask[playerKey];
    const newValue = Math.max(0, Math.min(oldValue + amount, waterTask.maxValue));
    
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
    
    const workoutTask = scores.dailyTasks.find(task => task.type === 'workout');
    if (!workoutTask) {
      return res.status(404).json({ error: 'Workout task not found' });
    }
    
    const playerKey = player === 1 ? 'player1Value' : 'player2Value';
    const scoreKey = player === 1 ? 'player1Score' : 'player2Score';
    
    const oldValue = workoutTask[playerKey];
    const newValue = Math.max(0, Math.min(oldValue + hours, workoutTask.maxValue));
    
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
    
    const isDefaultTask = DEFAULT_TASKS.some(defaultTask => defaultTask.name === task.name);
    if (isDefaultTask) {
      return res.status(400).json({ error: 'Cannot rename default tasks' });
    }
    
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
    
    const isDefaultTask = DEFAULT_TASKS.some(defaultTask => defaultTask.name === task.name);
    if (isDefaultTask) {
      return res.status(400).json({ error: 'Cannot delete default tasks' });
    }
    
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
      timeUntilReset: Math.max(0, timeSinceReset)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database reset endpoint for emergencies
app.post('/api/reset-database', async (req, res) => {
  try {
    await Score.deleteMany({});
    console.log('🗑️ All scores data reset');
    
    await initializeScores();
    
    res.json({ 
      success: true, 
      message: 'Database reset successfully. Default tasks recreated.' 
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

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