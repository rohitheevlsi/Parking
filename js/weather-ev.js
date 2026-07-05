// ============================================================
//  PARK AI — Interactive Core Features (EV, Weather, Safety, IoT, Insights)
// ============================================================

/* ---- GLOBAL STATE EXTENSIONS ---- */
State.rainSimulated = false;
State.originalPrices = {};
State.iotLogInterval = null;

// ==========================================
//  1. EV CHARGING HUB
// ==========================================
function initEV() {
  if (State.evInit) return;
  State.evInit = true;

  // Populate lot selector with EV capable lots
  const lotSel = document.getElementById('ev-lot-sel');
  if (lotSel) {
    const evLots = LOTS.filter(l => l.tags.includes('ev'));
    lotSel.innerHTML = evLots.map(l => `<option value="${l.id}">${l.name} (${l.area}) - ₹${l.price}/hr</option>`).join('');
  }

  // Populate live chargers list
  renderEVChargerStatus();

  // Run initial calculator logic
  calcEV();
}

function renderEVChargerStatus() {
  const container = document.getElementById('ev-charger-list');
  if (!container) return;

  const evLots = LOTS.filter(l => l.tags.includes('ev'));
  container.innerHTML = evLots.map(l => {
    // Generate random states for 5 charging slots per lot
    const slots = Array.from({ length: 5 }, () => {
      const rand = Math.random();
      if (rand < 0.3) return 'occupied';
      if (rand < 0.6) return 'charging';
      return 'available';
    });

    const totalAvailable = slots.filter(s => s === 'available').length;
    const speed = l.id === 3 ? '50 kW DC Fast' : l.id === 8 ? '22 kW AC Fast' : '7.2 kW AC';

    return `
      <div class="ev-charger-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:14.5px;">${l.name}</div>
            <div style="font-size:12px;color:var(--text3);">Speed: <strong>${speed}</strong> · rate: ₹15/kWh</div>
          </div>
          <span class="badge badge-teal" style="font-size:10px;">${totalAvailable} free</span>
        </div>
        <div class="ev-status-bar">
          ${slots.map(s => {
            const colors = { occupied: 'var(--red)', charging: 'var(--amber)', available: 'var(--teal)' };
            return `<div class="ev-slot" style="background:${colors[s]}; flex: 1; height: 6px; border-radius: 99px;"></div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text2);margin-top:8px;">
          <span>🟢 Available</span>
          <span>🟡 In Use (Charging)</span>
          <span>🔴 Occupied (Non-charging)</span>
        </div>
      </div>`;
  }).join('');
}

function calcEV() {
  const lotSel = document.getElementById('ev-lot-sel');
  const batteryCap = parseFloat(document.getElementById('ev-battery-cap')?.value) || 40;
  const speed = parseFloat(document.getElementById('ev-speed-sel')?.value) || 7.2;
  const currentPct = parseInt(document.getElementById('ev-batt-slider')?.value) || 45;

  if (!lotSel) return;

  const selectedLotId = parseInt(lotSel.value);
  const lot = LOTS.find(l => l.id === selectedLotId) || LOTS[0];

  const targetPct = 100;
  const chargeNeededPct = Math.max(0, targetPct - currentPct);
  
  // Calculations
  const powerNeeded = (chargeNeededPct / 100) * batteryCap;
  
  // Estimate duration (including standard EV charging curve overhead)
  let duration = powerNeeded / speed;
  if (speed > 22) {
    // DC fast chargers slow down above 80%
    duration *= 1.25; 
  } else {
    duration *= 1.05;
  }

  // Cost: Electricity (₹15/kWh) + Parking hourly fee (rate * duration)
  const powerCost = powerNeeded * 15;
  const parkingCost = lot.price * duration;
  const baseCost = powerCost + parkingCost;
  const service = baseCost * 0.05;
  const gst = baseCost * 0.18;
  const total = baseCost + service + gst;

  // Format outputs
  const timeEl = document.getElementById('ev-calc-time');
  const kwhEl = document.getElementById('ev-calc-kwh');
  const costEl = document.getElementById('ev-calc-cost');
  const totalEl = document.getElementById('ev-calc-total');

  if (timeEl) timeEl.textContent = `${duration.toFixed(1)} hrs`;
  if (kwhEl) kwhEl.textContent = `${powerNeeded.toFixed(1)} kWh`;
  if (costEl) costEl.textContent = `₹${Math.round(baseCost)}`;
  if (totalEl) totalEl.textContent = `₹${Math.round(total)}`;
}

// ==========================================
//  2. WEATHER HUB
// ==========================================
function initWeather() {
  if (State.weatherInit) return;
  State.weatherInit = true;

  fetchLiveWeather();
}

function fetchLiveWeather() {
  // Chennai Coords
  const lat = 13.0827;
  const lon = 80.2707;

  const tempEl = document.getElementById('weather-temp');
  const descEl = document.getElementById('weather-desc');
  const humEl = document.getElementById('weather-humidity');
  const windEl = document.getElementById('weather-wind');
  const rainEl = document.getElementById('weather-rain');

  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,precipitation_probability`)
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    })
    .then(data => {
      const cw = data.current_weather;
      if (!cw) return;

      const temp = cw.temperature;
      const wind = cw.windspeed;
      const code = cw.weathercode;

      // Weather codes description & emoji
      const weatherMap = {
        0: { desc: "Sunny Skies", emoji: "☀️" },
        1: { desc: "Mainly Clear", emoji: "🌤" },
        2: { desc: "Partly Cloudy", emoji: "⛅" },
        3: { desc: "Overcast", emoji: "☁️" },
        45: { desc: "Foggy Conditions", emoji: "🌫" },
        48: { desc: "Depositing Rime Fog", emoji: "🌫" },
        51: { desc: "Light Drizzle", emoji: "🌧" },
        53: { desc: "Moderate Drizzle", emoji: "🌧" },
        55: { desc: "Dense Drizzle", emoji: "🌧" },
        61: { desc: "Slight Rain", emoji: "🌧" },
        63: { desc: "Moderate Rain", emoji: "🌧" },
        65: { desc: "Heavy Rain", emoji: "⛈" },
        80: { desc: "Slight Rain Showers", emoji: "🌧" },
        81: { desc: "Moderate Rain Showers", emoji: "⛈" },
        82: { desc: "Violent Rain Showers", emoji: "⛈" },
        95: { desc: "Thunderstorm", emoji: "⚡⛈" },
      };

      const wInfo = weatherMap[code] || { desc: "Scattered Clouds", emoji: "⛅" };

      if (tempEl) tempEl.innerHTML = `${temp}<sup>°C</sup>`;
      if (descEl) descEl.textContent = wInfo.desc;
      document.getElementById('weather-icon').textContent = wInfo.emoji;
      
      if (windEl) windEl.textContent = `${wind} km/h`;
      
      // Attempt to retrieve relative humidity for current hour
      if (data.hourly && data.hourly.relativehumidity_2m) {
        const currentHourIndex = new Date().getHours();
        const humidity = data.hourly.relativehumidity_2m[currentHourIndex] || 72;
        if (humEl) humEl.textContent = `${humidity}%`;
      } else {
        if (humEl) humEl.textContent = `74%`;
      }

      // Check precipitation probability
      let rainProb = 0;
      if (data.hourly && data.hourly.precipitation_probability) {
        const currentHourIndex = new Date().getHours();
        rainProb = data.hourly.precipitation_probability[currentHourIndex] || 0;
      }
      if (rainEl) rainEl.textContent = `${rainProb}%`;

      // Auto-surge if live weather has rain code (>= 51)
      const isRaining = code >= 51;
      if (isRaining && !State.rainSimulated) {
        applyRainSurge(true);
      }
    })
    .catch(err => {
      console.warn("Could not fetch live weather: ", err.message);
      // Fallback details if Open-Meteo is blocked/offline
      if (tempEl) tempEl.innerHTML = `32.4<sup>°C</sup>`;
      if (descEl) descEl.textContent = "Humid & Cloudy";
      if (humEl) humEl.textContent = "78%";
      if (windEl) windEl.textContent = "12 km/h";
      if (rainEl) rainEl.textContent = "10%";
    });
}

