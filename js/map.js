// ============================================================
//  PARK AI — Map Module (Leaflet.js & Real Geolocation)
// ============================================================

let leafletMap = null;
let userCoords = null; // Stores real user latitude/longitude if available

function initMap() {
  if (State.mapInit) return;
  State.mapInit = true;

  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  leafletMap = L.map('leaflet-map', {
    center: [13.0478, 80.2400],
    zoom: 13,
    zoomControl: false,
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(leafletMap);

  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  // Trigger geolocation sorting on initialization
  detectUserLocation();

  // Plot all lots
  LOTS.forEach(lot => addMarker(lot));

  // Slot list sidebar
  renderSlotList();
  updateMapStats();
}

function addMarker(lot) {
  const color = getMarkerColor(lot);
  const size = lot.available === 0 ? 26 : 32;

  const icon = L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid rgba(255,255,255,0.9);
        box-shadow:0 4px 18px ${color}80;
        cursor:pointer;
        transition:transform .2s;
      "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
  });

  const marker = L.marker([lot.lat, lot.lng], { icon }).addTo(leafletMap);

  const priceTxt = `₹${lot.price}/hr`;
  const availTxt = lot.available === 0
    ? '<span style="color:#ff3366;font-weight:700;">● FULL</span>'
    : `<span style="color:#00ffd1;font-weight:700;">● ${lot.available} free</span>`;

  marker.bindPopup(`
    <div style="min-width:220px;">
      <div class="popup-title">${lot.name}</div>
      <div class="popup-tags">${getTagHTML(lot.tags)}</div>
      <div class="popup-price">${priceTxt}</div>
      <div class="popup-row"><span>Availability</span>${availTxt}</div>
      <div class="popup-row"><span>Total slots</span><span>${lot.total}</span></div>
      <div class="popup-row"><span>Rating</span><span>⭐ ${lot.rating}</span></div>
      <div class="popup-row"><span>Distance</span><span>${lot.dist}</span></div>
      <div style="font-size:11.5px;color:#64748b;margin:8px 0;">${lot.desc}</div>
      ${lot.available > 0
        ? `<button class="popup-btn" onclick="openBooking(${lot.id})">Book Now →</button>`
        : `<div style="text-align:center;padding:9px;background:rgba(255,51,102,0.08);border-radius:10px;color:#ff3366;font-weight:700;font-size:12px;">No Slots Available</div>`
      }
    </div>
  `, { maxWidth: 260 });

  marker.on('click', () => {
    State.selectedLot = lot;
    highlightSlot(lot.id);
  });

  State.markers[lot.id] = marker;
}

function renderSlotList(filter = 'all') {
  const container = document.getElementById('slot-list');
  if (!container) return;

  let filtered = LOTS;
  if (filter === 'ev') filtered = LOTS.filter(l => l.tags.includes('ev'));
  else if (filter === 'host') filtered = LOTS.filter(l => l.host);
  else if (filter === 'available') filtered = LOTS.filter(l => l.available > 0);

  // If user coordinates exist, sort slots by distance dynamically
  if (userCoords) {
    filtered.sort((a, b) => {
      const distA = getDistanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng);
      const distB = getDistanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng);
      return distA - distB;
    });
  }

  container.innerHTML = filtered.map(lot => {
    let displayDist = lot.dist;
    if (userCoords) {
      const actualDist = getDistanceKm(userCoords.lat, userCoords.lng, lot.lat, lot.lng);
      displayDist = `${actualDist.toFixed(1)} km`;
      lot.dist = displayDist; // Keep data in sync
    }

    return `
    <div class="slot-item ${State.selectedLot?.id === lot.id ? 'selected' : ''}"
         id="slot-${lot.id}"
         onclick="selectSlot(${lot.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="slot-name">${lot.name}</div>
          <div class="slot-meta">
            <span>📍 ${lot.area}</span>
            <span>⭐ ${lot.rating}</span>
            <span>${displayDist}</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;">
            ${lot.tags.map(t => {
              const info = { ev:'⚡ EV', covered:'🏠 Covered', safe:'🛡 Safe', host:'👤 Host' };
              const cls =  { ev:'badge-teal', covered:'badge-blue', safe:'badge-red', host:'badge-violet' };
              return `<span class="badge ${cls[t]||'badge-blue'}" style="font-size:10px;padding:2px 8px;">${info[t]||t}</span>`;
            }).join('')}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="slot-price-large">₹${lot.price}</div>
          <div style="font-size:10.5px;color:var(--text3);">/ hour</div>
          <div class="mt-1"><span class="${availClass(lot)}">${availText(lot)}</span></div>
        </div>
      </div>
      ${lot.available > 0
        ? `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;"
             onclick="event.stopPropagation();openBooking(${lot.id})">
             Book Now →
           </button>`
        : `<div style="margin-top:12px;text-align:center;font-size:12px;color:var(--red);font-weight:600;">● No slots available</div>`
      }
    </div>`;
  }).join('');
}

function highlightSlot(id) {
  document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`slot-${id}`);
  if (el) {
    el.classList.add('selected');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function selectSlot(id) {
  const lot = LOTS.find(l => l.id === id);
  if (!lot) return;
  State.selectedLot = lot;
  highlightSlot(id);
  leafletMap?.flyTo([lot.lat, lot.lng], 15, { animate: true, duration: 1 });
  State.markers[id]?.openPopup();
}

function updateMapStats() {
  const totalFree = LOTS.reduce((s, l) => s + l.available, 0);
  const evFree = LOTS.filter(l => l.tags.includes('ev')).reduce((s, l) => s + l.available, 0);
  const hostFree = LOTS.filter(l => l.host).reduce((s, l) => s + l.available, 0);
  const statFree = document.getElementById('map-stat-free');
  const statEv   = document.getElementById('map-stat-ev');
  const statHost = document.getElementById('map-stat-host');
  if (statFree) statFree.textContent = totalFree;
  if (statEv)   statEv.textContent   = evFree;
  if (statHost) statHost.textContent = hostFree;
}

// Filter buttons
function setMapFilter(type, el) {
  document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderSlotList(type);
}

// Helper: Haversine distance formula
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Check real browser location
function detectUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log("Real Geolocation detected:", userCoords);
        renderSlotList(); // Re-render to sort by distance
        toast('📍 Distance calculations updated with your live location!', 'success');
      },
      (error) => {
        console.warn("Geolocation permission denied or failed:", error);
      }
    );
  }
}

// Fly to user location using real geolocation if active, else fallback to Chennai center
function flyToMe() {
  if (!leafletMap) return;
  if (userCoords) {
    leafletMap.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 1.2 });
    toast('📍 Centered on your actual location', 'success');
  } else {
    // Check again
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        leafletMap.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 1.2 });
        renderSlotList();
        toast('📍 Centered on your actual location', 'success');
      }, () => {
        leafletMap.flyTo([13.0478, 80.2400], 13, { duration: 1.2 });
        toast('📍 Centered on Chennai center (Default)', 'info');
      });
    } else {
      leafletMap.flyTo([13.0478, 80.2400], 13, { duration: 1.2 });
      toast('📍 Centered on Chennai center (Default)', 'info');
    }
  }
}
