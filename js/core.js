// ============================================================
//  PARK AI — Core: Data, State, Utilities
// ============================================================

/* ---- PARKING LOTS DATA (Chennai) ---- */
const LOTS = [
  {
    id:1, name:"T. Nagar Central Hub", area:"T. Nagar",
    lat:13.0418, lng:80.2341,
    total:120, available:34, price:30,
    tags:["ev","covered","safe"], rating:4.8, dist:"0.2km",
    type:"commercial", host:false,
    desc:"Multi-level covered parking with EV charging, 24/7 CCTV.",
  },
  {
    id:2, name:"Mylapore Temple Lot", area:"Mylapore",
    lat:13.0339, lng:80.2696,
    total:60, available:12, price:20,
    tags:["safe"], rating:4.5, dist:"1.1km",
    type:"street", host:false,
    desc:"Open-air lot near Kapaleeswarar Temple. Well-lit at night.",
  },
  {
    id:3, name:"Anna Nagar EV Plaza", area:"Anna Nagar",
    lat:13.0878, lng:80.2100,
    total:80, available:55, price:25,
    tags:["ev","covered"], rating:4.9, dist:"3.4km",
    type:"ev_hub", host:false,
    desc:"Dedicated EV hub with CCS2, Type-2, and AC fast chargers.",
  },
  {
    id:4, name:"Marina Beachfront Parking", area:"Marina",
    lat:13.0500, lng:80.2824,
    total:200, available:88, price:15,
    tags:["safe"], rating:4.2, dist:"2.7km",
    type:"open", host:false,
    desc:"Large open lot near Marina Beach. Scenic walk to the shore.",
  },
  {
    id:5, name:"Adyar Home Driveway — Mrs. Priya", area:"Adyar",
    lat:13.0012, lng:80.2565,
    total:2, available:2, price:40,
    tags:["covered","host"], rating:5.0, dist:"4.2km",
    type:"host", host:true,
    desc:"Private gated driveway. Host verified. WhatsApp entry code sent on booking.",
  },
  {
    id:6, name:"Nungambakkam Corporate Bay", area:"Nungambakkam",
    lat:13.0569, lng:80.2425,
    total:150, available:0, price:50,
    tags:["covered","ev","safe"], rating:4.6, dist:"2.0km",
    type:"corporate", host:false,
    desc:"Premium corporate basement parking. Fully occupied currently.",
  },
  {
    id:7, name:"Velachery Signal Square", area:"Velachery",
    lat:12.9786, lng:80.2179,
    total:90, available:22, price:18,
    tags:["safe"], rating:4.1, dist:"8.1km",
    type:"street", host:false,
    desc:"Streetside metered parking. Good access to Phoenix Mall.",
  },
  {
    id:8, name:"Perambur EV Charging Hub", area:"Perambur",
    lat:13.1190, lng:80.2358,
    total:40, available:18, price:22,
    tags:["ev"], rating:4.7, dist:"5.6km",
    type:"ev_hub", host:false,
    desc:"TATA Power EV fast charging station with 7.2 kW AC chargers.",
  },
  {
    id:9, name:"Guindy Host Garage — Mr. Senthil", area:"Guindy",
    lat:13.0067, lng:80.2206,
    total:3, available:1, price:35,
    tags:["covered","host"], rating:4.9, dist:"6.3km",
    type:"host", host:true,
    desc:"Private covered garage near Guindy Estate. Secure with lock.",
  },
  {
    id:10, name:"Besant Nagar Beachside Lot", area:"Besant Nagar",
    lat:13.0002, lng:80.2697,
    total:50, available:30, price:12,
    tags:[], rating:4.0, dist:"5.8km",
    type:"open", host:false,
    desc:"Open lot near Elliot's Beach. Popular evenings and weekends.",
  },
];

/* ---- APP STATE ---- */
const State = {
  currentTab:    'overview',
  selectedLot:   null,
  bookingLot:    null,
  bookingDur:    1,
  activeBooking: null,
  bookingTimer:  null,
  evBattPct:     45,
  hostMode:      false,
  weatherData:   null,
  mapZoom:       13,
  markers:       {},
  feeds:         [],
  translations:  {},
  currentLang:   'en',
};

