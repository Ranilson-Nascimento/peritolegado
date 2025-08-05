import dotenv from 'dotenv';

// Load environment variables from .env file, if present.
dotenv.config();

/**
 * Central configuration loader. Reads variables from the environment
 * and exposes them in a strongly typed object. This can be extended
 * as new databases are supported.
 */
export const config = {
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASS || '',
    database: process.env.MYSQL_DB || '',
  },
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || '',
  },
  oracle: {
    user: process.env.ORACLE_USER || 'system',
    password: process.env.ORACLE_PASSWORD || '',
    connectString: process.env.ORACLE_CONNECT_STRING || '',
  },
  sqlserver: {
    server: process.env.MSSQL_SERVER || 'localhost',
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || '',
    database: process.env.MSSQL_DATABASE || '',
  },
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/test',
  },
  firebird: {
    database: process.env.FIREBIRD_DB_PATH || '',
    user: process.env.FIREBIRD_USER || 'sysdba',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  },
};

export default config;