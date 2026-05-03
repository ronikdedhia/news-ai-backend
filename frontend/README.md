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
| TTS | ElevenLabs API (falls back to Web Speech API) |
| Embeddings | `@huggingface/transformers` (all-MiniLM-L6-v2, local) |
| Cache | Upstash Redis (REST API, graceful no-op if unconfigured) |

---

## Features (Shipped)

### Feed & Discovery
- **AI-curated feed** — Groq-summarised articles with sentiment badge and named-entity chips (amber = people, sky = companies, emerald = places)
- **Category filter** — 12 canonical categories with gradient pill chips
- **Trending Hashtags** — Horizontal scrollable strip of top hashtags from last 48 h; click to filter feed
- **Personalized feed** — Weighted scoring: category × 3 + hashtag overlap × 2 + recency; signed-in only
- **Infinite scroll** — Automatic page loading as user scrolls
- **Source filter** — Filter feed by news source
- **Dismiss articles** — Hide articles you don't want to see again
- **Read indicator** — Visual marker on articles you've already opened

### Search
- **Keyword search** — Search by title or hashtags; last 10 queries stored in localStorage as clickable chips
- **Semantic AI search** — Toggle to meaning-based search powered by local `all-MiniLM-L6-v2` embeddings + Turso `vector_top_k` ANN; no external API required

### Article Detail
- **Why It Matters** — Amber insight banner; Groq-generated 20-word impact sentence; fetched on-demand if not pre-generated
- **AI Questions** — 2 Groq-generated Socratic Q&A pairs per article; expandable panel; fetches on-demand
- **ELI5 Summary** — "Explain Like I'm 5" plain-language summary; Groq-generated; expandable
- **Bias chip** — `Left-lean` / `Balanced` / `Right-lean` indicator on image overlay with confidence % tooltip
- **Similar articles** — Hashtag-overlap based recommendations; signed-in only
- **Threaded comments** — Post and reply to comments (1-level threading); delete own comments

### Personalisation & Engagement
- **Reactions** — Upvote / downvote per article with live counts; click again to undo
- **Bookmarks** — Save / unsave; full bookmark list on Profile page; organise into named folders
- **Text highlights** — Select any text to save in one of four colours (yellow, green, blue, pink); viewable and deletable per card
- **Keyword alerts** — Up to 10 keywords; in-app notification bell with unread counter; `/notifications` page
- **Streak widget** — Gamification on Profile; 7-day and 30-day achievement badges
- **Preferences** — First-run wizard + settings page: preferred categories, language, font size, theme, email digest frequency

### Briefings & TTS
- **Daily Briefing player** — Floating draggable music-player UI: play/pause, skip article, seek bar, speed selector 0.75×–2×; minimises to a floating pill with pulse indicator
- **Per-card Listen** — Play any article aloud via the headphone button
- **TTS backend** — ElevenLabs API (high-quality); automatically falls back to browser Web Speech API if ElevenLabs is unavailable
- **Weekly Wrap** — AI-generated digest of the week's top stories; personalised by category

### Sharing & Export
- **Share sheet** — html2canvas preview card + download PNG / copy link / PDF / social links (X, Facebook, LinkedIn, WhatsApp, Telegram)
- **Shareable image card** — Branded preview card optimised for social sharing

### Caching (Upstash Redis)

All caching is optional — if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not set, every cache call is a no-op and the app works normally.

| Cache key | Route | TTL | Invalidated by |
|-----------|-------|-----|----------------|
| `cache:articles:free:{limit}:{offset}` | `GET /api/articles` (anon) | 5 min | Pipeline trigger |
| `cache:trending:articles:{limit}:{offset}` | `GET /api/articles/trending` (anon) | 5 min | Pipeline trigger |
| `cache:hashtags:{hours}` | `GET /api/trending-hashtags` | 10 min | Pipeline trigger |
| `cache:stock:{tickers}:{limit}` | `GET /api/stock-news` | 15 min | Never (Alpha Vantage rate-limit buffer) |
| `cache:personalized:{userId}` | `GET /api/articles/personalized` | 5 min | React, bookmark, pipeline trigger |
| `cache:metrics` | `GET /api/metrics` | 5 min | Pipeline trigger |
| `cache:weekly-wrap:{userId}` | `GET /api/auth/weekly-wrap` | 30 min | Manual (acceptable staleness) |
| `cache:search:semantic:{query}:{limit}` | `GET /api/search?mode=semantic` | 5 min | Never (embeddings stable) |
| `rate:{apiKeyId}:{date}` | `GET /api/v1/articles` | 24 h | Daily reset (TTL) |

