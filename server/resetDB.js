const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/competitive-track';

async function resetDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Drop the scores collection
        await mongoose.connection.db.collection('scores').drop();
        console.log('🗑️ Dropped scores collection');
        
        console.log('🔄 Database reset complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting database:', error);
        process.exit(1);
    }
}

resetDatabase();