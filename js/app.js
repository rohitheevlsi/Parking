// ---- OVERVIEW: Quick Book list ----
function renderQuickBook() {
  const el = document.getElementById('quick-book-list');
  if (!el) return;
  const top = [...LOTS].filter(l => l.available > 0).sort((a,b) => b.available/b.total - a.available/a.total).slice(0,4);
  el.innerHTML = top.map(l => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <div style="font-weight:700;font-size:13.5px;">${l.name}</div>
        <div style="font-size:11.5px;color:var(--text3);">📍 ${l.area} · ${l.dist} · ⭐ ${l.rating}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-display);font-size:18px;">₹${l.price}</div>
        <div style="font-size:10px;color:var(--text3);">/hr</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openBooking(${l.id})">Book</button>
    </div>`).join('');
}

// ======== HOST PORTAL EXTRA JS ========

// How it works steps
function renderHowItWorks() {
  const grid = document.getElementById('how-it-works-grid');
  if (!grid) return;
  const steps = [
    { icon:'📍', title:'List Your Space', desc:'Add your driveway or garage in 5 minutes. Set your price and availability hours.' },
    { icon:'🔔', title:'Get Booking Alerts', desc:'Renters book instantly. You get an SMS and app notification with their vehicle number.' },
    { icon:'🚗', title:'They Park Safely', desc:'Renter gets a PIN/code for your gate. CCTV and PARK AI insurance covers any issues.' },
    { icon:'💰', title:'Get Paid', desc:'Money auto-transfers to your UPI/bank account within 24 hours. Zero manual effort.' },
  ];
  grid.innerHTML = steps.map((s, i) => `
    <div style="text-align:center;padding:20px 16px;background:var(--surface);border:1px solid var(--border);border-radius:20px;position:relative;transition:all .3s;"
         onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(168,85,247,0.3)'"
         onmouseleave="this.style.transform='';this.style.borderColor='var(--border)'">
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(0,255,209,0.1));border:1px solid rgba(168,85,247,0.2);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px;">
        ${s.icon}
      </div>
      <div style="position:absolute;top:46px;left:-8px;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#00ffd1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#030307;">${i+1}</div>
      <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${s.title}</div>
      <div style="font-size:12.5px;color:var(--text2);line-height:1.6;">${s.desc}</div>
    </div>`).join('');
}

// Earnings calculator
function calcEarnings() {
  const rate  = parseFloat(document.getElementById('calc-rate')?.value) || 40;
  const hours = parseFloat(document.getElementById('calc-hours')?.value) || 8;
  const days  = parseFloat(document.getElementById('calc-days')?.value) || 5;
  const occ   = parseFloat(document.getElementById('calc-occ')?.value) || 0.65;
  const fee   = 0.88; // 12% platform fee

  const perDay   = rate * hours * occ * fee;
  const perMonth = perDay * days * 4.33;
  const perYear  = perMonth * 12;

  const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const dayEl   = document.getElementById('earn-day');
  const monthEl = document.getElementById('earn-month');
  const yearEl  = document.getElementById('earn-year');
  if (dayEl)   dayEl.textContent   = fmt(perDay);
  if (monthEl) monthEl.textContent = fmt(perMonth);
  if (yearEl)  yearEl.textContent  = fmt(perYear);
}

// Host/Renter view toggle
function setHostView(view) {
  const hostView   = document.getElementById('host-view');
  const renterView = document.getElementById('renter-view');
  const hostBtn    = document.getElementById('view-host-btn');
  const renterBtn  = document.getElementById('view-renter-btn');
  if (!hostView || !renterView) return;

  if (view === 'host') {
    hostView.style.display   = 'block';
    renterView.style.display = 'none';
    hostBtn.style.background = 'linear-gradient(135deg,#a855f7,#ec4899)';
    hostBtn.style.color      = '#fff';
    renterBtn.style.background = 'transparent';
    renterBtn.style.color    = 'var(--text2)';
  } else {
    hostView.style.display   = 'none';
    renterView.style.display = 'block';
    renterBtn.style.background = 'linear-gradient(135deg,#00ffd1,#0ea5e9)';
    renterBtn.style.color    = '#030307';
    hostBtn.style.background = 'transparent';
    hostBtn.style.color      = 'var(--text2)';
    renderRenterListings();
  }
}

// Renter listings (private home spaces)
function renderRenterListings() {
  const grid = document.getElementById('renter-listings-grid');
  if (!grid) return;
  const hostLots = LOTS.filter(l => l.host);
  grid.innerHTML = hostLots.map(l => `
    <div style="padding:22px;background:var(--surface);border:1px solid var(--border);border-radius:20px;transition:all .3s;"
         onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(168,85,247,0.3)'"
         onmouseleave="this.style.transform='';this.style.borderColor='var(--border)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${l.name}</div>
          <div style="font-size:12px;color:var(--text3);">📍 ${l.area} · ${l.dist} away</div>
        </div>
        <span class="badge badge-violet" style="font-size:10px;">👤 Private</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.5;">${l.desc}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
        ${l.tags.map(t => {
          const info = { ev:'⚡ EV', covered:'🏠 Covered', safe:'🛡 Safe', host:'👤 Verified Host' };
          const cls  = { ev:'badge-teal', covered:'badge-blue', safe:'badge-red', host:'badge-violet' };
          return `<span class="badge ${cls[t]||'badge-blue'}" style="font-size:10px;">${info[t]||t}</span>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--text);">₹${l.price}<span style="font-size:13px;font-weight:400;color:var(--text3);">/hr</span></div>
          <div style="font-size:11px;color:var(--teal);">⭐ ${l.rating} · ${l.available} spot${l.available!==1?'s':''} free</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openBooking(${l.id})">Book Now →</button>
      </div>
    </div>`).join('');
}

// Live listing preview
function updateListingPreview() {
  const preview = document.getElementById('listing-preview');
  if (!preview) return;
  const name  = document.getElementById('new-lot-name')?.value || '';
  const spots = document.getElementById('new-lot-spots')?.value || '';
  const rate  = document.getElementById('new-lot-rate')?.value || '';
  const type  = document.getElementById('new-lot-type')?.value || '';

  if (!name && !rate) {
    preview.innerHTML = '<div style="font-size:12.5px;color:var(--text3);text-align:center;">Fill in details above to see preview</div>';
    return;
  }

  const typeIcon = { Covered:'🏠', Open:'🌳', Basement:'🏢' };
  preview.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-weight:700;font-size:15px;">${name || 'Your Listing Name'}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:3px;">${typeIcon[type]||'🏠'} ${type} · Chennai</div>
      </div>
      <span class="badge badge-violet" style="font-size:10px;">👤 Private Host</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:22px;font-weight:800;">${rate ? '₹'+rate : '₹—'}<span style="font-size:13px;font-weight:400;color:var(--text3);">/hr</span></div>
      <div style="font-size:12.5px;color:var(--teal);">⭐ New listing · ${spots||'0'} spot${spots!=1?'s':''}</div>
    </div>`;

  // Highlight steps
  ['lstep1','lstep2','lstep3','lstep4'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const filled = name && spots && rate;
    if (i === 0 || (i <= 2 && filled)) {
      el.style.background = 'rgba(168,85,247,0.1)';
      el.style.borderColor = 'rgba(168,85,247,0.25)';
      el.style.color = '#c084fc';
    }
  });
}

function initHost() {
  if (State.hostInit) return;
  State.hostInit = true;
  renderHostListings();
  renderHostEarningsChart();
  renderHowItWorks();
  calcEarnings();
  // Animate counters in host view
  setTimeout(() => {
    document.querySelectorAll('#pane-host [data-target]').forEach(el => animateCounter(el));
  }, 100);
}

// ================================================================
//  PERSISTENCE & REAL API INTEGRATIONS
// ================================================================

const DB = {
  _key: k => 'parkai_' + k,
  get(k)    { try { return JSON.parse(localStorage.getItem(DB._key(k))); } catch(e) { return null; } },
  set(k, v) { try { localStorage.setItem(DB._key(k), JSON.stringify(v)); } catch(e) {} },
  push(k, v){ const arr = DB.get(k) || []; arr.unshift(v); DB.set(k, arr.slice(0,50)); },
  all(k)    { return DB.get(k) || []; },
};

// Restore active booking on load
function restoreSession() {
  const bookings = DB.all('bookings');
  if (bookings.length === 0) return;
  const latest = bookings[0];
  const elapsed = (Date.now() - latest.ts) / 1000;
  const totalSecs = latest.dur * 3600;
  if (elapsed < totalSecs) {
    const lot = LOTS.find(l => l.id === latest.lot.id) || latest.lot;
    State.activeBooking = { ...latest, lot, endTime: latest.ts + latest.dur * 3600 * 1000 };
    renderActiveBooking();
    toast(`🔄 Session restored: Slot ${latest.spot} at ${latest.lot.name}`, 'info', 5000);
  }
}

// Restore host listings on load
function restoreHostListings() {
  const saved = DB.get('host_listings');
  if (saved && saved.length > HOST_LISTINGS.length) {
    saved.forEach(s => {
      if (!HOST_LISTINGS.find(l => l.id === s.id)) HOST_LISTINGS.push(s);
    });
  }
}

// Show booking history from the real server DB if logged in, else fallback to localStorage
async function renderBookingHistory() {
  const el = document.getElementById('booking-history-list');
  if (!el) return;

  if (Auth.isAuthenticated()) {
    try {
      const res = await fetch('http://localhost:5000/api/bookings', {
        headers: { 'Authorization': `Bearer ${Auth.token}` }
      });
      if (res.ok) {
        const bookings = await res.json();
        if (bookings.length === 0) {
          el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center;">No bookings yet. Book a spot!</div>';
          return;
        }
        el.innerHTML = bookings.map(b => {
          const start = new Date(b.start_time);
          const formattedDate = start.toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          let statusBadge = `<span class="badge badge-teal" style="font-size:10px;margin-top:4px;">✅ Confirmed</span>`;
          if (b.status === 'cancelled') {
            statusBadge = `<span class="badge badge-red" style="font-size:10px;margin-top:4px;">❌ Cancelled</span>`;
          }
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border);">
            <div>
              <div style="font-weight:700;font-size:14px;">${b.lot_name}</div>
              <div style="font-size:12px;color:var(--text2);">Slot <strong>${b.spot_code}</strong> · ${b.vehicle} · ${b.duration_hrs}hr</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${formattedDate}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800;color:var(--teal);">₹${b.total_paid}</div>
              ${statusBadge}
            </div>
          </div>`;
        }).join('');
        return;
      }
    } catch (e) {
      console.warn("Could not load bookings from live server, using local database fallback.", e);
    }
  }

  // Fallback to localStorage
  const bookings = DB.all('bookings');
  if (bookings.length === 0) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center;">No bookings yet. Book a spot!</div>';
    return;
  }
  el.innerHTML = bookings.map(b => {
    const ago = Math.round((Date.now() - b.ts) / 60000);
    const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago/60)}h ago` : `${Math.round(ago/1440)}d ago`;
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:700;font-size:14px;">${b.lot.name}</div>
        <div style="font-size:12px;color:var(--text2);">Slot <strong>${b.spot}</strong> · ${b.vehicle} · ${b.dur}hr</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${agoStr}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;color:var(--teal);">₹${b.total}</div>
        <span class="badge badge-teal" style="font-size:10px;margin-top:4px;">✅ Done</span>
      </div>
    </div>`;
  }).join('');
}

