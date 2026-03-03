import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const scrollBarRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const bar = scrollBarRef.current;
    if (!bar) return;
    const handleScroll = () => {
      const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      bar.style.width = Math.min(pct, 100) + '%';
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const parent = e.target.closest('.pain-grid, .pillar-grid, .pricing-grid, .steps-row');
          if (parent) {
            const siblings = [...parent.children];
            const idx = siblings.indexOf(e.target);
            e.target.style.transitionDelay = (idx * 0.08) + 's';
          }
          e.target.classList.add('revealed');
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.pain-card, .pillar-card, .step, .price-card').forEach(el => {
      el.classList.add('reveal-item');
      revealObserver.observe(el);
    });
    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    function handleCardClick() {
      this.classList.remove('popped');
      void this.offsetWidth;
      this.classList.add('popped');
    }
    const cards = document.querySelectorAll('.pain-card, .pillar-card, .price-card');
    cards.forEach(card => card.addEventListener('click', handleCardClick));
    return () => cards.forEach(card => card.removeEventListener('click', handleCardClick));
  }, []);

  useEffect(() => {
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const bars = e.target.querySelectorAll('.bar');
          bars.forEach((b, i) => setTimeout(() => b.classList.add('animate'), i * 50));
          chartObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    const chart = document.getElementById('chart');
    if (chart) chartObserver.observe(chart);
    return () => chartObserver.disconnect();
  }, []);

  useEffect(() => {
    const kpiObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const text = el.textContent;
          const match = text.match(/([$]?)([\d.]+)([KkxX%]?)/);
          if (!match) return;
          const prefix = match[1], target = parseFloat(match[2]), suffix = match[3];
          const duration = 1200;
          const start = performance.now();
          const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            el.textContent = prefix + (target % 1 !== 0 ? current.toFixed(1) : Math.round(current)) + suffix;
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          kpiObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.p-kpi-value').forEach(el => kpiObserver.observe(el));
    return () => kpiObserver.disconnect();
  }, []);

  useEffect(() => {
    const headingObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('heading-visible');
          headingObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.sec-label, .sec-title, .sec-sub').forEach(el => {
      el.classList.add('heading-hidden');
      headingObserver.observe(el);
    });
    return () => headingObserver.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <div id="scroll-progress" ref={scrollBarRef}></div>

      {/* ===== NAV ===== */}
      <nav>
        <div className="nav-inner">
          <a href="/" className="nav-logo">
            <div className="nav-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            AdPilot
          </a>
          <div className="nav-links">
            <a href="#problem">Problem</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <div className="nav-divider"></div>
            <Link to="/login" className="nav-btn nav-btn-ghost">Log in</Link>
            <Link to="/pricing" className="nav-btn nav-btn-ghost">Pricing</Link>
            <Link to="/register" className="nav-btn nav-btn-primary">Get Early Access</Link>
          </div>
          {/* Hamburger — mobile only */}
          <button
            className="nav-hamburger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-1' : ''}`} />
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-2' : ''}`} />
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-3' : ''}`} />
          </button>
        </div>
        {/* Mobile nav dropdown */}
        {navOpen && (
          <div className="nav-mobile-menu">
            <a href="#problem" onClick={() => setNavOpen(false)}>Problem</a>
            <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setNavOpen(false)}>Pricing</a>
            <Link to="/login" onClick={() => setNavOpen(false)}>Log in</Link>
            <Link to="/register" onClick={() => setNavOpen(false)} className="nav-btn nav-btn-primary" style={{ textAlign: 'center' }}>
              Get Early Access
            </Link>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="hero-floating">
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Meta Ads
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            SEO Engine
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="#8B5CF6" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Research AI
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Analytics
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#EC4899" strokeWidth="2"/>
              <path d="M3 9h18M9 21V9" stroke="#EC4899" strokeWidth="2"/>
            </svg>
            Google Ads
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Autopilot
          </div>
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 3 }}>
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            🔴 Live — Monitoring $2.4M in ad spend globally
          </div>
          <h1>Your Ads Are Bleeding<br /><span className="gradient-text">Money Right Now.</span></h1>
          <p className="hero-sub">
            AdPilot watches every campaign 24/7. The moment ROAS drops, CTR collapses,
            or spend spikes — we pause it automatically before you lose another rupee.
          </p>
          <div className="hero-ctas">
            <Link to="/register" className="btn-primary">Stop The Bleed — Free Trial</Link>
            <a href="#features" className="btn-ghost">See a live demo →</a>
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <Link to="/demo-login" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              No signup needed — try the live demo →
            </Link>
          </div>

          {/* Product Preview */}
          <div className="product-preview">
            <div className="preview-glow"></div>
            <div className="preview-window">
              <div className="preview-topbar">
                <div className="dot dot-r"></div>
                <div className="dot dot-y"></div>
                <div className="dot dot-g"></div>
                <span className="preview-url">adpilot.app — Command Center</span>
              </div>
              <div className="preview-body">
                <div className="p-sidebar">
                  <div className="p-sidebar-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Dashboard
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Campaigns
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    Research Hub
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    Ad Studio
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    SEO
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                    Analytics
                  </div>
                </div>
                <div className="p-content">
                  <div className="p-kpis">
                    <div className="p-kpi">
                      <div className="p-kpi-label">Ad Spend</div>
                      <div className="p-kpi-value">$12.4K</div>
                      <div className="p-kpi-change up">↑ 8% vs last month</div>
                    </div>
                    <div className="p-kpi">
                      <div className="p-kpi-label">ROAS</div>
                      <div className="p-kpi-value">4.2x</div>
                      <div className="p-kpi-change up">↑ 0.6 from baseline</div>
                    </div>
                    <div className="p-kpi">
                      <div className="p-kpi-label">Conversions</div>
                      <div className="p-kpi-value">847</div>
                      <div className="p-kpi-change up">↑ 23% growth</div>
                    </div>
                    <div className="p-kpi">
                      <div className="p-kpi-label">SEO Keywords</div>
                      <div className="p-kpi-value">142</div>
                      <div className="p-kpi-change up">↑ 18 new rankings</div>
                    </div>
                  </div>
                  <div className="p-chart">
                    <div className="p-chart-title">Cross-Platform Performance — Last 30 Days</div>
                    <div className="chart-bars" id="chart">
                      <div className="bar bar-meta" style={{ '--h': '42%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '58%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '53%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '38%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '68%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '62%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '48%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '73%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '78%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '58%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '62%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '82%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '70%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '88%' }}></div>
                      <div className="bar bar-meta" style={{ '--h': '65%' }}></div>
                      <div className="bar bar-google" style={{ '--h': '76%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED ===== */}
      <section className="trusted">
        <div className="container">
          <p className="trusted-label">USED BY GROWTH TEAMS AT</p>
          <div className="trusted-row">
            <span>Zepto</span><span>boAt</span><span>Mamaearth</span><span>Razorpay</span><span>Groww</span>
          </div>
        </div>
      </section>

      {/* ===== PAIN ===== */}
      <section className="pain" id="problem">
        <div className="container">
          <div className="sec-label">The Problem</div>
          <h2 className="sec-title">Every Night You're Not Watching,<br />Money Disappears</h2>
          <p className="sec-sub">Your campaigns run 24/7 but you only watch them 8 hours a day. That 16-hour gap is where budget goes to die.</p>

          <div className="pain-grid">
            <div className="pain-card">
              <div className="pain-icon ic-red">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
              </div>
              <h3>Research Takes Forever</h3>
              <p>Manually scanning competitor ads, landing pages, and keywords across 5+ browser tabs for every campaign.</p>
              <div className="pain-stat red">4+ hrs<div className="pain-stat-sub">wasted every time you set up a campaign manually</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-orange">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <h3>Budget Bleeds Overnight</h3>
              <p>A campaign tanks at 2am. Nobody notices until morning. By then you've burned through ₹30 of every ₹100 on bad targeting.</p>
              <div className="pain-stat orange">₹30 of every ₹100<div className="pain-stat-sub">lost to underperforming campaigns</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </div>
              <h3>Platform Silos</h3>
              <p>Meta Ads Manager, Google Ads, Semrush, Ahrefs — separate dashboards, separate logins, no unified view.</p>
              <div className="pain-stat purple">5-7 tools<div className="pain-stat-sub">just to run one campaign</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-red">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>Manual Optimization</h3>
              <p>Checking performance daily, pausing underperformers, adjusting bids. AI does this in minutes. You spend hours.</p>
              <div className="pain-stat red">30-60 min<div className="pain-stat-sub">daily per platform</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-orange">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <h3>Creative Bottleneck</h3>
              <p>Juggling Canva, ChatGPT, and manual copywriting. Testing variations is slow. Windows close before you launch.</p>
              <div className="pain-stat orange">3-5 hrs<div className="pain-stat-sub">per ad set</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>SEO Is an Afterthought</h3>
              <p>SEO and paid ads run in parallel but nobody connects keyword insights to ad strategy. Double the work, half the results.</p>
              <div className="pain-stat" style={{ color: 'var(--accent-blue)' }}>5-10 hrs<div className="pain-stat-sub">extra weekly</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PILLARS ===== */}
      <section className="pillars" id="features">
        <div className="container">
          <div className="sec-label">The Solution</div>
          <h2 className="sec-title">One Guardian.<br />Six Ways It Protects Your Spend.</h2>
          <p className="sec-sub">Each agent is a specialized pipeline that collects data, reasons with AI, and takes action — so you don't have to.</p>

          <div className="pillar-grid">
            <div className="pillar-card">
              <div className="pillar-num">01</div>
              <h3>Budget Guardian</h3>
              <p>Monitors campaigns every 15 min. Pauses bleeders. Scales winners. Acts before you wake up — so you never open Ads Manager to a disaster again.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-num">02</div>
              <h3>Research Agent</h3>
              <p>Drop in your URL. AI discovers competitors, analyzes their ads via Meta Ad Library, identifies winning patterns, and generates a competitive intelligence report.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-num">03</div>
              <h3>Creative Agent</h3>
              <p>Generates 5-10 headline variations, copy options, CTA suggestions, image prompts, and audience targeting — all based on research insights.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-num">04</div>
              <h3>Campaign Autopilot</h3>
              <p>One-click deployment to Meta and Google. AI handles audiences, bidding, placements, and cross-platform budget allocation automatically.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-num">05</div>
              <h3>SEO Intelligence</h3>
              <p>Keyword tracking, competitor gap analysis, content briefs, technical audits, and AI visibility monitoring — connected to your ad strategy.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-num">06</div>
              <h3>Unified Dashboard</h3>
              <p>Cross-platform ROAS, CPA, conversions, and SEO rankings in one view. AI-generated weekly reports. White-label export for agencies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="how">
        <div className="container">
          <div className="sec-label" style={{ textAlign: 'center' }}>How It Works</div>
          <h2 className="sec-title" style={{ textAlign: 'center' }}>Three Steps to Autopilot</h2>
          <p className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 56px' }}>From zero to optimized campaigns in under 10 minutes.</p>

          <div className="steps-row">
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <h3>Connect Accounts</h3>
              <p>Link your Meta Ads, Google Ads, and Slack in 60 seconds via OAuth. Your data stays yours.</p>
            </div>
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z"/>
                  <path d="M4.93 10.93a8 8 0 1012.14 2.14"/>
                  <path d="M12 18v4"/>
                </svg>
              </div>
              <h3>Let AI Build</h3>
              <p>AI researches competitors, generates ad creative, configures campaigns, and sets automation rules.</p>
            </div>
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              <h3>Approve & Scale</h3>
              <p>Review AI suggestions, approve with one click, and watch the optimization engine scale your winners.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="comparison">
        <div className="container">
          <div className="sec-label">Why AdPilot</div>
          <h2 className="sec-title">Replace 5 Tools With One</h2>
          <p className="sec-sub">No other platform combines AI research, ad creation, campaign management, and SEO in one place.</p>

          <table className="cmp-table">
            <thead>
              <tr>
                <th>Feature</th><th>Madgicx</th><th>Semrush</th><th>AdCreative.ai</th><th className="us">AdPilot ✦</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Meta Ads Management</td><td><span className="cmp-y">✓</span></td><td><span className="cmp-n">✗</span></td><td><span className="cmp-n">✗</span></td><td className="us"><span className="cmp-y">✓</span></td></tr>
              <tr><td>Google Ads Management</td><td><span className="cmp-p">Partial</span></td><td><span className="cmp-p">Limited</span></td><td><span className="cmp-n">✗</span></td><td className="us"><span className="cmp-y">✓</span></td></tr>
              <tr><td>AI Ad Creative</td><td><span className="cmp-p">Partial</span></td><td><span className="cmp-n">✗</span></td><td><span className="cmp-y">✓</span></td><td className="us"><span className="cmp-y">✓</span></td></tr>
              <tr><td>SEO Keyword Tracking</td><td><span className="cmp-n">✗</span></td><td><span className="cmp-y">✓</span></td><td><span className="cmp-n">✗</span></td><td className="us"><span className="cmp-y">✓</span></td></tr>
              <tr><td>AI Competitor Research</td><td><span className="cmp-n">✗</span></td><td><span className="cmp-p">Manual</span></td><td><span className="cmp-n">✗</span></td><td className="us"><span className="cmp-y">✓ Agent</span></td></tr>
              <tr><td>Automation Rules</td><td><span className="cmp-y">✓</span></td><td><span className="cmp-n">✗</span></td><td><span className="cmp-n">✗</span></td><td className="us"><span className="cmp-y">✓</span></td></tr>
              <tr><td>Starting Price</td><td>$72/mo</td><td>$130/mo</td><td>$29/mo</td><td className="us"><strong style={{ color: 'var(--accent-blue)' }}>$49/mo</strong></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="sec-label" style={{ textAlign: 'center' }}>Pricing</div>
          <h2 className="sec-title" style={{ textAlign: 'center' }}>One Bad Week Of Wasted Spend Costs More Than A Year Of AdPilot</h2>
          <p className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 56px' }}>Simple pricing. No percentage of ad spend. Early access gets 40% off.</p>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px', marginTop: '-24px' }}>
            Early access pricing. First 200 users locked in forever. 147 spots taken.
          </p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-plan">Starter</div>
              <div className="price-amt">$49 <span>/month</span></div>
              <p className="price-desc">For solo marketers testing AI automation.</p>
              <ul className="price-list">
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>1 ad platform (Meta or Google)</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>5 active campaigns</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>3 AI research reports/mo</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>20 AI ad generations/mo</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>50 SEO keywords tracked</li>
              </ul>
              <Link to="/register" className="price-btn price-btn-outline">Start Free Trial</Link>
            </div>

            <div className="price-card pop">
              <div className="price-badge">Most Popular</div>
              <div className="price-plan">Growth</div>
              <div className="price-amt">$149 <span>/month</span></div>
              <p className="price-desc">For growing teams and agencies managing multiple campaigns.</p>
              <ul className="price-list">
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Meta + Google Ads</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>25 active campaigns</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>15 AI research reports/mo</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>100 AI ad generations/mo</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>250 SEO keywords tracked</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>PDF report export</li>
              </ul>
              <Link to="/register?plan=growth" className="price-btn price-btn-fill">Get Started Now</Link>
            </div>

            <div className="price-card">
              <div className="price-plan">Scale</div>
              <div className="price-amt">$299 <span>/month</span></div>
              <p className="price-desc">For agencies and enterprises needing unlimited everything.</p>
              <ul className="price-list">
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>All platforms + TikTok + LinkedIn</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Unlimited campaigns</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Unlimited AI features</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Unlimited SEO tracking</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>White-label reports + API</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Dedicated success manager</li>
              </ul>
              <Link to="/register?plan=scale" className="price-btn price-btn-outline">Contact Sales</Link>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Annual billing saves 20% · 14-day money-back guarantee ·{' '}
            <Link to="/pricing" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'underline' }}>
              See full plan details →
            </Link>
          </p>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="cta-final">
        <div className="container">
          <h2>How Much Are You Losing<br /><span className="gradient-text">Right Now?</span></h2>
          <p>The average team wastes 23% of ad budget on campaigns that underperform. AdPilot catches them automatically.</p>
          <div className="hero-ctas">
            <Link to="/register" className="btn-primary">Start Protecting My Budget — Free</Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-about">
              <a href="/" className="nav-logo">
                <div className="nav-logo-mark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                AdPilot
              </a>
              <p>AI-powered ad and SEO automation for teams who refuse to waste money on manual marketing.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#">Integrations</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="#">Documentation</a>
              <a href="#">API Reference</a>
              <a href="#">Blog</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 AdPilot. All rights reserved.</p>
            <p>Built by Vedang Vaidya & Aditya</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
