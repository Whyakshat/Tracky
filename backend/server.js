import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import db from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE');

// --- SECURITY MIDDLEWARE ---
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window` (here, per 15 minutes)
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
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No session token provided' });
    }

    const token = authHeader.split(' ')[1];
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }

    const now = new Date().toISOString();
    if (session.expires_at < now) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }

    // Load user settings details
    const user = db.prepare('SELECT id, email, business_name, tracking_label, currency FROM users WHERE id = ?').get(session.user_id);
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
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, business_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // Check if email already registered
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = hashPassword(password);
    const created_at = new Date().toISOString();
    const defaultBusiness = business_name || `${email.split('@')[0]}'s Tracker`;

    // Create user
    const info = db.prepare(`
      INSERT INTO users (email, password_hash, business_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run(email, password_hash, defaultBusiness, created_at);

    const userId = info.lastInsertRowid;

    // Log them in immediately (generate session)
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, userId, expires_at);

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
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate Session Token
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, user.id, expires_at);

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
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(google_id, email);

    if (!user) {
      // Create a new user with Google profile
      const defaultBusiness = name ? `${name}'s Tracker` : `${email.split('@')[0]}'s Tracker`;
      const created_at = new Date().toISOString();
      
      const info = db.prepare(`
        INSERT INTO users (email, google_id, business_name, created_at)
        VALUES (?, ?, ?, ?)
      `).run(email, google_id, defaultBusiness, created_at);

      user = {
        id: info.lastInsertRowid,
        email,
        business_name: defaultBusiness,
        tracking_label: 'Meal',
        currency: '₹'
      };
    } else if (!user.google_id) {
      // Link Google ID to existing email account
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(google_id, user.id);
      user.google_id = google_id;
    }

    // Generate Session Token
    const token = generateSessionToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, user.id, expires_at);

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
app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
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

app.put('/api/user/settings', authMiddleware, (req, res) => {
  try {
    const { business_name, tracking_label, currency } = req.body;

    if (!business_name || !tracking_label || !currency) {
      return res.status(400).json({ error: 'Missing business_name, tracking_label, or currency' });
    }

    db.prepare(`
      UPDATE users 
      SET business_name = ?, tracking_label = ?, currency = ?
      WHERE id = ?
    `).run(business_name, tracking_label, currency, req.user.id);

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
app.get('/api/customers', authMiddleware, (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COALESCE(l.delivered_count, 0) as delivered_count,
        COALESCE(l.skipped_count, 0) as skipped_count,
        COALESCE(l.extra_count, 0) as extra_count,
        MAX(0, c.plan_duration - COALESCE(l.delivered_count, 0) - COALESCE(l.skipped_count, 0)) as pending_meals,
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
      WHERE c.user_id = ?
      ORDER BY c.active DESC, c.name ASC
    `;
    const customers = db.prepare(query).all(req.user.id);
    const formatted = customers.map(c => ({ ...c, active: !!c.active }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// 6. GET /api/customers/:id - Get scoped single customer with details
app.get('/api/customers/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const customerQuery = `
      SELECT 
        c.*,
        COALESCE(l.delivered_count, 0) as delivered_count,
        COALESCE(l.skipped_count, 0) as skipped_count,
        COALESCE(l.extra_count, 0) as extra_count,
        MAX(0, c.plan_duration - COALESCE(l.delivered_count, 0) - COALESCE(l.skipped_count, 0)) as pending_meals,
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
      WHERE c.id = ? AND c.user_id = ?
    `;
    const customer = db.prepare(customerQuery).get(id, req.user.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    customer.active = !!customer.active;
    
    const logs = db.prepare(`
      SELECT * FROM meal_logs 
      WHERE customer_id = ? 
      ORDER BY log_date DESC
    `).all(id);
    
    const payments = db.prepare(`
      SELECT * FROM payments 
      WHERE customer_id = ? 
      ORDER BY payment_date DESC
    `).all(id);
    
    res.json({ customer, logs, payments });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// 7. POST /api/customers - Add a customer linked to user_id
app.post('/api/customers', authMiddleware, (req, res) => {
  try {
    const {
      name, phone, address, subscription_type, plan_type,
      plan_start_date, next_delivery_date, plan_duration,
      plan_amount, amount_paid, notes, active
    } = req.body;
    
    if (!name || !phone || !address || !subscription_type || !plan_type || !plan_start_date || plan_duration === undefined || plan_amount === undefined) {
      return res.status(400).json({ error: 'Missing required customer fields' });
    }
    
    const paidVal = amount_paid || 0;
    const activeVal = active ? 1 : 0;
    
    const insertTransaction = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO customers (
          user_id, name, phone, address, subscription_type, plan_type,
          plan_start_date, next_delivery_date, plan_duration,
          plan_amount, amount_paid, notes, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id, name, phone, address, subscription_type, plan_type,
        plan_start_date, next_delivery_date || null, plan_duration,
        plan_amount, paidVal, notes || '', activeVal
      );
      
      const newCustomerId = info.lastInsertRowid;
      
      if (paidVal > 0) {
        db.prepare(`
          INSERT INTO payments (customer_id, amount, payment_date, notes)
          VALUES (?, ?, ?, ?)
        `).run(newCustomerId, paidVal, plan_start_date, 'Initial payment recorded during setup');
      }
      
      return newCustomerId;
    });
    
    const newId = insertTransaction();
    res.status(201).json({ id: newId, message: 'Customer created successfully' });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// 8. PUT /api/customers/:id - Update scoped customer
app.put('/api/customers/:id', authMiddleware, (req, res) => {
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
    const paidVal = amount_paid || 0;
    
    // Check owner
    const currentCustomer = db.prepare('SELECT amount_paid FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!currentCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const diff = paidVal - currentCustomer.amount_paid;
    
    const updateTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE customers SET
          name = ?, phone = ?, address = ?, subscription_type = ?, plan_type = ?,
          plan_start_date = ?, next_delivery_date = ?, plan_duration = ?,
          plan_amount = ?, amount_paid = ?, notes = ?, active = ?
        WHERE id = ? AND user_id = ?
      `).run(
        name, phone, address, subscription_type, plan_type,
        plan_start_date, next_delivery_date || null, plan_duration,
        plan_amount, paidVal, notes || '', activeVal, id, req.user.id
      );
      
      if (diff !== 0) {
        db.prepare(`
          INSERT INTO payments (customer_id, amount, payment_date, notes)
          VALUES (?, ?, ?, ?)
        `).run(
          id, 
          diff, 
          new Date().toISOString().split('T')[0], 
          `Adjustment entry due to profile update`
        );
      }
    });
    
    updateTransaction();
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// 9. DELETE /api/customers/:id - Delete customer
app.delete('/api/customers/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').run(id, req.user.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(550).json({ error: 'Failed to delete customer' });
  }
});