/* ---- TRANSLATIONS ---- */
const TRANSLATIONS = {
  en: {
    heroLine1: "Smart Parking",
    heroLine2: "Where Empty Driveways Become Income",
    heroDesc: "Find, book, and pay for parking in seconds. Home driveways, EV charging, and weather-covered spaces — all live.",
    findBtn: "Find Parking Now →",
    hostBtn: "🏠 Host Your Space",
    bookNow: "Book Now →",
    available: "Available",
    cancel: "Cancel",
    confirm: "Confirm Booking",
  },
  ta: {
    heroLine1: "ஸ்மார்ட் பார்க்கிங்",
    heroLine2: "ஒவ்வொரு சென்னை ஓட்டுனருக்கும்",
    heroDesc: "நொடிகளில் வாகன நிறுத்துமிட இடங்களை கண்டுபிடி, முன்பதிவு செய்து, பணம் செலுத்துங்கள்.",
    findBtn: "இப்போது இடம் தேடு →",
    hostBtn: "🏠 உங்கள் இடத்தை வழங்கு",
    bookNow: "இப்போது முன்பதிவு செய் →",
    available: "கிடைக்கிறது",
    cancel: "ரத்து செய்",
    confirm: "முன்பதிவை உறுதிசெய்",
  },
  hi: {
    heroLine1: "स्मार्ट पार्किंग",
    heroLine2: "हर चेन्नई ड्राइवर के लिए",
    heroDesc: "सेकंडों में पार्किंग खोजें, बुक करें और भुगतान करें। होम ड्राइववे, EV चार्जिंग और ढके हुए स्थान — सब लाइव।",
    findBtn: "अभी पार्किंग खोजें →",
    hostBtn: "🏠 अपनी जगह होस्ट करें",
    bookNow: "अभी बुक करें →",
    available: "उपलब्ध",
    cancel: "रद्द करें",
    confirm: "बुकिंग की पुष्टि करें",
  },
};