function applyRainSurge(enable) {
  const alertBox = document.getElementById('rain-alert');
  if (enable) {
    if (alertBox) alertBox.classList.remove('hidden');
    
    // Apply ₹10 rain-surge price to covered lots
    LOTS.forEach(l => {
      if (l.tags.includes('covered')) {
        if (State.originalPrices[l.id] === undefined) {
          State.originalPrices[l.id] = l.price;
        }
        l.price = State.originalPrices[l.id] + 10;
      }
    });

    toast("🌧 Surge Pricing activated (+₹10/hr on covered lots)", "warning");
  } else {
    if (alertBox) alertBox.classList.add('hidden');
    
    // Restore original prices
    LOTS.forEach(l => {
      if (State.originalPrices[l.id] !== undefined) {
        l.price = State.originalPrices[l.id];
      }
    });
    
    toast("☀️ Surge Pricing deactivated. Rates restored.", "info");
  }

  // Refresh price displays across the active views
  renderQuickBook();
  if (State.mapInit) {
    // Re-render slot list
    renderSlotList();
    // Update map popup texts by re-plotting markers
    LOTS.forEach(l => {
      if (State.markers[l.id]) {
        leafletMap.removeLayer(State.markers[l.id]);
        addMarker(l);
      }
    });
  }
  if (State.hostInit) {
    renderRenterListings();
  }
}

