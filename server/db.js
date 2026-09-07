const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure data directory exists outside public access
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
}

const dbPath = path.join(dataDir, 'crm.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('CRITICAL: Failed to open CRM database:', err.message);
  } else {
    console.log('CRM Database initialized securely at:', dbPath);
  }
});

// Enable WAL mode for high concurrency & performance
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA synchronous = NORMAL;');
db.run('PRAGMA foreign_keys = ON;');

// Initialize schema
db.serialize(() => {
  // Leads table
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      designation TEXT,
      company TEXT,
      linkedin TEXT,
      transition_category TEXT NOT NULL,
      current_challenge TEXT NOT NULL,
      investment_readiness TEXT,
      booked_date TEXT NOT NULL,
      booked_time TEXT NOT NULL,
      status TEXT DEFAULT 'New',
      notes TEXT DEFAULT '',
      ip_masked TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_booked_date ON leads (booked_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);`);

  // Admin users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin accounts if not present
  const seedAdmins = [
    { user: 'coachmallika', pass: 'MallikaInnerEdge2026!', name: 'Coach Mallika Rao' },
    { user: 'mallika', pass: 'InnerEdge2025!', name: 'Coach Mallika Rao' }
  ];

  seedAdmins.forEach(account => {
    db.get('SELECT id FROM admins WHERE username = ?', [account.user], (err, row) => {
      if (!err && !row) {
        const hash = bcrypt.hashSync(account.pass, 10);
        db.run(
          'INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)',
          [account.user, hash, account.name],
          (insertErr) => {
            if (!insertErr) {
              console.log(`Default CRM admin account created: ${account.user}`);
            }
          }
        );
      }
    });
  });
});

// Database Operations
const dbOps = {
  // Create lead
  createLead: (data) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO leads (
          ref_id, full_name, email, phone, designation, company, linkedin,
          transition_category, current_challenge, investment_readiness,
          booked_date, booked_time, ip_masked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.ref_id,
        data.full_name,
        data.email,
        data.phone,
        data.designation || '',
        data.company || '',
        data.linkedin || '',
        data.transition_category,
        data.current_challenge,
        data.investment_readiness || '',
        data.booked_date,
        data.booked_time,
        data.ip_masked || ''
      ];
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, ref_id: data.ref_id });
      });
    });
  },

  // Get all leads (Admin only)
  getLeads: (options = {}) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM leads';
      const params = [];
      const whereClauses = [];

      if (options.status && options.status !== 'All') {
        whereClauses.push('status = ?');
        params.push(options.status);
      }
      if (options.search) {
        whereClauses.push('(full_name LIKE ? OR email LIKE ? OR company LIKE ? OR ref_id LIKE ?)');
        const s = `%${options.search}%`;
        params.push(s, s, s, s);
      }
      if (options.date) {
        whereClauses.push('booked_date = ?');
        params.push(options.date);
      }

      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }

      sql += ' ORDER BY created_at DESC';

      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(Number(options.limit));
      }

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  // Get single lead
  getLeadById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM leads WHERE id = ? OR ref_id = ?', [id, id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  // Update lead status and notes
  updateLead: (id, updates) => {
    return new Promise((resolve, reject) => {
      const allowed = ['status', 'notes'];
      const setClauses = [];
      const params = [];

      for (const key of allowed) {
        if (updates[key] !== undefined) {
          setClauses.push(`${key} = ?`);
          params.push(updates[key]);
        }
      }

      if (setClauses.length === 0) return resolve(false);

      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      const sql = `UPDATE leads SET ${setClauses.join(', ')} WHERE id = ? OR ref_id = ?`;
      params.push(id, id);

      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  },

  // Verify Admin Login
  verifyAdmin: (username, password) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
        if (err) return reject(err);
        if (!admin) return resolve(null);

        const match = bcrypt.compareSync(password, admin.password_hash);
        if (!match) return resolve(null);

        resolve({ id: admin.id, username: admin.username, full_name: admin.full_name });
      });
    });
  },

  // Get CRM Metrics & Stats
  getStats: () => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(*) as total_leads,
          SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as new_leads,
          SUM(CASE WHEN status = 'Call Scheduled' THEN 1 ELSE 0 END) as scheduled_calls,
          SUM(CASE WHEN status = 'Qualified' THEN 1 ELSE 0 END) as qualified_leads,
          SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_leads,
          SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_leads
        FROM leads;
      `;
      db.get(sql, [], (err, row) => {
        if (err) return reject(err);
        resolve(row || {});
      });
    });
  }
};

module.exports = dbOps;
