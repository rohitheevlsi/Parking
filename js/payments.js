// ==========================================
// PARK AI — Payment Gateway Module (Razorpay)
// ==========================================

const Payments = {
  keyId: null,
  scriptLoaded: false,

  async loadScript() {
    if (this.scriptLoaded) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        this.scriptLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn("Failed to load Razorpay SDK, using simulation fallback.");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  },

  async checkout({ bookingId, amount, phone, name, email }, onSuccess, onFailure) {
    toast('Initializing payment...', 'info');
    
    // 1. Load Razorpay script
    const loaded = await this.loadScript();
    
    // 2. Create Order in backend
    let orderData;
    try {
      const res = await fetch('http://localhost:5000/api/payments/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.token}`
        },
        body: JSON.stringify({ booking_id: bookingId, amount })
      });
      orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Failed to create payment order');
    } catch (e) {
      toast(e.message, 'error');
      if (onFailure) onFailure(e.message);
      return;
    }

    const orderId = orderData.order_id;
    this.keyId = orderData.key;

    // 3. If offline/Razorpay not loaded or using dummy order, we support direct UI simulation fallback
    if (!loaded || orderData.is_dummy) {
      this.showSimulationOverlay(bookingId, orderId, amount, onSuccess, onFailure);
      return;
    }

    // 4. Open real Razorpay popup
    const options = {
      key: this.keyId,
      amount: orderData.amount_paise || (amount * 100),
      currency: 'INR',
      name: 'PARK AI',
      description: `Booking reference ${bookingId}`,
      order_id: orderId,
      handler: async function (response) {
        toast('Verifying payment...', 'info');
        try {
          const verifyRes = await fetch('http://localhost:5000/api/payments/verify', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Auth.token}`
            },
            body: JSON.stringify({
              booking_id: bookingId,
              razorpay_order_id: orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            onSuccess(verifyData);
          } else {
            throw new Error(verifyData.error || 'Signature verification failed');
          }
        } catch (err) {
          toast(err.message, 'error');
          if (onFailure) onFailure(err.message);
        }
      },
      prefill: {
        name: name || 'Smart Renter',
        contact: phone || '',
        email: email || 'renter@parkai.in'
      },
      theme: {
        color: '#00ffd1'
      },
      modal: {
        ondismiss: function() {
          toast('Payment cancelled by user', 'warning');
          if (onFailure) onFailure('User closed payment window');
        }
      }
    };

    try {
      const rzp1 = new Razorpay(options);
      rzp1.open();
    } catch (e) {
      console.error(e);
      // Fallback
      this.showSimulationOverlay(bookingId, orderId, amount, onSuccess, onFailure);
    }
  },

  showSimulationOverlay(bookingId, orderId, amount, onSuccess, onFailure) {
    // Construct simulation UI modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'payment-simulation-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
      display:flex; align-items:center; justify-content:center;
      animation: fadein 0.25s ease both;
    `;

    overlay.innerHTML = `
      <div style="background:var(--bg2); border:1px solid var(--border2); border-radius:var(--r3); padding:32px; width:400px; text-align:center; box-shadow:var(--glow-teal);">
        <div style="font-size:40px; margin-bottom:12px;">💳</div>
        <h3 style="font-size:20px; color:var(--text); margin-bottom:4px;">Razorpay Sandbox</h3>
        <p style="color:var(--text2); font-size:12.5px; margin-bottom:20px;">Simulating secure checkout for order:<br/><span class="mono" style="font-size:11px; color:var(--teal);">${orderId}</span></p>
        
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--r); padding:16px; text-align:left; margin-bottom:24px;">
          <div style="display:flex; justify-content:between; font-size:13px; color:var(--text2); margin-bottom:6px;">
            <span>Merchant:</span><span style="font-weight:700; color:var(--text); margin-left:auto;">PARK AI Chennai</span>
          </div>
          <div style="display:flex; justify-content:between; font-size:13px; color:var(--text2); margin-bottom:6px;">
            <span>Reference:</span><span style="font-weight:700; color:var(--text); margin-left:auto;">${bookingId}</span>
          </div>
          <div style="display:flex; justify-content:between; font-size:15px; color:var(--text); margin-top:10px; border-top:1px solid var(--border); padding-top:8px;">
            <span>Total Payable:</span><span style="font-weight:700; color:var(--teal); margin-left:auto;">₹${amount.toFixed(2)}</span>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" id="sim-pay-cancel">Cancel</button>
          <button class="btn btn-primary" style="flex:2;" id="sim-pay-success">✅ Confirm Success</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sim-pay-cancel').onclick = () => {
      overlay.remove();
      toast('Payment cancelled by user', 'warning');
      if (onFailure) onFailure('User cancelled simulated payment');
    };

    document.getElementById('sim-pay-success').onclick = async () => {
      overlay.remove();
      toast('Verifying simulated payment...', 'info');
      try {
        const verifyRes = await fetch('http://localhost:5000/api/payments/verify', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.token}`
          },
          body: JSON.stringify({
            booking_id: bookingId,
            razorpay_order_id: orderId
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          onSuccess(verifyData);
        } else {
          throw new Error(verifyData.error || 'Verification failed');
        }
      } catch (err) {
        toast(err.message, 'error');
        if (onFailure) onFailure(err.message);
      }
    };
  }
};