function toggleRainSimulation() {
  State.rainSimulated = !State.rainSimulated;
  const btn = document.getElementById('weather-simulate-btn');

  if (State.rainSimulated) {
    if (btn) {
      btn.textContent = "☀️ Simulate Clear";
      btn.style.borderColor = "var(--teal)";
      btn.style.color = "var(--teal)";
    }
    applyRainSurge(true);
  } else {
    if (btn) {
      btn.textContent = "🌧 Simulate Rain";
      btn.style.borderColor = "";
      btn.style.color = "";
    }
    applyRainSurge(false);
  }
}

// ==========================================
//  3. SAFETY CONSOLE
// ==========================================
function submitCustomIssue() {
  const textEl = document.getElementById('custom-issue-text');
  const msg = textEl?.value.trim();

  if (!msg) {
    toast("Please type an incident description", "error");
    return;
  }

  const caseId = "SR-" + Math.floor(1000 + Math.random() * 9000);
  toast(`✅ Incident logged: Case ID #${caseId}`, "success", 4000);
  
  // Append to feed
  const container = document.getElementById('live-feed');
  if (container) {
    addFeedItem(container, '🛡', `Incident report logged: <em>"${msg.slice(0, 30)}${msg.length > 30 ? '...' : ''}"</em>`, 'Just now');
  }

  if (textEl) textEl.value = "";
}

// ==========================================
//  4. IOT SENSOR NETWORK
// ==========================================
function initIoT() {
  if (State.iotInit) return;
  State.iotInit = true;

  // Run periodic simulated logs inside the console log box
  const consoleLog = document.getElementById('iot-console-log');
  if (consoleLog) {
    clearInterval(State.iotLogInterval);
    State.iotLogInterval = setInterval(() => {
      if (State.currentTab !== 'iot') return;

      const dist = parseInt(document.getElementById('iot-dist-slider')?.value) || 42;
      const occupied = dist < 25;
      const rssi = -60 + Math.floor(Math.random() * 10);
      const temp = (30.8 + Math.random() * 1.5).toFixed(1);
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false });
      const statusText = occupied ? "OCCUPIED" : "FREE";
      
      const entry = document.createElement('div');
      entry.innerHTML = `[${now}] <span style="color:var(--violet)">[ESP32-ADYAR-01]</span> Dist: ${dist}cm | Mapped state: <span style="color:${occupied ? 'var(--red)' : 'var(--teal)'}">${statusText}</span> | RSSI: ${rssi}dBm | TEMP: ${temp}°C`;
      consoleLog.appendChild(entry);
      
      // Auto scroll
      consoleLog.scrollTop = consoleLog.scrollHeight;
      
      // Keep logs at max 30 lines
      while (consoleLog.children.length > 30) {
        consoleLog.removeChild(consoleLog.firstChild);
      }
    }, 4000);
  }

  // Update simulator components based on initial slider value
  const initialDist = document.getElementById('iot-dist-slider')?.value || 42;
  updateIoTSimulator(initialDist);
}

