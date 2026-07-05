// ============================================================
//  PARK AI — Insights & Host Portal Modules (Production Ready)
// ============================================================

const HOST_LISTINGS = [
  { id:1, name:'Adyar Driveway', type:'Covered', spots:2, rate:40, status:'active', bookings:24, earned:3840, views:142 },
  { id:2, name:'T. Nagar Garage Slot', type:'Covered', spots:1, rate:50, status:'paused', bookings:11, earned:2200, views:67 },
];

async function renderHostListings() {
  const container = document.getElementById('host-listings');
  if (!container) return;

  // Load host listings from backend if logged in
  if (Auth.isAuthenticated()) {
    try {
      const res = await fetch('http://localhost:5000/api/host/listings', {
        headers: { 'Authorization': `Bearer ${Auth.token}` }
      });
      if (res.ok) {
        const serverListings = await res.json();
        // Merge or replace
        serverListings.forEach(sl => {
          const idx = HOST_LISTINGS.findIndex(hl => hl.id === sl.id);
          if (idx !== -1) {
            HOST_LISTINGS[idx] = sl;
          } else {
            HOST_LISTINGS.push(sl);
          }
        });
      }
    } catch (e) {
      console.warn("Could not sync host listings from backend.", e);
    }
  }

  container.innerHTML = HOST_LISTINGS.map(l => {
    let statusLabel = '🟢 Active';
    let statusClass = 'badge-teal';
    let toggleLabel = '⏸ Pause';

    if (l.status === 'paused' || l.status === 'inactive') {
      statusLabel = '⏸ Paused';
      statusClass = 'badge-violet';
      toggleLabel = '▶ Activate';
    } else if (l.status === 'pending') {
      statusLabel = '⏳ Pending Verification';
      statusClass = 'badge-amber';
      toggleLabel = '▶ Activate';
    }

    return `
    <div class="card card-sm" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-weight:700;font-size:15px;">${l.name}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px;">🏠 ${l.type} · ${l.spots} spot${l.spots>1?'s':''} · ₹${l.rate}/hr</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="badge badge-teal">📅 ${l.bookings || 0} bookings</span>
            <span class="badge badge-amber">💰 ₹${(l.earned || 0).toLocaleString()} earned</span>
            <span class="badge badge-blue">👁 ${l.views || 0} views</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          <span class="badge ${statusClass}">
            ${statusLabel}
          </span>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="editListing(${l.id})">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleListing(${l.id}, this)">
              ${toggleLabel}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function editListing(id) {
  const l = HOST_LISTINGS.find(x => x.id === id);
  if (!l) return;
  document.getElementById('edit-listing-id').value  = id;
  document.getElementById('edit-lot-name').value    = l.name;
  document.getElementById('edit-lot-type').value    = l.type;
  document.getElementById('edit-lot-spots').value   = l.spots;
  document.getElementById('edit-lot-rate').value    = l.rate;
  document.getElementById('edit-listing-overlay').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-listing-overlay').classList.remove('open');
}

async function saveEditListing() {
  const id    = parseInt(document.getElementById('edit-listing-id').value);
  const name  = document.getElementById('edit-lot-name').value.trim();
  const type  = document.getElementById('edit-lot-type').value;
  const spots = parseInt(document.getElementById('edit-lot-spots').value);
  const rate  = parseFloat(document.getElementById('edit-lot-rate').value);

  if (!name || !spots || !rate) {
    toast('Please fill in all fields', 'error');
    return;
  }

  const l = HOST_LISTINGS.find(x => x.id === id);
  if (!l) return;
  l.name  = name;
  l.type  = type;
  l.spots = spots;
  l.rate  = rate;

  // Persist to localStorage
  if (typeof DB !== 'undefined') DB.set('host_listings', HOST_LISTINGS);

  // Sync to backend if live
  if (Auth.isAuthenticated()) {
    try {
      const res = await fetch(`http://localhost:5000/api/listings/${id}/details`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.token}`
        },
        body: JSON.stringify({ name, type, spots, rate })
      });
      if (res.ok) toast('☁️ Updates synced to server DB', 'info');
    } catch (e) {}
  }

  renderHostListings();
  closeEditModal();
  toast(`✅ Listing "${name}" updated!`, 'success');
}

