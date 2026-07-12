import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connection pool configuration
// Uses the DATABASE_URL environment variable provided by Neon or Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech') 
    ? { rejectUnauthorized: false } 
    : false
});

// Initialize schema (runs once on startup)
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Initializing PostgreSQL database schemas...');
    
    // Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT,
        google_id TEXT,
        business_name VARCHAR(255) NOT NULL DEFAULT 'My Tracker HQ',
        tracking_label VARCHAR(255) NOT NULL DEFAULT 'Meal',
        currency VARCHAR(50) NOT NULL DEFAULT '₹',
        created_at VARCHAR(100) NOT NULL
      );
    `);

    // Create Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at VARCHAR(100) NOT NULL
      );
    `);

    // Create Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        subscription_type VARCHAR(100) NOT NULL,
        plan_type VARCHAR(100) NOT NULL,
        plan_start_date VARCHAR(50) NOT NULL,
        next_delivery_date VARCHAR(50),
        plan_duration INTEGER NOT NULL,
        plan_amount DECIMAL(10, 2) NOT NULL,
        amount_paid DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        active INTEGER DEFAULT 1
      );
    `);

    // Create Meal Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        log_date VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL CHECK(status IN ('delivered', 'skipped', 'extra')),
        note TEXT,
        UNIQUE(customer_id, log_date, status)
      );
    `);

    // Create Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_date VARCHAR(50) NOT NULL,
        notes TEXT
      );
    `);

    // Create Expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        expense_date VARCHAR(50) NOT NULL,
        category VARCHAR(100) DEFAULT 'Other',
        notes TEXT
      );
    `);

    console.log('PostgreSQL database schemas verified successfully.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
