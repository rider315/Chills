import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* ───────── inline keyframes & animations ───────── */
const animationStyles = `
@keyframes conveyorBelt {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes floatUp {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes floatUpSlow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes popIn {
  0% { opacity: 0; transform: scale(0.7) rotate(-6deg); }
  60% { transform: scale(1.05) rotate(1deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes slideInLeft {
  0% { opacity: 0; transform: translateX(-60px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes slideInRight {
  0% { opacity: 0; transform: translateX(60px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes slideInUp {
  0% { opacity: 0; transform: translateY(40px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}
@keyframes gearSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes gearSpinReverse {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-360deg); }
}
@keyframes envelopeBounce {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-6px) rotate(2deg); }
  75% { transform: translateY(-3px) rotate(-1deg); }
}
@keyframes stampDown {
  0%, 70%, 100% { transform: translateY(0) scale(1); }
  80% { transform: translateY(4px) scale(0.96); }
  90% { transform: translateY(-2px) scale(1.02); }
}
@keyframes smokeRise {
  0% { opacity: 0.7; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(2); }
}
@keyframes dashMove {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -20; }
}
@keyframes fadeInScale {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}

.anim-float { animation: floatUp 3s ease-in-out infinite; }
.anim-float-slow { animation: floatUpSlow 4s ease-in-out infinite; }
.anim-pop { animation: popIn 0.6s ease-out both; }
.anim-slide-left { animation: slideInLeft 0.7s ease-out both; }
.anim-slide-right { animation: slideInRight 0.7s ease-out both; }
.anim-slide-up { animation: slideInUp 0.6s ease-out both; }
.anim-pulse { animation: pulse 2s ease-in-out infinite; }
.anim-sparkle { animation: sparkle 2s ease-in-out infinite; }
.anim-gear { animation: gearSpin 4s linear infinite; }
.anim-gear-rev { animation: gearSpinReverse 3s linear infinite; }
.anim-envelope { animation: envelopeBounce 2s ease-in-out infinite; }
.anim-stamp { animation: stampDown 3s ease-in-out infinite; }
.anim-smoke { animation: smokeRise 2s ease-out infinite; }
.anim-fade-scale { animation: fadeInScale 0.5s ease-out both; }

.conveyor-track {
  animation: conveyorBelt 12s linear infinite;
}

.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.7s ease-out, transform 0.7s ease-out;
}
.scroll-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
`;

/* ───────── scroll‑reveal hook ───────── */
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealDiv({ className = '', children, style, ...rest }) {
  const ref = useScrollReveal();
  return <div ref={ref} className={`scroll-reveal ${className}`} style={style} {...rest}>{children}</div>;
}

/* ═══════════════════════════ COMPONENTS ═══════════════════════════ */