async function toggleListing(id, btn) {
  const l = HOST_LISTINGS.find(x => x.id === id);
  if (!l) return;
  const nextStatus = l.status === 'active' ? 'paused' : 'active';
  l.status = nextStatus;

  // Persist local
  if (typeof DB !== 'undefined') DB.set('host_listings', HOST_LISTINGS);

  // Sync backend
  if (Auth.isAuthenticated()) {
    try {
      const res = await fetch(`http://localhost:5000/api/listings/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) toast('☁️ Status updated on server', 'info');
    } catch (e) {}
  }

  renderHostListings();
  toast(nextStatus === 'active' ? '✅ Listing activated!' : '⏸ Listing paused.', nextStatus === 'active' ? 'success' : 'info');
}

function renderHostEarningsChart() {
  const container = document.getElementById('host-earnings-chart');
  if (!container) return;
  const weeks = ['W1','W2','W3','W4','W5','W6','W7','W8'];
  const vals  = [520, 840, 610, 990, 1120, 730, 1280, 1540];
  const max   = Math.max(...vals);
  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;height:110px;margin-bottom:8px;">
      ${weeks.map((w, i) => {
        const h = (vals[i] / max) * 100;
        const col = i === weeks.length-1 ? '#00ffd1' : '#a855f7';
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;" title="₹${vals[i]}">
            <div style="font-size:9px;color:${col};font-weight:700;">₹${vals[i]}</div>
            <div style="flex:1;display:flex;align-items:flex-end;width:100%;">
              <div style="width:100%;height:${h}%;background:${col};border-radius:5px 5px 0 0;min-height:3px;opacity:0.85;"></div>
            </div>
            <div style="font-size:10px;color:var(--text3);">${w}</div>
          </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;font-size:12px;color:var(--text2);">Weekly earnings — last 8 weeks</div>`;
}

async function submitNewListing() {
  if (!Auth.isAuthenticated()) {
    toast('🔑 Please login to list your space', 'warning');
    Auth.showAuthModal(() => submitNewListing());
    return;
  }

  const name  = document.getElementById('new-lot-name')?.value.trim();
  const spots = document.getElementById('new-lot-spots')?.value;
  const rate  = document.getElementById('new-lot-rate')?.value;
  const type  = document.getElementById('new-lot-type')?.value;
  const address = document.getElementById('new-lot-address')?.value.trim() || 'Chennai, India';

  if (!name || !spots || !rate) {
    toast('Please fill in all required fields', 'error');
    return;
  }

  // Generate random coords in Chennai center boundary box for map visualization
  const lat = 13.0475 + (Math.random() - 0.5) * 0.05;
  const lng = 80.2089 + (Math.random() - 0.5) * 0.05;

  const newListingRecord = {
    name, 
    type: type || 'Open',
    spots: parseInt(spots), 
    rate: parseInt(rate),
    address: address,
    lat: lat,
    lng: lng,
    status: 'pending' // Pending validation & approval
  };

  toast('Submitting listing for verification...', 'info');

  if (Auth.isAuthenticated()) {
    try {
      const res = await fetch('http://localhost:5000/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.token}`
        },
        body: JSON.stringify(newListingRecord)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit listing');
      
      const serverListing = data[0];
      HOST_LISTINGS.push(serverListing);
      toast(`🎉 Listing submitted successfully! Under verification.`, 'success');
    } catch (e) {
      toast(e.message, 'error');
      // local fallback
      HOST_LISTINGS.push({
        id: HOST_LISTINGS.length + 1,
        ...newListingRecord,
        bookings: 0, earned: 0, views: 0
      });
    }
  }

  // Update locally and clear forms
  if (typeof DB !== 'undefined') DB.set('host_listings', HOST_LISTINGS);
  renderHostListings();
  
  document.getElementById('new-lot-name').value  = '';
  document.getElementById('new-lot-spots').value = '';
  document.getElementById('new-lot-rate').value  = '';
  document.getElementById('new-lot-address').value = '';
}

// ---- SAFETY MODULE ----
function triggerSOS() {
  const btn = document.getElementById('sos-btn');
  if (btn) {
    btn.textContent = '🚨 SOS SENT — HELP IS COMING';
    btn.style.background = 'linear-gradient(135deg,#ff0040,#ff6b6b)';
    btn.disabled = true;
  }
  toast('🚨 SOS Alert sent! Emergency contact notified.', 'error', 6000);
  setTimeout(() => {
    if (btn) {
      btn.textContent = '🆘 EMERGENCY SOS';
      btn.style.background = '';
      btn.disabled = false;
    }
  }, 8000);
}

function reportIssue(type) {
  const msgs = {
    'damage': '🔧 Damage report submitted. Our team will respond within 2 hours.',
    'theft':  '🚔 Theft alert sent to Chennai Police PCR and lot security.',
    'light':  '💡 Lighting issue reported. Maintenance notified.',
    'cctv':   '📷 CCTV issue escalated to ops team.',
  };
  toast(msgs[type] || '✅ Issue reported!', 'warning');
}