// 10. GET /api/customers/:id/logs - Fetch customer logs
app.get('/api/customers/:id/logs', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    // Check owner
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const logs = db.prepare('SELECT * FROM meal_logs WHERE customer_id = ? ORDER BY log_date DESC').all(id);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// 11. POST /api/customers/:id/logs - Add log
app.post('/api/customers/:id/logs', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { log_date, status, note } = req.body;
    
    if (!log_date || !status) {
      return res.status(400).json({ error: 'Missing log_date or status' });
    }
    
    // Check owner
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const upsertTransaction = db.transaction(() => {
      db.prepare('DELETE FROM meal_logs WHERE customer_id = ? AND log_date = ?').run(id, log_date);
      const info = db.prepare(`
        INSERT INTO meal_logs (customer_id, log_date, status, note)
        VALUES (?, ?, ?, ?)
      `).run(id, log_date, status, note || '');
      
      return info.lastInsertRowid;
    });
    
    const newLogId = upsertTransaction();
    res.status(201).json({ id: newLogId, message: 'Meal log recorded successfully' });
  } catch (error) {
    console.error('Error recording meal log:', error);
    res.status(500).json({ error: 'Failed to record meal log' });
  }
});

// 12. DELETE /api/meal-logs/:id - Delete/undo log
app.delete('/api/meal-logs/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    // Only delete if the log belongs to a customer owned by req.user.id
    const result = db.prepare(`
      DELETE FROM meal_logs 
      WHERE id = ? AND customer_id IN (SELECT id FROM customers WHERE user_id = ?)
    `).run(id, req.user.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Meal log not found or unauthorized' });
    }
    
    res.json({ message: 'Meal log removed successfully' });
  } catch (error) {
    console.error('Error deleting meal log:', error);
    res.status(500).json({ error: 'Failed to delete meal log' });
  }
});