function updateIoTSimulator(val) {
  const distVal = document.getElementById('iot-dist-val');
  if (distVal) distVal.textContent = `${val} cm`;

  const stateEl = document.getElementById('iot-occupied-state');
  const ledEl = document.getElementById('iot-led');
  const carEl = document.getElementById('iot-car-svg');
  const pulsesEl = document.getElementById('iot-sensor-pulses');
  const labelEl = document.getElementById('iot-status-sub-label');
  const visualBay = document.getElementById('iot-visual-bay');

  const occupied = val < 25;

  if (occupied) {
    if (stateEl) {
      stateEl.textContent = "🔴 OCCUPIED";
      stateEl.style.color = "var(--red)";
    }
    if (ledEl) {
      ledEl.textContent = "🔴 ON (RED)";
      ledEl.style.color = "var(--red)";
    }
    if (carEl) {
      carEl.style.transform = "translateY(0)";
      carEl.style.opacity = "1";
      carEl.style.background = "linear-gradient(135deg,#ff3366,#ff6a00)";
      carEl.style.boxShadow = "0 8px 24px rgba(255,51,102,0.35)";
    }
    if (pulsesEl) {
      pulsesEl.style.display = "none";
    }
    if (labelEl) {
      labelEl.textContent = "Ultrasonic sensor range < 25cm (Vehicle Detected)";
    }
    if (visualBay) {
      visualBay.style.borderColor = "var(--red)";
      visualBay.style.boxShadow = "inset 0 0 20px rgba(255,51,102,0.05)";
    }
  } else {
    if (stateEl) {
      stateEl.textContent = "🟢 FREE";
      stateEl.style.color = "var(--teal)";
    }
    if (ledEl) {
      ledEl.textContent = "⚫ OFF";
      ledEl.style.color = "var(--text3)";
    }
    if (carEl) {
      carEl.style.transform = "translateY(80px)";
      carEl.style.opacity = "0";
    }
    if (pulsesEl) {
      pulsesEl.style.display = "flex";
    }
    if (labelEl) {
      labelEl.textContent = "Ultrasonic sensor range >= 25cm (Slot empty)";
    }
    if (visualBay) {
      visualBay.style.borderColor = "var(--border)";
      visualBay.style.boxShadow = "none";
    }
  }

  // Update Adyar lot free spots dynamically (Lot 5)
  const lotIdx = LOTS.findIndex(l => l.id === 5);
  if (lotIdx !== -1) {
    const isNowOccupied = occupied;
    const currentFree = LOTS[lotIdx].available;
    const expectedFree = isNowOccupied ? 1 : 2;
    if (currentFree !== expectedFree) {
      LOTS[lotIdx].available = expectedFree;
      // Refresh map views
      if (State.mapInit) {
        renderSlotList();
        updateMapStats();
        // Refresh marker
        if (State.markers[5]) {
          leafletMap.removeLayer(State.markers[5]);
          addMarker(LOTS[lotIdx]);
        }
      }
      renderQuickBook();
    }
  }
}

