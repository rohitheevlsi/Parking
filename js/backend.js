// ============================================================
//  PARK AI — Real Backend (Local Python Flask + Socket.IO)
// ============================================================

const BACKEND_URL = "http://localhost:5000";

const BACKEND = {
  enabled: false,
  socket: null,

  async init() {
    try {
      // Test the backend connection
      const res = await fetch(`${BACKEND_URL}/api/bookings?limit=1`);
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

  async createBooking(booking) {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.bookId,
          lot_id:     booking.lot.id,
          lot_name:   booking.lot.name,
          lot_area:   booking.lot.area,
          spot_code:  booking.spot,
          vehicle:    booking.vehicle,
          duration_hrs: booking.dur,
          total_paid: booking.total
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
      const res = await fetch(`${BACKEND_URL}/api/bookings?limit=${limit}`);
      const data = await res.json();
      return data;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:   listing.name,
          type:   listing.type,
          spots:  listing.spots,
          rate:   listing.rate,
          status: listing.status,
        })
      });
      const data = await res.json();
      return data?.[0] || null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async listHostListings() {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/listings`);
      const data = await res.json();
      return data;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      console.error(e);
      return false;
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