// 13. GET /api/customers/:id/payments - Fetch payments
app.get('/api/customers/:id/payments', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC').all(id);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// 14. POST /api/customers/:id/payments - Add payment
app.post('/api/customers/:id/payments', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_date, notes } = req.body;
    
    if (amount === undefined || !payment_date) {
      return res.status(400).json({ error: 'Missing amount or payment_date' });
    }
    
    // Check owner
    const customer = db.prepare('SELECT id, plan_amount, amount_paid FROM customers WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const paymentAmt = parseFloat(amount);
    
    const paymentTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (customer_id, amount, payment_date, notes)
        VALUES (?, ?, ?, ?)
      `).run(id, paymentAmt, payment_date, notes || '');
      
      db.prepare(`
        UPDATE customers 
        SET amount_paid = amount_paid + ? 
        WHERE id = ?
      `).run(paymentAmt, id);
      
      return db.prepare('SELECT amount_paid, plan_amount FROM customers WHERE id = ?').get(id);
    });
    
    const updatedCustomer = paymentTransaction();
    res.status(201).json({ 
      message: 'Payment recorded successfully', 
      amount_paid: updatedCustomer.amount_paid,
      pending_payment: updatedCustomer.plan_amount - updatedCustomer.amount_paid
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// 15. GET /api/stats - Dashboard summary statistics
app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const activeMonth = req.query.month || getCurrentMonthString(); // YYYY-MM
    
    // A. Active Customers
    const { active_count } = db.prepare('SELECT COUNT(*) as active_count FROM customers WHERE active = 1 AND user_id = ?').get(req.user.id);
    
    // B. Total Pending Payments (from active customers)
    const { total_pending_payment } = db.prepare(`
      SELECT SUM(CASE WHEN plan_amount > amount_paid THEN plan_amount - amount_paid ELSE 0 END) as total_pending_payment 
      FROM customers 
      WHERE active = 1 AND user_id = ?
    `).get(req.user.id);
    
    // C. Total Pending Meals (for active plans)
    const { total_pending_meals } = db.prepare(`
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
      WHERE c.active = 1 AND c.user_id = ?
    `).get(req.user.id);
    
    // D. Collected This Month
    // Query payments joined to scoped customers matching YYYY-MM
    const { collected_this_month } = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as collected_this_month 
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE strftime('%Y-%m', p.payment_date) = ? AND c.user_id = ?
    `).get(activeMonth, req.user.id);

    // E. Expenses This Month
    const { expenses_this_month } = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as expenses_this_month
      FROM expenses
      WHERE strftime('%Y-%m', expense_date) = ? AND user_id = ?
    `).get(activeMonth, req.user.id);
    
    res.json({
      active_customers: active_count || 0,
      pending_payments: total_pending_payment || 0,
      pending_meals: total_pending_meals || 0,
      collected_this_month: collected_this_month || 0,
      expenses_this_month: expenses_this_month || 0,
      net_revenue: (collected_this_month || 0) - (expenses_this_month || 0)
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// 16. GET /api/expenses - Get all scoped expenses
app.get('/api/expenses', authMiddleware, (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC').all(req.user.id);
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// 17. POST /api/expenses - Record a new scoped expense
app.post('/api/expenses', authMiddleware, (req, res) => {
  try {
    const { title, amount, expense_date, category, notes } = req.body;
    if (!title || amount === undefined || !expense_date) {
      return res.status(400).json({ error: 'Missing title, amount, or expense_date' });
    }
    const info = db.prepare(`
      INSERT INTO expenses (user_id, title, amount, expense_date, category, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, title, parseFloat(amount), expense_date, category || 'Other', notes || '');
    
    res.status(201).json({ id: info.lastInsertRowid, message: 'Expense recorded successfully' });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to record expense' });
  }
});

// 18. DELETE /api/expenses/:id - Delete scoped expense record
app.delete('/api/expenses/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, req.user.id);
    
    if (result.changes === 0) {
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

app.listen(PORT, () => {
  console.log(`Tracky backend REST API running on port ${PORT}`);
});
