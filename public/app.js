/**
 * PushpakBhure IoT Dashboard Client Logic
 * Stack: HTML5 + Tailwind CSS + Vanilla JS
 * Back End: Node.js + SQLite
 * Deployment: Render
 * Timezone: Asia/Kolkata (+05:30)
 */

// Global State
let currentTab = 'tab-env';
let currentPage = 1;
const recordsPerPage = 20;
let graphLimit = 15;
let envChartInstance = null;
let currentLedState = 0;
let pollTimer = null;

// ==========================================
// 1. INITIALIZATION & CLOCK
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Start live IST Clock
  updateISTClock();
  setInterval(updateISTClock, 1000);

  // Initialize Auth state from localStorage
  checkAuth();

  // Initialize Chart.js
  initEnvChart();

  // Load initial data for all tabs
  fetchSensorData();
  loadSensorRecords(1);
  loadLcdState();
  loadLedState();

  // Start 10-second automatic polling for DHT11 & hardware
  pollTimer = setInterval(() => {
    fetchSensorData(false);
  }, 10000);
});

// Asia/Kolkata (+05:30) Live Clock
function updateISTClock() {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const timeStr = timeFormatter.format(now);

  const desktopClock = document.getElementById('ist-clock-display');
  const mobileClock = document.getElementById('mobile-clock-display');
  if (desktopClock) desktopClock.textContent = timeStr;
  if (mobileClock) mobileClock.textContent = timeStr;
}

