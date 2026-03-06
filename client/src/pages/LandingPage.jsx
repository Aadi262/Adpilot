import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const scrollBarRef   = useRef(null);
  const canvasRef      = useRef(null);
  const ambientRef     = useRef(null);
  const cursorRef      = useRef(null);
  const previewRef     = useRef(null);
  const stepsTrackRef  = useRef(null);
  const stepsFillRef   = useRef(null);
  const pipelineRef    = useRef(null);

  const [navOpen, setNavOpen]         = useState(false);
  const [liveVisible, setLiveVisible] = useState(true);

  /* ── scroll progress bar ── */
  useEffect(() => {
    const bar = scrollBarRef.current;
    if (!bar) return;
    const onScroll = () => {
      const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      bar.style.width = Math.min(pct, 100) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── intersection reveal ── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const parent = e.target.closest('.pain-grid, .pillar-grid, .pricing-grid, .steps-row');
          if (parent) {
            const idx = [...parent.children].indexOf(e.target);
            e.target.style.transitionDelay = (idx * 0.08) + 's';
          }
          e.target.classList.add('revealed');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.pain-card, .pillar-card, .step, .price-card').forEach(el => {
      el.classList.add('reveal-item');
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  /* ── card pop click ── */
  useEffect(() => {
    function onCardClick() {
      this.classList.remove('popped');
      void this.offsetWidth;
      this.classList.add('popped');
    }
    const cards = document.querySelectorAll('.pain-card, .pillar-card, .price-card');
    cards.forEach(c => c.addEventListener('click', onCardClick));
    return () => cards.forEach(c => c.removeEventListener('click', onCardClick));
  }, []);

  /* ── chart animate ── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.bar').forEach((b, i) => setTimeout(() => b.classList.add('animate'), i * 50));
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    const chart = document.getElementById('chart');
    if (chart) obs.observe(chart);
    return () => obs.disconnect();
  }, []);

  /* ── KPI counter ── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const match = el.textContent.match(/([$]?)([\d.]+)([KkxX%]?)/);
          if (!match) return;
          const [, prefix, rawTarget, suffix] = match;
          const target = parseFloat(rawTarget);
          const start  = performance.now();
          const step   = (now) => {
            const progress = Math.min((now - start) / 1200, 1);
            const eased    = 1 - Math.pow(1 - progress, 3);
            el.textContent = prefix + (target % 1 !== 0 ? (target * eased).toFixed(1) : Math.round(target * eased)) + suffix;
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('.p-kpi-value').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ── heading reveal ── */
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('heading-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.sec-label, .sec-title, .sec-sub').forEach(el => {
      el.classList.add('heading-hidden');
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  /* ── float badge staggered reveal ── */
  useEffect(() => {
    const badges = document.querySelectorAll('.float-badge');
    badges.forEach((badge, i) => {
      setTimeout(() => badge.classList.add('badge-visible'), 1800 + i * 150);
    });
  }, []);

  /* ── STAR FIELD CANVAS ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let scrollY = 0;

    const STAR_COUNT = 200;
    let stars = [];

    const generateStars = () => {
      const pageH = document.body.scrollHeight;
      stars = Array.from({ length: STAR_COUNT }, () => {
        const rnd = Math.random();
        let r, baseAlpha, isAccent;
        if (rnd < 0.70) {
          r = 0.5 + Math.random() * 0.5; baseAlpha = 0.15 + Math.random() * 0.15; isAccent = false;
        } else if (rnd < 0.95) {
          r = 1 + Math.random() * 0.5;   baseAlpha = 0.25 + Math.random() * 0.2;  isAccent = false;
        } else {
          r = 2 + Math.random() * 0.5;   baseAlpha = 0.5  + Math.random() * 0.2;  isAccent = true;
        }
        return {
          x:           Math.random() * window.innerWidth,
          y:           Math.random() * pageH,
          r,
          baseAlpha,
          isAccent,
          pulseSpeed:  3000 + Math.random() * 5000,
          pulseOffset: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      generateStars();
    };

    resize();
    window.addEventListener('resize', resize);

    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const canvasY = s.y - scrollY * 0.05;
        if (canvasY < -4 || canvasY > canvas.height + 4) return;
        const pulse = Math.sin((time / s.pulseSpeed) * Math.PI * 2 + s.pulseOffset) * 0.08;
        const alpha = Math.max(0.04, s.baseAlpha + pulse);
        ctx.beginPath();
        ctx.arc(s.x, canvasY, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.isAccent
          ? `rgba(200,216,255,${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* ── MOUSE AMBIENT + CUSTOM CURSOR ── */
  useEffect(() => {
    const ambientEl = ambientRef.current;
    const cursorEl  = cursorRef.current;
    if (!ambientEl) return;

    let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    let ax = tx, ay = ty;
    let cx = tx, cy = ty;
    let raf;

    const onMove = (e) => { tx = e.clientX; ty = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const lerp = (a, b, t) => a + (b - a) * t;
    const tick = () => {
      ax = lerp(ax, tx, 0.06);
      ay = lerp(ay, ty, 0.06);
      cx = lerp(cx, tx, 0.2);
      cy = lerp(cy, ty, 0.2);

      ambientEl.style.setProperty('--mx', ax + 'px');
      ambientEl.style.setProperty('--my', ay + 'px');

      if (cursorEl) {
        cursorEl.style.transform = `translate(${cx - 5}px, ${cy - 5}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  /* ── dashboard parallax on scroll ── */
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const onScroll = () => {
      const rect = preview.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        preview.style.transform = `translateY(${(progress - 0.5) * -28}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── scroll-driven step connector fill ── */
  useEffect(() => {
    const track = stepsTrackRef.current;
    const fill  = stepsFillRef.current;
    if (!track || !fill) return;
    const onScroll = () => {
      const rect  = track.getBoundingClientRect();
      const start = window.innerHeight * 0.8;
      const end   = window.innerHeight * 0.2;
      if (rect.top > start) {
        fill.style.width = '0%'; fill.classList.remove('has-progress');
      } else if (rect.bottom < end) {
        fill.style.width = '100%'; fill.classList.add('has-progress');
      } else {
        const pct = Math.min(((start - rect.top) / (start - end)) * 100, 100);
        fill.style.width = pct + '%';
        if (pct > 3) fill.classList.add('has-progress');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── pipeline entry animation ── */
  useEffect(() => {
    const track = pipelineRef.current;
    if (!track) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      // 1. nodes appear L→R with 80ms stagger
      track.querySelectorAll('.pipeline-node').forEach((node, i) => {
        setTimeout(() => node.classList.add('pn-visible'), i * 80);
      });
      // 2. connectors appear after nodes
      const nodeCount = track.querySelectorAll('.pipeline-node').length;
      track.querySelectorAll('.pipeline-connector').forEach((conn, i) => {
        setTimeout(() => conn.classList.add('pc-visible'), nodeCount * 80 + i * 60 + 100);
      });
      obs.disconnect();
    }, { threshold: 0.25 });
    obs.observe(track);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing-root">
      {/* ── background layers ── */}
      <div className="bg-grid" />
      <canvas ref={canvasRef} className="particle-canvas" />
      <div className="bg-halos">
        <div className="bg-halo bg-halo-hero" />
        <div className="bg-halo bg-halo-features" />
        <div className="bg-halo bg-halo-cta" />
      </div>
      <div ref={ambientRef} className="bg-ambient" />
      <div ref={cursorRef} className="custom-cursor" />

      <div id="scroll-progress" ref={scrollBarRef} />

      {/* Live widget */}
      {liveVisible && (
        <div className="live-widget">
          <button className="live-widget-close" onClick={() => setLiveVisible(false)} aria-label="Close">✕</button>
          <div className="live-widget-row">
            <span className="live-dot" />
            System Live
          </div>
          <div className="live-widget-sub">$2.4M monitored</div>
        </div>
      )}

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
            <div className="nav-divider" />
            <Link to="/login" className="nav-btn nav-btn-ghost">Log in</Link>
            <Link to="/pricing" className="nav-btn nav-btn-ghost">Pricing</Link>
            <Link to="/register" className="nav-btn nav-btn-primary">Get Early Access</Link>
          </div>
          <button className="nav-hamburger" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu">
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-1' : ''}`} />
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-2' : ''}`} />
            <span className={`nav-ham-line ${navOpen ? 'nav-ham-open-3' : ''}`} />
          </button>
        </div>
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
        <div className="hero-streaks">
          <div className="hero-streak" /><div className="hero-streak" /><div className="hero-streak" />
          <div className="hero-streak" /><div className="hero-streak" />
        </div>

        <div className="hero-floating">
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Meta Ads
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            SEO Engine
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#8B5CF6" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/></svg>
            Research AI
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Analytics
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#EC4899" strokeWidth="2"/><path d="M3 9h18M9 21V9" stroke="#EC4899" strokeWidth="2"/></svg>
            Google Ads
          </div>
          <div className="float-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Autopilot
          </div>
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 3 }}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
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
            <Link to="/demo-login" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              No signup needed — try the live demo →
            </Link>
          </div>

          <div className="product-preview" ref={previewRef}>
            <div className="preview-glow" />
            <div className="preview-window">
              <div className="preview-topbar">
                <div className="dot dot-r" /><div className="dot dot-y" /><div className="dot dot-g" />
                <span className="preview-url">adpilot.app — Command Center</span>
              </div>
              <div className="preview-body">
                <div className="p-sidebar">
                  <div className="p-sidebar-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>Dashboard
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Campaigns
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>Research Hub
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Ad Studio
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>SEO
                  </div>
                  <div className="p-sidebar-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>Analytics
                  </div>
                </div>
                <div className="p-content">
                  <div className="p-kpis">
                    <div className="p-kpi"><div className="p-kpi-label">Ad Spend</div><div className="p-kpi-value">$12.4K</div><div className="p-kpi-change up">↑ 8% vs last month</div></div>
                    <div className="p-kpi"><div className="p-kpi-label">ROAS</div><div className="p-kpi-value">4.2x</div><div className="p-kpi-change up">↑ 0.6 from baseline</div></div>
                    <div className="p-kpi"><div className="p-kpi-label">Conversions</div><div className="p-kpi-value">847</div><div className="p-kpi-change up">↑ 23% growth</div></div>
                    <div className="p-kpi"><div className="p-kpi-label">SEO Keywords</div><div className="p-kpi-value">142</div><div className="p-kpi-change up">↑ 18 new rankings</div></div>
                  </div>
                  <div className="p-chart">
                    <div className="p-chart-title">Cross-Platform Performance — Last 30 Days</div>
                    <div className="chart-bars" id="chart">
                      {[42,58,53,38,68,62,48,73,78,58,62,82,70,88,65,76].map((h, i) => (
                        <div key={i} className={`bar ${i % 2 === 0 ? 'bar-meta' : 'bar-google'}`} style={{ '--h': h + '%' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NUMBERS TICKER ===== */}
      <div className="ticker-strip">
        <div className="ticker-track">
          {['$2.4M monitored','·','147 teams onboard','·','23% avg waste recovered','·','4.2x average ROAS','·','15-min protection cycle','·','6 AI agents','·','Meta + Google + SEO unified','·','Zero manual checks needed','·',
            '$2.4M monitored','·','147 teams onboard','·','23% avg waste recovered','·','4.2x average ROAS','·','15-min protection cycle','·','6 AI agents','·','Meta + Google + SEO unified','·','Zero manual checks needed','·'].map((t, i) => (
            <span key={i} className={t === '·' ? 'ticker-sep' : ''}>{t}</span>
          ))}
        </div>
      </div>

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
              <div className="pain-icon ic-red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
              <h3>Research Takes Forever</h3>
              <p>Manually scanning competitor ads, landing pages, and keywords across 5+ browser tabs for every campaign.</p>
              <div className="pain-stat red">4+ hrs<div className="pain-stat-sub">wasted every time you set up a campaign manually</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
              <h3>Budget Bleeds Overnight</h3>
              <p>A campaign tanks at 2am. Nobody notices until morning. By then you've burned through ₹30 of every ₹100 on bad targeting.</p>
              <div className="pain-stat orange">₹30 of every ₹100<div className="pain-stat-sub">lost to underperforming campaigns</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
              <h3>Platform Silos</h3>
              <p>Meta Ads Manager, Google Ads, Semrush, Ahrefs — separate dashboards, separate logins, no unified view.</p>
              <div className="pain-stat purple">5-7 tools<div className="pain-stat-sub">just to run one campaign</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
              <h3>Manual Optimization</h3>
              <p>Checking performance daily, pausing underperformers, adjusting bids. AI does this in minutes. You spend hours.</p>
              <div className="pain-stat red">30-60 min<div className="pain-stat-sub">daily per platform</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
              <h3>Creative Bottleneck</h3>
              <p>Juggling Canva, ChatGPT, and manual copywriting. Testing variations is slow. Windows close before you launch.</p>
              <div className="pain-stat orange">3-5 hrs<div className="pain-stat-sub">per ad set</div></div>
            </div>
            <div className="pain-card">
              <div className="pain-icon ic-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h3>SEO Is an Afterthought</h3>
              <p>SEO and paid ads run in parallel but nobody connects keyword insights to ad strategy. Double the work, half the results.</p>
              <div className="pain-stat" style={{ color: 'var(--accent-blue)' }}>5-10 hrs<div className="pain-stat-sub">extra weekly</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PILLARS — BENTO GRID ===== */}
      <section className="pillars" id="features">
        <div className="container">
          <div className="sec-label">The Solution</div>
          <h2 className="sec-title">One Guardian.<br />Six Ways It Protects Your Spend.</h2>
          <p className="sec-sub">Each agent is a specialized pipeline that collects data, reasons with AI, and takes action — so you don't have to.</p>
          <div className="pillar-grid">
            <div className="pillar-card bento-wide accent-red">
              <div className="live-indicator"><span className="live-indicator-dot" />LIVE</div>
              <div className="pillar-num">01</div>
              <h3>Budget Guardian</h3>
              <p>Monitors campaigns every 15 min. Pauses bleeders. Scales winners. Acts before you wake up — so you never open Ads Manager to a disaster again.</p>
            </div>
            <div className="pillar-card accent-blue">
              <div className="live-indicator"><span className="live-indicator-dot" />RUNNING</div>
              <div className="pillar-num">02</div>
              <h3>Research Agent</h3>
              <p>Drop in your URL. AI discovers competitors, analyzes their ads via Meta Ad Library, identifies winning patterns, and generates a competitive intelligence report.</p>
            </div>
            <div className="pillar-card bento-wide accent-pink">
              <div className="live-indicator"><span className="live-indicator-dot" />RUNNING</div>
              <div className="pillar-num">03</div>
              <h3>Creative Agent</h3>
              <p>Generates 5-10 headline variations, copy options, CTA suggestions, image prompts, and audience targeting — all based on research insights.</p>
            </div>
            <div className="pillar-card accent-purple">
              <div className="live-indicator"><span className="live-indicator-dot" />LIVE</div>
              <div className="pillar-num">04</div>
              <h3>Campaign Autopilot</h3>
              <p>One-click deployment to Meta and Google. AI handles audiences, bidding, placements, and cross-platform budget allocation automatically.</p>
            </div>
            <div className="pillar-card accent-emerald">
              <div className="live-indicator"><span className="live-indicator-dot" />RUNNING</div>
              <div className="pillar-num">05</div>
              <h3>SEO Intelligence</h3>
              <p>Keyword tracking, competitor gap analysis, content briefs, technical audits, and AI visibility monitoring — connected to your ad strategy.</p>
            </div>
            <div className="pillar-card bento-wide accent-cyan">
              <div className="live-indicator"><span className="live-indicator-dot" />LIVE</div>
              <div className="pillar-num">06</div>
              <h3>Unified Dashboard</h3>
              <p>Cross-platform ROAS, CPA, conversions, and SEO rankings in one view. AI-generated weekly reports. White-label export for agencies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PIPELINE ===== */}
      <section className="pipeline-section">
        <div className="container">
          <div className="sec-label" style={{ textAlign: 'center' }}>The Engine</div>
          <h2 className="sec-title" style={{ textAlign: 'center' }}>Five Agents. One Pipeline.<br />Running While You Sleep.</h2>
          <p className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 48px' }}>Real-time data flows through each specialized AI agent in sequence, every 15 minutes.</p>
          <div className="pipeline-track" ref={pipelineRef}>
            <div className="pipeline-nodes">
              <div className="pipeline-node pn-blue">
                <div className="pn-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                </div>
                <div className="pn-label">AD INPUT</div>
                <div className="pn-sub">Live data feed</div>
              </div>

              <div className="pipeline-connector pc-to-purple">
                <div className="pc-packet" /><div className="pc-packet" />
              </div>

              <div className="pipeline-node pn-purple">
                <div className="pn-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z"/><path d="M4.93 10.93a8 8 0 1012.14 2.14"/><path d="M12 18v4"/></svg>
                </div>
                <div className="pn-label">AI ANALYSIS</div>
                <div className="pn-sub">Pattern detection</div>
              </div>

              <div className="pipeline-connector pc-to-pink">
                <div className="pc-packet" /><div className="pc-packet" />
              </div>

              <div className="pipeline-node pn-pink">
                <div className="pn-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                </div>
                <div className="pn-label">TARGETING</div>
                <div className="pn-sub">Audience match</div>
              </div>

              <div className="pipeline-connector pc-to-amber">
                <div className="pc-packet" /><div className="pc-packet" />
              </div>

              <div className="pipeline-node pn-amber">
                <div className="pn-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <div className="pn-label">CREATIVE</div>
                <div className="pn-sub">Ad generation</div>
              </div>

              <div className="pipeline-connector pc-to-emerald">
                <div className="pc-packet" /><div className="pc-packet" />
              </div>

              <div className="pipeline-node pn-emerald">
                <div className="pn-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                </div>
                <div className="pn-label">LAUNCH</div>
                <div className="pn-sub">Auto-deploy</div>
              </div>
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
          <div className="steps-track" ref={stepsTrackRef}>
            <div className="steps-connector">
              <div className="steps-connector-fill" ref={stepsFillRef} />
              <div className="step-packet" /><div className="step-packet" /><div className="step-packet" />
            </div>
            <div className="steps-row">
              <div className="step">
                <div className="step-node step-completed">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <h3>Connect Accounts</h3>
                <p>Link your Meta Ads, Google Ads, and Slack in 60 seconds via OAuth. Your data stays yours.</p>
              </div>
              <div className="step">
                <div className="step-node step-active">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z"/>
                    <path d="M4.93 10.93a8 8 0 1012.14 2.14"/><path d="M12 18v4"/>
                  </svg>
                </div>
                <h3>Let AI Build</h3>
                <p>AI researches competitors, generates ad creative, configures campaigns, and sets automation rules.</p>
              </div>
              <div className="step">
                <div className="step-node">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                  </svg>
                </div>
                <h3>Approve &amp; Scale</h3>
                <p>Review AI suggestions, approve with one click, and watch the optimization engine scale your winners.</p>
              </div>
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
              <tr><th>Feature</th><th>Madgicx</th><th>Semrush</th><th>AdCreative.ai</th><th className="us">AdPilot ✦</th></tr>
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
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '32px', marginTop: '-24px' }}>
            Early access pricing. First 200 users locked in forever. 147 spots taken.
          </p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-plan">Starter</div>
              <div className="price-amt">$49 <span>/month</span></div>
              <p className="price-desc">For solo marketers testing AI automation.</p>
              <ul className="price-list">
                {['1 ad platform (Meta or Google)','5 active campaigns','3 AI research reports/mo','20 AI ad generations/mo','50 SEO keywords tracked'].map(f => (
                  <li key={f}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>{f}</li>
                ))}
              </ul>
              <Link to="/register" className="price-btn price-btn-outline">Start Free Trial</Link>
            </div>
            <div className="price-card pop">
              <div className="price-badge">Most Popular</div>
              <div className="price-plan">Growth</div>
              <div className="price-amt">$149 <span>/month</span></div>
              <p className="price-desc">For growing teams and agencies managing multiple campaigns.</p>
              <ul className="price-list">
                {['Meta + Google Ads','25 active campaigns','15 AI research reports/mo','100 AI ad generations/mo','250 SEO keywords tracked','PDF report export'].map(f => (
                  <li key={f}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>{f}</li>
                ))}
              </ul>
              <Link to="/register?plan=growth" className="price-btn price-btn-fill">Get Started Now</Link>
            </div>
            <div className="price-card">
              <div className="price-plan">Scale</div>
              <div className="price-amt">$299 <span>/month</span></div>
              <p className="price-desc">For agencies and enterprises needing unlimited everything.</p>
              <ul className="price-list">
                {['All platforms + TikTok + LinkedIn','Unlimited campaigns','Unlimited AI features','Unlimited SEO tracking','White-label reports + API','Dedicated success manager'].map(f => (
                  <li key={f}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>{f}</li>
                ))}
              </ul>
              <Link to="/register?plan=scale" className="price-btn price-btn-outline">Contact Sales</Link>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
            Annual billing saves 20% · 14-day money-back guarantee ·{' '}
            <Link to="/pricing" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>See full plan details →</Link>
          </p>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="cta-final">
        <div className="cta-streak" /><div className="cta-streak" /><div className="cta-streak" /><div className="cta-streak" />
        <div className="container">
          <h2>How Much Are You Losing<br /><span className="gradient-text">Right Now?</span></h2>
          <p>The average team wastes 23% of ad budget on campaigns that underperform. AdPilot catches them automatically.</p>
          <div className="hero-ctas">
            <div className="cta-btn-wrap">
              <div className="cta-btn-halo" />
              <Link to="/register" className="btn-primary">Start Protecting My Budget — Free</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer>
        <div className="footer-meteor" /><div className="footer-meteor" /><div className="footer-meteor" />
        <div className="footer-meteor" /><div className="footer-meteor" /><div className="footer-meteor" />
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
              <a href="#features">Features</a><a href="#pricing">Pricing</a>
              <a href="#">Integrations</a><a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="#">Documentation</a><a href="#">API Reference</a><a href="#">Blog</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a><a href="#">Terms of Service</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 AdPilot. All rights reserved.</p>
            <p>Built by Vedang Vaidya &amp; Aditya</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