/* ── Navbar ── */
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-bw/95 backdrop-blur-sm border-b-2 border-border shadow-neosm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 group">
          <span className="bg-neo-blue text-bw px-2 py-0.5 text-2xl font-black inline-block -rotate-2 border-2 border-border shadow-neosm transition-transform group-hover:rotate-0 group-hover:scale-105">
            Chills
          </span>
          <span className="text-2xl">❄️</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="btn-neo btn-neo-white text-sm">Log in</Link>
          <Link to="/register" className="btn-neo btn-neo-green text-sm">Get Started 🚀</Link>
        </div>

        {/* Mobile burger */}
        <button onClick={() => setOpen(!open)} className="md:hidden btn-neo btn-neo-white !px-3 !py-2" aria-label="Menu">
          <span className="text-xl">{open ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-bw border-t-2 border-border px-5 pb-5 flex flex-col gap-3 anim-fade-scale">
          <Link to="/login" className="btn-neo btn-neo-white w-full text-center" onClick={() => setOpen(false)}>Log in</Link>
          <Link to="/register" className="btn-neo btn-neo-green w-full text-center" onClick={() => setOpen(false)}>Get Started 🚀</Link>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ── */
function Hero() {
  return (
    <section className="pt-32 pb-10 md:pt-40 md:pb-16 px-5">
      <div className="max-w-5xl mx-auto text-center flex flex-col items-center gap-6">
        {/* Badge */}
        <div className="badge-neo bg-neo-yellow anim-pop" style={{ animationDelay: '0.1s' }}>
          ✨ AI-Powered Cold Email Platform
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.05] anim-pop" style={{ animationDelay: '0.25s' }}>
          <span className="inline-block bg-neo-green px-3 py-1 -rotate-2 border-2 border-border shadow-neo mr-2 transition-transform hover:rotate-0 hover:scale-105">
            Cold Emails
          </span>
          <br className="sm:hidden" />
          that actually<br />get{' '}
          <span className="inline-block bg-neo-yellow px-3 py-1 rotate-1 border-2 border-border shadow-neo transition-transform hover:rotate-0 hover:scale-105">
            replies
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl max-w-2xl font-medium opacity-80 anim-slide-up" style={{ animationDelay: '0.45s' }}>
          Upload your resume, add recruiters, and let AI write personalized cold emails that land interviews.
        </p>

        {/* CTA */}
        <Link to="/register" className="btn-neo text-lg !px-10 !py-4 anim-slide-up anim-pulse" style={{ animationDelay: '0.6s' }}>
          Start for Free →
        </Link>

        {/* Social proof */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2 anim-slide-up" style={{ animationDelay: '0.75s' }}>
          <span className="badge-neo bg-bw">🚀 500+ emails sent</span>
          <span className="badge-neo bg-bw">⭐ 4.9/5 rating</span>
          <span className="badge-neo bg-bw">💼 120+ interviews landed</span>
        </div>
      </div>
    </section>
  );
}

/* ── Conveyor Belt / Pipeline Animation ── */
function ConveyorBelt() {
  return (
    <RevealDiv className="py-12 md:py-20 px-5 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-4 tracking-tight">
          The <span className="inline-block bg-neo-teal text-bw px-2 -rotate-1 border-2 border-border shadow-neosm">Magic</span> Pipeline
        </h2>
        <p className="text-center font-medium opacity-70 mb-10 max-w-xl mx-auto">Your resume goes in, personalized emails come out. Like magic — but it's AI.</p>

        {/* Main pipeline */}
        <div className="relative flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-0">
          
          {/* Stage 1 — Resume Input */}
          <div className="flex flex-col items-center gap-3 z-10 anim-float">
            <div className="card-neo bg-neo-yellow !border-4 p-6 sm:p-8 flex flex-col items-center gap-3 w-52 sm:w-60 transition-transform hover:scale-105">
              <span className="text-5xl sm:text-6xl">📄</span>
              <span className="font-black text-sm uppercase tracking-wider">Your Resume</span>
              <div className="w-full space-y-1.5">
                <div className="h-2 bg-border rounded-full w-full" />
                <div className="h-2 bg-border rounded-full w-3/4" />
                <div className="h-2 bg-border rounded-full w-5/6" />
                <div className="h-2 bg-border rounded-full w-1/2" />
              </div>
            </div>
          </div>

          {/* Arrow / Conveyor 1 */}
          <div className="hidden lg:flex items-center w-24 xl:w-32">
            <svg width="100%" height="40" viewBox="0 0 120 40" fill="none">
              <line x1="0" y1="20" x2="100" y2="20" stroke="black" strokeWidth="3" strokeDasharray="8 6" style={{ animation: 'dashMove 1s linear infinite' }} />
              <polygon points="100,10 120,20 100,30" fill="black" />
            </svg>
          </div>
          <div className="lg:hidden flex items-center justify-center">
            <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
              <line x1="20" y1="0" x2="20" y2="45" stroke="black" strokeWidth="3" strokeDasharray="8 6" style={{ animation: 'dashMove 1s linear infinite' }} />
              <polygon points="10,45 20,60 30,45" fill="black" />
            </svg>
          </div>

          {/* Stage 2 — AI Machine */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="relative card-neo bg-neo-purple !border-4 p-6 sm:p-8 flex flex-col items-center gap-3 w-56 sm:w-72 transition-transform hover:scale-105">
              {/* Smoke puffs */}
              <div className="absolute -top-6 left-1/4">
                <span className="text-2xl anim-smoke" style={{ animationDelay: '0s' }}>💨</span>
              </div>
              <div className="absolute -top-8 left-1/2">
                <span className="text-xl anim-smoke" style={{ animationDelay: '0.7s' }}>💨</span>
              </div>
              <div className="absolute -top-5 right-1/4">
                <span className="text-2xl anim-smoke" style={{ animationDelay: '1.3s' }}>💨</span>
              </div>

              {/* Gears */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-3xl sm:text-4xl anim-gear">⚙️</span>
                <span className="text-4xl sm:text-5xl anim-gear-rev">⚙️</span>
                <span className="text-3xl sm:text-4xl anim-gear">⚙️</span>
              </div>

              <span className="font-black text-bw text-lg sm:text-xl uppercase tracking-wider">AI Engine</span>
              <span className="text-bw text-xs font-bold opacity-80 text-center">Analyzing skills · Matching roles · Crafting emails</span>

              {/* Sparkles around the machine */}
              <span className="absolute -top-3 -right-3 text-xl anim-sparkle" style={{ animationDelay: '0s' }}>✨</span>
              <span className="absolute -bottom-3 -left-3 text-xl anim-sparkle" style={{ animationDelay: '1s' }}>✨</span>
              <span className="absolute top-1/2 -right-4 text-lg anim-sparkle" style={{ animationDelay: '0.5s' }}>⚡</span>
            </div>
          </div>

          {/* Arrow / Conveyor 2 */}
          <div className="hidden lg:flex items-center w-24 xl:w-32">
            <svg width="100%" height="40" viewBox="0 0 120 40" fill="none">
              <line x1="0" y1="20" x2="100" y2="20" stroke="black" strokeWidth="3" strokeDasharray="8 6" style={{ animation: 'dashMove 1s linear infinite' }} />
              <polygon points="100,10 120,20 100,30" fill="black" />
            </svg>
          </div>
          <div className="lg:hidden flex items-center justify-center">
            <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
              <line x1="20" y1="0" x2="20" y2="45" stroke="black" strokeWidth="3" strokeDasharray="8 6" style={{ animation: 'dashMove 1s linear infinite' }} />
              <polygon points="10,45 20,60 30,45" fill="black" />
            </svg>
          </div>

          {/* Stage 3 — Email Output */}
          <div className="flex flex-col items-center gap-3 z-10 anim-float-slow">
            <div className="card-neo bg-neo-green !border-4 p-6 sm:p-8 flex flex-col items-center gap-3 w-52 sm:w-60 transition-transform hover:scale-105">
              <span className="text-5xl sm:text-6xl anim-envelope">✉️</span>
              <span className="font-black text-sm uppercase tracking-wider">Personalized Email</span>
              <div className="bg-bw border-2 border-border rounded-base p-2 text-xs w-full space-y-1">
                <p className="font-bold">Hi Sarah,</p>
                <p className="opacity-70">I noticed your team at Stripe is...</p>
                <p className="opacity-50">— tailored for you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conveyor belt track beneath */}
        <div className="mt-8 border-t-4 border-b-4 border-border bg-gray-100 h-10 overflow-hidden hidden lg:block">
          <div className="conveyor-track flex h-full" style={{ width: '200%' }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[5%] h-full border-r-2 border-border/30 flex items-center justify-center">
                <div className="w-3 h-3 bg-border/20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </RevealDiv>
  );
}

/* ── How It Works ── */
function HowItWorks() {
  const steps = [
    { emoji: '📄', title: 'Upload Resume', desc: 'Drop your PDF and our AI extracts your skills, projects, and experience automatically.', color: 'bg-neo-yellow' },
    { emoji: '👥', title: 'Add Recruiters', desc: 'Import recruiters via CSV or add them manually with company details and roles.', color: 'bg-neo-teal' },
    { emoji: '✉️', title: 'Generate & Send', desc: 'AI crafts personalized emails for each recruiter and sends them at the perfect time.', color: 'bg-neo-green' },
  ];

  return (
    <section className="py-16 md:py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <RevealDiv className="text-center mb-14">
          <span className="badge-neo bg-neo-green mb-4 inline-block">⚡ Simple as 1-2-3</span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            How It{' '}
            <span className="inline-block bg-neo-blue text-bw px-2 rotate-1 border-2 border-border shadow-neosm">Works</span>
          </h2>
        </RevealDiv>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((s, i) => (
            <RevealDiv key={i} style={{ transitionDelay: `${i * 0.15}s` }}>
              <div className="card-neo card-neo-hover flex flex-col items-center text-center gap-4 h-full relative overflow-hidden group">
                {/* Step number */}
                <span className="absolute top-3 right-4 text-6xl font-black opacity-[0.07] select-none">
                  {i + 1}
                </span>
                <div className={`${s.color} w-20 h-20 rounded-base border-2 border-border shadow-neosm flex items-center justify-center text-4xl transition-transform group-hover:scale-110 group-hover:-rotate-6`}>
                  {s.emoji}
                </div>
                <h3 className="text-xl font-black">{s.title}</h3>
                <p className="text-sm font-medium opacity-70 leading-relaxed">{s.desc}</p>
              </div>
            </RevealDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features Grid ── */
function Features() {
  const feats = [
    { emoji: '🤖', title: 'AI-Powered Emails', desc: 'Sector-aware emails that match your skills to what the company is hiring for.', bg: 'bg-neo-purple', text: 'text-bw' },
    { emoji: '📊', title: 'Smart Dashboard', desc: 'Track applications, sent emails, replies, and interviews in one place.', bg: 'bg-neo-blue', text: 'text-bw' },
    { emoji: '⏰', title: 'Optimal Send Times', desc: 'AI suggests the best time to send based on recruiter behavior patterns.', bg: 'bg-neo-yellow', text: 'text-text' },
    { emoji: '🔄', title: 'Smart Batching', desc: 'Generate emails for 100+ recruiters in one click. Scale your outreach.', bg: 'bg-neo-green', text: 'text-text' },
    { emoji: '💬', title: 'Reply Analysis', desc: 'AI analyzes recruiter replies and suggests your best response.', bg: 'bg-neo-teal', text: 'text-bw' },
    { emoji: '🎯', title: 'Startup Spotlight', desc: 'Highlights your startup experience and flagship projects automatically.', bg: 'bg-neo-red', text: 'text-bw' },
  ];

  return (
    <section className="py-16 md:py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <RevealDiv className="text-center mb-14">
          <span className="badge-neo bg-neo-yellow mb-4 inline-block">🔥 Packed with Power</span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            Everything you{' '}
            <span className="inline-block bg-neo-green px-2 -rotate-1 border-2 border-border shadow-neosm">need</span>
          </h2>
        </RevealDiv>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {feats.map((f, i) => (
            <RevealDiv key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="card-neo card-neo-hover h-full flex flex-col gap-4 group">
                <div className={`${f.bg} ${f.text} w-14 h-14 rounded-base border-2 border-border shadow-neosm flex items-center justify-center text-2xl transition-transform group-hover:rotate-12 group-hover:scale-110`}>
                  {f.emoji}
                </div>
                <h3 className="text-lg font-black">{f.title}</h3>
                <p className="text-sm font-medium opacity-70 leading-relaxed">{f.desc}</p>
              </div>
            </RevealDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function Testimonials() {
  const reviews = [
    {
      name: 'Priya Sharma',
      role: 'SDE @ Google',
      quote: "I sent 50 cold emails using Chills and got 12 replies within a week. The AI somehow knew exactly what to highlight from my resume. Landed 3 interviews!",
      avatar: '👩‍💻',
      bg: 'bg-neo-green',
    },
    {
      name: 'James Okafor',
      role: 'PM @ Stripe',
      quote: "The batch generation is a game-changer. What used to take me an entire weekend now takes 10 minutes. Plus the emails actually sound like ME, not a robot.",
      avatar: '👨‍💼',
      bg: 'bg-neo-yellow',
    },
    {
      name: 'Emily Zhang',
      role: 'Designer @ Figma',
      quote: "As a designer, I was skeptical about AI writing my emails. But Chills nailed my tone and even highlighted my portfolio projects. Absolutely blown away.",
      avatar: '👩‍🎨',
      bg: 'bg-neo-teal',
    },
  ];

  return (
    <section className="py-16 md:py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <RevealDiv className="text-center mb-14">
          <span className="badge-neo bg-neo-teal text-bw mb-4 inline-block">💬 Real Stories</span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
            Loved by{' '}
            <span className="inline-block bg-neo-yellow px-2 rotate-1 border-2 border-border shadow-neosm">job seekers</span>
          </h2>
        </RevealDiv>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {reviews.map((r, i) => (
            <RevealDiv key={i} style={{ transitionDelay: `${i * 0.15}s` }}>
              <div className="card-neo card-neo-hover flex flex-col gap-5 h-full relative">
                {/* Big quote mark */}
                <span className="absolute top-3 right-4 text-5xl font-black opacity-[0.06] select-none">"</span>
                <p className="text-sm font-medium leading-relaxed opacity-80 flex-1">"{r.quote}"</p>
                <div className="flex items-center gap-3 pt-3 border-t-2 border-border">
                  <div className={`${r.bg} w-12 h-12 rounded-base border-2 border-border shadow-neosm flex items-center justify-center text-2xl`}>
                    {r.avatar}
                  </div>
                  <div>
                    <p className="font-black text-sm">{r.name}</p>
                    <p className="text-xs font-bold opacity-60">{r.role}</p>
                  </div>
                </div>
              </div>
            </RevealDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ── */
function FinalCTA() {
  return (
    <section className="py-16 md:py-24 px-5">
      <RevealDiv className="max-w-4xl mx-auto">
        <div className="card-neo !border-4 bg-neo-purple p-10 sm:p-14 text-center flex flex-col items-center gap-6 relative overflow-hidden">
          {/* Decorative sparkles */}
          <span className="absolute top-5 left-8 text-3xl anim-sparkle" style={{ animationDelay: '0s' }}>✨</span>
          <span className="absolute bottom-8 right-10 text-2xl anim-sparkle" style={{ animationDelay: '0.8s' }}>⚡</span>
          <span className="absolute top-1/2 left-4 text-xl anim-sparkle hidden sm:block" style={{ animationDelay: '1.5s' }}>✨</span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bw tracking-tight leading-[1.1]">
            Ready to land your<br />
            <span className="inline-block bg-neo-green text-text px-3 py-1 -rotate-1 border-2 border-border shadow-neo mt-2">
              dream job?
            </span>
          </h2>
          <p className="text-bw/80 text-lg font-medium max-w-lg">
            Start sending personalized cold emails today. No credit card required. Just results.
          </p>
          <Link to="/register" className="btn-neo btn-neo-green text-lg !px-10 !py-4 !shadow-[4px_4px_0_0_rgba(255,255,255,0.5)] hover:!shadow-[6px_6px_0_0_rgba(255,255,255,0.5)]">
            Get Started — It's Free ❄️
          </Link>
        </div>
      </RevealDiv>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="border-t-2 border-border bg-bw px-5 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="bg-neo-blue text-bw px-2 py-0.5 text-lg font-black -rotate-2 border-2 border-border shadow-neosm">
            Chills
          </span>
          <span className="text-lg">❄️</span>
        </div>

        <div className="flex items-center gap-6 text-sm font-bold">
          <a href="#" className="hover:text-neo-blue transition-colors">About</a>
          <a href="#" className="hover:text-neo-blue transition-colors">Pricing</a>
          <a href="#" className="hover:text-neo-blue transition-colors">Contact</a>
        </div>

        <p className="text-xs font-bold opacity-60">
          Made with ❄️ by Chills © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════════════ */
export default function LandingPage() {
  return (
    <>
      <style>{animationStyles}</style>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <Hero />
        <ConveyorBelt />
        <HowItWorks />
        <Features />
        <Testimonials />
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}
