# AdPilot — Product Plan & Roadmap

> Living document. Update after every phase or session.
> Last updated: 2026-03-15

---

## 1. The Honest Diagnosis

Before planning new features — understand what's broken at the core. Right now AdPilot has a **trust problem**:

| Signal | What the user sees | What's actually happening |
|---|---|---|
| Analytics charts | Nice upward ROAS trend | `MOCK_SERIES` hardcoded, never changes |
| Dashboard sparklines | Always trending upward | Generated from delta, always fake |
| Apex scoring | "78/100 Ready to Scale" | `charSum % 40 + 45` — same score forever |
| Anomaly detection | "Anomaly detected in ROAS" | Z-score vs hardcoded baseline arrays |

An ad manager running $50k/month opens AdPilot, sees a 78/100 health score and nice ROAS trend. Then they check Meta Ads Manager — ROAS is actually 1.2x and dropping. **They never come back.**

**Everything built on top of fake data is theater. Fix the foundation first.**

---

## 2. Radar vs Pulse — The Overlap Problem

Currently 95% the same thing. Both:
- Take a competitor domain
- Crawl with Puppeteer
- Return keywords, CTAs, messaging, weaknesses
- Show win-back opportunities

### The canonical split:

**PULSE `/research` — Market Intelligence Layer**
> "What's the landscape across all my competitors?"
- Tracked competitor list (CRUD)
- Keyword gap table across ALL competitors
- Market-level keyword trends (search volume, difficulty, opportunity)
- Industry share-of-voice (who owns what keywords)
- AI Visibility map (GEO — which competitors appear in AI answers)
- Saved market research reports (history)
- **Does NOT do:** Single-competitor deep attack analysis (that's Radar)

**RADAR `/competitor-hijack` — Tactical Attack Layer**
> "I'm launching a campaign against THIS competitor next week"
- Deep single-competitor crawl (Puppeteer)
- Tech stack, CTAs, messaging angles, full keyword footprint
- AI-generated counter-ad templates
- Win-back opportunities
- "Counter in Forge" button → Forge pre-filled
- Change detection (did their site change since last scan?)
- **Does NOT do:** Market-level trends or multi-competitor view

### Action items:
- Strip full hijack analysis flow out of Pulse's Ad Intelligence tab
- Pulse Ad Intelligence tab → replace with AI Visibility (GEO) map
- Pulse keeps: competitor tracking list, keyword gaps, market trends

---

## 3. AEO + GEO — The Next Frontier

### What these actually are (food brand mental model)

You run **ProteinChef** — meal prep kits for gym-goers. You spend $40k/month on Meta and Google ads.

**Traditional SEO (what Beacon already does):**
Someone types "best meal prep service" into Google → you want to rank #1 in the blue links.

**AEO — Answer Engine Optimization:**
Someone asks Siri: "What's the best high-protein meal prep service?"
Google's featured snippet answers with text from Healthline.com.
ProteinChef is not on Healthline. ProteinChef is **invisible**.

**GEO — Generative Engine Optimization:**
Someone asks ChatGPT: "Best meal prep for bodybuilders in 2025?"
AI answers: "Top options include Trifecta, Factor, and Green Chef…"
ProteinChef is not cited. The $40k/month in ads is fighting against **free AI citations** their competitors are getting.

### The compounding effect no ad manager currently sees:

```
Trifecta appears in ChatGPT answers for "best high protein meal prep"
→ 50,000 people/month ask this
→ Trifecta gets brand awareness for free
→ Same people see Trifecta retargeting ads
→ Trifecta's CPC is lower because of brand recognition
→ Your CPC keeps rising because you have no AI awareness lift
```

### The CTR stat that makes GEO/AEO urgent for ad managers

**From Seer Interactive's study of 3,119 queries across 42 clients:**

| Condition | Paid CTR | Change |
|---|---|---|
| No AI Overview present | 19.7% | baseline |
| AI Overview present | 6.34% | **-68%** |
| Cited INSIDE the AIO | +91% more | **opportunity** |

An ad manager spending $40k/month on keywords that trigger AI Overviews:
- Their effective CPC just went from $2.80 → $8.75
- Their competitor cited in the AIO: effective CPC dropped to $1.46
- **AdPilot is the only platform that can detect this and tell them**

### How AdPilot integrates GEO/AEO

**Signal graph — each gap creates an action across features:**

```
AI Visibility Gap: "best meal prep high protein" → ProteinChef not cited

→ BEACON:   "Add FAQ schema to /meal-prep page.
             Structured data increases AI citation probability 3x"

→ FORGE:    "Generate FAQ article: 'Is ProteinChef good for bodybuilders?'
             (This is the format AI engines pull citations from)"

→ SENTINEL: "Increase brand awareness budget 20% —
             brand mentions in forums = GEO signal.
             More Meta impressions → more brand signals → more AI citations"

→ RADAR:    "Trifecta appears in 8/10 AI answers.
             Their strategy: long-form nutrition guides with citations.
             Counter: Create 'ProteinChef vs Trifecta' comparison page"
```

### Implementation is easier than expected

ValueSERP already supports AI Overview data — just add `include_ai_overview=true`:

```javascript
// src/services/seo/SerpService.js — minimal change needed
async getRankWithAIO(keyword, domain) {
  const resp = await axios.get('https://api.valueserp.com/search', {
    params: {
      api_key:             this.apiKey,
      q:                   keyword,
      domain:              'google.com',
      gl:                  'us',
      include_ai_overview: true,  // ← just add this
    }
  });

  const rank  = this._extractRank(resp.data, domain);
  const aio   = resp.data.ai_overview ?? null;
  const cited = aio?.references?.some(
    ref => (ref.link || '').includes(domain)
  ) ?? false;

  return { rank, aioPresent: !!aio, citedInAIO: cited, aioSources: aio?.references ?? [] };
}
```

That single extension gives you: AIO present? → flag 68% CTR penalty. You cited? → flag +91% opportunity. Who else cited? → GEO gap.

### Competitive moat — no ad platform does this yet

| Tool | Tracks AI Visibility | Connected to Bids | Connected to Creative |
|---|---|---|---|
| Otterly.ai | ✓ | ✗ | ✗ |
| Ahrefs Brand Radar | ✓ | ✗ | ✗ |
| LLMClicks | ✓ | ✗ | ✗ |
| SE Ranking | ✓ | ✗ | ✗ |
| **AdPilot** | **✓ (planned)** | **✓ via Sentinel** | **✓ via Forge** |

---

## 4. What's Real vs Fake Right Now

| Feature | Real | Fake / Mock | Status |
|---|---|---|---|
| Campaign CRUD | ✅ | — | Done |
| Ad Studio (Forge) | ✅ Gemini/Groq/Cerebras | — | Done |
| Analytics charts (time-series) | ✅ CampaignMetricSnapshot | MOCK_SERIES removed | **Phase 1 ✅** |
| Apex scoring | ✅ real 7-day snapshot avg | charSum % 40 removed | **Phase 1 ✅** |
| Anomaly detection | ✅ real snapshot baseline | hardcoded arrays removed | **Phase 1 ✅** |
| Dashboard sparklines | ❌ | Generated from delta | Phase 2 |
| SEO Audits (Beacon) | ✅ Puppeteer v2 | — | Done |
| Keyword ranks | ✅ ValueSERP | — | Done |
| Competitor crawl (Radar) | ✅ Puppeteer | — | Done |
| Research dossiers (Pulse) | ✅ hybrid | — | Done |
| Budget protection (Sentinel) | ✅ | — | Done |
| Integration OAuth | ✅ | — | Done |
| Integration data sync | ❌ | Never actually syncs | Phase 1 remaining |
| AI Visibility / GEO | ❌ | — | Phase 3 |

---

## 5. AI / API Stack

### Current live chain (2026-03-15)

```
Ad generation:
  Ollama (local) → Groq (Llama 3.3, creative task)
  → Cerebras (Llama 3.3, 20x faster)
  → Gemini (free 15rpm)
  → Together AI (Qwen 2.5 72B)
  → HuggingFace (Mistral-7B)
  → Anthropic (paid, last resort)
  → mock (labelled isMock:true)

Competitor analysis:
  Groq (DeepSeek R1 distill, reasoning task)
  → Cerebras (Qwen3 32B, reasoning)
  → Together AI (DeepSeek R1 full — best open reasoner)
  → Gemini → Anthropic

Web search:
  ValueSERP (rank tracking + AI Overview)
  → Tavily (1K/mo free, AI-native)
  → DuckDuckGo (facts/entities only)

Content extraction:
  Jina AI r.jina.ai/{url} (free, no key)
  → Puppeteer (fallback for JS-rendered pages)
```

### Task-based model routing

All AI services (Groq, Cerebras, Together AI) route by task type:

| Task | Best model |
|---|---|
| Reasoning / strategy / analysis | DeepSeek R1 (Groq distill or Together full), Qwen3 32B (Cerebras) |
| Ad copy / creative writing | Llama 3.3 70B (Groq or Cerebras) |
| Structured JSON output | Qwen QwQ 32B (Groq), Qwen3 32B (Cerebras), Qwen 2.5 72B (Together) |

### Free tier verified limits

| Provider | Free? | Card needed? | Daily limit | File |
|---|---|---|---|---|
| Ollama | ✅ | No | Unlimited (local) | OllamaService.js |
| Groq | ✅ | No | 500K tokens (70B model) | GroqService.js |
| Cerebras | ✅ | No | 1M tokens, 30 req/min | CerebraService.js |
| Gemini | ✅ | No | 1M tokens, 15 req/min | GeminiService.js |
| HuggingFace | ✅ | No | Limited free tier | HuggingFaceService.js |
| Together AI | ⚠️ | $5 min | Varies | TogetherAIService.js |
| Anthropic | ❌ | Yes | Paid | AnthropicService.js |
| Tavily search | ✅ | No | 1K/month | TavilyAdapter.js |
| ValueSERP | ✅ | No | 50/month | SerpService.js |
| Jina AI | ✅ | No | ~20 RPM keyless | inline |
| Brave Search | ❌ | Yes (2026) | Eliminated free tier | **Removed** |

---

## 6. Phases

---

### PHASE 1 — Fix the Data Foundation
**Status: COMPLETE ✅ (2026-03-15)**

> Nothing built on top of fake data is worth keeping. Real data first.

#### What was built:
- ✅ `CampaignMetricSnapshot` model added to `prisma/schema.prisma`, pushed to DB
- ✅ `GET /api/v1/analytics/time-series?range=7d|30d|90d` — reads from snapshots, empty array if no data
- ✅ `POST /api/v1/analytics/snapshots` — manual snapshot entry (for testing/manual import)
- ✅ `AnalyticsPage.jsx` — `MOCK_SERIES` removed entirely, replaced with real API call + "no data" empty state
- ✅ `AnalyticsAggregator.detectAnomalies()` — now uses last 14 snapshot rows as Z-score baseline, skips campaigns with <3 data points
- ✅ `ScalingAnalyzer` — loads real 7-day snapshot averages for ROAS/CTR/CPA (falls back to `campaign.performance` if no snapshots)
- ✅ `GroqService.js` — task-aware (DeepSeek R1 for reasoning, Llama 3.3 for creative)
- ✅ `CerebraService.js` — free 1M tokens/day, fastest inference
- ✅ `TogetherAIService.js` — DeepSeek R1 full + Qwen 2.5 72B
- ✅ `TavilyAdapter.js` — free web search + GEO citation checking

#### Still needed in Phase 1:
- ⬜ `PerformanceSyncService.js` — pulls real data from Meta/Google integrations into CampaignMetricSnapshot every 6h via Bull queue
- ⬜ Integration sync feedback UI — show user exactly what was imported after "Sync Data"

---

### PHASE 2 — Morning Briefing + Campaign Drill-Down
**Status: PLANNED**

> An ad manager opens AdPilot every morning. Right now they see a generic dashboard. They need to know what changed overnight and what to act on.

#### 2A. Dashboard Situation Report ✅ COMPLETE

**Layout decision: Option A** — Situation Report IS the dashboard. It renders first above the Health Score Banner and KPI cards. Always visible (shows empty state when no data). Title changed from "Command Center" to "Situation Report — [date]".

Replace generic dashboard with auto-generated daily briefing:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SITUATION REPORT — March 15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 URGENT (act now)
  • Summer Collection ROAS dropped to 1.2x overnight (was 2.8x)
    7-day spend: $4,200 → Action: Pause or refresh creative

  • Retargeting campaign exceeded daily budget by 23%
    Spent $1,840 vs $1,500 limit → Sentinel auto-paused at 11pm

🟡 WATCH (monitor today)
  • Competitor nike.com updated their landing page (Radar detected)
    New CTA: "Free Returns on All Orders" — new angle detected

🟢 WINNERS (scale these)
  • Brand Awareness — Google ROAS 4.1x, 78% IS lost to budget
    Apex: Scale +20% today ($3,000 → $3,600)
```

**Implementation:**
- Reads last 24h of CampaignMetricSnapshot changes (ROAS delta > 30% overnight = URGENT)
- Queries Sentinel alert log for actions taken overnight
- Queries ScalingAnalyzer for campaigns with score ≥75
- Stores generated briefing in Redis, refreshes at 5am daily

#### 2B. Campaign Detail Page `/campaigns/:id`

```
Campaign: Summer Collection Meta
Status: Active | Budget: $1,500/day | Spend: $12,450 total

PERFORMANCE (last 7 days from CampaignMetricSnapshot)
Spend       $4,200    ↑12% vs prev week
ROAS        1.2x      ↓57% vs prev week  ← RED FLAG
CTR         0.8%      ↓0.4% vs prev week
CPA         $87       ↑40% vs prev week
Frequency   3.8x      (fatigue threshold: 3.5x)

7-DAY CHART [real data]

ACTIVE ADS (5 variants)
#1 "Summer Deals Are Here"   CTR 1.2% ← WINNER
#2 "Limited Time Offer"      CTR 0.7%
#3 "Shop The Collection"     CTR 0.4% ← LOSER

QUICK ACTIONS
[Pause Campaign] [Refresh in Forge] [Analyze in Radar] [Scale Budget]
```

- Every quick action opens the relevant feature with this campaign pre-loaded
- Per-ad CTR ranking pulled from `ad.performance` JSON

#### 2C. Integration Sync Feedback

After "Sync Data" click:
```
✓ Synced 3 campaigns from Meta
✓ Updated performance: $12,450 spend, 2.8x ROAS, 1.4% CTR
✓ 47 new metric snapshots recorded
Last sync: 2 minutes ago
```

---

### PHASE 3 — GEO/AEO AI Visibility Module
**Status: PLANNED**

> No ad platform connects AI citation data to bid strategy. This is the moat.

#### 3A. Extend SerpService for AI Overview data

```javascript
// src/services/seo/SerpService.js
async getRankWithAIO(keyword, domain) {
  const resp = await axios.get('https://api.valueserp.com/search', {
    params: { api_key: this.apiKey, q: keyword, include_ai_overview: true }
  });
  const aio   = resp.data.ai_overview ?? null;
  const cited = aio?.references?.some(r => (r.link || '').includes(domain)) ?? false;
  return {
    rank:        this._extractRank(resp.data, domain),
    aioPresent:  !!aio,
    citedInAIO:  cited,
    aioSources:  aio?.references ?? [],
    ctrPenalty:  !!aio && !cited,  // AIO present but you're not in it = ~68% CTR loss
  };
}
```

#### 3B. PerplexityAdapter (pplx-api)

```javascript
// src/services/aeo/PerplexityAdapter.js
async checkCitation(keyword, domain) {
  const resp = await axios.post('https://api.perplexity.ai/chat/completions', {
    model:    'llama-3.1-sonar-small-128k-online',
    messages: [{ role: 'user', content: `Best ${keyword} options 2025` }],
  }, { headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` } });

  const sources = resp.data.citations ?? [];
  const cited   = sources.some(url => url.includes(domain));
  return { cited, sources, answer: resp.data.choices[0].message.content };
}
```

#### 3C. GoogleAIOAdapter

File: `src/services/aeo/GoogleAIOAdapter.js`
- Wraps `SerpService.getRankWithAIO()`
- Returns: `{ aioPresent, citedInAIO, sources[], ctrPenaltyFlag, estimatedCtrLoss }`
- No new vendor — uses existing `VALUESERP_API_KEY`

#### 3D. AiVisibilityService (orchestrator)

File: `src/services/aeo/AiVisibilityService.js`
- For each tracked keyword → run GoogleAIOAdapter + PerplexityAdapter
- Score: `citedCount / keywordCount * 100` = AI Visibility Score (0-100)
- Compare against competitor domains
- Store results in `KeywordAioStatus` table

#### 3E. New DB table: KeywordAioStatus

```prisma
model KeywordAioStatus {
  id               String   @id @default(uuid())
  keywordId        String   @map("keyword_id")
  teamId           String   @map("team_id")
  checkedAt        DateTime @default(now()) @map("checked_at")
  aioPresent       Boolean  @default(false) @map("aio_present")
  citedInAio       Boolean  @default(false) @map("cited_in_aio")
  aioSources       Json     @default("[]") @db.JsonB @map("aio_sources")
  tavilyCited      Boolean  @default(false) @map("tavily_cited")
  ctrPenalty       Boolean  @default(false) @map("ctr_penalty")
  competitorsCited Json     @default("[]") @db.JsonB @map("competitors_cited")

  keyword Keyword @relation(fields: [keywordId], references: [id])
  team    Team    @relation(fields: [teamId], references: [id])

  @@index([teamId, checkedAt])
  @@map("keyword_aio_status")
}
```

#### 3F. AI Visibility Tab in Beacon UI

```
AI VISIBILITY REPORT — proteinchef.com

OVERALL AI SCORE: 12/100  (Industry avg: 34/100)

TRACKED KEYWORDS (10)
Keyword                      Google AIO  Perplexity  Competitor cited
────────────────────────────────────────────────────────────────────
best meal prep high protein    ✗           ✗           trifecta.com ✓
meal prep bodybuilder          ✗           ✗           factor.co ✓
high protein lunch ideas       ✗           ✓           —
meal prep service review       ✗           ✗           greenchef.com ✓
healthy meal delivery          ✓           ✗           —

WHAT'S BLOCKING YOU
• Missing FAQ schema on 8 product pages
• No long-form citation-worthy content for top 3 keywords
• Zero brand mentions in nutrition/fitness publications

HOW TO FIX
[→ Beacon: Fix missing schema on 8 pages]
[→ Forge: Generate FAQ content for "best meal prep high protein"]
[→ Radar: See how Trifecta earns AI citations]
[→ Sentinel: Increase brand awareness budget]
```

#### 3G. GEO signals map to Beacon rules

| GEO Ranking Signal | AdPilot Has It? | Action |
|---|---|---|
| FAQ schema markup | Add to rule registry | Beacon surfaces it, Forge generates content |
| Question-format H2 headings | Beacon checks heading structure | Add AIO-specific check |
| Organization schema | Not in Beacon yet | Add rule: missing-organization-schema |
| Content recency | Beacon checks last-modified | Connect to GEO score |
| Top-10 organic rank (prerequisite) | Beacon tracks ranks | If rank > 10 → AIO citation nearly impossible |

#### 3H. AIO Penalty in Sentinel

- When active campaign targets keyword that triggers AIO → Sentinel alert:
  `"Summer Collection targeting 'best meal kit' — AIO detected, paid CTR reduced ~68%"`
- Action button: "Optimize for AI citation" → links to Beacon + Forge

---

### PHASE 4 — Pulse vs Radar Separation + Market Intel
**Status: PLANNED**

#### 4A. Strip hijack analysis from Pulse
- Remove the 4-step animation / hijack analysis from ResearchPage Ad Intelligence tab
- That entire flow belongs to Radar only

#### 4B. Pulse becomes market intelligence
- Share-of-voice chart across all tracked competitors
- Keyword landscape heatmap (who owns which keyword cluster)
- Industry trend signals (rising/falling volume by keyword group)
- AI Visibility map — which competitors appear in AI answers across all tracked keywords

#### 4C. Radar gets change detection
- Hash competitor's homepage/key pages on each crawl
- Alert when CTA/headline/key content changes
- "Competitor changed landing page 2 days ago — new angle: Free Returns"
- Feed change alerts into Morning Briefing (Phase 2)

---

### PHASE 5 — Connected Signal Graph
**Status: PLANNED**

Every feature feeds every other. No more islands.

```
RADAR detects competitor changed CTA to "Free Returns"
  → SENTINEL: "Competitor updated offer — consider defensive spend increase"
  → FORGE:    "Generate counter-ad: highlight your free returns"

BEACON finds page speed 4.2s
  → APEX:     "Quality Score penalty likely — don't scale until page fixed"
  → FORGE:    "Generate ad copy compensating for slow landing page — emphasize trust"

APEX detects ROAS trending up + high budget utilization
  → SENTINEL: "Scale approved — executing +15% budget increase"
  → DASHBOARD: Morning briefing logs overnight action

GEO: Competitor in 8/10 AI Overviews, you in 0
  → FORGE:    "Generate FAQ content for top 3 AI gap keywords"
  → BEACON:   "Add FAQ schema to 6 product pages (missing)"
  → SENTINEL: "Increase brand awareness budget — brand mentions = GEO signal"

PULSE keyword trend spike (+340% this week)
  → FORGE:    "Generate ads for trending keyword"
  → SENTINEL: "Increase budget on matching campaigns"
```

#### 5A. Smart Campaign Brief

New campaign creation flow:
1. Pick product/category
2. AdPilot runs: Pulse (trends) + Radar (competitor angles) + Beacon (landing page health) + GEO (AI gaps)
3. Pre-fills brief with real intelligence:

```
"Based on current data, we recommend a Google Search campaign
 targeting 'best meal prep high protein' (volume up 40% this month,
 you're not in AI answers, competitor Trifecta owns this keyword).

 Best landing page: /protein-plans (94/100 SEO score, fast load)

 Counter-angle: Trifecta charges $13/meal. You charge $9.
 Lead with price in headline.

 Suggested budget: $800/day based on keyword volume + your avg CPC"

[Generate 4 Ad Variants with Forge]
```

---

## 7. Priority Stack — What to Build in What Order

```
WEEK 1-2 (Phase 1 — remaining):
  → PerformanceSyncService.js (Meta + Google adapters already exist)
  → Integration sync feedback UI

WEEK 3-4 (Phase 2):
  → Dashboard Situation Report (what changed overnight, what to act on)
  → Campaign detail page /campaigns/:id with real time-series chart
  → Quick action buttons from campaign view into Forge/Sentinel/Radar/Apex

WEEK 5-6 (Phase 3 — GEO/AEO):
  → SerpService.js: add include_ai_overview=true + citation check
  → GoogleAIOAdapter.js + PerplexityAdapter.js
  → AiVisibilityService.js + KeywordAioStatus table
  → AI Visibility tab in Beacon UI
  → AIO Penalty alert in Sentinel

WEEK 7-8 (Phase 4 — Pulse/Radar separation):
  → Strip hijack analysis from Pulse
  → Pulse: market keyword trends + share-of-voice + AI visibility map
  → Radar: competitor dossier + change detection + counter-brief

WEEK 9-10 (Phase 5 — Signal graph):
  → Cross-feature event system
  → Smart Campaign Brief creation flow
  → Account health score includes GEO component
```

---

## 8. The Mental Model (How to Explain AdPilot)

> You run a meal prep brand. You pay $40k/month on ads. Here's what's happening without AdPilot:

**Sentinel** is watching your spend while you sleep — it paused your breakfast campaign at 2am when ROAS dropped below 1.5x. You saved $800.

**Radar** noticed your competitor Trifecta added "Free Returns" to their landing page last Tuesday. Your ads are still running against their old angle.

**Beacon** found your /meal-prep page loads in 4.2 seconds on mobile. That's why your Google Quality Score is 4/10 and your CPC is $2.40 higher than it should be.

**GEO (new)** found that when someone asks ChatGPT "best meal prep for bodybuilders," Trifecta is cited. You're not. That's 50,000 free impressions per month they're getting while you pay for every click.

**Apex** says your "Gym Audience" campaign has ROAS 4.1x and is only spending 72% of budget. You can safely scale to $3,600/day. Do it now.

**Forge** generated a new ad using Trifecta's weakness: their delivery takes 5 days. Yours takes 2. That's your counter-angle. 4 variants ready to launch.

**That's AdPilot. Not another dashboard. An operator.**

---

## 9. Execution Log

| Date | Phase | What was done |
|---|---|---|
| 2026-03-15 | 1 | `CampaignMetricSnapshot` table added + pushed to DB |
| 2026-03-15 | 1 | `GET /api/v1/analytics/time-series` — real snapshot API |
| 2026-03-15 | 1 | `POST /api/v1/analytics/snapshots` — manual snapshot entry |
| 2026-03-15 | 1 | `AnalyticsPage.jsx` — MOCK_SERIES removed, real data + empty state |
| 2026-03-15 | 1 | `AnalyticsAggregator.detectAnomalies()` — real snapshot baseline, not hardcoded |
| 2026-03-15 | 1 | `ScalingAnalyzer._loadRealPerf()` — 7-day snapshot avg for ROAS/CTR/CPA |
| 2026-03-15 | AI | `GroqService.js` — DeepSeek R1 (reasoning), Llama 3.3 (creative), Qwen QwQ (structured) |
| 2026-03-15 | AI | `CerebraService.js` — free 1M tok/day, Qwen3 + Llama 3.3 |
| 2026-03-15 | AI | `TogetherAIService.js` — DeepSeek R1 full + Qwen 2.5 72B |
| 2026-03-15 | AI | `TavilyAdapter.js` — free search + GEO citation check |
| 2026-03-15 | Bugs | Radar auto-load shape mismatch, BudgetGuardian N+1, AlertCard fields, CTR threshold, ₹→$, AdStudio fallback |
| 2026-03-15 | Features | Apex platform signals (Meta frequency / Google IS), Apex budget fix, ResearchPage gap tiers, SVG gradient collision, Radar→Forge deep link |

---

## 10. Key Numbers to Remember

- Google AIO present → Paid CTR drops **68%** (Seer Interactive, 3,119 queries, 42 clients, 2025)
- Brand cited INSIDE AIO → Paid CTR **+91%** vs non-cited
- ChatGPT: 800M weekly active users (early 2026)
- Traditional search predicted to drop 25% by 2026
- **Groq free:** 500K tokens/day, no card (console.groq.com)
- **Cerebras free:** 1M tokens/day, no card (cloud.cerebras.ai) — fastest inference on earth
- **Tavily free:** 1,000 searches/month, no card (app.tavily.com)
- **ValueSERP:** 50 searches/month free, already integrated, AI Overview included
- **Gemini free:** 15 req/min, 1M tokens/day, already integrated
- **Brave Search:** eliminated free tier in early 2026 — removed from stack