// ==========================================
// 2. TAB SWITCHING
// ==========================================
function switchTab(tabId) {
  currentTab = tabId;

  // Toggle tab contents
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
  });
  const activeSection = document.getElementById(tabId);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  }

  // Update button styles
  const tabs = ['tab-env', 'tab-lcd', 'tab-led'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btn-${t}`);
    if (!btn) return;
    if (t === tabId) {
      btn.className = "tab-button flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 bg-emerald-500 text-black shadow-lg shadow-emerald-500/25";
    } else {
      btn.className = "tab-button flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-emerald-400 hover:text-white hover:bg-emerald-900/40";
    }
  });

  // Re-render chart if switching back to Environment tab
  if (tabId === 'tab-env' && envChartInstance) {
    setTimeout(() => {
      envChartInstance.resize();
    }, 100);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ==========================================
// 3. AUTHENTICATION (LOGIN & REGISTRATION)
// ==========================================
function checkAuth() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  const loggedOutBlock = document.getElementById('auth-logged-out');
  const loggedInBlock = document.getElementById('auth-logged-in');
  const userDisplayName = document.getElementById('user-display-name');
  const userInitials = document.getElementById('user-avatar-initials');

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson);
      loggedOutBlock.classList.add('hidden');
      loggedInBlock.classList.remove('hidden');
      if (userDisplayName) userDisplayName.textContent = user.name || 'User';
      if (userInitials) {
        const initials = (user.name || 'PB')
          .split(' ')
          .map(n => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        userInitials.textContent = initials || 'PB';
      }
    } catch (e) {
      handleLogout();
    }
  } else {
    loggedOutBlock.classList.remove('hidden');
    loggedInBlock.classList.add('hidden');
  }
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  switchAuthMode(mode);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal.classList.add('hidden');
  hideAuthError();
}

function switchAuthMode(mode) {
  hideAuthError();
  const tabLogin = document.getElementById('modal-tab-login');
  const tabReg = document.getElementById('modal-tab-register');
  const formLogin = document.getElementById('login-form');
  const formReg = document.getElementById('register-form');

  if (mode === 'login') {
    tabLogin.className = "flex-1 text-center font-bold text-sm pb-2 border-b-2 border-emerald-500 text-emerald-400 transition";
    tabReg.className = "flex-1 text-center font-bold text-sm pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition";
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  } else {
    tabLogin.className = "flex-1 text-center font-bold text-sm pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition";
    tabReg.className = "flex-1 text-center font-bold text-sm pb-2 border-b-2 border-emerald-500 text-emerald-400 transition";
    formLogin.classList.add('hidden');
    formReg.classList.remove('hidden');
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAuthError() {
  const el = document.getElementById('auth-error-msg');
  el.classList.add('hidden');
  el.textContent = '';
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  hideAuthError();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || 'Login failed. Please check your credentials.');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    checkAuth();
    closeAuthModal();
  } catch (err) {
    showAuthError('Server connection error. Please try again.');
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  hideAuthError();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || 'Registration failed');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    checkAuth();
    closeAuthModal();
  } catch (err) {
    showAuthError('Server connection error. Please try again.');
  }
}

function fillDemoCredentials() {
  document.getElementById('login-email').value = 'demo@pushpakbhure.com';
  document.getElementById('login-password').value = '12345678';
  // Attempt auto registration if demo doesn't exist
  registerDemoIfMissing('demo@pushpakbhure.com', '12345678');
}

async function registerDemoIfMissing(email, password) {
  try {
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pushpak Bhure (Demo)', email, password })
    });
  } catch (e) {
    // Ignore if already registered
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  checkAuth();
}

// ==========================================
// 4. TAB 1: ENVIRONMENT MONITORING
// ==========================================

// Gauge circumference for r=68 is 2 * Math.PI * 68 = 427.26
const GAUGE_CIRCUMFERENCE = 427.26;

async function fetchSensorData(isManual = false) {
  try {
    const res = await fetch('/api/sensor/latest');
    const data = await res.json();

    const espStatusDot = document.getElementById('esp-status-dot');
    const espStatusText = document.getElementById('esp-status-text');
    const mobileStatusText = document.getElementById('mobile-esp-status');

    if (data.device) {
      const isOnline = data.device.isOnline;
      if (espStatusDot) {
        espStatusDot.className = isOnline
          ? 'w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-online'
          : 'w-2.5 h-2.5 rounded-full bg-slate-500';
      }
      const label = isOnline ? 'ESP8266 Online' : 'ESP8266 Standby';
      if (espStatusText) espStatusText.textContent = label;
      if (mobileStatusText) mobileStatusText.textContent = label;
    }

    if (data.latest) {
      updateGaugeAndMeters(data.latest.temperature, data.latest.humidity);
      const syncTimeEl = document.getElementById('last-sync-time');
      if (syncTimeEl) {
        syncTimeEl.textContent = `${data.latest.time_ist} (${data.latest.date_ist})`;
      }
    } else {
      // If no records in database yet, set placeholder
      const syncTimeEl = document.getElementById('last-sync-time');
      if (syncTimeEl) syncTimeEl.textContent = 'No records yet - Click Simulate Push';
    }

    // Refresh chart & table
    loadSensorHistory();
    loadSensorRecords(currentPage);

    if (isManual && window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Error fetching sensor data:', err);
  }
}

// Update the Innovative Circular SVG Gauges and Seek Bars
function updateGaugeAndMeters(temp, hum) {
  // 1. TEMPERATURE (Bounds: 0 °C to 50 °C)
  const tempVal = parseFloat(temp) || 0;
  const tempClamped = Math.max(0, Math.min(tempVal, 50));
  const tempRatio = tempClamped / 50;
  const tempOffset = GAUGE_CIRCUMFERENCE - (tempRatio * GAUGE_CIRCUMFERENCE);

  const tempDisplay = document.getElementById('temp-display-val');
  const tempCircle = document.getElementById('temp-gauge-circle');
  const tempFill = document.getElementById('temp-seek-fill');
  const tempPct = document.getElementById('temp-seek-pct');
  const tempBadge = document.getElementById('temp-badge');
  const tempComfort = document.getElementById('temp-comfort-text');

  if (tempDisplay) tempDisplay.textContent = tempVal.toFixed(1);
  if (tempCircle) {
    tempCircle.style.strokeDashoffset = tempOffset;
    // Dynamic color based on temperature
    if (tempVal < 20) {
      tempCircle.setAttribute('class', 'gauge-progress stroke-cyan-400');
    } else if (tempVal <= 32) {
      tempCircle.setAttribute('class', 'gauge-progress stroke-emerald-400');
    } else if (tempVal <= 38) {
      tempCircle.setAttribute('class', 'gauge-progress stroke-amber-400');
    } else {
      tempCircle.setAttribute('class', 'gauge-progress stroke-red-500');
    }
  }

  const tempPercentage = Math.round(tempRatio * 100);
  if (tempFill) tempFill.style.width = `${tempPercentage}%`;
  if (tempPct) tempPct.textContent = `${tempPercentage}%`;

  if (tempBadge && tempComfort) {
    if (tempVal < 18) {
      tempBadge.textContent = 'Cold';
      tempBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
      tempComfort.textContent = 'Condition: Cool / Chilly';
    } else if (tempVal <= 30) {
      tempBadge.textContent = 'Optimal';
      tempBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      tempComfort.textContent = 'Condition: Optimal Room Comfort';
    } else if (tempVal <= 38) {
      tempBadge.textContent = 'Warm';
      tempBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
      tempComfort.textContent = 'Condition: Elevated Warmth';
    } else {
      tempBadge.textContent = 'High Heat';
      tempBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40';
      tempComfort.textContent = 'Condition: Hot Temperature Alert';
    }
  }

  // 2. HUMIDITY (Bounds: 0 % to 100 %)
  const humVal = parseFloat(hum) || 0;
  const humClamped = Math.max(0, Math.min(humVal, 100));
  const humRatio = humClamped / 100;
  const humOffset = GAUGE_CIRCUMFERENCE - (humRatio * GAUGE_CIRCUMFERENCE);

  const humDisplay = document.getElementById('hum-display-val');
  const humCircle = document.getElementById('hum-gauge-circle');
  const humFill = document.getElementById('hum-seek-fill');
  const humPct = document.getElementById('hum-seek-pct');
  const humBadge = document.getElementById('hum-badge');
  const humComfort = document.getElementById('hum-comfort-text');

  if (humDisplay) humDisplay.textContent = humVal.toFixed(1);
  if (humCircle) {
    humCircle.style.strokeDashoffset = humOffset;
  }

  const humPercentage = Math.round(humRatio * 100);
  if (humFill) humFill.style.width = `${humPercentage}%`;
  if (humPct) humPct.textContent = `${humPercentage}%`;

  if (humBadge && humComfort) {
    if (humVal < 30) {
      humBadge.textContent = 'Dry';
      humBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
      humComfort.textContent = 'Air Moisture: Dry Air';
    } else if (humVal <= 65) {
      humBadge.textContent = 'Comfortable';
      humBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40';
      humComfort.textContent = 'Air Moisture: Ideal & Balanced';
    } else {
      humBadge.textContent = 'High Humidity';
      humBadge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
      humComfort.textContent = 'Air Moisture: High Moisture Content';
    }
  }
}

// Simulate Sensor Push (DHT11 sample data)
async function simulateSensorPush() {
  const randomTemp = (24 + Math.random() * 11).toFixed(1); // 24.0 to 35.0 °C
  const randomHum = (50 + Math.random() * 25).toFixed(1);  // 50.0 to 75.0 %

  try {
    const res = await fetch('/api/sensor/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: randomTemp, humidity: randomHum })
    });
    if (res.ok) {
      fetchSensorData(true);
    }
  } catch (err) {
    console.error('Failed to simulate sensor data:', err);
  }
}

// ==========================================
// 5. DYNAMIC CHART.JS GRAPH
// ==========================================
function initEnvChart() {
  const ctx = document.getElementById('envChart');
  if (!ctx) return;

  const gradientTemp = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradientTemp.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
  gradientTemp.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  const gradientHum = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradientHum.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
  gradientHum.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

  envChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: gradientTemp,
          borderWidth: 2.5,
          pointBackgroundColor: '#10b981',
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: gradientHum,
          borderWidth: 2.5,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#a7f3d0',
            font: { family: 'Plus Jakarta Sans', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#0c1810',
          titleColor: '#34d399',
          bodyColor: '#e2e8f0',
          borderColor: '#059669',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(52, 211, 153, 0.08)' },
          ticks: { color: '#6ee7b7', font: { size: 11 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(52, 211, 153, 0.08)' },
          ticks: { color: '#10b981', font: { size: 11 } },
          suggestedMin: 15,
          suggestedMax: 45
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#38bdf8', font: { size: 11 } },
          suggestedMin: 20,
          suggestedMax: 100
        }
      }
    }
  });
}

async function loadSensorHistory() {
  if (!envChartInstance) return;
  try {
    const res = await fetch(`/api/sensor/history?limit=${graphLimit}`);
    const data = await res.json();
    if (!data.history) return;

    const labels = data.history.map(item => item.time_ist);
    const temps = data.history.map(item => item.temperature);
    const hums = data.history.map(item => item.humidity);

    envChartInstance.data.labels = labels;
    envChartInstance.data.datasets[0].data = temps;
    envChartInstance.data.datasets[1].data = hums;
    envChartInstance.update();
  } catch (err) {
    console.error('Failed to load sensor history for graph:', err);
  }
}

function setGraphLimit(limit) {
  graphLimit = limit;
  [15, 30, 50].forEach(n => {
    const btn = document.getElementById(`btn-limit-${n}`);
    if (btn) {
      if (n === limit) {
        btn.className = 'px-3 py-1.5 rounded-lg font-semibold bg-emerald-500 text-black';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg font-semibold text-emerald-400 hover:text-white';
      }
    }
  });
  loadSensorHistory();
}

// ==========================================
// 6. PAGINATED RECORDS TABLE
// ==========================================
async function loadSensorRecords(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('records-table-body');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/sensor/records?page=${page}&limit=${recordsPerPage}`);
    const data = await res.json();

    const records = data.records || [];
    const pagination = data.pagination || { totalRecords: 0, totalPages: 1 };

    // Update total counter badge
    const counterBadge = document.getElementById('records-counter-badge');
    if (counterBadge) {
      counterBadge.textContent = `Total: ${pagination.totalRecords} records`;
    }

    // Update page range display
    const rangeDisplay = document.getElementById('page-range-display');
    const totalDisplay = document.getElementById('page-total-display');
    if (rangeDisplay && totalDisplay) {
      const start = pagination.totalRecords === 0 ? 0 : (page - 1) * recordsPerPage + 1;
      const end = Math.min(page * recordsPerPage, pagination.totalRecords);
      rangeDisplay.textContent = `${start} - ${end}`;
      totalDisplay.textContent = pagination.totalRecords;
    }

    // Render table rows
    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
            No sensor records found in the database. Send data via ESP8266 or click "Simulate Sensor Push" above!
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = records.map(r => `
        <tr class="hover:bg-emerald-950/40 transition">
          <td class="py-3 px-4 text-xs font-mono text-slate-400">#${r.id}</td>
          <td class="py-3 px-4 font-semibold text-emerald-400 font-mono">${r.temperature.toFixed(1)} °C</td>
          <td class="py-3 px-4 font-semibold text-teal-300 font-mono">${r.humidity.toFixed(1)} %</td>
          <td class="py-3 px-4 text-xs font-mono text-emerald-200/90">${r.time_ist}</td>
          <td class="py-3 px-4 text-xs font-mono text-slate-300">${r.date_ist}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="deleteRecord(${r.id})" title="Delete Record"
              class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-lg transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Update Pagination Buttons
    updatePaginationControls(pagination);

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Failed to load sensor records:', err);
  }
}

function updatePaginationControls(pagination) {
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const numbersContainer = document.getElementById('pagination-numbers');

  if (btnPrev) btnPrev.disabled = !pagination.hasPrev;
  if (btnNext) btnNext.disabled = !pagination.hasNext;

  if (numbersContainer) {
    const total = pagination.totalPages;
    let html = '';
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(total, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const active = i === currentPage;
      html += `
        <button onclick="goToPage(${i})" class="w-8 h-8 rounded-lg text-xs font-bold transition ${
          active
            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
            : 'bg-emerald-950 text-slate-300 hover:bg-emerald-900 border border-emerald-800/60'
        }">${i}</button>
      `;
    }
    numbersContainer.innerHTML = html;
  }
}

function goToPage(page) {
  if (page < 1) return;
  loadSensorRecords(page);
}

async function deleteRecord(id) {
  if (!confirm(`Are you sure you want to delete record #${id}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/sensor/records/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      loadSensorRecords(currentPage);
      loadSensorHistory();
    } else {
      alert(data.error || 'Failed to delete record');
    }
  } catch (err) {
    console.error('Delete record error:', err);
  }
}

