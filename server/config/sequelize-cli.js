'use strict';

require('dotenv').config();

const baseConfig = {
  username: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'root',
  database: process.env.PGDATABASE || 'crmdb',
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  }
};

module.exports = {
  development: { ...baseConfig },
  test: { ...baseConfig, database: process.env.PGDATABASE_TEST || `${baseConfig.database}_test` },
  production: {
    ...baseConfig,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
};