async function sendSimulatedTelemetry() {
  const dist = parseInt(document.getElementById('iot-dist-slider')?.value) || 42;
  const occupied = dist < 25;
  const rssi = -62;
  const temp = 31.2;

  const payload = {
    node_id: "ESP32-ADYAR-01",
    lot_id: 5,
    slot_id: "A-01",
    occupied: occupied,
    distance_cm: dist,
    rssi_dbm: rssi,
    temp_c: temp
  };

  const consoleLog = document.getElementById('iot-console-log');
  if (consoleLog) {
    const pLog = document.createElement('div');
    pLog.style.color = "var(--blue)";
    pLog.textContent = `[POST] Sending telemetry raw HTTP request to ${BACKEND_URL}/api/sensors...`;
    consoleLog.appendChild(pLog);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/sensors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      toast("☁️ Telemetry written to local backend DB", "success");
      if (consoleLog) {
        const sLog = document.createElement('div');
        sLog.style.color = "var(--teal)";
        sLog.textContent = `[HTTP/POST] Server responded: 201 Created. SQLite DB updated successfully.`;
        consoleLog.appendChild(sLog);
        consoleLog.scrollTop = consoleLog.scrollHeight;
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[PARK AI] Telemetry POST failed: Python server offline.");
    toast("💾 Telemetry simulated in local browser runtime", "info");
    if (consoleLog) {
      const eLog = document.createElement('div');
      eLog.style.color = "var(--amber)";
      eLog.textContent = `[HTTP/POST] Request failed. Connection refused (Flask server offline). Local browser state updated instead.`;
      consoleLog.appendChild(eLog);
      consoleLog.scrollTop = consoleLog.scrollHeight;
    }
  }
}

// ==========================================
//  5. CITY INSIGHTS
// ==========================================
function initInsights() {
  if (State.insightsInit) return;
  State.insightsInit = true;

  renderInsightsBarChart();
  renderInsightsHeatmap();
  renderInsightsLeaderboard();
}

function renderInsightsBarChart() {
  const container = document.getElementById('insights-bar-chart');
  if (!container) return;

  // Occupancy rate by Chennai zone
  const data = [
    { zone: 'T. Nagar', rate: 84, color: 'var(--grad-teal)' },
    { zone: 'Mylapore', rate: 68, color: 'var(--grad-violet)' },
    { zone: 'Anna Nagar', rate: 74, color: 'var(--grad-teal)' },
    { zone: 'Adyar', rate: 90, color: 'var(--grad-violet)' },
    { zone: 'Guindy', rate: 58, color: 'var(--grad-teal)' },
    { zone: 'Marina', rate: 62, color: 'var(--grad-amber)' }
  ];

  container.innerHTML = data.map(d => {
    return `
      <div class="bar-col">
        <div class="bar-val">${d.rate}%</div>
        <div style="flex:1;display:flex;align-items:flex-end;width:100%;">
          <div class="bar-fill" style="height:${d.rate}%; background:${d.color}; opacity:0.85;"></div>
        </div>
        <div class="bar-label">${d.zone}</div>
      </div>`;
  }).join('');
}

function renderInsightsHeatmap() {
  const container = document.getElementById('insights-heatmap');
  if (!container) return;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Matrix of occupancy rates by Day (rows) and Time Blocks (columns)
  // Time Blocks: Morning (8am-12pm), Afternoon (12pm-4pm), Evening (4pm-8pm), Night (8pm-12am)
  const heatmapData = [
    [0.45, 0.60, 0.85, 0.50], // Mon
    [0.50, 0.55, 0.88, 0.55], // Tue
    [0.48, 0.58, 0.90, 0.60], // Wed
    [0.52, 0.65, 0.92, 0.65], // Thu
    [0.55, 0.70, 0.95, 0.85], // Fri
    [0.72, 0.85, 0.98, 0.90], // Sat
    [0.65, 0.80, 0.82, 0.70]  // Sun
  ];

  // Render headers
  let html = `
    <div style="font-size:9.5px;color:var(--text3);font-weight:700;display:flex;align-items:center;justify-content:center;">Day</div>
    <div style="font-size:9.5px;color:var(--text3);font-weight:700;text-align:center;padding:4px 0;">8AM-12PM</div>
    <div style="font-size:9.5px;color:var(--text3);font-weight:700;text-align:center;padding:4px 0;">12PM-4PM</div>
    <div style="font-size:9.5px;color:var(--text3);font-weight:700;text-align:center;padding:4px 0;">4PM-8PM</div>
    <div style="font-size:9.5px;color:var(--text3);font-weight:700;text-align:center;padding:4px 0;">8PM-12AM</div>
  `;

  // Render rows
  days.forEach((day, rIdx) => {
    html += `<div style="font-size:11px;font-weight:600;color:var(--text2);display:flex;align-items:center;padding:4px 0;">${day}</div>`;
    heatmapData[rIdx].forEach(val => {
      const color = val > 0.85 ? 'var(--teal)' : val > 0.60 ? '#a855f7' : 'var(--text3)';
      const pct = Math.round(val * 100);
      html += `
        <div class="heat-cell" 
             style="background:${color}; opacity:${val}; border: 1px solid var(--bg);" 
             title="Demand: ${pct}%"
             onmouseenter="this.style.transform='scale(1.15)';"
             onmouseleave="this.style.transform='scale(1)';">
        </div>`;
    });
  });

  // Since CSS grid was designed for 8 columns but this is a 5-column layout,
  // we will adjust the template inline for a nice 5-column layout.
  container.style.gridTemplateColumns = "0.7fr 1fr 1fr 1fr 1fr";
  container.style.gap = "6px";
  container.innerHTML = html;
}

function renderInsightsLeaderboard() {
  const container = document.getElementById('insights-leaderboard');
  if (!container) return;

  const topLots = [
    { rank: 1, name: 'Adyar Driveway — Mrs. Priya', category: 'Host Driveway', bookings: 142, revenue: '₹5,680', trend: '+14%' },
    { rank: 2, name: 'T. Nagar Central Hub', category: 'Commercial Lot', bookings: 120, revenue: '₹3,600', trend: '+8%' },
    { rank: 3, name: 'Guindy Host Garage — Mr. Senthil', category: 'Host Garage', bookings: 98, revenue: '₹3,430', trend: '+11%' }
  ];

  container.innerHTML = topLots.map(lot => {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:var(--r);transition:all .2s;"
           onmouseenter="this.style.borderColor='var(--border2)';this.style.background='rgba(255,255,255,0.03)'"
           onmouseleave="this.style.borderColor='var(--border)';this.style.background='rgba(255,255,255,0.01)'">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:22px;">${medals[lot.rank]}</div>
          <div>
            <div style="font-weight:700;font-size:13.5px;">${lot.name}</div>
            <div style="font-size:11.5px;color:var(--text3);">${lot.category} · <strong>${lot.bookings}</strong> bookings</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:800;color:var(--teal);">${lot.revenue}</div>
          <div style="font-size:10px;color:var(--teal);">${lot.trend} this week</div>
        </div>
      </div>`;
  }).join('');
}

// ==========================================
//  6. WHY PARK AI
// ==========================================
function renderDifferentiators() {
  // Triggers the standard counter animation routines
  document.querySelectorAll('#pane-why [data-target]').forEach(el => animateCounter(el));
}
