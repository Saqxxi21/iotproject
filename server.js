require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDb, dbAsync } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pushpak_bhure_iot_secret_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
initDb();

// Timezone formatter for Asia/Kolkata (IST: UTC+5:30)
function formatIST(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  
  // Format for Asia/Kolkata
  const timeOptions = {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  const dateOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  const time_ist = new Intl.DateTimeFormat('en-IN', timeOptions).format(d);
  const date_ist = new Intl.DateTimeFormat('en-IN', dateOptions).format(d);
  return { time_ist, date_ist, iso: d.toISOString() };
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingUser = await dbAsync.get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await dbAsync.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), trimmedEmail, hashedPassword]
    );

    const token = jwt.sign({ id: result.id, name: name.trim(), email: trimmedEmail }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.id, name: name.trim(), email: trimmedEmail }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Current User Details
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbAsync.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ==========================================
// 2. TAB 1: SENSOR DATA & ENVIRONMENT ROUTES
// ==========================================

// Add a single sensor record (from web simulator or automated scripts)
app.post('/api/sensor/record', async (req, res) => {
  try {
    const { temperature, humidity } = req.body;
    if (temperature === undefined || humidity === undefined) {
      return res.status(400).json({ error: 'Temperature and humidity are required' });
    }

    const temp = parseFloat(temperature);
    const hum = parseFloat(humidity);

    if (isNaN(temp) || isNaN(hum)) {
      return res.status(400).json({ error: 'Invalid temperature or humidity value' });
    }

    const result = await dbAsync.run(
      'INSERT INTO sensor_records (temperature, humidity, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [temp, hum]
    );

    // Update last_seen in device_state
    await dbAsync.run('UPDATE device_state SET last_seen = CURRENT_TIMESTAMP WHERE id = 1');

    const createdRecord = await dbAsync.get('SELECT * FROM sensor_records WHERE id = ?', [result.id]);
    const { time_ist, date_ist } = formatIST(createdRecord.created_at);

    res.status(201).json({
      success: true,
      record: {
        ...createdRecord,
        time_ist,
        date_ist
      }
    });
  } catch (err) {
    console.error('Sensor record insertion error:', err);
    res.status(500).json({ error: 'Failed to save sensor data' });
  }
});

// Get latest sensor record & device status
app.get('/api/sensor/latest', async (req, res) => {
  try {
    const latest = await dbAsync.get(
      'SELECT * FROM sensor_records ORDER BY id DESC LIMIT 1'
    );
    const device = await dbAsync.get('SELECT * FROM device_state WHERE id = 1');

    let formattedLatest = null;
    if (latest) {
      const { time_ist, date_ist } = formatIST(latest.created_at);
      formattedLatest = {
        ...latest,
        time_ist,
        date_ist
      };
    }

    // Check device online status (e.g. active within last 25 seconds)
    let isOnline = false;
    if (device && device.last_seen) {
      const diffMs = Date.now() - new Date(device.last_seen + 'Z').getTime();
      isOnline = diffMs < 30000; // 30s threshold
    }

    res.json({
      latest: formattedLatest,
      device: {
        led_state: device ? device.led_state : 0,
        lcd_line1: device ? device.lcd_line1 : '',
        lcd_line2: device ? device.lcd_line2 : '',
        last_seen: device ? device.last_seen : null,
        isOnline
      }
    });
  } catch (err) {
    console.error('Latest sensor error:', err);
    res.status(500).json({ error: 'Failed to fetch latest sensor data' });
  }
});

// Get recent history for dynamic Graph/Charts (last 20-30 records, chronological order)
app.get('/api/sensor/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    // Fetch latest records, then invert to chronological order for charts
    const records = await dbAsync.all(
      'SELECT * FROM sensor_records ORDER BY id DESC LIMIT ?',
      [limit]
    );

    const chronological = records.reverse().map(rec => {
      const { time_ist, date_ist } = formatIST(rec.created_at);
      return {
        id: rec.id,
        temperature: rec.temperature,
        humidity: rec.humidity,
        time_ist,
        date_ist,
        created_at: rec.created_at
      };
    });

    res.json({ history: chronological });
  } catch (err) {
    console.error('Sensor history error:', err);
    res.status(500).json({ error: 'Failed to fetch sensor history' });
  }
});

// Paginated records table (latest records first, 20 per page)
app.get('/api/sensor/records', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);
    const offset = (page - 1) * limit;

    const countRow = await dbAsync.get('SELECT COUNT(*) as total FROM sensor_records');
    const totalRecords = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const records = await dbAsync.all(
      'SELECT * FROM sensor_records ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const formattedRecords = records.map((r, index) => {
      const { time_ist, date_ist } = formatIST(r.created_at);
      return {
        row_number: offset + index + 1,
        id: r.id,
        temperature: r.temperature,
        humidity: r.humidity,
        time_ist,
        date_ist,
        created_at: r.created_at
      };
    });

    res.json({
      records: formattedRecords,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Paginated records error:', err);
    res.status(500).json({ error: 'Failed to fetch sensor records' });
  }
});

