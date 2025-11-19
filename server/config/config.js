const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const common = {
  dialect: 'postgres',
  logging: false,
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  }
};

const buildConfig = () => {
  if (process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING) {
    return {
      ...common,
      use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG_CONNECTION_STRING',
      dialectOptions: {
        ssl:
          process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
            ? {
                require: true,
                rejectUnauthorized: false
              }
            : process.env.PGSSLMODE === 'disable'
            ? false
            : false
      }
    };
  }

  return {
    ...common,
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE || 'crmdb',
    username: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'root',
    dialectOptions: {
      ssl:
        process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
          ? {
              require: true,
              rejectUnauthorized: false
            }
          : process.env.PGSSLMODE === 'disable'
          ? false
          : false
    }
  };
};

const config = buildConfig();

module.exports = {
  development: config,
  test: config,
  production: config
};

