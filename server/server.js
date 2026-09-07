const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const dbOps = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'HPC_MallikaRao_SecretKey_9874!#';

// 1. Hardened HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://mallikarao.com'],
        connectSrc: [
          "'self'",
          'https://script.google.com',
          'https://script.googleusercontent.com'
        ]
      }
    },
    hidePoweredBy: true,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

// 2. Body Parser with Size Limits (Anti-DoS)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 3. CORS Policy
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 4. Rate Limiting Protection
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: { error: 'Too many consultation requests from this connection. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded. Please throttle requests.' }
});

// 5. Strict Path & Source Isolation
// Block any attempt to traverse, view backend source code, SQLite databases, or configs
app.use((req, res, next) => {
  const url = req.path.toLowerCase();
  const forbiddenPatterns = [
    '/server',
    '/data',
    '/node_modules',
    'package.json',
    '.env',
    '.git',
    'tsconfig',
    'angular.json',
    '.db',
    '.sqlite'
  ];

  for (const pattern of forbiddenPatterns) {
    if (url.includes(pattern)) {
      return res.status(404).send('Not Found');
    }
  }
  next();
});

// Helper: Sanitize string input
function sanitizeText(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .substring(0, maxLength);
}

// Helper: Validate email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email.trim());
}

// Authentication Middleware for CRM Admin
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized access.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Public Lead & Call Booking Intake
app.post('/api/leads', leadLimiter, async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      designation,
      company,
      linkedin,
      transitionCategory,
      currentChallenge,
      investmentReadiness,
      bookedDate,
      bookedTime
    } = req.body;

    // Validation
    if (!fullName || sanitizeText(fullName).length < 2) {
      return res.status(400).json({ error: 'Please provide a valid full name.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!phone || sanitizeText(phone).length < 6) {
      return res.status(400).json({ error: 'Please provide a valid phone or WhatsApp number.' });
    }
    if (!transitionCategory) {
      return res.status(400).json({ error: 'Please select your primary transition category.' });
    }
    if (!currentChallenge || sanitizeText(currentChallenge).length < 5) {
      return res.status(400).json({ error: 'Please share a brief note about your current crossroads.' });
    }
    if (!bookedDate || !bookedTime) {
      return res.status(400).json({ error: 'Please choose your preferred consultation date and time slot.' });
    }

    // Mask client IP for privacy
    const rawIp = req.ip || req.connection.remoteAddress || '';
    const ipMasked = rawIp.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.xxx.xxx');

    // Generate secure reference ID (e.g. HPC-849201)
    const refId = `HPC-${Math.floor(100000 + Math.random() * 900000)}`;

    const leadRecord = {
      ref_id: refId,
      full_name: sanitizeText(fullName, 100),
      email: sanitizeText(email, 120).toLowerCase(),
      phone: sanitizeText(phone, 30),
      designation: sanitizeText(designation, 100),
      company: sanitizeText(company, 100),
      linkedin: sanitizeText(linkedin, 200),
      transition_category: sanitizeText(transitionCategory, 100),
      current_challenge: sanitizeText(currentChallenge, 2000),
      investment_readiness: sanitizeText(investmentReadiness, 50),
      booked_date: sanitizeText(bookedDate, 20),
      booked_time: sanitizeText(bookedTime, 30),
      ip_masked: ipMasked
    };

    await dbOps.createLead(leadRecord);

    // Real-time asynchronous forward to Google Sheets Webhook
    const sheetWebhook =
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      'https://script.google.com/macros/s/AKfycbyMX5WY6aI7LBp4ohghWY4CBZTM3kdUbVKJNWUR6Mo2T7ShPCp8TeSDJVBDModeurmyWg/exec';
    if (sheetWebhook && typeof fetch !== 'undefined') {
      fetch(sheetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          refId: refId,
          fullName: leadRecord.full_name,
          email: leadRecord.email,
          phone: leadRecord.phone,
          designation: leadRecord.designation,
          company: leadRecord.company,
          linkedin: leadRecord.linkedin,
          transitionCategory: leadRecord.transition_category,
          currentChallenge: leadRecord.current_challenge,
          investmentReadiness: leadRecord.investment_readiness,
          bookedDate: leadRecord.booked_date,
          bookedTime: leadRecord.booked_time,
          status: 'New',
          notes: ''
        })
      }).catch((sheetErr) => {
        console.warn('Google Sheets webhook forward warning:', sheetErr.message);
      });
    }

    // Return opaque response — zero server details exposed
    return res.status(201).json({
      success: true,
      refId: refId,
      bookedDate: leadRecord.booked_date,
      bookedTime: leadRecord.booked_time,
      message: 'Your consultation request has been privately submitted. Coach Mallika will review your application.'
    });
  } catch (err) {
    console.error('Error recording consultation lead:', err);
    // Generic error response (never leak SQL traces)
    return res.status(500).json({
      error: 'An unexpected error occurred while submitting your consultation request. Please try again.'
    });
  }
});