// Show live / local status badge
function renderBackendStatus() {
  const el = document.getElementById('backend-status');
  if (!el) return;
  if (typeof BACKEND !== 'undefined' && BACKEND.enabled) {
    el.innerHTML = `<span class="badge badge-teal" style="font-size:10.5px;">🟢 Live Python Server Connected</span>`;
  } else {
    // If backend script loads but server not active, we still check server connection
    fetch('http://localhost:5000/api/bookings?limit=1')
      .then(res => {
        if (res.ok) {
          el.innerHTML = `<span class="badge badge-teal" style="font-size:10.5px;">🟢 Live Python Server Connected</span>`;
          if (typeof BACKEND !== 'undefined') BACKEND.enabled = true;
        } else throw new Error();
      })
      .catch(() => {
        el.innerHTML = `<span class="badge badge-amber" style="font-size:10.5px;">💾 Local storage fallback (Server offline)</span>`;
      });
  }
}

// Full DOMContentLoaded init
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user authentication
  Auth.init();

  if (typeof BACKEND !== 'undefined') {
    await BACKEND.init();
  }
  renderBackendStatus();

  // Restore state
  restoreSession();
  restoreHostListings();
  renderQuickBook();

  // Animate counters
  document.querySelectorAll('#pane-overview [data-target]').forEach(el => animateCounter(el));

  setTimeout(() => {
    renderBookingHistory();
    calcEarnings();
  }, 400);
});
