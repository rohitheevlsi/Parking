// ============================================================
//  PARK AI — Real Backend (Local Python Flask + Socket.IO)
// ============================================================

const BACKEND_URL = "http://localhost:5000";

const BACKEND = {
  enabled: false,
  socket: null,

  async init() {
    try {
      // Use the public listings endpoint (no auth needed) as health check
      const res = await fetch(`${BACKEND_URL}/api/listings`);
      if (!res.ok) throw new Error("Backend not responding correctly");

      this.enabled = true;

      // Initialize Socket.IO for real-time updates if loaded
      if (typeof io !== 'undefined') {
        this.socket = io(BACKEND_URL);
        console.info("[PARK AI] Connected to local Socket.IO backend.");
      } else {
        console.warn("[PARK AI] Socket.IO library not loaded.");
      }

      console.info("[PARK AI] Connected to real Python backend.");
      return true;
    } catch (e) {
      console.warn("[PARK AI] Backend connection failed, falling back to localStorage.", e.message);
      this.enabled = false;
      return false;
    }
  },

  // Helper to get auth headers from Auth module
  _authHeaders() {
    const token = (typeof Auth !== 'undefined' && Auth.token) ? Auth.token : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  async createBooking(booking) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({
          booking_id:   booking.bookId,
          lot_id:       booking.lot.id,
          lot_name:     booking.lot.name,
          lot_area:     booking.lot.area,
          spot_code:    booking.spot,
          vehicle:      booking.vehicle,
          duration_hrs: booking.dur,
          total_paid:   booking.total,
          start_time:   booking.start_time,
          end_time:     booking.end_time,
        })
      });
      const data = await res.json();
      return data?.[0] || null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async listBookings(limit = 50) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings?limit=${limit}`, {
        headers: this._authHeaders()
      });
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async createListing(listing) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/listings`, {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({
          name:             listing.name,
          type:             listing.type,
          spots:            listing.spots,
          rate:             listing.rate,
          address:          listing.address || 'Chennai, India',
          lat:              listing.lat || 13.0475,
          lng:              listing.lng || 80.2089,
          availability_hrs: listing.availability_hrs || '24/7',
          description:      listing.description || '',
        })
      });
      const data = await res.json();
      return data?.[0] || null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  // List own host listings (authenticated)
  async listHostListings() {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/host/listings`, {
        headers: this._authHeaders()
      });
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  // List all public active listings (no auth)
  async listPublicListings() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/listings`);
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async updateListingStatus(id, status) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/listings/${id}/status`, {
        method: 'PUT',
        headers: this._authHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async cancelBooking(bookingId) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: this._authHeaders()
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async extendBooking(bookingId, durationHrs, totalPaid) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}/extend`, {
        method: 'PUT',
        headers: this._authHeaders(),
        body: JSON.stringify({ duration_hrs: durationHrs, total_paid: totalPaid })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  // Live updates: subscribe to new bookings from ANY user/device in real time via Socket.IO.
  subscribeToBookings(onInsert) {
    if (!this.enabled || !this.socket) return null;

    this.socket.on('new_booking', (booking) => {
      onInsert(booking);
    });

    return {
      unsubscribe: () => {
        this.socket.off('new_booking');
      }
    };
  },
};
