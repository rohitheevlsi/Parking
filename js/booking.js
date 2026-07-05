// ============================================================
//  PARK AI — Booking Module (Production Ready)
// ============================================================

function openBooking(lotId) {
  // Guard clause: requires authentication
  if (!Auth.isAuthenticated()) {
    toast('🔑 Please login to book a spot', 'warning');
    Auth.showAuthModal(() => openBooking(lotId));
    return;
  }

  const lot = LOTS.find(l => l.id === lotId);
  if (!lot || lot.available === 0) return toast('No slots available', 'error');

  State.bookingLot = lot;
  State.bookingDur = 1;

  const overlay = document.getElementById('booking-overlay');
  const form    = document.getElementById('booking-form');
  const success = document.getElementById('booking-success');
  if (!overlay) return;

  form.style.display    = 'block';
  success.style.display = 'none';

  // Populate
  document.getElementById('bk-lot-name').textContent    = lot.name;
  document.getElementById('bk-lot-area').textContent    = lot.area;
  document.getElementById('bk-lot-tags').innerHTML      = getTagHTML(lot.tags);
  document.getElementById('bk-base-price').textContent  = `₹${lot.price}`;
  document.getElementById('bk-vehicle').value           = Auth.user?.vehicle_no || '';

  // Set default date & time (now)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  document.getElementById('bk-date').value = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('bk-start-time').value = `${hours}:${minutes}`;

  setBookingDur(1);
  overlay.classList.add('open');
}

function closeBooking() {
  document.getElementById('booking-overlay')?.classList.remove('open');
  clearInterval(State.bookingTimer);
}

function setBookingDur(hrs, el) {
  State.bookingDur = hrs;
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    const btns = document.querySelectorAll('.dur-btn');
    btns.forEach(b => { if (parseInt(b.dataset.hr) === hrs) b.classList.add('active'); });
  }
  updatePriceBreakdown();
}

function updatePriceBreakdown() {
  const lot = State.bookingLot;
  if (!lot) return;
  const base    = lot.price * State.bookingDur;
  const service = Math.round(base * 0.05);
  const gst     = Math.round(base * 0.18);
  const total   = base + service + gst;

  document.getElementById('bk-price-base').textContent    = `₹${base}`;
  document.getElementById('bk-price-service').textContent = `₹${service}`;
  document.getElementById('bk-price-gst').textContent     = `₹${gst}`;
  document.getElementById('bk-price-total').textContent   = `₹${total}`;
}

