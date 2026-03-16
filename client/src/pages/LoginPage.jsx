import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import AdpilotLogo from '../components/ui/AdpilotLogo';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState('login');
  const [showForgot, setShowForgot] = useState(false);
  const [formMsg, setFormMsg] = useState(null); // { text, type }

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Register form
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [pwdStrength, setPwdStrength] = useState(0);
  const [pwdHint, setPwdHint] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  const showMessage = (text, type) => {
    setFormMsg({ text, type });
    setTimeout(() => setFormMsg(null), 4000);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setShowForgot(false);
    setFormMsg(null);
  };

  // ── LOGIN MUTATION ──
  const loginMutation = useMutation({
    mutationFn: (data) => api.post('/auth/login', data),
    onSuccess: (res) => {
      const { user, accessToken, team } = res.data.data;
      setAuth(user, accessToken, team || null);
      navigate('/dashboard');
    },
    onError: (err) => {
      const msg = err?.response?.data?.error?.message || 'Invalid credentials. Please try again.';
      showMessage(msg, 'error');
    },
  });

  // ── REGISTER MUTATION ──
  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data),
    onSuccess: (res) => {
      const data = res.data?.data ?? res.data;
      if (data?.accessToken) {
        setAuth(data.user, data.accessToken, data.team || null);
        navigate('/dashboard');
      } else {
        showMessage('Account created! Signing you in...', 'success');
        setTimeout(() => switchTab('login'), 1500);
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.error?.message || 'Registration failed. Please try again.';
      showMessage(msg, 'error');
    },
  });

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation.mutate({ email: loginEmail, password: loginPassword });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    registerMutation.mutate({
      email: regEmail,
      password: regPassword,
      name: `${regFirstName} ${regLastName}`.trim() || 'New User',
      teamName: regCompany || 'My Team',
    });
  };

  const forgotMutation = useMutation({
    mutationFn: (email) => api.post('/auth/forgot-password', { email }),
    onSuccess: () => {
      showMessage('If that email exists, a reset link has been sent. Check your inbox.', 'success');
      setTimeout(() => setShowForgot(false), 4000);
    },
    onError: () => {
      // Still show success to prevent enumeration
      showMessage('If that email exists, a reset link has been sent. Check your inbox.', 'success');
      setTimeout(() => setShowForgot(false), 4000);
    },
  });

  const handleForgot = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    forgotMutation.mutate(forgotEmail.trim());
  };

  const checkPwd = (val) => {
    let strength = 0;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;
    setPwdStrength(strength);
    const hints = ['', 'Weak — add numbers/symbols', 'Fair — add uppercase or symbols', 'Good — almost there!', 'Strong password ✓'];
    setPwdHint(hints[strength]);
  };

  const getPwdBarClass = (i) => {
    if (i >= pwdStrength) return 'pwd-bar';
    return 'pwd-bar ' + (pwdStrength <= 1 ? 'filled-weak' : pwdStrength <= 2 ? 'filled-med' : 'filled-strong');
  };

  const pwdHintColor = ['', '#FCA5A5', '#FCD34D', '#6EE7B7', '#6EE7B7'][pwdStrength];

  return (
    <div className="login-root">
      <div id="scroll-bar"></div>
      <div className="bg-glow"></div>
      <div className="bg-grid"></div>

      <div className="page">
        {/* ── LEFT PANEL ── */}
        <div className="left-panel">
          <div className="brand">
            <AdpilotLogo variant="wordmark" size={36} />
          </div>

          <div className="left-content">
            <div className="left-tagline">AI Command Center</div>

            <h2 className="left-headline">
              Your ads.<br />
              <span className="gradient">Automated.</span><br />
              Optimized.
            </h2>

            <p className="left-sub">
              AdPilot handles the research, creative, campaigns, and SEO — so you can focus on growth, not grunt work.
            </p>

            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">15h+</span>
                <span className="stat-label">Saved / week</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">3.8×</span>
                <span className="stat-label">Avg. ROAS lift</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">30%</span>
                <span className="stat-label">Less wasted spend</span>
              </div>
            </div>

            <div className="left-cards">
              <div className="metric-card">
                <div className="metric-icon blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                  </svg>
                </div>
                <div className="metric-text">
                  <div className="metric-label">AI Research Agent</div>
                  <div className="metric-value">7 competitors analysed</div>
                </div>
                <span className="metric-badge badge-live">● LIVE</span>
              </div>

              <div className="metric-card">
                <div className="metric-icon green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                  </svg>
                </div>
                <div className="metric-text">
                  <div className="metric-label">Campaign Performance</div>
                  <div className="metric-value">ROAS +42% this week</div>
                </div>
                <span className="metric-badge badge-up">▲ 42%</span>
              </div>

              <div className="metric-card">
                <div className="metric-icon purple">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <div className="metric-text">
                  <div className="metric-label">SEO Keywords Tracked</div>
                  <div className="metric-value">142 ranking keywords</div>
                </div>
                <span className="metric-badge badge-new">NEW</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            <span className="live-dot"></span>&nbsp; 1,240+ teams automating their ads
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="right-panel">
          <div className="auth-box">

            {/* TABS */}
            {!showForgot && (
              <div className="auth-tabs">
                <button className={`tab-btn${activeTab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>Sign In</button>
                <button className={`tab-btn${activeTab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>Create Account</button>
              </div>
            )}

            {/* FORM MESSAGE */}
            {formMsg && (
              <div className={`form-msg ${formMsg.type}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{formMsg.text}</span>
              </div>
            )}

            {/* ── LOGIN FORM ── */}
            {activeTab === 'login' && !showForgot && (
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="auth-header">
                  <h1 className="auth-title">Welcome back</h1>
                  <p className="auth-sub">New to AdPilot? <button type="button" onClick={() => switchTab('register')}>Create a free account →</button></p>
                </div>

                <div className="field">
                  <label className="field-label">Work Email</label>
                  <div className="field-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input
                      className="field-input"
                      type="email"
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="field-meta">
                    <label className="field-label">Password</label>
                    <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot password?</button>
                  </div>
                  <div className="field-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      className="field-input"
                      type={showLoginPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      style={{ paddingRight: '40px' }}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <button type="button" className="field-eye" onClick={() => setShowLoginPwd(!showLoginPwd)}>
                      {showLoginPwd ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                      Sign In to AdPilot
                    </>
                  )}
                </button>

                <div className="divider">or continue with</div>

                <div className="social-row">
                  <button type="button" className="btn-social" onClick={() => showMessage('Google OAuth coming soon', 'error')}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" className="btn-social" onClick={() => showMessage('Microsoft OAuth coming soon', 'error')}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#F35325" d="M1 1h10v10H1z"/>
                      <path fill="#81BC06" d="M13 1h10v10H13z"/>
                      <path fill="#05A6F0" d="M1 13h10v10H1z"/>
                      <path fill="#FFBA08" d="M13 13h10v10H13z"/>
                    </svg>
                    Microsoft
                  </button>
                </div>
              </form>
            )}

            {/* ── REGISTER FORM ── */}
            {activeTab === 'register' && !showForgot && (
              <form className="auth-form" onSubmit={handleRegister}>
                <div className="auth-header">
                  <h1 className="auth-title">Start for free</h1>
                  <p className="auth-sub">Already have an account? <button type="button" onClick={() => switchTab('login')}>Sign in →</button></p>
                </div>

                <div className="form-row">
                  <div className="field">
                    <label className="field-label">First Name</label>
                    <div className="field-wrap">
                      <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input className="field-input" type="text" placeholder="Aditya" required autoComplete="given-name" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Last Name</label>
                    <div className="field-wrap">
                      <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input className="field-input" type="text" placeholder="Tiwari" required autoComplete="family-name" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Work Email</label>
                  <div className="field-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input className="field-input" type="email" placeholder="you@company.com" required autoComplete="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Company / Team Name</label>
                  <div className="field-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <input className="field-input" type="text" placeholder="Acme Marketing" required value={regCompany} onChange={(e) => setRegCompany(e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Password</label>
                  <div className="field-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      className="field-input"
                      type={showRegPwd ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      required
                      autoComplete="new-password"
                      style={{ paddingRight: '40px' }}
                      value={regPassword}
                      onChange={(e) => { setRegPassword(e.target.value); checkPwd(e.target.value); }}
                    />
                    <button type="button" className="field-eye" onClick={() => setShowRegPwd(!showRegPwd)}>
                      {showRegPwd ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {regPassword.length > 0 && (
                    <div className="pwd-strength">
                      <div className="pwd-bars">
                        <div className={getPwdBarClass(0)}></div>
                        <div className={getPwdBarClass(1)}></div>
                        <div className={getPwdBarClass(2)}></div>
                        <div className={getPwdBarClass(3)}></div>
                      </div>
                      <span className="pwd-hint" style={{ color: pwdHintColor }}>{pwdHint}</span>
                    </div>
                  )}
                </div>

                <div className="terms-check">
                  <input type="checkbox" id="termsCheck" required checked={termsChecked} onChange={(e) => setTermsChecked(e.target.checked)} />
                  <label htmlFor="termsCheck">I agree to AdPilot's <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>. I understand my data will be used to power AI features.</label>
                </div>

                <button type="submit" className="btn-submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/>
                      </svg>
                      Creating your account...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                      Create Free Account
                    </>
                  )}
                </button>

                <div className="divider">or sign up with</div>

                <div className="social-row">
                  <button type="button" className="btn-social">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" className="btn-social">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#F35325" d="M1 1h10v10H1z"/>
                      <path fill="#81BC06" d="M13 1h10v10H13z"/>
                      <path fill="#05A6F0" d="M1 13h10v10H1z"/>
                      <path fill="#FFBA08" d="M13 13h10v10H13z"/>
                    </svg>
                    Microsoft
                  </button>
                </div>
              </form>
            )}

            {/* ── FORGOT PASSWORD PANEL ── */}
            {showForgot && (
              <div className="forgot-panel">
                <div className="forgot-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                </div>
                <h2 className="auth-title" style={{ fontSize: '22px', marginBottom: '8px' }}>Reset password</h2>
                <p className="auth-sub" style={{ marginBottom: '24px' }}>Enter your email and we'll send you a secure reset link. Check your spam folder if you don't see it.</p>

                <form className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleForgot}>
                  <div className="field">
                    <label className="field-label">Email Address</label>
                    <div className="field-wrap">
                      <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <input className="field-input" type="email" placeholder="you@company.com" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                    </div>
                  </div>

                  <button type="submit" className="btn-submit" disabled={forgotMutation.isPending}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {forgotMutation.isPending ? 'Sending…' : 'Send Reset Link'}
                  </button>

                  <button type="button" className="back-link" onClick={() => { setShowForgot(false); setFormMsg(null); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
                    </svg>
                    Back to sign in
                  </button>
                </form>
              </div>
            )}

            <div className="auth-footer">
              Protected by 256-bit AES encryption &nbsp;·&nbsp;
              <a href="#">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
