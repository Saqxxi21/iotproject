# PushpakBhure IoT - ESP8266 Hardware Guide

**Application Name**: PushpakBhure  
**Designed & Developed by**: Gopal & Saqlain  
**Institution**: Dept of Electrical Engineering, Govt College of Engineering Yavatmal  

---

## 1. Hardware Pin Connections

| Component | Component Pin | ESP8266 Pin | GPIO Number | Notes |
|---|---|---|---|---|
| **DHT11 Sensor** | VCC | 3.3V or VIN | - | Power supply |
| | DATA | **D5** | GPIO 14 | 10kΩ pull-up resistor if raw 3-pin |
| | GND | GND | - | Ground |
| **LED** | Anode (+) | **D0** | GPIO 16 | Connect in series with 220Ω - 330Ω resistor |
| | Cathode (-) | GND | - | Ground |
| **I2C LCD (16x2)** | VCC | **VIN / 5V** | - | Requires 5V for crisp contrast backlight |
| | GND | GND | - | Common ground |
| | SCL | **D1** | GPIO 5 | I2C Clock line |
| | SDA | **D2** | GPIO 4 | I2C Data line |

---

## 2. Arduino IDE Setup

### Step A: Install ESP8266 Board Package
1. Open **Arduino IDE**.
2. Go to **File > Preferences**.
3. In **Additional Board Manager URLs**, add:  
   `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
4. Go to **Tools > Board > Boards Manager...**, search for `esp8266` and click **Install**.
5. Select **Tools > Board > ESP8266 Boards > NodeMCU 1.0 (ESP-12E Module)**.

### Step B: Install Required Libraries
Open **Sketch > Include Library > Manage Libraries...** and install:
1. **`DHT sensor library`** by Adafruit (also accept the prompt to install *Adafruit Unified Sensor*).
2. **`LiquidCrystal I2C`** by Frank de Brabander or Marco Schwartz.
3. **`ArduinoJson`** by Benoit Blanchon (Version 6.x or 7.x).

---

## 3. Configuration in the Sketch

In `ESP8266_IoT_Client.ino`, verify your settings:

```cpp
// 1. WiFi Credentials
const char* WIFI_SSID     = "IoT";
const char* WIFI_PASSWORD = "12345678";

// 2. Server Endpoint (Live Render Cloud Deployment):
const char* SERVER_SYNC_URL = "https://iotproject-1-waoe.onrender.com/api/device/sync";
```

> **Note on I2C LCD Address:**  
> Most PCF8574 I2C backpacks use address `0x27`. If your LCD backlight turns on but no text appears, turn the blue contrast potentiometer on the back of the I2C module with a small screwdriver, or change the address to `0x3F` in line 49:  
> `LiquidCrystal_I2C lcd(0x3F, 16, 2);`

---

## 4. How It Works (Every 10 Seconds)
1. **DHT11**: Reads Temperature (°C) and Humidity (%).
2. **WiFi Sync**: Sends an HTTP POST to `/api/device/sync` with JSON data.
3. **Actuator Sync**: The backend responds with the current **LED state** and **LCD text**.
4. **Instant Action**:
   - ESP8266 sets Pin **D0** `HIGH` or `LOW` to toggle the LED.
   - ESP8266 updates the **16x2 LCD** screen row 1 and row 2.
