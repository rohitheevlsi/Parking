# PARK AI Hardware — Real Parking Sensor Node

This folder contains **real, flashable firmware** — not a simulation. The web app's IoT tab clearly labels its live dashboard as a software simulation; this is the actual code that would run on physical hardware.

## Bill of Materials (per parking slot)

| Part | Approx. Cost (₹) | Purpose |
|---|---|---|
| ESP32 DevKit v1 | 350 | WiFi microcontroller, runs the firmware |
| HC-SR04 ultrasonic sensor | 60 | Measures distance to detect a parked vehicle |
| LED + 220Ω resistor | 5 | Visual occupied/free indicator |
| 1kΩ + 2kΩ resistor (voltage divider) | 5 | Steps ECHO pin down from 5V to 3.3V logic |
| Breadboard or perfboard + jumper wires | 35 | Assembly |
| **Total per slot** | **~₹455** | |

For a 10-slot lot: ~₹4,550 in hardware — cheap enough that this is genuinely viable for a single homeowner's driveway, not just commercial lots.

## Wiring Diagram

```
                     ESP32 DevKit
                    ┌─────────────┐
        5V (VIN) ───┤             │
                    │             │
   HC-SR04          │             │
   ┌───────┐        │             │
   │  VCC  ├────────┤ 5V          │
   │  GND  ├────────┤ GND         │
   │  TRIG ├────────┤ GPIO 5      │
   │  ECHO ├──[R1]──┤ GPIO 18     │   R1 = 1kΩ, R2 = 2kΩ
   └───────┘    │   │             │   forms a voltage divider:
                [R2]│             │   5V → ~3.3V safe for ESP32
                 │  │             │
                GND │             │
                    │  GPIO 2 ────┼──[220Ω]──[LED]──GND
                    └─────────────┘
```

## Setup Steps

1. **Install Arduino IDE** (free, arduino.cc)
2. **Add ESP32 board support**: File → Preferences → Additional Board Manager URLs →
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   then Tools → Board → Boards Manager → search "esp32" → Install
3. **Install the ArduinoJson library**: Tools → Manage Libraries → search "ArduinoJson" → Install
4. **Open** `esp32_parking_sensor.ino`
5. **Fill in your credentials** at the top of the file:
   - `WIFI_SSID` / `WIFI_PASSWORD` — your network
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY` — from your Supabase project (Settings → API)
   - `NODE_ID`, `LOT_ID`, `SLOT_ID` — unique identifiers for this physical sensor
6. **Select your board**: Tools → Board → ESP32 Arduino → "ESP32 Dev Module"
7. **Select the COM port** your ESP32 is connected to
8. **Click Upload**

Once flashed, the device will:
- Connect to WiFi (auto-reconnects if it drops)
- Ping the ultrasonic sensor every 2 seconds
- Light the onboard LED when a vehicle is detected within 25cm
- POST a JSON reading to your Supabase `sensor_readings` table every 4 seconds

## Verifying it Works

Open the Supabase dashboard → Table Editor → `sensor_readings`. New rows should appear every 4 seconds once the device is powered and connected to WiFi. You can also open the Arduino IDE Serial Monitor (115200 baud) to see live distance readings and HTTP response codes.

## Honest Status

This firmware has been written to compile against the standard ESP32 Arduino core and the documented Supabase REST API — but it has **not been tested on physical hardware** as part of building this repo (no ESP32 board was available in the development environment). Treat it as a correct starting point that may need minor debugging (typical issues: wrong COM port, wrong board variant, voltage divider resistor values) rather than a guaranteed-working binary. This is the honest state of things — the architecture and code are real engineering, not vaporware, but "written code" and "verified on hardware" are different claims and this repo is currently the former.

## Next Steps to Go From Simulation → Real

1. Buy the BOM above for 1-2 test slots (~₹1,000)
2. Flash this firmware, verify readings land in Supabase
3. In `js/backend.js`, swap the app's polling from the local `IOT` simulation object to a `BACKEND.subscribeToBookings`-style realtime subscription on `sensor_readings`
4. Mount the sensor at bumper height, angled down slightly, in a small waterproof enclosure
