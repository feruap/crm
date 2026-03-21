import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Support both DATABASE_URL (preferred) and individual DB_* vars
const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, max: 20, idleTimeoutMillis: 30000 }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'myalice_clone',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
    };

export const db = new Pool(poolConfig);
