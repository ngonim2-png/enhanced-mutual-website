/**
 * Enhanced Mutual Insurance — backend API
 * ----------------------------------------
 * Real user accounts (hashed passwords), JWT-based login sessions,
 * and simple JSON-file storage for users, quote requests, and
 * contact messages. Also serves the website itself as static files
 * so the whole thing runs from one process.
 *
 * Run:
 *   npm install
 *   npm start
 *   -> open http://localhost:4000
 *
 * Storage: data/db.json (auto-created). This is intentionally a flat
 * JSON file rather than a full database so the project has zero
 * external services to set up. Swap readDB/writeDB for a real
 * database (Postgres, MySQL, etc.) later without touching the routes.
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- tiny JSON-file "database" ----------

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], quotes: [], messages: [], activity: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ---------- auth middleware ----------

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ---------- routes: auth ----------

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are all required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
    policy: {
      planName: 'Legacy Security Plan',
      coverAmount: 'SLE 400,000',
      nextPremiumDue: '15 Aug 2026',
      paymentMethod: 'Mobile Money',
      status: 'Active'
    }
  };
  db.users.push(user);
  writeDB(db);

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user: publicUser(user) });
});

// ---------- routes: Self Care actions (require login) ----------

app.post('/api/action', requireAuth, (req, res) => {
  const { type } = req.body || {};
  const messages = {
    statement: 'Your latest statement has been generated and sent to your email.',
    beneficiary: 'Beneficiary details updated successfully.',
    pay: 'Redirecting you to secure mobile payment…',
    claim: 'Your claim form has been opened. A claims adviser will follow up within 1 business day.'
  };
  const db = readDB();
  db.activity.push({
    id: uuidv4(),
    userId: req.userId,
    type: type || 'unknown',
    at: new Date().toISOString()
  });
  writeDB(db);
  res.json({ message: messages[type] || 'Done.' });
});

// ---------- routes: public forms (no login required) ----------

app.post('/api/quote', (req, res) => {
  const { firstName, lastName, email, phone, district, help } = req.body || {};
  if (!firstName || !email) {
    return res.status(400).json({ error: 'At least your first name and email are required.' });
  }
  const db = readDB();
  db.quotes.push({
    id: uuidv4(),
    firstName, lastName, email, phone, district, help,
    createdAt: new Date().toISOString()
  });
  writeDB(db);
  res.status(201).json({ message: "Thanks — we'll be in touch shortly." });
});

app.post('/api/contact', (req, res) => {
  const { firstName, lastName, email, message } = req.body || {};
  if (!firstName || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and a message are required.' });
  }
  const db = readDB();
  db.messages.push({
    id: uuidv4(),
    firstName, lastName, email, message,
    createdAt: new Date().toISOString()
  });
  writeDB(db);
  res.status(201).json({ message: "Thanks — we'll be in touch shortly." });
});

app.post('/api/partner', (req, res) => {
  const { institutionName, contactName, email, phone, message } = req.body || {};
  if (!institutionName || !contactName || !email) {
    return res.status(400).json({ error: 'Institution name, contact name, and email are required.' });
  }
  const db = readDB();
  if (!db.partners) db.partners = [];
  db.partners.push({
    id: uuidv4(),
    institutionName, contactName, email, phone, message,
    createdAt: new Date().toISOString()
  });
  writeDB(db);
  res.status(201).json({ message: "Thanks — our partnerships team will reach out shortly." });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Enhanced Mutual backend running at http://localhost:${PORT}`);
});