### Dashboard & Developer
- **Admin dashboard** — Pipeline run history, article counts, sentiment & category breakdown, top upvoted articles; gate: admin email only
- **Developer portal** — `/developer` page to generate and manage personal API keys with configurable daily rate limits
- **Public API** — `GET /api/v1/articles` authenticated via API key; documented on the developer page

### UX & Accessibility
- **Glassmorphism UI** — Full-bleed image cards with frosted-glass content panels, animated ambient blobs, gradient borders per category
- **Dark mode** — CSS variable palette, respects user preference
- **Font size** — Small / Medium / Large via `data-font-size` attribute
- **Keyboard shortcuts** — `j`/`k` navigate, `b` bookmark, `u` upvote, `d` downvote, `o`/Enter open, `/` search, `?` shortcut overlay, `Esc` deselect
- **Offline mode** — Service worker + cached articles via PWA
- **Catch-up brief** — Quick summary of what you missed since last visit

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
│   ├── developer/page.tsx      # API key management
│   ├── profile/page.tsx        # User profile, bookmarks, keyword alerts, streak
│   ├── notifications/page.tsx  # In-app notification list
│   ├── search/page.tsx         # Keyword + semantic search with mode toggle
│   ├── sign-in/                # Clerk sign-in (split-screen layout)
│   └── sign-up/                # Clerk sign-up (split-screen layout)
├── components/
│   ├── NewsCard.tsx            # Glass card — full-bleed image + frosted panel
│   ├── NewsFeed.tsx            # Feed container — infinite scroll, category filter, source filter
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
│   ├── api.ts                  # All API calls
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
4. **Frosted glass panel** (`backdrop-blur-2xl bg-black/45`) overlapping from the bottom

### Primary palette
| Token | Value |
|-------|-------|
| `--primary` | Indigo 600 `hsl(243 75% 59%)` |
| `--accent` | Violet 600 `hsl(262 83% 58%)` |
| `--radius` | `1rem` |

---

## API Reference

Backend base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/articles` | optional | Paginated article feed |
| GET | `/api/articles/trending` | optional | Trending articles |
| GET | `/api/articles/personalized` | required | Personalised feed |
| POST | `/api/articles/:id` | optional | Mark article as read |
| POST | `/api/articles/:id/react` | required | Upvote / downvote |
| GET | `/api/articles/:id/similar` | required | Similar articles (hashtag) |
| GET | `/api/articles/:id/comments` | optional | Get comments |
| POST | `/api/articles/:id/comments` | required | Post comment or reply |
| DELETE | `/api/articles/:id/comments/:commentId` | required | Delete own comment |
| GET | `/api/articles/:id/highlights` | required | Get user highlights |
| POST | `/api/articles/:id/highlights` | required | Save highlight |
| DELETE | `/api/articles/:id/highlights/:highlightId` | required | Delete highlight |
| GET | `/api/articles/:id/why-it-matters` | optional | Get / generate why-it-matters |
| GET | `/api/articles/:id/questions` | optional | Get / generate Socratic Q&A |
| GET | `/api/articles/:id/eli5` | required | Get / generate ELI5 summary |
| POST | `/api/articles/:id/dismiss` | required | Dismiss article from feed |
| GET | `/api/search?q=&mode=keyword\|semantic` | required | Keyword or semantic search |
| GET | `/api/trending-hashtags` | optional | Top hashtags (last 48 h) |
| GET | `/api/stock-news` | optional | Alpha Vantage stock news |
| GET/POST/DELETE | `/api/bookmarks` | required | Bookmark management |
| GET/POST/DELETE | `/api/folders` | required | Bookmark folder management |
| PUT | `/api/bookmarks/:id/folder` | required | Assign bookmark to folder |
| GET/POST/DELETE | `/api/auth/alerts` | required | Keyword alerts |
| GET | `/api/notifications` | required | In-app notifications |
| GET | `/api/notifications/unread-count` | required | Unread badge count |
| POST | `/api/notifications/read-all` | required | Mark all read |
| GET | `/api/auth/me` | required | Current user profile |
| GET | `/api/auth/streak` | required | Reading streak |
| GET | `/api/auth/preferences` | required | User preferences |
| PUT | `/api/auth/preferences` | required | Update preferences |
| GET | `/api/auth/weekly-wrap` | required | Weekly AI digest |
| GET | `/api/auth/catchup-brief` | required | Catch-up since last visit |
| GET | `/api/metrics` | required (admin) | Dashboard analytics |
| POST | `/api/tts` | required | ElevenLabs TTS → MP3 blob |
| GET/POST/DELETE | `/api/developer/keys` | required | API key management |
| GET | `/api/v1/articles` | API key | Public articles feed |
