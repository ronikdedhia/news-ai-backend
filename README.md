# Daily Bytes

A full-stack AI-powered news aggregation platform with daily newsletter delivery, user authentication, bookmarking, and personalized content.

## 🎯 Major Features

### AI-Powered Summarization
- 🤖 **Dual Summarization** - Generates both title summaries (3-5 words) and content summaries (50-70 words) using Groq LLM
- 🌍 **Multi-Language Support** - Summarizes in English, Hindi, Marathi, Gujarati, Tamil, Spanish, French, and German
- ⚡ **Batch Processing** - Efficiently processes multiple articles with rate limiting
- 📊 **Schema Validation** - Ensures summaries meet strict word count and quality constraints
- 🎯 **Context-Aware** - Extracts only main facts without inferences or elaborations

### Text-to-Speech (TTS)
- 🔊 **Browser-Based TTS** - Listen to articles using native Web Speech API
- ⏸️ **Play/Stop Controls** - Start and stop audio playback with single click
- 🎙️ **Full Article Audio** - Reads both title and complete article content
- 📱 **Mobile Friendly** - Works seamlessly on all devices
- ⚙️ **Customizable** - Adjustable speech rate, pitch, and volume

### Reading Streak System
- 🔥 **Daily Streak Tracking** - Tracks consecutive days of article reading
- 🏆 **Longest Streak** - Records personal best reading streak
- 🎖️ **Achievement Badges** - Unlocks badges at 7-day and 30-day milestones
- 📈 **Streak Persistence** - Maintains streak across sessions
- 🔄 **Smart Reset** - Automatically resets streak if gap exceeds 1 day

### News & Content
- 📰 **Multi-Category News Fetching** - Fetches news from 12 categories (education, entertainment, politics, sports, technology, business, health, science, world, nation, lifestyle, opinion)
- 🏷️ **Auto Hashtag Generation** - Generates relevant hashtags using Hugging Face
- 💾 **Smart Database Storage** - Stores articles with duplicate detection and category tracking
- ⏰ **Scheduled Pipeline** - Runs automatically at 12:00 AM and 12:00 PM daily
- 🧹 **Auto Cleanup** - Removes old articles (30+ days) every 15 days

### Daily Newsletter System
- 📧 **Automated Daily Newsletter** - Sends personalized newsletters via SendGrid at configured time (default: 8:00 AM)
- 🎯 **Personalized Content** - Articles curated based on user's preferred categories
- 🎨 **Beautiful Email Templates** - Professional HTML emails with images, summaries, and direct links
- 📊 **Full Article Content** - Complete article text included (no truncation)
- 🏷️ **Category Tags** - Articles tagged with sentence-case category names
- 📱 **Responsive Design** - Mobile-friendly email layout

### User Features
- 🔐 **Authentication** - Clerk-based user authentication with OAuth
- 📌 **Bookmarking System** - Save articles for later reading with real-time sync
- 👤 **User Profiles** - View profile, member since date, articles viewed count
- 📚 **Bookmarks Management** - View all bookmarked articles in dedicated profile section
- 🎯 **Category Preferences** - Select preferred news categories
- 🔄 **Real-time Tier Updates** - Instant tier change on sign-in/sign-out

### Newsletter Management
- 🔔 **Notification Preferences** - Enable/disable newsletter emails
- 📅 **Frequency Control** - Choose daily, weekly, or never
- 🚫 **Easy Unsubscribe** - One-click unsubscribe from email links
- ⚙️ **Preference Management** - Manage newsletter settings without authentication
- 📧 **Public Unsubscribe Endpoint** - Unsubscribe directly from email (no login required)

### Frontend Features
- 🌐 **Responsive Design** - Mobile, tablet, and desktop optimized
- ♾️ **Infinite Scroll** - Lazy loading with smooth pagination
- 🖼️ **Image Optimization** - Fallback images with graceful degradation
- 🎨 **Beautiful UI** - Card-based layout with category badges
- 🎭 **Dark/Light Mode Ready** - Tailwind CSS with theme support
- ⚡ **Fast Performance** - Next.js optimization and caching
- 📸 **Shareable Images** - Generate and share articles as beautiful images on social media (Twitter, Facebook, LinkedIn, WhatsApp, Telegram)

### API Features
- 🚀 **Optimized REST API** - Consolidated endpoints with minimal API calls
- 📊 **Bookmark Status Integration** - Bookmark status included in article responses
- 🔒 **Authentication Middleware** - Clerk token verification
- 📈 **Trending Articles** - Articles sorted by bookmark count
- 🎯 **Free Tier Limits** - 10 articles for free users, unlimited for authenticated
- 📧 **Newsletter Endpoints** - Manual trigger and public unsubscribe

### Integrations
- 📱 **Telegram Integration** - Sends summarized articles to Telegram with images
- 📧 **SendGrid Email** - Professional email delivery with tracking
- 🔐 **Clerk Authentication** - OAuth and email-based authentication

## Tech Stack

**Backend:**
- Node.js + TypeScript
- Express.js
- Drizzle ORM
- Turso (SQLite)
- Groq API (LLM)
- Hugging Face API
- SendGrid API
- Telegram Bot API
- node-cron

**Frontend:**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons


## Scheduled Jobs

- **12:00 AM & 12:00 PM** - Run news pipeline (fetch, summarize, store articles)
- **2:00 AM** - Cleanup old articles (runs every 15 days)
- **Daily at configured time** - Send newsletter to all users (default: 8:00 AM)


## Key Features Highlights

✅ AI-powered dual summarization (titles + content)
✅ Multi-language summarization support
✅ Browser-based text-to-speech for articles
✅ Reading streak tracking with achievement badges
✅ Fully automated daily newsletter system
✅ Personalized content based on user preferences
✅ Professional HTML email templates
✅ One-click unsubscribe from emails
✅ Auto-generated hashtags
✅ Real-time bookmark synchronization
✅ Responsive mobile-first design
✅ Infinite scroll pagination
✅ Telegram integration
✅ SendGrid email delivery
✅ Clerk authentication
✅ Shareable article images for social media
