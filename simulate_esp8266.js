/**
 * ESP8266 Hardware Simulator for Testing
 * Simulates the physical hardware sending DHT11 sensor readings every 10 seconds
 * and logging the LCD and LED state returned by the server.
 */

const SERVER_URL = 'http://localhost:3000/api/device/sync';
const INTERVAL_MS = 10000; // 10 seconds

console.log('========================================================');
console.log('🤖 ESP8266 Hardware Simulation Client Started');
console.log(`📡 Target Server: ${SERVER_URL}`);
console.log(`⏱️ Sync Interval: ${INTERVAL_MS / 1000} seconds`);
console.log('========================================================');

async function syncHardware() {
  // Generate realistic room temperature (25.0 - 33.0 °C) and humidity (50.0 - 75.0 %)
  const temp = +(26.0 + Math.sin(Date.now() / 60000) * 4.5 + (Math.random() * 1.5 - 0.75)).toFixed(1);
  const hum = +(62.0 + Math.cos(Date.now() / 60000) * 8.0 + (Math.random() * 2.0 - 1.0)).toFixed(1);

  console.log(`\n[${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST] Reading DHT11 on Pin D5: Temp=${temp}°C, Humidity=${hum}%`);

  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: temp, humidity: hum })
    });

    if (!res.ok) {
      console.error(`❌ HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    console.log('📥 Response from Server:');
    console.log(`   💡 LED Pin D0 State : ${data.led === 1 ? '🟢 HIGH (LED ON)' : '⚫ LOW (LED OFF)'}`);
    console.log(`   📟 16x2 LCD Row 1   : [${data.lcd_line1}]`);
    console.log(`   📟 16x2 LCD Row 2   : [${data.lcd_line2}]`);
  } catch (err) {
    console.error('❌ Connection error to server:', err.message);
  }
}

// Initial sync immediately, then repeat every 10 seconds
syncHardware();
setInterval(syncHardware, INTERVAL_MS);
