# Daily Bytes — Frontend

An AI-powered news aggregation platform built with Next.js 14, Clerk auth, and a glassmorphism design system.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk |
| Styling | Tailwind CSS + custom glass utilities |
| UI Primitives | shadcn/ui |
| Icons | Lucide React |
| Image capture | html2canvas + jsPDF |
| TTS | Web Speech API |

---

## Features (Shipped)

- **AI-curated feed** — Groq-summarised articles with sentiment badge and named-entity chips (amber = people, sky = companies, emerald = places)
- **Glassmorphism UI** — Full-bleed image cards with frosted-glass content panels, animated ambient blobs, gradient borders per category
- **Daily Briefing** — Floating draggable music player: play/pause (native resume), skip article, seek bar (word-level via `onboundary`), speed selector 0.75×–2×; minimises to a floating pill with pulse indicator
- **Category filter** — 12 canonical categories with gradient pill chips; paywall for guest users
- **Trending Hashtags** — Horizontal scrollable strip of top hashtags from last 48 h; click to filter feed; chevron arrows appear based on scroll position
- **Full-text search** — Search by title or hashtags; last 10 queries stored in localStorage as clickable chips
- **Reactions** — Upvote / downvote per article with live counts; click again to undo
- **Bookmarks** — Save / unsave; full bookmark list on Profile page; organise into named folders
- **Keyword alerts** — Up to 10 keywords; in-app notification bell with unread counter; `/notifications` page
- **Similar articles** — Expand in-card similar article list (hashtag-overlap based)
- **Threaded comments** — Post and reply to comments per article (1-level threading); delete own comments
- **Text highlights** — Select any text in an article summary to save a highlight in one of four colours (yellow, green, blue, pink); viewable and deletable from the card
- **Why It Matters** — Amber insight banner below article title; fetched on-demand via Groq if not pre-generated
- **AI Questions** — Expandable Q&A panel per card (? button); 2 Socratic questions with short answers; fetches on-demand; indigo-accented answer style
- **Bias chip** — `Left-lean` / `Balanced` / `Right-lean` indicator on image overlay with confidence % tooltip
- **Share sheet** — html2canvas preview card + download PNG / copy / PDF / social links (X, Facebook, LinkedIn, WhatsApp, Telegram)
- **Text-to-speech** per card via browser Web Speech API
- **Shareable image card** — Branded preview card for social sharing
- **Streak widget** — Gamification on Profile; 7-day and 30-day achievement badges
- **Dashboard** — Admin metrics: article counts, sentiment breakdown, category breakdown, pipeline run history, top upvoted articles
- **Keyboard shortcuts** — `j`/`k` navigate, `b` bookmark, `u` upvote, `d` downvote, `o`/Enter open, `/` search, `?` shortcut panel, `Esc` deselect
- **Dark mode** — CSS variable palette, respects user preference set in Preferences
- **Font size** — Small / Medium / Large via `data-font-size` attribute
- **Offline mode** — Service worker + cached articles
- **Infinite scroll**

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout — ambient blob background, Header, Footer
│   ├── globals.css             # CSS variables (indigo/violet palette), glass utilities, blob animation
│   ├── Header.tsx              # Sticky glass header — logo, nav, bell badge
│   ├── page.tsx                # Home → <NewsFeed />
│   ├── dashboard/page.tsx      # Admin metrics dashboard
│   ├── profile/page.tsx        # User profile, bookmarks, keyword alerts
│   ├── notifications/page.tsx  # In-app notification list
│   ├── search/page.tsx         # Article search
│   ├── sign-in/                # Clerk sign-in (split-screen layout)
│   └── sign-up/                # Clerk sign-up (split-screen layout)
├── components/
│   ├── NewsCard.tsx            # Glass card — full-bleed image + frosted panel
│   ├── NewsFeed.tsx            # Feed container — infinite scroll, category filter, search
│   ├── DailyBriefing.tsx       # Floating draggable TTS player
│   ├── CategoryFilter.tsx      # Category pill chips
│   ├── TrendingHashtags.tsx    # Horizontal scrollable hashtag strip
│   ├── CommentSection.tsx      # Threaded comments (1-level) per article
│   ├── KeyboardShortcutsHelp.tsx # Shortcut reference overlay (? key)
│   ├── ShareableImage.tsx      # Share modal — preview card + social links
│   ├── PreferencesForm.tsx     # First-run preferences wizard
│   ├── PreferencesManager.tsx  # Edit preferences on Profile
│   └── StreakWidget.tsx        # Reading streak gamification
├── lib/
│   ├── api.ts                  # All API calls (articles, bookmarks, reactions, alerts, notifications)
│   ├── categories.ts           # Canonical category list + color map
│   └── useApiClient.ts         # Clerk token → Axios header injection
└── public/
    ├── favicon.svg             # Lightning bolt icon (indigo/violet gradient)
    └── news-placeholder.png    # Fallback image for articles with no CDN image
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Backend running on port 3001