async function confirmBooking() {
  const vehicle = document.getElementById('bk-vehicle').value.trim();
  if (!vehicle) {
    toast('Please enter your vehicle number', 'error');
    document.getElementById('bk-vehicle').focus();
    return;
  }

  const dateVal = document.getElementById('bk-date').value;
  const timeVal = document.getElementById('bk-start-time').value;
  if (!dateVal || !timeVal) {
    toast('Please pick a start date and time', 'error');
    return;
  }

  // Calculate start & end ISO strings
  const startDt = new Date(`${dateVal}T${timeVal}`);
  if (startDt.getTime() < Date.now() - 10 * 60 * 1000) { // allow 10 min grace
    toast('Start time cannot be in the past!', 'error');
    return;
  }

  const endDt = new Date(startDt.getTime() + State.bookingDur * 3600 * 1000);
  const start_iso = startDt.toISOString();
  const end_iso = endDt.toISOString();

  const lot = State.bookingLot;
  const spot = genSpotCode();
  const bookId = genBookingId();
  const base = lot.price * State.bookingDur;
  const total = Math.round(base + base * 0.05 + base * 0.18);

  // Check slot availability against the backend (if online), or skip gracefully
  toast('Checking slot availability...', 'info');
  try {
    const checkRes = await fetch(`${BACKEND_URL}/api/slots/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot_id: lot.id,
        spot_code: spot,
        start_time: start_iso,
        end_time: end_iso
      })
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (!checkData.available) {
        toast('This slot conflicts with another booking. Auto-selecting a new slot...', 'warning');
        confirmBooking(); // retry with a new spot code
        return;
      }
    }
  } catch (err) {
    console.warn("Slot availability check failed (offline?), proceeding:", err);
  }

  // Pre-create pending booking details
  const pendingBooking = {
    booking_id:   bookId,
    lot_id:       lot.id,
    lot_name:     lot.name,
    lot_area:     lot.area,
    spot_code:    spot,
    vehicle:      vehicle,
    duration_hrs: State.bookingDur,
    start_time:   start_iso,
    end_time:     end_iso,
    total_paid:   total
  };

  // Launch payments checkout flow
  Payments.checkout(
    {
      bookingId: bookId,
      amount: total,
      phone: Auth.user?.phone,
      name: Auth.user?.name,
      email: `${Auth.user?.phone}@parkai.in`
    },
    // Payment verified success callback
    async (payResponse) => {
      toast('Payment verified! Confirming booking...', 'success');
      try {
        const createRes = await fetch(`${BACKEND_URL}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.token}`
          },
          body: JSON.stringify(pendingBooking)
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Server failed to save booking');

        // Build active booking state object
        const activeB = {
          lot, spot, bookId, vehicle,
          dur: State.bookingDur,
          total,
          endTime: endDt.getTime(),
          start_time: start_iso,
          end_time: end_iso,
          ts: Date.now()
        };

        State.activeBooking = activeB;

        // Also persist to localStorage as session backup
        if (typeof DB !== 'undefined') DB.push('bookings', activeB);

        // Render success screen
        document.getElementById('booking-form').style.display    = 'none';
        document.getElementById('booking-success').style.display = 'block';

        document.getElementById('bk-confirm-id').textContent     = bookId;
        document.getElementById('bk-confirm-spot').textContent   = spot;
        document.getElementById('bk-confirm-lot').textContent    = lot.name;
        document.getElementById('bk-confirm-dur').textContent    = `${State.bookingDur} hour${State.bookingDur > 1 ? 's' : ''}`;
        document.getElementById('bk-confirm-vehicle').textContent = vehicle;
        document.getElementById('bk-confirm-total').textContent  = `₹${total}`;

        // Initialize active timer
        startActiveBookingTimer(endDt.getTime());

        // Update markers & lot count locally
        const idx = LOTS.findIndex(l => l.id === lot.id);
        if (idx !== -1) {
          LOTS[idx].available = Math.max(0, LOTS[idx].available - 1);
          if (State.mapInit) {
            if (State.markers[lot.id]) {
              leafletMap.removeLayer(State.markers[lot.id]);
              addMarker(LOTS[idx]);
            }
            renderSlotList();
            updateMapStats();
          }
        }

        renderActiveBooking();
        setTimeout(renderBookingHistory, 400);

      } catch (err) {
        toast(`Server Sync Error: ${err.message}. Please contact support.`, 'error');
      }
    },
    // Failure callback
    (errMessage) => {
      toast(`Payment Checkout Failed: ${errMessage}`, 'error');
    }
  );
}

function startActiveBookingTimer(endTime) {
  clearInterval(State.bookingTimer);
  State.bookingTimer = setInterval(() => {
    if (!State.activeBooking) { clearInterval(State.bookingTimer); return; }
    const secs = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const el = document.getElementById('bk-timer');
    if (el) el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

    if (secs <= 0) {
      clearInterval(State.bookingTimer);
      toast('⏰ Your parking session has ended!', 'warning');
    }
  }, 1000);
}

function renderActiveBooking() {
  const banner = document.getElementById('active-booking-banner');
  if (!banner) return;
  if (!State.activeBooking) {
    banner.style.display = 'none';
    return;
  }
  const b = State.activeBooking;

  const endTs = new Date(b.end_time || b.endTime).getTime();

  banner.style.display = 'flex';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;width:100%;">
      <div style="font-size:22px;">🅿️</div>
      <div>
        <div style="font-weight:700;font-size:14px;">Active Stay: ${b.lot.name}</div>
        <div style="font-size:12px;color:var(--text2);">Slot <strong>${b.spot}</strong> · ${b.vehicle} · ₹${b.total}</div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:2px;">TIME REMAINING</div>
        <div id="banner-timer" style="font-family:var(--font-mono);font-size:20px;color:var(--teal);">
          --:--:--
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="extendBooking()">+ Extend</button>
        <button class="btn btn-danger btn-sm" onclick="cancelActiveBooking('${b.bookId || b.booking_id}')">Cancel Booking</button>
      </div>
    </div>
  `;

  // Sync timer
  clearInterval(State._bannerTimer);
  const updateBannerTimer = () => {
    if (!State.activeBooking) { clearInterval(State._bannerTimer); return; }
    const secs = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const el = document.getElementById('banner-timer');
    if (el) el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    if (secs <= 0) {
      clearInterval(State._bannerTimer);
      if (el) el.textContent = "00:00:00";
    }
  };

  updateBannerTimer();
  State._bannerTimer = setInterval(updateBannerTimer, 1000);
}

async function cancelActiveBooking(bookingId) {
  if (!confirm("Are you sure you want to cancel this booking? Refunds are available only for cancellations made at least 30 minutes before booking start.")) return;

  toast('Cancelling booking...', 'info');
  try {
    const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

    toast('✅ Booking successfully cancelled & refund initiated!', 'success');

    // Clear active state
    clearInterval(State.bookingTimer);
    clearInterval(State._bannerTimer);

    // Restore lot availability count locally
    const lotId = State.activeBooking.lot.id;
    const idx = LOTS.findIndex(l => l.id === lotId);
    if (idx !== -1) {
      LOTS[idx].available = Math.min(LOTS[idx].spots, LOTS[idx].available + 1);
      if (State.mapInit) {
        if (State.markers[lotId]) {
          leafletMap.removeLayer(State.markers[lotId]);
          addMarker(LOTS[idx]);
        }
        renderSlotList();
        updateMapStats();
      }
    }

    State.activeBooking = null;
    renderActiveBooking();
    setTimeout(renderBookingHistory, 400);

  } catch (e) {
    toast(e.message, 'error');
  }
}

async function extendBooking() {
  if (!State.activeBooking) return;
  const b = State.activeBooking;

  const currentEnd = new Date(b.end_time || b.endTime);
  const extraHours = 1;
  const newEnd = new Date(currentEnd.getTime() + extraHours * 3600 * 1000);
  const nextHourCost = b.lot.price;

  // Validate extend availability
  toast('Checking extend availability...', 'info');
  try {
    const checkRes = await fetch(`${BACKEND_URL}/api/slots/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot_id: b.lot.id,
        spot_code: b.spot,
        start_time: currentEnd.toISOString(),
        end_time: newEnd.toISOString()
      })
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (!checkData.available) {
        toast('Cannot extend. This spot is already booked by another user right after your slot.', 'error');
        return;
      }
    }
  } catch (err) {
    console.warn("Extend availability check failed (offline?), proceeding:", err);
  }

  // Payment checkout for extend fee
  Payments.checkout(
    {
      bookingId: b.bookId || b.booking_id,
      amount: nextHourCost,
      phone: Auth.user?.phone,
      name: Auth.user?.name,
      email: `${Auth.user?.phone}@parkai.in`
    },
    // Payment verified
    async () => {
      toast('Extension payment verified! Syncing...', 'success');
      try {
        const extendRes = await fetch(`${BACKEND_URL}/api/bookings/${b.bookId || b.booking_id}/extend`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.token}`
          },
          body: JSON.stringify({
            duration_hrs: extraHours,
            total_paid: nextHourCost
          })
        });
        const extendData = await extendRes.json();
        if (!extendRes.ok) throw new Error(extendData.error || 'Server failed to extend booking');

        b.dur += extraHours;
        b.total += nextHourCost;
        b.end_time = newEnd.toISOString();
        b.endTime = newEnd.getTime();

        toast('⏱ Booking extended successfully!', 'success');

        startActiveBookingTimer(b.endTime);
        renderActiveBooking();
        setTimeout(renderBookingHistory, 400);

      } catch (err) {
        toast(`Extension Error: ${err.message}`, 'error');
      }
    },
    (err) => {
      toast(`Extension payment failed: ${err}`, 'error');
    }
  );
}
