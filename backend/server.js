import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import db, { initializeDatabase } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE');

// --- SECURITY MIDDLEWARE ---
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));
app.use(express.json());

// Helper to get current month YYYY-MM
const getCurrentMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// --- NATIVE CRYPTO AUTH HELPERS ---
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};

const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// --- AUTHENTICATION MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No session token provided' });
    }

    const token = authHeader.split(' ')[1];
    const sessionRes = await db.query('SELECT * FROM sessions WHERE token = $1', [token]);
    const session = sessionRes.rows[0];

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }

    const now = new Date().toISOString();
    if (session.expires_at < now) {
      await db.query('DELETE FROM sessions WHERE token = $1', [token]);
      return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }

    // Load user settings details
    const userRes = await db.query('SELECT id, email, business_name, tracking_label, currency FROM users WHERE id = $1', [session.user_id]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User account not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal Auth Error' });
  }
};

// ==========================================
//             AUTH ENDPOINTS
// ==========================================

// 1. POST /api/auth/signup - Register new business/personal tracker
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, business_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // Check if email already registered
    const existingRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingRes.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = hashPassword(password);
    const created_at = new Date().toISOString();
    const defaultBusiness = business_name || `${email.split('@')[0]}'s Tracker`;

    // Create user
    const insertRes = await db.query(`
      INSERT INTO users (email, password_hash, business_name, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [email, password_hash, defaultBusiness, created_at]);

    const userId = insertRes.rows[0].id;

    // Log them in immediately (generate session)
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    await db.query(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `, [token, userId, expires_at]);

    res.status(201).json({
      token,
      user: {
        email,
        business_name: defaultBusiness,
        tracking_label: 'Meal',
        currency: '₹'
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// 2. POST /api/auth/login - Credentials login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate Session Token
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    await db.query(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `, [token, user.id, expires_at]);

    res.json({
      token,
      user: {
        email: user.email,
        business_name: user.business_name,
        tracking_label: user.tracking_label,
        currency: user.currency
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// 3. POST /api/auth/google - Real Google authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    // Verify the Google ID Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    });
    const payload = ticket.getPayload();
    const { email, sub: google_id, name } = payload;

    // Check if user exists by Google ID or email
    const userRes = await db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [google_id, email]);
    let user = userRes.rows[0];

    if (!user) {
      // Create a new user with Google profile
      const defaultBusiness = name ? `${name}'s Tracker` : `${email.split('@')[0]}'s Tracker`;
      const created_at = new Date().toISOString();
      
      const insertRes = await db.query(`
        INSERT INTO users (email, google_id, business_name, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [email, google_id, defaultBusiness, created_at]);

      user = {
        id: insertRes.rows[0].id,
        email,
        business_name: defaultBusiness,
        tracking_label: 'Meal',
        currency: '₹'
      };
    } else if (!user.google_id) {
      // Link Google ID to existing email account
      await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
      user.google_id = google_id;
    }

    // Generate Session Token
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    await db.query(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `, [token, user.id, expires_at]);

    res.json({
      token,
      user: {
        email: user.email,
        business_name: user.business_name,
        tracking_label: user.tracking_label || 'Meal',
        currency: user.currency || '₹'
      }
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// 4. POST /api/auth/logout - Invalidate session token
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ==========================================
//             SETTINGS ENDPOINTS
// ==========================================

app.get('/api/user/settings', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/user/settings', authMiddleware, async (req, res) => {
  try {
    const { business_name, tracking_label, currency } = req.body;

    if (!business_name || !tracking_label || !currency) {
      return res.status(400).json({ error: 'Missing business_name, tracking_label, or currency' });
    }

    await db.query(`
      UPDATE users 
      SET business_name = $1, tracking_label = $2, currency = $3
      WHERE id = $4
    `, [business_name, tracking_label, currency, req.user.id]);

    res.json({
      message: 'Settings updated successfully',
      user: {
        email: req.user.email,
        business_name,
        tracking_label,
        currency
      }
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
//           BUSINESS DATA ROUTING (Scoped)
// ==========================================

// 5. GET /api/customers - Get all customers for the logged-in user
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COALESCE(l.delivered_count, 0) as delivered_count,
        COALESCE(l.skipped_count, 0) as skipped_count,
        COALESCE(l.extra_count, 0) as extra_count,
        GREATEST(0, c.plan_duration - COALESCE(l.delivered_count, 0) - COALESCE(l.skipped_count, 0)) as pending_meals,
        (c.plan_amount - c.amount_paid) as pending_payment,
        CASE 
          WHEN (c.plan_amount - c.amount_paid) <= 0 THEN 'Paid'
          WHEN c.amount_paid > 0 THEN 'Partial'
          ELSE 'Unpaid'
        END as payment_status
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
          SUM(CASE WHEN status = 'extra' THEN 1 ELSE 0 END) as extra_count
        FROM meal_logs
        GROUP BY customer_id
      ) l ON c.id = l.customer_id
      WHERE c.user_id = $1
      ORDER BY c.active DESC, c.name ASC
    `;
    const custRes = await db.query(query, [req.user.id]);
    const formatted = custRes.rows.map(c => ({ 
      ...c, 
      active: !!c.active,
      plan_amount: parseFloat(c.plan_amount),
      amount_paid: parseFloat(c.amount_paid),
      pending_payment: parseFloat(c.pending_payment),
      pending_meals: parseInt(c.pending_meals),
      delivered_count: parseInt(c.delivered_count),
      skipped_count: parseInt(c.skipped_count),
      extra_count: parseInt(c.extra_count)
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// 6. GET /api/customers/:id - Get scoped single customer with details
app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const customerQuery = `
      SELECT 
        c.*,
        COALESCE(l.delivered_count, 0) as delivered_count,
        COALESCE(l.skipped_count, 0) as skipped_count,
        COALESCE(l.extra_count, 0) as extra_count,
        GREATEST(0, c.plan_duration - COALESCE(l.delivered_count, 0) - COALESCE(l.skipped_count, 0)) as pending_meals,
        (c.plan_amount - c.amount_paid) as pending_payment,
        CASE 
          WHEN (c.plan_amount - c.amount_paid) <= 0 THEN 'Paid'
          WHEN c.amount_paid > 0 THEN 'Partial'
          ELSE 'Unpaid'
        END as payment_status
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
          SUM(CASE WHEN status = 'extra' THEN 1 ELSE 0 END) as extra_count
        FROM meal_logs
        GROUP BY customer_id
      ) l ON c.id = l.customer_id
      WHERE c.id = $1 AND c.user_id = $2
    `;
    const custRes = await db.query(customerQuery, [id, req.user.id]);
    const customer = custRes.rows[0];
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    customer.active = !!customer.active;
    customer.plan_amount = parseFloat(customer.plan_amount);
    customer.amount_paid = parseFloat(customer.amount_paid);
    customer.pending_payment = parseFloat(customer.pending_payment);
    customer.pending_meals = parseInt(customer.pending_meals);
    customer.delivered_count = parseInt(customer.delivered_count);
    customer.skipped_count = parseInt(customer.skipped_count);
    customer.extra_count = parseInt(customer.extra_count);
    
    const logsRes = await db.query(`
      SELECT * FROM meal_logs 
      WHERE customer_id = $1 
      ORDER BY log_date DESC
    `, [id]);
    
    const paymentsRes = await db.query(`
      SELECT * FROM payments 
      WHERE customer_id = $1 
      ORDER BY payment_date DESC
    `, [id]);
    
    res.json({ 
      customer, 
      logs: logsRes.rows, 
      payments: paymentsRes.rows.map(p => ({ ...p, amount: parseFloat(p.amount) }))
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// 7. POST /api/customers - Add a customer linked to user_id
app.post('/api/customers', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    const {
      name, phone, address, subscription_type, plan_type,
      plan_start_date, next_delivery_date, plan_duration,
      plan_amount, amount_paid, notes, active
    } = req.body;
    
    if (!name || !phone || !address || !subscription_type || !plan_type || !plan_start_date || plan_duration === undefined || plan_amount === undefined) {
      return res.status(400).json({ error: 'Missing required customer fields' });
    }
    
    const paidVal = parseFloat(amount_paid) || 0;
    const activeVal = active ? 1 : 0;
    
    await client.query('BEGIN');
    
    const insertRes = await client.query(`
      INSERT INTO customers (
        user_id, name, phone, address, subscription_type, plan_type,
        plan_start_date, next_delivery_date, plan_duration,
        plan_amount, amount_paid, notes, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      req.user.id, name, phone, address, subscription_type, plan_type,
      plan_start_date, next_delivery_date || null, parseInt(plan_duration),
      parseFloat(plan_amount), paidVal, notes || '', activeVal
    ]);
    
    const newCustomerId = insertRes.rows[0].id;
    
    if (paidVal > 0) {
      await client.query(`
        INSERT INTO payments (customer_id, amount, payment_date, notes)
        VALUES ($1, $2, $3, $4)
      `, [newCustomerId, paidVal, plan_start_date, 'Initial payment recorded during setup']);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ id: newCustomerId, message: 'Customer created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  } finally {
    client.release();
  }
});

// 8. PUT /api/customers/:id - Update scoped customer
app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const {
      name, phone, address, subscription_type, plan_type,
      plan_start_date, next_delivery_date, plan_duration,
      plan_amount, amount_paid, notes, active
    } = req.body;
    
    if (!name || !phone || !address || !subscription_type || !plan_type || !plan_start_date || plan_duration === undefined || plan_amount === undefined) {
      return res.status(400).json({ error: 'Missing required customer fields' });
    }
    
    const activeVal = active ? 1 : 0;
    const paidVal = parseFloat(amount_paid) || 0;
    
    // Check owner
    const currentRes = await client.query('SELECT amount_paid FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const currentCustomer = currentRes.rows[0];
    if (!currentCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const diff = paidVal - parseFloat(currentCustomer.amount_paid);
    
    await client.query('BEGIN');
    
    await client.query(`
      UPDATE customers SET
        name = $1, phone = $2, address = $3, subscription_type = $4, plan_type = $5,
        plan_start_date = $6, next_delivery_date = $7, plan_duration = $8,
        plan_amount = $9, amount_paid = $10, notes = $11, active = $12
      WHERE id = $13 AND user_id = $14
    `, [
      name, phone, address, subscription_type, plan_type,
      plan_start_date, next_delivery_date || null, parseInt(plan_duration),
      parseFloat(plan_amount), paidVal, notes || '', activeVal, id, req.user.id
    ]);
    
    if (diff !== 0) {
      await client.query(`
        INSERT INTO payments (customer_id, amount, payment_date, notes)
        VALUES ($1, $2, $3, $4)
      `, [
        id, 
        diff, 
        new Date().toISOString().split('T')[0], 
        `Adjustment entry due to profile update`
      ]);
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  } finally {
    client.release();
  }
});

// 9. DELETE /api/customers/:id - Delete customer
app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// 10. GET /api/customers/:id/logs - Fetch customer logs
app.get('/api/customers/:id/logs', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check owner
    const customerRes = await db.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const logsRes = await db.query('SELECT * FROM meal_logs WHERE customer_id = $1 ORDER BY log_date DESC', [id]);
    res.json(logsRes.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// 11. POST /api/customers/:id/logs - Add log
app.post('/api/customers/:id/logs', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { log_date, status, note } = req.body;
    
    if (!log_date || !status) {
      return res.status(400).json({ error: 'Missing log_date or status' });
    }
    
    // Check owner
    const customerRes = await client.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM meal_logs WHERE customer_id = $1 AND log_date = $2', [id, log_date]);
    const info = await client.query(`
      INSERT INTO meal_logs (customer_id, log_date, status, note)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [id, log_date, status, note || '']);
    
    await client.query('COMMIT');
    res.status(201).json({ id: info.rows[0].id, message: 'Meal log recorded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording meal log:', error);
    res.status(500).json({ error: 'Failed to record meal log' });
  } finally {
    client.release();
  }
});

// 12. DELETE /api/meal-logs/:id - Delete/undo log
app.delete('/api/meal-logs/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      DELETE FROM meal_logs 
      WHERE id = $1 AND customer_id IN (SELECT id FROM customers WHERE user_id = $2)
    `, [id, req.user.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Meal log not found or unauthorized' });
    }
    
    res.json({ message: 'Meal log removed successfully' });
  } catch (error) {
    console.error('Error deleting meal log:', error);
    res.status(500).json({ error: 'Failed to delete meal log' });
  }
});

// 13. GET /api/customers/:id/payments - Fetch payments
app.get('/api/customers/:id/payments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const customerRes = await db.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const paymentsRes = await db.query('SELECT * FROM payments WHERE customer_id = $1 ORDER BY payment_date DESC', [id]);
    res.json(paymentsRes.rows.map(p => ({ ...p, amount: parseFloat(p.amount) })));
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// 14. POST /api/customers/:id/payments - Add payment
app.post('/api/customers/:id/payments', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { amount, payment_date, notes } = req.body;
    
    if (amount === undefined || !payment_date) {
      return res.status(400).json({ error: 'Missing amount or payment_date' });
    }
    
    // Check owner
    const customerRes = await client.query('SELECT id, plan_amount, amount_paid FROM customers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const customer = customerRes.rows[0];
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const paymentAmt = parseFloat(amount);
    
    await client.query('BEGIN');
    
    await client.query(`
      INSERT INTO payments (customer_id, amount, payment_date, notes)
      VALUES ($1, $2, $3, $4)
    `, [id, paymentAmt, payment_date, notes || '']);
    
    const updateRes = await client.query(`
      UPDATE customers 
      SET amount_paid = amount_paid + $1 
      WHERE id = $2
      RETURNING amount_paid, plan_amount
    `, [paymentAmt, id]);
    
    await client.query('COMMIT');
    
    const updatedCustomer = updateRes.rows[0];
    res.status(201).json({ 
      message: 'Payment recorded successfully', 
      amount_paid: parseFloat(updatedCustomer.amount_paid),
      pending_payment: parseFloat(updatedCustomer.plan_amount) - parseFloat(updatedCustomer.amount_paid)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// 15. GET /api/stats - Dashboard summary statistics
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const activeMonth = req.query.month || getCurrentMonthString(); // YYYY-MM
    
    // A. Active Customers
    const activeCountRes = await db.query('SELECT COUNT(*) as active_count FROM customers WHERE active = 1 AND user_id = $1', [req.user.id]);
    const active_count = parseInt(activeCountRes.rows[0].active_count) || 0;
    
    // B. Total Pending Payments (from active customers)
    const pendingPaymentRes = await db.query(`
      SELECT SUM(CASE WHEN plan_amount > amount_paid THEN plan_amount - amount_paid ELSE 0 END) as total_pending_payment 
      FROM customers 
      WHERE active = 1 AND user_id = $1
    `, [req.user.id]);
    const total_pending_payment = parseFloat(pendingPaymentRes.rows[0].total_pending_payment) || 0;
    
    // C. Total Pending Meals (for active plans)
    const pendingMealsRes = await db.query(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN c.plan_duration > (COALESCE(l.delivered_count, 0) + COALESCE(l.skipped_count, 0)) 
            THEN c.plan_duration - (COALESCE(l.delivered_count, 0) + COALESCE(l.skipped_count, 0))
            ELSE 0 
          END
        ), 0) as total_pending_meals
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count
        FROM meal_logs
        GROUP BY customer_id
      ) l ON c.id = l.customer_id
      WHERE c.active = 1 AND c.user_id = $1
    `, [req.user.id]);
    const total_pending_meals = parseInt(pendingMealsRes.rows[0].total_pending_meals) || 0;
    
    // D. Collected This Month
    const collectedRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as collected_this_month 
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE substring(p.payment_date from 1 for 7) = $1 AND c.user_id = $2
    `, [activeMonth, req.user.id]);
    const collected_this_month = parseFloat(collectedRes.rows[0].collected_this_month) || 0;

    // E. Expenses This Month
    const expensesRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as expenses_this_month
      FROM expenses
      WHERE substring(expense_date from 1 for 7) = $1 AND user_id = $2
    `, [activeMonth, req.user.id]);
    const expenses_this_month = parseFloat(expensesRes.rows[0].expenses_this_month) || 0;
    
    res.json({
      active_customers: active_count,
      pending_payments: total_pending_payment,
      pending_meals: total_pending_meals,
      collected_this_month: collected_this_month,
      expenses_this_month: expenses_this_month,
      net_revenue: collected_this_month - expenses_this_month
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// 16. GET /api/expenses - Get all scoped expenses
app.get('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const expensesRes = await db.query('SELECT * FROM expenses WHERE user_id = $1 ORDER BY expense_date DESC, id DESC', [req.user.id]);
    res.json(expensesRes.rows.map(e => ({ ...e, amount: parseFloat(e.amount) })));
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// 17. POST /api/expenses - Record a new scoped expense
app.post('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const { title, amount, expense_date, category, notes } = req.body;
    if (!title || amount === undefined || !expense_date) {
      return res.status(400).json({ error: 'Missing title, amount, or expense_date' });
    }
    const info = await db.query(`
      INSERT INTO expenses (user_id, title, amount, expense_date, category, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [req.user.id, title, parseFloat(amount), expense_date, category || 'Other', notes || '']);
    
    res.status(201).json({ id: info.rows[0].id, message: 'Expense recorded successfully' });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to record expense' });
  }
});

// 18. DELETE /api/expenses/:id - Delete scoped expense record
app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense record not found or unauthorized' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, async () => {
  try {
    await initializeDatabase();
    console.log(`Tracky backend REST API running on port ${PORT}`);
  } catch (err) {
    console.error('Failed to start server due to database initialization error:', err);
    process.exit(1);
  }
});
