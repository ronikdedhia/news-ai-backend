# News Daily Frontend

A beautiful, modern news feed built with Next.js and shadcn/ui.

## Features

- 📱 Responsive design (mobile, tablet, desktop)
- 🎨 Beautiful UI with shadcn/ui components
- ⚡ Fast performance with Next.js
- 🖼️ Image optimization with Next.js Image
- 🔄 Real-time news fetching
- 📰 Clean card-based layout
- 🌙 Dark mode ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with header/footer
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── NewsCard.tsx       # Individual news card
│   └── NewsFeed.tsx       # News feed container
├── lib/
│   ├── api.ts             # API client
│   └── utils.ts           # Utility functions
└── public/                # Static assets
```

## Components

### NewsCard
Displays a single news article with:
- Article image
- Source badge
- Title
- Description
- Publication date
- Read more link

### NewsFeed
Main container that:
- Fetches news from API
- Handles loading/error states
- Displays articles in responsive grid
- Provides refresh functionality

## Styling

Uses Tailwind CSS with shadcn/ui components for consistent, beautiful design.

## API Integration

The frontend connects to the backend API at `http://localhost:3000/api/test/fetch-news`

Expected response format:
```json
{
  "success": true,
  "count": 10,
  "articles": [
    {
      "id": "...",
      "title": "...",
      "url": "...",
      "description": "...",
      "content": "...",
      "publishedAt": "...",
      "imageUrl": "...",
      "sourceName": "...",
      "sourceUrl": "..."
    }
  ]
}
```