/* ---- UTILITIES ---- */
let toastCount = 0;
function toast(msg, type='info', duration=3500) {
  const tc = document.getElementById('toast-container');
  if (!tc) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✅', error:'🚨', info:'ℹ️', warning:'⚠️' };
  el.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  tc.appendChild(el);
  toastCount++;
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function fmt(n) {
  if (n >= 1000) return (n/1000).toFixed(1)+'k';
  return n.toString();
}

function availClass(lot) {
  const pct = lot.available / lot.total;
  if (lot.available === 0) return 'avail avail-low';
  if (pct < 0.3) return 'avail avail-mid';
  return 'avail avail-good';
}
function availText(lot) {
  if (lot.available === 0) return '● FULL';
  if (lot.available / lot.total < 0.3) return `● ${lot.available} left`;
  return `● ${lot.available} free`;
}

function getMarkerColor(lot) {
  if (lot.available === 0) return '#ff3366';
  if (lot.available / lot.total < 0.3) return '#ffb830';
  return '#00ffd1';
}

function getTagHTML(tags) {
  return tags.map(t => {
    const labels = { ev:'⚡ EV', covered:'🏠 Covered', safe:'🛡 Safe', host:'👤 Host' };
    return `<span class="popup-tag ${t}">${labels[t]||t}</span>`;
  }).join('');
}

function genSpotCode() {
  const rows = ['A','B','C','D'];
  return rows[Math.floor(Math.random()*rows.length)] + '-' + (Math.floor(Math.random()*90)+10);
}

function genBookingId() {
  return 'PL' + Date.now().toString().slice(-6).toUpperCase();
}

/* ---- CLOCK ---- */
function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

/* ---- LIVE FEED DATA ---- */
const FEED_TEMPLATES = [
  (lot) => `<strong>${randomName()}</strong> booked slot ${genSpotCode()} at <strong>${lot.name}</strong>`,
  (lot) => `⚡ EV charger freed at <strong>${lot.name}</strong>`,
  () => `🌧 Rain surge: covered lots +₹10 surcharge active`,
  (lot) => `<strong>${randomName()}</strong> rated <strong>${lot.name}</strong> ⭐ 5.0`,
  () => `🛡 Safety alert cleared — all clear in T. Nagar zone`,
  (lot) => `<strong>${randomName()}</strong> extended booking at <strong>${lot.name}</strong> by 1 hr`,
];
const NAMES = ['Arjun Kumar','Priya Rajan','Senthil D.','Meena V.','Karthik P.','Divya S.','Ravi N.','Ananya M.'];
function randomName() { return NAMES[Math.floor(Math.random()*NAMES.length)]; }
function randomLot() { return LOTS[Math.floor(Math.random()*LOTS.length)]; }

function generateFeedItem() {
  const template = FEED_TEMPLATES[Math.floor(Math.random()*FEED_TEMPLATES.length)];
  return template(randomLot());
}

function initFeed() {
  const container = document.getElementById('live-feed');
  if (!container) return;
  // seed initial feed
  const seeds = [
    { icon:'🚗', text:`<strong>Arjun Kumar</strong> booked slot A-42 at <strong>T. Nagar Central Hub</strong>`, time:'Just now' },
    { icon:'⚡', text:`CCS2 charger freed at <strong>Anna Nagar EV Plaza</strong>`, time:'3 min ago' },
    { icon:'🌧', text:`Rain alert: covered lots pricing surge activated`, time:'11 min ago' },
    { icon:'🛡', text:`<strong>Priya Rajan</strong> verified as Host — Adyar listing live`, time:'28 min ago' },
    { icon:'🚗', text:`<strong>Karthik P.</strong> extended booking at <strong>Guindy Host Garage</strong> by 1hr`, time:'1 hr ago' },
  ];
  seeds.forEach(s => addFeedItem(container, s.icon, s.text, s.time));

  setInterval(() => {
    const item = generateFeedItem();
    addFeedItem(container, '🚗', item, 'Just now');
    // update older items
    container.querySelectorAll('.feed-time').forEach((el, i) => {
      if (i > 0) el.textContent = `${i*3} min ago`;
    });
    // cap feed at 8
    while (container.children.length > 8) container.removeChild(container.lastChild);
  }, 6000);
}

function addFeedItem(container, icon, text, time) {
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.style.animation = 'fadein .4s ease both';
  div.innerHTML = `
    <div class="feed-icon">${icon}</div>
    <div>
      <div class="feed-text">${text}</div>
      <div class="feed-time">${time}</div>
    </div>`;
  container.prepend(div);
}

/* ---- TRANSLATION ENGINE ---- */
function applyLang(lang) {
  State.currentLang = lang;
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const map = {
    'hero-line1': t.heroLine1,
    'hero-line2': t.heroLine2,
    'hero-desc':  t.heroDesc,
    'cta-find':   t.findBtn,
    'cta-host':   t.hostBtn,
    'lang-card-btn-text': t.bookNow,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
  toast(`🌐 Language changed to ${lang.toUpperCase()}`, 'info');
}

/* ---- COUNTER ANIMATION ---- */
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const duration = 1400;
  const start = performance.now();
  function step(now) {
    const pct = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1-pct, 4);
    const val = Math.floor(ease * target);
    el.textContent = (val >= 1000 ? (val/1000).toFixed(1)+'k' : val) + suffix;
    if (pct < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        animateCounter(el);
        observer.disconnect();
      }
    });
    observer.observe(el);
  });
}

/* ---- TAB SWITCHING ---- */
function syncMobileNav(activeEl) {
  document.querySelectorAll('#mobile-nav .nav-item').forEach(n => n.classList.remove('active'));
  if (activeEl) activeEl.classList.add('active');
}

function switchTab(tabId, el) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pane = document.getElementById('pane-'+tabId);
  if (pane) pane.classList.add('active');
  if (el) el.classList.add('active');
  State.currentTab = tabId;

  // Keep mobile nav in sync with sidebar nav (and vice-versa)
  document.querySelectorAll('#mobile-nav [data-tab="'+tabId+'"]').forEach(n => n.classList.add('active'));
  document.querySelectorAll('.sidebar [data-tab="'+tabId+'"]').forEach(n => n.classList.add('active'));

  // Lazy-init sections
  if (tabId === 'map' && !State.mapInit) initMap();
  if (tabId === 'ev')       initEV();
  if (tabId === 'weather')  initWeather();
  if (tabId === 'insights') initInsights();
  if (tabId === 'host')     initHost();
  if (tabId === 'iot')      initIoT();
  if (tabId === 'why')      { renderDifferentiators(); setTimeout(() => document.querySelectorAll('#pane-why [data-target]').forEach(el => animateCounter(el)), 100); }
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initCounters();
  initFeed();
  // Lang selector
  const langSel = document.getElementById('lang-select');
  if (langSel) langSel.addEventListener('change', e => applyLang(e.target.value));
  // Init map on page load (overview tab)
  setTimeout(() => {}, 100);
});