// Admin Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await dbOps.verifyAdmin(username.trim(), password);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials provided.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, name: admin.full_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      admin: {
        username: admin.username,
        fullName: admin.full_name
      }
    });
  } catch (err) {
    console.error('Admin authentication error:', err);
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }
});

// ==========================================
// PROTECTED CRM ADMIN ENDPOINTS
// ==========================================

// Get Leads
app.get('/api/admin/leads', apiLimiter, requireAdmin, async (req, res) => {
  try {
    const { status, search, date, limit } = req.query;
    const leads = await dbOps.getLeads({ status, search, date, limit });
    return res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error('Error fetching leads:', err);
    return res.status(500).json({ error: 'Unable to retrieve leads.' });
  }
});

// Get CRM Overview KPIs
app.get('/api/admin/stats', apiLimiter, requireAdmin, async (req, res) => {
  try {
    const stats = await dbOps.getStats();
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching CRM stats:', err);
    return res.status(500).json({ error: 'Unable to retrieve statistics.' });
  }
});

// Get Single Lead
app.get('/api/admin/leads/:id', apiLimiter, requireAdmin, async (req, res) => {
  try {
    const lead = await dbOps.getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    return res.json({ success: true, lead });
  } catch (err) {
    console.error('Error fetching single lead:', err);
    return res.status(500).json({ error: 'Unable to retrieve lead.' });
  }
});

// Update Lead Status or Private Notes
app.patch('/api/admin/leads/:id', apiLimiter, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updated = await dbOps.updateLead(req.params.id, {
      status: status ? sanitizeText(status, 50) : undefined,
      notes: notes !== undefined ? sanitizeText(notes, 4000) : undefined
    });

    if (!updated) {
      return res.status(404).json({ error: 'Lead not found or no changes made.' });
    }

    return res.json({ success: true, message: 'Lead updated successfully.' });
  } catch (err) {
    console.error('Error updating lead:', err);
    return res.status(500).json({ error: 'Unable to update lead.' });
  }
});

// Export Leads to CSV
app.get('/api/admin/export', apiLimiter, requireAdmin, async (req, res) => {
  try {
    const leads = await dbOps.getLeads();

    const headers = [
      'Reference ID',
      'Submitted At',
      'Full Name',
      'Email',
      'Phone',
      'Designation',
      'Company',
      'LinkedIn',
      'Transition Category',
      'Current Challenge',
      'Investment Readiness',
      'Booked Date',
      'Booked Time',
      'Status',
      'Notes'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map((l) => [
      escapeCsv(l.ref_id),
      escapeCsv(l.created_at),
      escapeCsv(l.full_name),
      escapeCsv(l.email),
      escapeCsv(l.phone),
      escapeCsv(l.designation),
      escapeCsv(l.company),
      escapeCsv(l.linkedin),
      escapeCsv(l.transition_category),
      escapeCsv(l.current_challenge),
      escapeCsv(l.investment_readiness),
      escapeCsv(l.booked_date),
      escapeCsv(l.booked_time),
      escapeCsv(l.status),
      escapeCsv(l.notes)
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mallika_rao_hpc_leads_${new Date().toISOString().split('T')[0]}.csv"`
    );
    return res.send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    return res.status(500).json({ error: 'Unable to export leads.' });
  }
});

// ==========================================
// STATIC FRONTEND SERVING
// ==========================================

// First check if Angular production build exists in dist/hpc/browser
const distPath = path.join(__dirname, '..', 'dist', 'hpc', 'browser');
const publicPath = path.join(__dirname, '..', 'public');

if (fs.existsSync(distPath)) {
  console.log('Serving production Angular app from:', distPath);
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('Production build not yet generated. Serving static public folder from:', publicPath);
  app.use(express.static(publicPath));
  app.use((req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.send('Mallika Rao High Performance Coaching API Server Running.');
    }
  });
}

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Secure Server Running on: http://localhost:${PORT}`);
  console.log(`Security: Helmet, CSP, Rate-limiting, SQLite3 active`);
  console.log(`====================================================`);
});