### Install & run
```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### Environment
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

---

## Design System

### Glass utilities (globals.css)
```css
.glass        /* bg-white/70  backdrop-blur-xl  border-white/40 */
.glass-strong /* bg-white/85  backdrop-blur-2xl border-white/50 */
.glass-card   /* bg-white/75  backdrop-blur-xl  border-white/50 shadow-xl */
```

### Card anatomy
Each card is:
1. **Gradient border wrapper** (1.5px, category colour)
2. **Full-bleed image** behind everything
3. **Dark gradient scrim** (transparent → 95% black bottom)
4. **Frosted glass panel** (`backdrop-blur-2xl bg-black/45`) overlapping from the bottom — blurs the actual image behind it

### Primary palette
| Token | Value |
|-------|-------|
| `--primary` | Indigo 600 `hsl(243 75% 59%)` |
| `--accent` | Violet 600 `hsl(262 83% 58%)` |
| `--radius` | `1rem` |

---

## Future Scope

### 1. RAG-based Q&A / Chat with News
Embed articles into a vector store (sqlite-vec or Pinecone free tier). Let users ask "What happened with RBI this week?" → retrieve top-k relevant articles → Groq answers with citations. Floating chat UI.

### 2. Feed filter by bias
Use the existing `bias_label` field to let users filter the feed to "Balanced only" or see a bias distribution chart. Needs a filter chip in the feed header and a backend query param.

### 4. Smart Bookmark Collections
Auto-organise bookmarks when user exceeds 5 saved articles — Groq clusters titles into named collections ("AI & Tech", "Market News"). Manual drag-drop to rearrange.

### 5. Polls between cards
Micro-poll cards injected at configurable feed positions ("Do you think X will happen?"). Needs `polls` + `poll_votes` DB tables and real-time vote tallying.

### 6. Redis Caching (Upstash free tier)
Cache `/api/articles`, `/api/articles/trending`, `/api/trending-hashtags` with 5-minute TTL.

### 7. Stripe Paywall
Replace current logged-in-equals-premium gate with proper Stripe subscription. Free: 10 articles; paid: everything. Webhook updates `is_premium`.

### 8. Enhanced TTS (ElevenLabs / Google TTS)
Replace browser SpeechSynthesis with proper TTS API. Generate one MP3 per day, cache, serve via URL for cross-device playback.

### 9. Vector / Semantic Search
Replace keyword search with embedding-based ANN. Candidates: Chroma (local), Qdrant (self-hosted), Pinecone (managed).

### 10. Google AdSense
AdSense banner slots between card rows (every 6 cards). Requires AdSense approval + `next/script` integration.

---

## API Integration

Backend base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)

Key endpoints used by the frontend:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/articles` | Paginated article feed |
| GET | `/api/search` | Keyword search (rate-limited 15 req/min) |
| POST | `/api/articles/:id/react` | Upvote / downvote |
| GET | `/api/articles/:id/similar` | Similar articles |
| GET/POST/DELETE | `/api/bookmarks` | Bookmark management |
| GET/POST/DELETE | `/api/folders` | Bookmark folder management |
| PUT | `/api/bookmarks/:id/folder` | Assign bookmark to folder |
| GET/POST/DELETE | `/api/auth/alerts` | Keyword alerts |
| GET | `/api/notifications` | In-app notifications |
| GET | `/api/notifications/unread-count` | Unread badge count |
| POST | `/api/notifications/read-all` | Mark all read |
| GET | `/api/articles/:id/comments` | Get comments |
| POST | `/api/articles/:id/comments` | Post comment or reply |
| DELETE | `/api/articles/:id/comments/:commentId` | Delete own comment |
| GET | `/api/articles/:id/highlights` | Get user highlights |
| POST | `/api/articles/:id/highlights` | Save highlight |
| DELETE | `/api/articles/:id/highlights/:highlightId` | Delete highlight |
| GET | `/api/articles/:id/why-it-matters` | Get / generate why-it-matters |
| GET | `/api/articles/:id/questions` | Get / generate 2 Socratic Q&A pairs |
| GET | `/api/trending-hashtags` | Top hashtags (last N hours) |
| GET | `/api/stock-news` | Alpha Vantage stock news |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/metrics` | Admin dashboard data |
