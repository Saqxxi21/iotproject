const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'iot_database.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${dbPath}`);
  }
});

// Initialize Tables
function initDb() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sensor records table
    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index for quick pagination and ordering
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sensor_records_created_at 
      ON sensor_records (created_at DESC)
    `);

    // Device state table (single-row configuration for LED & LCD)
    db.run(`
      CREATE TABLE IF NOT EXISTS device_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        led_state INTEGER DEFAULT 0,
        lcd_line1 TEXT DEFAULT 'PushpakBhure',
        lcd_line2 TEXT DEFAULT 'IoT System Ready',
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure default device state exists
    db.run(`
      INSERT OR IGNORE INTO device_state (id, led_state, lcd_line1, lcd_line2, last_seen)
      VALUES (1, 0, 'PushpakBhure', 'IoT System Ready', CURRENT_TIMESTAMP)
    `);
  });
}

// Promisified query helper functions
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

module.exports = {
  db,
  initDb,
  dbAsync
};