// Delete sensor record
app.delete('/api/sensor/records/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid record ID' });

    const result = await dbAsync.run('DELETE FROM sensor_records WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ success: true, message: `Record #${id} deleted successfully` });
  } catch (err) {
    console.error('Delete record error:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// Clear all records (Optional helper)
app.delete('/api/sensor/records-all', async (req, res) => {
  try {
    await dbAsync.run('DELETE FROM sensor_records');
    res.json({ success: true, message: 'All records cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear records' });
  }
});

// ==========================================
// 3. TAB 2: SMART LCD ROUTES
// ==========================================

// Get LCD status
app.get('/api/device/lcd', async (req, res) => {
  try {
    const state = await dbAsync.get('SELECT lcd_line1, lcd_line2 FROM device_state WHERE id = 1');
    res.json({
      line1: state ? state.lcd_line1 : '',
      line2: state ? state.lcd_line2 : ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LCD state' });
  }
});

// Update LCD lines
app.post('/api/device/lcd', async (req, res) => {
  try {
    const { line1 = '', line2 = '' } = req.body;
    // Standard 16x2 LCD supports 16 characters per line
    const cleanLine1 = String(line1).substring(0, 16);
    const cleanLine2 = String(line2).substring(0, 16);

    await dbAsync.run(
      'UPDATE device_state SET lcd_line1 = ?, lcd_line2 = ? WHERE id = 1',
      [cleanLine1, cleanLine2]
    );

    res.json({
      success: true,
      message: 'LCD display updated successfully',
      line1: cleanLine1,
      line2: cleanLine2
    });
  } catch (err) {
    console.error('LCD update error:', err);
    res.status(500).json({ error: 'Failed to update LCD display' });
  }
});

// ==========================================
// 4. TAB 3: LED AUTOMATION ROUTES
// ==========================================

// Get LED status
app.get('/api/device/led', async (req, res) => {
  try {
    const state = await dbAsync.get('SELECT led_state FROM device_state WHERE id = 1');
    res.json({
      led_state: state ? state.led_state : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch LED state' });
  }
});

// Toggle / Set LED status
app.post('/api/device/led', async (req, res) => {
  try {
    let { led_state } = req.body;
    
    // Support toggle if led_state not provided explicitly
    if (led_state === undefined) {
      const current = await dbAsync.get('SELECT led_state FROM device_state WHERE id = 1');
      led_state = current && current.led_state === 1 ? 0 : 1;
    } else {
      led_state = led_state ? 1 : 0;
    }

    await dbAsync.run(
      'UPDATE device_state SET led_state = ? WHERE id = 1',
      [led_state]
    );

    res.json({
      success: true,
      led_state,
      message: `LED turned ${led_state === 1 ? 'ON' : 'OFF'}`
    });
  } catch (err) {
    console.error('LED update error:', err);
    res.status(500).json({ error: 'Failed to update LED state' });
  }
});

// ==========================================
// 5. HARDWARE SYNC ENDPOINT (ESP8266)
// ==========================================
// This single endpoint allows the ESP8266 to:
// 1. Post DHT11 Temperature & Humidity
// 2. Receive LED State and LCD row 1 & row 2 in one atomic 10s cycle!
app.all('/api/device/sync', async (req, res) => {
  try {
    const tempRaw = req.body.temperature ?? req.query.temperature;
    const humRaw = req.body.humidity ?? req.query.humidity;

    if (tempRaw !== undefined && humRaw !== undefined) {
      const temp = parseFloat(tempRaw);
      const hum = parseFloat(humRaw);

      if (!isNaN(temp) && !isNaN(hum)) {
        await dbAsync.run(
          'INSERT INTO sensor_records (temperature, humidity, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [temp, hum]
        );
      }
    }

    // Update last_seen
    await dbAsync.run('UPDATE device_state SET last_seen = CURRENT_TIMESTAMP WHERE id = 1');

    // Retrieve current commands for hardware
    const state = await dbAsync.get('SELECT led_state, lcd_line1, lcd_line2 FROM device_state WHERE id = 1');

    res.json({
      status: 'ok',
      led: state ? state.led_state : 0,
      lcd_line1: state ? state.lcd_line1 : 'PushpakBhure',
      lcd_line2: state ? state.lcd_line2 : 'IoT System Ready'
    });
  } catch (err) {
    console.error('Device sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ==========================================
// 6. HEALTH & STATUS
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'PushpakBhure IoT',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata (+05:30)'
  });
});

// Fallback to SPA index.html (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 PushpakBhure IoT Application Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⏰ Timezone: Asia/Kolkata (+05:30)`);
  console.log(`=======================================================`);
});
