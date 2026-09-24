# PushpakBhure - Smart IoT Environment & Hardware Automation

**Application Name**: PushpakBhure  
**Institution**: Dept of Electrical Engineering, Govt College of Engineering Yavatmal  
**Designed & Developed by**: Gopal & Saqlain  
**Timezone Standard**: `+05:30 Asia/Kolkata`  
**Theme**: Emerald / Forest Green Aesthetics  

---

## 🌟 Overview
PushpakBhure is an end-to-end Internet of Things (IoT) monitoring and hardware automation platform engineered with Node.js, SQLite, and an ESP8266 microcontroller client. It features real-time environmental telemetry, dynamic charts, innovative SVG radial gauges, physical 16x2 I2C LCD control, and LED remote switching.

### System Architecture
```
+------------------------------------------------------------------------+
|                          Web Dashboard (Browser)                       |
|   HTML5 + Tailwind CSS + Chart.js + SVG Gauges + Lucide Icons (Green)  |
+-----------------------------------+------------------------------------+
                                    | HTTP / REST (JSON)
                                    v
+------------------------------------------------------------------------+
|                     PushpakBhure Node.js Server                        |
|                  Express + JWT Auth + SQLite Engine                    |
|             (Ready for 1-Click Deployment on Render)                   |
+-----------------------------------+------------------------------------+
                                    | 10-Second Bi-directional Sync
                                    v
+------------------------------------------------------------------------+
|                      ESP8266 Microcontroller Node                      |
|                                                                        |
|   - Pin D5 (GPIO 14) : DHT11 Sensor (Temperature & Humidity)           |
|   - Pin D0 (GPIO 16) : Remote Controlled LED                           |
|   - Pin D1 & D2      : 16x2 I2C LCD Display (SCL=D1, SDA=D2)           |
+------------------------------------------------------------------------+
```

---

## 🚀 Key Features

### 1. Tab 1: Environment Monitoring
- **10-Second Telemetry Sync**: Automatically polls and ingests DHT11 sensor data every 10 seconds.
- **Innovative Gauges & Seek Bars**:
  - Dual circular SVG dials with dynamic color shifts (Green: optimal, Yellow: warm, Red: hot).
  - Dual seek-bar progress sliders illustrating calibrated operating zones.
- **Dynamic Interactive Graph**: Real-time line chart (Chart.js) with smooth curves and IST timestamps.
- **Saved Records Table**:
  - Paginated display: **20 records per page**, newest records first.
  - Columns: `# | Temperature (°C) | Humidity (%) | Time (IST) | Date (IST) | Action (Delete)`.
  - Strictly calibrated to **`+5:30 Asia/Kolkata`**.
  - One-click record deletion and CSV export.
- **Built-in Sensor Simulator**: Test your dashboard and graphing immediately even before powering up your ESP8266!

### 2. Tab 2: Smart LCD Controller
- **Real-time 16x2 LCD Simulation**: Realistic green backlit dot-matrix visualizer.
- **Row 1 & Row 2 Inputs**: Character-constrained (16 characters per line) text fields.
- **Instant Cloud Sync**: Submits entered text to SQLite; the ESP8266 updates its physical 16x2 I2C screen on its next 10-second sync cycle.
- **Quick Presets**: Instant buttons for greetings, college title, or sensor snapshots.

### 3. Tab 3: LED Automation
- **Remote Actuator Switching**: Large tactile toggle switch button with glowing emerald illumination.
- **Actuator Logic**: Pin D0 (GPIO 16) is driven HIGH (3.3V) when ON and LOW (0V) when OFF.
- **Status Diagnostics**: Displays current logic level and last toggle timestamp in IST.

### 4. User Authentication
- Sign In & Registration forms with password hashing (`bcryptjs`) and secure JWT session tokens.
- Demo account auto-filler for rapid evaluation.

---

## 💻 Local Quick Start

### 1. Start the Server
In PowerShell:
```powershell
npm start
```
The server will start on `http://localhost:3000`.

### 2. Open the Dashboard
Visit `http://localhost:3000` in any web browser.

---

## ☁️ Deploying on Render (Step-by-Step)

This project has been engineered specifically for seamless deployment on **Render**:

### Option A: Deploy via GitHub (Recommended)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of PushpakBhure IoT Project"
   git remote add origin https://github.com/your-username/pushpakbhure-iot.git
   git push -u origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Name**: `pushpakbhure-iot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `(generate any random string)`
7. Click **Deploy Web Service**.
8. Once deployed, Render provides a public HTTPS URL (e.g. `https://pushpakbhure-iot.onrender.com`).

### Option B: Deploy using `render.yaml` (Blueprint)
In the Render dashboard, click **Blueprints > New Blueprint Instance**, select your repository, and Render will automatically parse `render.yaml` and configure everything!

---

## 🔌 Hardware Setup (ESP8266)

Detailed hardware wiring instructions and the complete sketch are located in the [`arduino/`](file:///c:/Users/GCOEY/Desktop/Iot_Project/arduino) directory:
- Sketch: [`arduino/ESP8266_IoT_Client.ino`](file:///c:/Users/GCOEY/Desktop/Iot_Project/arduino/ESP8266_IoT_Client.ino)
- Wiring Guide: [`arduino/README_ARDUINO.md`](file:///c:/Users/GCOEY/Desktop/Iot_Project/arduino/README_ARDUINO.md)

### Quick Wiring Summary:
- **DHT11 Data** ➔ Pin **D5**
- **LED Anode (+)** ➔ Pin **D0**
- **LCD I2C SCL** ➔ Pin **D1**
- **LCD I2C SDA** ➔ Pin **D2**
- **WiFi SSID**: `IoT`
- **WiFi Password**: `12345678`

---

## 👨‍💻 Project Accreditation
**Application Name**: PushpakBhure  
**Designed and Developed by**: Gopal & Saqlain  
**Department**: Dept of Electrical Engineering  
**College**: Govt College of Engineering Yavatmal  