// Export Records as CSV
async function exportRecordsCSV() {
  try {
    const res = await fetch('/api/sensor/records?page=1&limit=500');
    const data = await res.json();
    const records = data.records || [];
    if (records.length === 0) {
      alert('No records available to export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Temperature (C),Humidity (%),Time (IST),Date (IST)\n';

    records.forEach(r => {
      csvContent += `${r.id},${r.temperature},${r.humidity},"${r.time_ist}","${r.date_ist}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pushpakbhure_iot_records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('CSV export failed:', err);
  }
}

// ==========================================
// 7. TAB 2: SMART LCD CONTROLLER
// ==========================================
async function loadLcdState() {
  try {
    const res = await fetch('/api/device/lcd');
    const data = await res.json();
    if (data) {
      const row1Input = document.getElementById('lcd-row1-input');
      const row2Input = document.getElementById('lcd-row2-input');
      if (row1Input && data.line1 !== undefined) row1Input.value = data.line1;
      if (row2Input && data.line2 !== undefined) row2Input.value = data.line2;
      updateLcdPreview();
    }
  } catch (err) {
    console.error('Failed to load LCD state:', err);
  }
}

function updateLcdPreview() {
  const row1Input = document.getElementById('lcd-row1-input');
  const row2Input = document.getElementById('lcd-row2-input');
  const prev1 = document.getElementById('lcd-preview-row1');
  const prev2 = document.getElementById('lcd-preview-row2');
  const count1 = document.getElementById('row1-count');
  const count2 = document.getElementById('row2-count');

  const val1 = (row1Input ? row1Input.value : '').substring(0, 16);
  const val2 = (row2Input ? row2Input.value : '').substring(0, 16);

  if (count1) count1.textContent = `${val1.length} / 16 chars`;
  if (count2) count2.textContent = `${val2.length} / 16 chars`;

  // Pad with spaces for realistic 16-char grid
  const pad1 = (val1 + '                ').substring(0, 16);
  const pad2 = (val2 + '                ').substring(0, 16);

  if (prev1) prev1.textContent = pad1;
  if (prev2) prev2.textContent = pad2;
}

async function handleLcdUpdate(event) {
  event.preventDefault();
  const row1 = document.getElementById('lcd-row1-input').value;
  const row2 = document.getElementById('lcd-row2-input').value;
  const alertEl = document.getElementById('lcd-success-alert');

  try {
    const res = await fetch('/api/device/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line1: row1, line2: row2 })
    });
    const data = await res.json();
    if (res.ok) {
      if (alertEl) {
        alertEl.classList.remove('hidden');
        setTimeout(() => alertEl.classList.add('hidden'), 4000);
      }
      const syncStatus = document.getElementById('lcd-sync-status');
      if (syncStatus) syncStatus.textContent = 'Status: Successfully sent to Cloud!';
    }
  } catch (err) {
    console.error('Failed to update LCD:', err);
  }
}

function applyLcdPreset(line1, line2) {
  const row1Input = document.getElementById('lcd-row1-input');
  const row2Input = document.getElementById('lcd-row2-input');
  if (row1Input) row1Input.value = line1;
  if (row2Input) row2Input.value = line2;
  updateLcdPreview();
}

// ==========================================
// 8. TAB 3: LED AUTOMATION
// ==========================================
async function loadLedState() {
  try {
    const res = await fetch('/api/device/led');
    const data = await res.json();
    if (data && data.led_state !== undefined) {
      renderLedUI(data.led_state);
    }
  } catch (err) {
    console.error('Failed to load LED state:', err);
  }
}

async function handleToggleLed() {
  const newState = currentLedState === 1 ? 0 : 1;
  await setLedExplicit(newState);
}

async function setLedExplicit(state) {
  try {
    const res = await fetch('/api/device/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ led_state: state })
    });
    const data = await res.json();
    if (res.ok) {
      renderLedUI(data.led_state);
    }
  } catch (err) {
    console.error('Failed to update LED state:', err);
  }
}

function renderLedUI(state) {
  currentLedState = state === 1 ? 1 : 0;

  const bulbGlow = document.getElementById('led-bulb-glow');
  const bulbIcon = document.getElementById('led-bulb-icon');
  const ripple = document.getElementById('led-ripple');
  const stateText = document.getElementById('led-state-text');
  const stateSubtext = document.getElementById('led-state-subtext');
  const btn = document.getElementById('btn-toggle-led');
  const btnLabel = document.getElementById('led-btn-label');
  const lastUpdated = document.getElementById('led-last-updated');

  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);

  if (lastUpdated) lastUpdated.textContent = `${timeStr} (IST)`;

  if (currentLedState === 1) {
    // LED IS ON
    if (bulbGlow) bulbGlow.className = "w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 bg-emerald-500/20 border-4 border-emerald-400 glow-green";
    if (bulbIcon) bulbIcon.className = "w-20 h-20 text-emerald-400 fill-emerald-400 filter drop-shadow(0 0 16px #10b981) transition-all duration-500";
    if (ripple) ripple.classList.remove('hidden');
    if (stateText) {
      stateText.textContent = "LED IS ON";
      stateText.className = "text-3xl sm:text-4xl font-black text-emerald-400 glow-text-green tracking-tight";
    }
    if (stateSubtext) stateSubtext.textContent = "ESP8266 Pin D0 is set to HIGH (3.3V)";
    if (btn) {
      btn.className = "w-full py-4 px-8 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30";
    }
    if (btnLabel) btnLabel.textContent = "Turn LED OFF";
  } else {
    // LED IS OFF
    if (bulbGlow) bulbGlow.className = "w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 bg-slate-900 border-4 border-slate-700";
    if (bulbIcon) bulbIcon.className = "w-20 h-20 text-slate-600 transition-all duration-500";
    if (ripple) ripple.classList.add('hidden');
    if (stateText) {
      stateText.textContent = "LED IS OFF";
      stateText.className = "text-3xl sm:text-4xl font-black text-slate-400 tracking-tight";
    }
    if (stateSubtext) stateSubtext.textContent = "ESP8266 Pin D0 is set to LOW (0V)";
    if (btn) {
      btn.className = "w-full py-4 px-8 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center space-x-3 bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30";
    }
    if (btnLabel) btnLabel.textContent = "Turn LED ON";
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}
