# News AI Backend

A powerful full-stack news aggregation platform with AI-powered summarization, bookmarking, user authentication, and real-time updates.

## 🎯 Major Features

### Core News Features
- 📰 **Multi-Category News Fetching** - Fetches news from 12 categories (education, entertainment, politics, sports, technology, business, health, science, world, nation, lifestyle, opinion)
- 🤖 **AI Summarization** - Summarizes article titles and content using Groq LLM
- 🏷️ **Auto Hashtag Generation** - Generates relevant hashtags using Hugging Face
- 💾 **Smart Database Storage** - Stores articles with duplicate detection and category tracking
- 📱 **Telegram Integration** - Sends summarized articles to Telegram with images
- ⏰ **Scheduled Pipeline** - Runs automatically at 12:00 AM and 12:00 PM daily
- 🧹 **Auto Cleanup** - Removes old articles (30+ days) every 15 days

### User Features
- 🔐 **Authentication** - Clerk-based user authentication with OAuth
- 📌 **Bookmarking System** - Save articles for later reading with real-time sync
- 👤 **User Profiles** - View profile, member since date, articles viewed count
- 📚 **Bookmarks Management** - View all bookmarked articles in dedicated profile section
- 🎯 **Category Filtering** - Articles tagged with categories for easy discovery
- 🔄 **Real-time Tier Updates** - Instant tier change on sign-in/sign-out

### Frontend Features
- 🌐 **Responsive Design** - Mobile, tablet, and desktop optimized
- ♾️ **Infinite Scroll** - Lazy loading with smooth pagination
- 🖼️ **Image Optimization** - Fallback images with graceful degradation
- 🎨 **Beautiful UI** - Card-based layout with category badges
- 🔊 **Text-to-Speech** - Listen to articles with browser speech synthesis
- 🎭 **Dark/Light Mode Ready** - Tailwind CSS with theme support
- ⚡ **Fast Performance** - Next.js optimization and caching

### API Features
- 🚀 **Optimized REST API** - Consolidated endpoints with minimal API calls
- 📊 **Bookmark Status Integration** - Bookmark status included in article responses
- 🔒 **Authentication Middleware** - Clerk token verification
- 📈 **Trending Articles** - Articles sorted by bookmark count
- 🎯 **Free Tier Limits** - 10 articles for free users, unlimited for authenticated
- 🔄 **Real-time Updates** - Instant bookmark status changes

## Features

- 📰 **News Fetching** - Fetches latest news from NewsData.io API
- 🤖 **AI Summarization** - Summarizes article titles and content using Groq LLM
- 🏷️ **Hashtag Generation** - Auto-generates relevant hashtags using Hugging Face
- 💾 **Database Storage** - Stores articles in Turso (SQLite) with duplicate detection
- 📱 **Telegram Integration** - Sends summarized articles to Telegram channel with images
- ⏰ **Scheduled Pipeline** - Runs automatically at 12:00 AM and 12:00 PM daily
- 🧹 **Auto Cleanup** - Removes old articles (30+ days) every 15 days
- 🌐 **REST API** - Full API for fetching, trending, and bookmarking articles
- 🎨 **Beautiful Frontend** - Next.js + shadcn/ui news feed with infinite scroll
- 🔐 **User Authentication** - Clerk-based auth with OAuth support
- 📌 **Bookmarking** - Save articles with real-time sync
- 👤 **User Profiles** - View bookmarks and reading history

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express.js
- Drizzle ORM
- Turso (SQLite)
- Groq API (LLM)
- Hugging Face API
- Telegram Bot API
- node-cron

**Frontend:**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons

## Project Structure

```
news-ai-backend/
├── src/
│   ├── agents/              # AI agents for fetching and summarization
│   ├── config/              # Configuration management
│   ├── cron/                # Scheduled jobs
│   ├── db/                  # Database client and schema
│   ├── services/            # Business logic services
│   │   ├── article.service.ts
│   │   ├── groq.service.ts
│   │   ├── hashtag.service.ts
│   │   ├── newsdata.service.ts
│   │   ├── pipeline.service.ts
│   │   └── telegram.service.ts
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities (logger, etc)
│   └── index.ts             # Express server
├── frontend/                # Next.js frontend
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                 # Utilities and API client
│   └── public/              # Static assets
└── docker-compose.yml       # Docker setup
```

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Turso account (free tier available)
- API Keys:
  - NewsData.io
  - Groq
  - Hugging Face
  - Telegram Bot Token

