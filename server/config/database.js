const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Database configuration using individual environment variables
const sequelize = new Sequelize({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'crmdb',
  username: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'root',
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL database connection established successfully.');
    console.log('📊 Database:', process.env.PGDATABASE || 'crmdb');
    console.log('👤 User:', process.env.PGUSER || 'postgres');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL database:', error.message);
    console.error('🔧 Please ensure PostgreSQL is running and credentials are correct');
    return false;
  }
};

module.exports = { sequelize, DataTypes, testConnection };
