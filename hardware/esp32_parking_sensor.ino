/* ============================================================
   PARK AI — ESP32 Parking Slot Sensor Firmware
   ============================================================

   HARDWARE NEEDED (~₹450 per slot):
     - 1x ESP32 DevKit (or ESP32-WROOM-32)         ~₹350
     - 1x HC-SR04 ultrasonic distance sensor        ~₹60
     - 1x LED (optional, visual occupied indicator) ~₹5
     - Jumper wires + breadboard or perfboard        ~₹35

   WIRING:
     HC-SR04 VCC  → ESP32 5V (VIN)
     HC-SR04 GND  → ESP32 GND
     HC-SR04 TRIG → ESP32 GPIO 5
     HC-SR04 ECHO → ESP32 GPIO 18   (use a voltage divider:
                    ECHO is 5V logic, ESP32 GPIO is 3.3V —
                    use two resistors, e.g. 1kΩ + 2kΩ, as a divider)
     LED (+)      → ESP32 GPIO 2 (built-in LED on most DevKits)
     LED (-)      → GND via 220Ω resistor

   WHAT THIS DOES:
     1. Pings the ultrasonic sensor every 2 seconds
     2. If distance < OCCUPIED_THRESHOLD_CM → slot is occupied
     3. Posts the reading as JSON to the PARK AI Supabase REST API
     4. Lights the onboard LED when the slot is occupied
     5. Reconnects automatically if WiFi drops

   SETUP STEPS:
     1. Install "ESP32" board support in Arduino IDE
        (File → Preferences → Additional Board URLs →
         https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json)
     2. Install the "ArduinoJson" library (Library Manager)
     3. Fill in WIFI_SSID, WIFI_PASSWORD, SUPABASE_URL,
        SUPABASE_ANON_KEY, NODE_ID, LOT_ID, SLOT_ID below
     4. Select Board: "ESP32 Dev Module", select the correct COM port
     5. Click Upload

   This firmware writes directly into the `sensor_readings` table
   defined in supabase/schema.sql — no separate MQTT broker required
   for a hackathon-scale demo (Supabase's REST API is simpler to set
   up than running your own Mosquitto broker). A real MQTT pipeline
   is a drop-in upgrade once you're running more than a few nodes.
   ============================================================ */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- CONFIGURE THESE ----
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SUPABASE_URL      = "https://YOUR_PROJECT.supabase.co";
const char* SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

const char* NODE_ID = "ESP32-001";   // unique per device
const int   LOT_ID  = 1;             // matches a lot id in LOTS in js/core.js
const char* SLOT_ID  = "1-S1";       // unique per physical slot

// ---- PIN CONFIG ----
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN  = 2;

// ---- BEHAVIOUR CONFIG ----
const float OCCUPIED_THRESHOLD_CM = 25.0;  // closer than this = car present
const unsigned long READ_INTERVAL_MS = 2000;
const unsigned long POST_INTERVAL_MS = 4000; // matches the app's 4s simulation cadence

unsigned long lastRead = 0;
unsigned long lastPost = 0;
bool lastOccupiedState = false;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  connectWiFi();
}

void loop() {
  unsigned long now = millis();

  if (now - lastRead >= READ_INTERVAL_MS) {
    lastRead = now;
    float distanceCm = readDistanceCm();
    bool occupied = (distanceCm > 0 && distanceCm < OCCUPIED_THRESHOLD_CM);
    digitalWrite(LED_PIN, occupied ? HIGH : LOW);

    Serial.printf("[%s] dist=%.1fcm occupied=%d\n", NODE_ID, distanceCm, occupied);

    if (now - lastPost >= POST_INTERVAL_MS) {
      lastPost = now;
      postReading(distanceCm, occupied);
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long durationUs = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5m range)
  if (durationUs == 0) return -1; // no echo received, sensor fault or out of range

  // speed of sound = 0.0343 cm/us, round trip so divide by 2
  float distanceCm = (durationUs * 0.0343) / 2.0;
  return distanceCm;
}

void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed, will retry in loop().");
  }
}

void postReading(float distanceCm, bool occupied) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping post — WiFi not connected.");
    return;
  }

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["node_id"]     = NODE_ID;
  doc["lot_id"]       = LOT_ID;
  doc["slot_id"]      = SLOT_ID;
  doc["occupied"]     = occupied;
  doc["distance_cm"]  = distanceCm;
  doc["rssi_dbm"]     = WiFi.RSSI();
  // doc["temp_c"]    = temp_c; // comment out since we don't have a temperature sensor, avoiding NAN serialization error

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  Serial.printf("POST → %d\n", httpCode);
  if (httpCode <= 0) {
    Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}