### Backend Setup

1. Clone and install:
```bash
git clone https://github.com/ronikdedhia/news-ai-backend.git
cd news-ai-backend
npm install
```

2. Create `.env` file:
```env
NODE_ENV=development
PORT=3000

# APIs
NEWSDATA_API_KEY=your_key
GROQ_API_KEY=your_key
GROQ_MODEL=llama-3.1-8b-instant
HUGGING_FACE_API_KEY=your_key

# Database (Turso)
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your_token

# Telegram
TELEGRAM_ACCESS_TOKEN=your_token
TELEGRAM_CHANNEL_ID=your_channel_id

# Features
MAX_ARTICLES_TO_FETCH=10
SUMMARY_MAX_LENGTH=150
```

3. Run backend:
```bash
npm run dev
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

3. Run frontend:
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## API Endpoints

### Article Management
- `GET /api/articles?limit=10&offset=0` - Get all articles with bookmark status
- `GET /api/articles/trending?limit=10&offset=0` - Get trending articles (sorted by bookmarks)
- `POST /api/articles/:id` - Bookmark/unbookmark article (action: "bookmark" | "unbookmark")

### Bookmarks
- `GET /api/bookmarks?limit=20&offset=0` - Get user's bookmarked articles
- `POST /api/auth/sync-user` - Sync user from Clerk
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/upgrade-premium` - Upgrade to premium

### Health
- `GET /health` - Health check endpoint

## Pipeline Flow

```
1. Fetch News (NewsData.io API)
   ↓
2. Process Each Article
   ├─ Summarize content (Groq)
   ├─ Summarize title (Groq)
   └─ Generate hashtags (Hugging Face)
   ↓
3. Save to Database (Turso)
   ├─ Skip duplicates
   └─ Store with hashtags
   ↓
4. Send to Telegram
   ├─ Format message
   ├─ Attach image
   └─ Send to channel
```

## Scheduled Jobs

- **12:00 AM & 12:00 PM** - Run news pipeline
- **2:00 AM** - Cleanup old articles (runs every 15 days)

## Frontend Features

- 📱 Responsive grid layout (mobile, tablet, desktop)
- ♾️ Infinite scroll with lazy loading
- 🖼️ Image optimization with fallback
- 🔄 Real-time article updates
- 🎨 Beautiful card-based UI
- ⚡ Fast performance with Next.js

## Database Schema

```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT random(),
  title TEXT NOT NULL,
  content TEXT,
  hashtags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  bookmark_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEWSDATA_API_KEY` | NewsData.io API key | ✅ |
| `GROQ_API_KEY` | Groq API key | ✅ |
| `GROQ_MODEL` | Groq model name | ✅ |
| `HUGGING_FACE_API_KEY` | Hugging Face API key | ✅ |
| `DATABASE_URL` | Turso database URL | ✅ |
| `DATABASE_AUTH_TOKEN` | Turso auth token | ✅ |
| `TELEGRAM_ACCESS_TOKEN` | Telegram bot token | ✅ |
| `TELEGRAM_CHANNEL_ID` | Telegram channel ID | ✅ |
| `MAX_ARTICLES_TO_FETCH` | Max articles per fetch | ❌ (default: 10) |
| `SUMMARY_MAX_LENGTH` | Max summary length | ❌ (default: 150) |

## Docker

Run with Docker Compose:

```bash
docker-compose up
```

## Performance Optimizations

- ✅ Duplicate detection by URL
- ✅ Direct database return (no extra reads)
- ✅ Batch processing with delays
- ✅ Image optimization in frontend
- ✅ Infinite scroll pagination
- ✅ Turso credits optimization

## Error Handling

- Graceful error logging with timestamps
- Duplicate article skipping
- Failed API call recovery
- Database connection fallback
- Telegram send retry logic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT

## Support

For issues and questions, open an issue on GitHub.

---

**Made with ❤️ by Ronik Dedhia**
