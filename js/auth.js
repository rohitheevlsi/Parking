// ==========================================
// PARK AI — Authentication Module
// Handles OTP send/verify and profile management
// ==========================================

const Auth = {
  token: null,
  user: null,
  onLoginCallbacks: [],

  init() {
    this.token = localStorage.getItem('parkai_auth_token');
    const savedUser = localStorage.getItem('parkai_user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
      } catch (e) {
        this.user = null;
      }
    }

    // Verify token with server if present
    if (this.token) {
      this.fetchUser().then(user => {
        if (user) {
          this.user = user;
          localStorage.setItem('parkai_user', JSON.stringify(user));
          this.updateUI();
          this.triggerOnLogin();
        } else {
          this.logout();
        }
      }).catch(() => {
        // network issue, keep local copy
        this.updateUI();
      });
    } else {
      this.updateUI();
    }
  },

  async fetchUser() {
    if (!this.token) return null;
    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Auth fetch user failed:", e);
    }
    return null;
  },

  isAuthenticated() {
    return !!this.token;
  },

  onLogin(callback) {
    this.onLoginCallbacks.push(callback);
    if (this.isAuthenticated()) {
      callback(this.user);
    }
  },

  triggerOnLogin() {
    this.onLoginCallbacks.forEach(cb => cb(this.user));
  },

  async sendOTP(phone) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      return data;
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  },

  async verifyOTP(phone, otp) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');
      
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('parkai_auth_token', data.token);
      localStorage.setItem('parkai_user', JSON.stringify(data.user));
      
      this.updateUI();
      this.triggerOnLogin();
      return data;
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  },

  async updateProfile(name, vehicleNo) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/update-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ name, vehicle_no: vehicleNo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      
      this.user = data.user;
      localStorage.setItem('parkai_user', JSON.stringify(data.user));
      this.updateUI();
      this.triggerOnLogin();
      return data;
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('parkai_auth_token');
    localStorage.removeItem('parkai_user');
    this.updateUI();
    toast('Logged out successfully', 'info');
    // Refresh page to clear security sensitive DOM/state
    setTimeout(() => window.location.reload(), 800);
  },

  showAuthModal(onSuccess = null) {
    const modal = document.getElementById('auth-modal-overlay');
    if (modal) {
      modal.classList.add('open');
      // Reset flow to first step (phone prompt)
      document.getElementById('auth-step-phone').style.display = 'block';
      document.getElementById('auth-step-otp').style.display = 'none';
      document.getElementById('auth-step-profile').style.display = 'none';
      document.getElementById('auth-phone-input').value = '';
      document.getElementById('auth-otp-input').value = '';
      
      if (onSuccess) {
        this.tempSuccessCallback = onSuccess;
      }
    }
  },

  closeAuthModal() {
    const modal = document.getElementById('auth-modal-overlay');
    if (modal) modal.classList.remove('open');
  },

  updateUI() {
    const btn = document.getElementById('auth-topbar-btn');
    if (!btn) return;

    if (this.isAuthenticated() && this.user) {
      btn.innerHTML = `<span style="font-size:16px;">👤</span> ${this.user.name || 'Set Profile'}`;
      btn.onclick = () => this.showProfileManagement();
      btn.className = 'btn btn-ghost btn-sm';
    } else {
      btn.innerHTML = `🔐 Sign In`;
      btn.onclick = () => this.showAuthModal();
      btn.className = 'btn btn-primary btn-sm';
    }
  },

  showProfileManagement() {
    const modal = document.getElementById('auth-modal-overlay');
    if (!modal) return;
    
    modal.classList.add('open');
    document.getElementById('auth-step-phone').style.display = 'none';
    document.getElementById('auth-step-otp').style.display = 'none';
    
    const pStep = document.getElementById('auth-step-profile');
    pStep.style.display = 'block';
    
    // Fill values
    document.getElementById('auth-name-input').value = this.user.name || '';
    document.getElementById('auth-vehicle-input').value = this.user.vehicle_no || '';
    
    // Show logout option
    const actions = pStep.querySelector('.profile-actions') || document.createElement('div');
    actions.className = 'profile-actions';
    actions.style.marginTop = '16px';
    actions.innerHTML = `
      <button class="btn btn-danger" style="width:100%;margin-top:10px;" onclick="Auth.logout()">🚪 Log Out</button>
    `;
    if (!pStep.contains(actions)) {
      pStep.appendChild(actions);
    }
  }
};

// Handle UI logic for Auth steps
async function authSendOTP() {
  const phone = document.getElementById('auth-phone-input').value.trim();
  if (!phone || phone.length < 10) {
    toast('Please enter a valid 10-digit phone number', 'error');
    return;
  }
  
  toast('Sending OTP...', 'info');
  try {
    const data = await Auth.sendOTP(phone);
    document.getElementById('auth-step-phone').style.display = 'none';
    document.getElementById('auth-step-otp').style.display = 'block';
    
    // Automatically auto-fill during development for better UX
    if (data.debug_otp) {
      document.getElementById('auth-otp-input').value = data.debug_otp;
      toast(`Dev Mode: Auto-filled debug OTP ${data.debug_otp}`, 'success');
    }
  } catch (e) {}
}

async function authVerifyOTP() {
  const phone = document.getElementById('auth-phone-input').value.trim();
  const otp = document.getElementById('auth-otp-input').value.trim();
  if (otp.length < 6) {
    toast('OTP must be 6 digits', 'error');
    return;
  }
  
  toast('Verifying...', 'info');
  try {
    const data = await Auth.verifyOTP(phone, otp);
    if (data.is_new_user) {
      document.getElementById('auth-step-otp').style.display = 'none';
      document.getElementById('auth-step-profile').style.display = 'block';
      document.getElementById('auth-name-input').value = '';
      document.getElementById('auth-vehicle-input').value = '';
    } else {
      Auth.closeAuthModal();
      toast(`Welcome back, ${data.user.name || 'User'}!`, 'success');
      if (Auth.tempSuccessCallback) {
        Auth.tempSuccessCallback();
        Auth.tempSuccessCallback = null;
      }
    }
  } catch (e) {}
}

async function authSaveProfile() {
  const name = document.getElementById('auth-name-input').value.trim();
  const vehicle = document.getElementById('auth-vehicle-input').value.trim();
  if (!name) {
    toast('Name is required', 'error');
    return;
  }
  
  toast('Saving...', 'info');
  try {
    await Auth.updateProfile(name, vehicle);
    Auth.closeAuthModal();
    toast('Profile updated successfully!', 'success');
    if (Auth.tempSuccessCallback) {
      Auth.tempSuccessCallback();
      Auth.tempSuccessCallback = null;
    }
  } catch (e) {}
}
