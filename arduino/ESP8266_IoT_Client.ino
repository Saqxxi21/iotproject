/*
 * =========================================================================================
 * Project: PushpakBhure - IoT Smart Environment Monitoring, LCD & LED Automation
 * Designed & Developed by: Gopal & Saqlain
 * Dept of Electrical Engineering, Govt College of Engineering Yavatmal
 * 
 * Target Board: ESP8266 (NodeMCU / WeMos D1 Mini)
 * 
 * Hardware Connections:
 * -----------------------------------------------------------------------------------------
 * Component        ESP8266 Pin      GPIO Number    Note
 * -----------------------------------------------------------------------------------------
 * DHT11 Data Pin   D5               GPIO 14        Sensor Data (Use 10k pull-up if naked)
 * LED Anode (+)    D0               GPIO 16        Active HIGH Output (Series with 220Ω)
 * LED Cathode (-)  GND              GND            Ground
 * LCD I2C SCL      D1               GPIO 5         I2C Clock
 * LCD I2C SDA      D2               GPIO 4         I2C Data
 * LCD I2C VCC      VIN / 5V         5V             Requires 5V for backlight contrast
 * LCD I2C GND      GND              GND            Common Ground
 * -----------------------------------------------------------------------------------------
 * 
 * Required Arduino Libraries (Install via Arduino IDE Library Manager):
 * 1. "DHT sensor library" by Adafruit
 * 2. "Adafruit Unified Sensor" by Adafruit
 * 3. "LiquidCrystal I2C" by Frank de Brabander / Marco Schwartz
 * 4. "ArduinoJson" (Version 6.x or 7.x) by Benoit Blanchon
 * =========================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ================= CONFIGURATION =================

// 1. WiFi Credentials (as specified)
const char* WIFI_SSID     = "IoT";
const char* WIFI_PASSWORD = "12345678";

// 2. Backend Server Endpoint
// - When running locally: Use your computer's local LAN IP: "http://192.168.1.xxx:3000/api/device/sync"
// - When deployed on Render: Use your Render HTTPS URL: "https://pushpakbhure-iot.onrender.com/api/device/sync"
const char* SERVER_SYNC_URL = "http://192.168.1.100:3000/api/device/sync";

// 3. Pin Definitions
#define DHTPIN        D5      // DHT11 Data Pin (GPIO 14)
#define DHTTYPE       DHT11   // Sensor Model
#define LED_PIN       D0      // LED Output Pin (GPIO 16)
#define LCD_SCL_PIN   D1      // I2C SCL (GPIO 5)
#define LCD_SDA_PIN   D2      // I2C SDA (GPIO 4)

// 4. LCD Address (Usually 0x27 or 0x3F)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// 5. DHT Sensor Object
DHT dht(DHTPIN, DHTTYPE);

// 6. Timing & Polling Variables
unsigned long previousMillis = 0;
const unsigned long SYNC_INTERVAL = 10000; // 10 seconds interval

// Track state to prevent LCD flicker
String lastLcdLine1 = "";
String lastLcdLine2 = "";

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("   PushpakBhure IoT Hardware Client Initializing   "));
  Serial.println(F(" Dept of Electrical Engg, Govt College Yavatmal   "));
  Serial.println(F("=================================================="));

  // Initialize LED Pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Start with LED OFF

  // Initialize I2C for LCD with explicit SCL & SDA pins
  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("PushpakBhure IoT");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi.");

  // Initialize DHT Sensor
  dht.begin();

  // Connect to WiFi
  connectToWiFi();
}

// ================= MAIN LOOP =================
void loop() {
  // Check WiFi connection and reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[WiFi] Connection lost. Reconnecting..."));
    connectToWiFi();
  }

  // Periodic 10-second sync routine
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= SYNC_INTERVAL || previousMillis == 0) {
    previousMillis = currentMillis;
    syncWithServer();
  }

  delay(50); // Small yield to prevent WDT reset
}

// ================= WIFI CONNECTION HELPER =================
void connectToWiFi() {
  Serial.print(F("[WiFi] Connecting to SSID: "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("[WiFi] Connected Successfully!"));
    Serial.print(F("[WiFi] IP Address: "));
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    delay(2000);
  } else {
    Serial.println(F("[WiFi] Failed to connect. Will retry in loop..."));
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Conn Failed");
    lcd.setCursor(0, 1);
    lcd.print("Check SSID/Pass");
  }
}

// ================= SYNC WITH BACKEND (POST DHT11 + GET LED/LCD) =================
void syncWithServer() {
  Serial.println(F("--------------------------------------------------"));
  Serial.println(F("[Sync] Starting 10-second server synchronization..."));

  // 1. Read DHT11 Sensor
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Handle sensor reading failure
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println(F("[DHT11] Warning: Failed to read from sensor. Using defaults."));
    temperature = 28.0;
    humidity = 60.0;
  }

  Serial.print(F("[DHT11] Temperature: "));
  Serial.print(temperature);
  Serial.print(F(" °C | Humidity: "));
  Serial.print(humidity);
  Serial.println(F(" %"));

  // 2. Prepare JSON Payload
  StaticJsonDocument<256> docOut;
  docOut["temperature"] = temperature;
  docOut["humidity"] = humidity;

  String jsonPayload;
  serializeJson(docOut, jsonPayload);

  // 3. Send HTTP Request
  WiFiClient client;
  std::unique_ptr<BearSSL::WiFiClientSecure> secureClient;
  HTTPClient http;

  bool isHttps = String(SERVER_SYNC_URL).startsWith("https://");

  if (isHttps) {
    secureClient.reset(new BearSSL::WiFiClientSecure);
    secureClient->setInsecure(); // Skip SSL certificate verification on ESP8266
    http.begin(*secureClient, SERVER_SYNC_URL);
  } else {
    http.begin(client, SERVER_SYNC_URL);
  }

  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(jsonPayload);
  Serial.print(F("[HTTP] POST Response Code: "));
  Serial.println(httpResponseCode);

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    String responseString = http.getString();
    Serial.print(F("[HTTP] Response: "));
    Serial.println(responseString);

    // 4. Parse Server Response (Contains LED state and LCD lines)
    StaticJsonDocument<512> docIn;
    DeserializationError error = deserializeJson(docIn, responseString);

    if (!error) {
      // Control LED
      int ledState = docIn["led"] | 0;
      digitalWrite(LED_PIN, ledState == 1 ? HIGH : LOW);
      Serial.print(F("[Actuator] LED Pin D0 set to: "));
      Serial.println(ledState == 1 ? F("HIGH (ON)") : F("LOW (OFF)"));

      // Update LCD Display
      const char* line1 = docIn["lcd_line1"] | "PushpakBhure";
      const char* line2 = docIn["lcd_line2"] | "IoT System Ready";

      updateLcd(String(line1), String(line2));
    } else {
      Serial.print(F("[JSON] Deserialization failed: "));
      Serial.println(error.f_str());
    }
  } else {
    Serial.print(F("[HTTP] Sync Error: "));
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// ================= LCD DISPLAY UPDATE HELPER =================
void updateLcd(String line1, String line2) {
  // Pad strings to 16 characters to overwrite any previous letters cleanly
  while (line1.length() < 16) line1 += " ";
  while (line2.length() < 16) line2 += " ";

  line1 = line1.substring(0, 16);
  line2 = line2.substring(0, 16);

  // Update only if text has changed to prevent unwanted LCD screen flickering
  if (line1 != lastLcdLine1 || line2 != lastLcdLine2) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);

    lastLcdLine1 = line1;
    lastLcdLine2 = line2;

    Serial.println(F("[LCD] Screen successfully updated:"));
    Serial.print(F("  Row 1: [")); Serial.print(line1); Serial.println(F("]"));
    Serial.print(F("  Row 2: [")); Serial.print(line2); Serial.println(F("]"));
  }
}