/* ---- LEGAL POLICIES & COMPLIANCE ---- */
function closeLegalModal() {
  document.getElementById('legal-modal-overlay')?.classList.remove('open');
}

function showLegal(type) {
  const overlay = document.getElementById('legal-modal-overlay');
  const title = document.getElementById('legal-title');
  const body = document.getElementById('legal-body');
  if (!overlay || !title || !body) return;

  const content = {
    tos: `
      <h3 style="color:var(--text);margin-bottom:8px;">PARK AI — Terms of Service</h3>
      <p style="margin-bottom:12px;">Welcome to PARK AI (the "Platform"). By using our website, service, or hardware interfaces in India, you agree to comply with and be bound by these Terms of Service (under Indian Information Technology Act, 2000).</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">1. User Accounts & Verification</h4>
      <p style="margin-bottom:12px;">Users booking or listing parking spots must authenticate using a verified mobile phone number. You are responsible for maintaining the accuracy of your vehicle registration details (e.g. state-issued license plate) and contact information.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">2. Payment & Service Charges</h4>
      <p style="margin-bottom:12px;">All payments are securely handled via integrated payment gateways (Razorpay). Booking fees are split into a base parking charge (paid to the host, minus a 12% platform processing fee) and regulatory GST of 18%. Confirmations are generated only upon successful authorization from the bank.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">3. Cancellation & Refunds</h4>
      <p style="margin-bottom:12px;">Cancellations are permitted up to 30 minutes prior to the booked slot start time. Upon valid cancellation, the fee is refunded automatically to the original source payment instrument within 5-7 working days. Extensions are subject to slot availability and dynamic billing rates.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">4. Liability & Insurance Disclaimers</h4>
      <p style="margin-bottom:12px;">Hosts listing their driveways assert that they possess legal ownership or licensing rights to authorize parking. While PARK AI provides support alerts and security console integrations (CCTV alerts, SOS dispatch), the platform does not assume direct custody over vehicles. PARK AI assumes no liability for theft, mechanical damage, or lockouts inside private garages.</p>
    `,
    privacy: `
      <h3 style="color:var(--text);margin-bottom:8px;">PARK AI — Privacy Policy</h3>
      <p style="margin-bottom:12px;">This policy describes how we collect, store, and process personal data in compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act, India)**.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">1. Data We Collect</h4>
      <ul style="margin:0 0 12px 20px; list-style-type:disc;">
        <li>Mobile Phone Numbers (collected via secure SMS OTP)</li>
        <li>Vehicle Registration Numbers (needed to verify parking rights)</li>
        <li>GPS Geolocation (used to search for closest parking lots)</li>
        <li>Transaction & Payment References (order ID, status)</li>
      </ul>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">2. Use of Your Personal Data</h4>
      <p style="margin-bottom:12px;">Data is processed solely for verifying reservation validity, completing payouts to hosts, routing emergency SOS triggers, and displaying real-time space coordinates on Leaflet map layers. We do not sell or trade user databases to external brokers.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">3. Security Controls</h4>
      <p style="margin-bottom:12px;">All communications are served over encrypted HTTPS channels. Access logs are archived securely in SQLite databases. Sensor nodes (ESP32) publish only telemetry data (distance, signal status) without any personally identifiable renter information.</p>
      
      <h4 style="color:var(--text);margin:12px 0 6px;">4. User Rights (Consent Withdrawal)</h4>
      <p style="margin-bottom:12px;">Under the DPDP Act, you have the right to request deletion of your account, vehicle records, and saved booking history. To execute this, please contact support or delete your local browser history from the dashboard.</p>
    `
  };

  title.textContent = type === 'tos' ? '📜 Terms of Service' : '🛡 Privacy Policy (DPDP)';
  body.innerHTML = content[type] || 'Content not found.';
  overlay.classList.add('open');
}
