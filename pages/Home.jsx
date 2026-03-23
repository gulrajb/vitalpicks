import { useState } from "react";

const articles = [
  {
    slug: "best-protein-powders",
    title: "Best Protein Powders of 2026 — Ranked & Reviewed",
    category: "Supplements",
    excerpt: "We tested 20+ protein powders so you don't have to. Here are the top picks for muscle gain, weight loss, and everyday health.",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80",
    badge: "🏆 Top Pick",
  },
  {
    slug: "best-fitness-trackers",
    title: "Best Fitness Trackers 2026 — Complete Buyer's Guide",
    category: "Gadgets",
    excerpt: "From budget-friendly bands to premium smartwatches — we break down which fitness tracker is actually worth buying.",
    readTime: "10 min read",
    image: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&q=80",
    badge: "⚡ Editor's Choice",
  },
  {
    slug: "best-collagen-supplements",
    title: "Best Collagen Supplements — What Actually Works in 2026",
    category: "Supplements",
    excerpt: "Collagen is everywhere, but most products are overhyped. We cut through the noise and tell you exactly what to buy.",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
    badge: "🔥 Trending",
  },
  {
    slug: "best-home-gym-equipment",
    title: "Best Home Gym Equipment 2026 — Build Your Gym on Any Budget",
    category: "Gadgets",
    excerpt: "You don't need a $10,000 setup to get fit at home. Here's the best equipment at every price point.",
    readTime: "12 min read",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    badge: null,
  },
  {
    slug: "best-vitamins-immunity",
    title: "Best Vitamins for Immunity — Science-Backed Picks for 2026",
    category: "Supplements",
    excerpt: "Not all vitamins are created equal. These are the only immunity supplements actually backed by solid research.",
    readTime: "9 min read",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
    badge: null,
  },
  {
    slug: "best-sleep-gadgets",
    title: "Best Sleep Gadgets of 2026 — Wake Up Actually Rested",
    category: "Gadgets",
    excerpt: "Sleep tech has exploded. We tested the best gadgets to help you fall asleep faster, sleep deeper, and wake up refreshed.",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1541480601022-2308c0f02487?w=600&q=80",
    badge: "⭐ Most Popular",
  },
];

const categories = ["All", "Supplements", "Gadgets"];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const filtered = activeCategory === "All"
    ? articles
    : articles.filter(a => a.category === activeCategory);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#f8faf8", minHeight: "100vh" }}>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e8f0e8", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>💚</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: "#1a6b3a", letterSpacing: "-0.5px" }}>VitalPicks</span>
            <span style={{ fontSize: 12, color: "#888", marginLeft: 4 }}>.org</span>
          </div>
          <nav style={{ display: "flex", gap: 24 }}>
            {["Reviews", "Supplements", "Gadgets", "About"].map(n => (
              <a key={n} href="#" style={{ textDecoration: "none", color: "#444", fontSize: 14, fontWeight: 500 }}>{n}</a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #1a6b3a 0%, #2d9b5a 50%, #3dbf6f 100%)", color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 16px", fontSize: 13, marginBottom: 20, fontWeight: 500 }}>
            🔬 Science-backed health reviews you can trust
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 900, margin: "0 0 20px", lineHeight: 1.15, letterSpacing: "-1px" }}>
            Find the Best Health Products — <span style={{ color: "#a8f0c8" }}>Without the Guesswork</span>
          </h1>
          <p style={{ fontSize: 18, opacity: 0.9, lineHeight: 1.6, margin: "0 0 36px" }}>
            Honest, in-depth reviews of supplements and wellness gadgets. We research everything so you can buy with confidence.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#articles" style={{ background: "#fff", color: "#1a6b3a", padding: "14px 28px", borderRadius: 30, fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
              Browse Reviews →
            </a>
            <a href="#newsletter" style={{ background: "transparent", color: "#fff", padding: "14px 28px", borderRadius: 30, fontWeight: 600, textDecoration: "none", fontSize: 15, border: "2px solid rgba(255,255,255,0.5)" }}>
              Get Weekly Picks
            </a>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "center", gap: "clamp(20px, 4vw, 60px)", flexWrap: "wrap" }}>
          {["✅ Independently Tested", "🔗 Affiliate Disclosure", "📊 Data-Driven Reviews", "🌍 India & USA Picks"].map(item => (
            <span key={item} style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Articles */}
      <section id="articles" style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0 }}>Latest Reviews</h2>
            <p style={{ color: "#666", margin: "6px 0 0", fontSize: 15 }}>Updated weekly with the best finds</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: activeCategory === cat ? "#1a6b3a" : "#f0f0f0",
                  color: activeCategory === cat ? "#fff" : "#555",
                  transition: "all 0.2s"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 28 }}>
          {filtered.map(article => (
            <div key={article.slug} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
            >
              <div style={{ position: "relative" }}>
                <img src={article.image} alt={article.title} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                {article.badge && (
                  <span style={{ position: "absolute", top: 12, left: 12, background: "#1a6b3a", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {article.badge}
                  </span>
                )}
                <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 11 }}>
                  {article.category}
                </span>
              </div>
              <div style={{ padding: "20px 22px 24px" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 10px", lineHeight: 1.4 }}>{article.title}</h3>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 16px" }}>{article.excerpt}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#999" }}>⏱ {article.readTime}</span>
                  <a href="#" style={{ color: "#1a6b3a", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Read Review →</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section id="newsletter" style={{ background: "linear-gradient(135deg, #1a6b3a, #2d9b5a)", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <span style={{ fontSize: 40 }}>📬</span>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "16px 0 12px" }}>Get the Best Health Picks Weekly</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, margin: "0 0 28px", lineHeight: 1.6 }}>
            Join 10,000+ readers who get our top supplement and gadget finds every week. No spam, ever.
          </p>
          {subscribed ? (
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "20px", color: "#fff", fontWeight: 600, fontSize: 16 }}>
              🎉 You're in! Check your inbox for a welcome email.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, maxWidth: 420, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ flex: 1, minWidth: 220, padding: "14px 18px", borderRadius: 30, border: "none", fontSize: 15, outline: "none" }}
              />
              <button
                onClick={() => email && setSubscribed(true)}
                style={{ background: "#fff", color: "#1a6b3a", padding: "14px 24px", borderRadius: 30, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
              >
                Subscribe →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#111", color: "#aaa", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>💚</span>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: 18 }}>VitalPicks.org</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 600, margin: "0 auto 20px" }}>
            VitalPicks.org is a participant in the Amazon Associates Program and other affiliate programs. We earn a small commission when you buy through our links — at no extra cost to you. All reviews are our honest opinion.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {["Privacy Policy", "Affiliate Disclosure", "Contact", "About Us"].map(l => (
              <a key={l} href="#" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#555", marginTop: 20 }}>© 2026 VitalPicks.org — All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
