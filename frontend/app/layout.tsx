import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'News Daily',
  description: 'Stay updated with the latest news from around the world',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📰</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📰</div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">News Daily</h1>
                    <p className="text-xs text-muted-foreground">Stay informed, stay ahead</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border bg-muted/50 mt-12">
            <div className="container mx-auto px-4 py-8">
              <p className="text-sm text-muted-foreground text-center">
                © 2026 News Daily. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
