import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { ServiceWorkerRegister } from './ServiceWorkerRegister'
import { Header } from './Header'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Daily Bytes',
  description: 'Stay updated with the latest news from around the world',
  icons: {
    icon: '/favicon.svg',
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
        <Providers>
          <ServiceWorkerRegister />

          {/* Ambient mesh gradient — fixed behind everything */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="blob blob-delay-0 absolute -top-64 -right-64 h-[700px] w-[700px] rounded-full bg-indigo-400/40 dark:bg-indigo-500/25 blur-3xl" />
            <div className="blob blob-delay-2 absolute top-1/2 -left-48 h-[600px] w-[600px] rounded-full bg-violet-400/35 dark:bg-violet-500/20 blur-3xl" />
            <div className="blob blob-delay-4 absolute -bottom-48 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-400/30 dark:bg-cyan-500/15 blur-3xl" />
            <div className="blob blob-delay-6 absolute top-1/4 left-1/3 h-[400px] w-[400px] rounded-full bg-purple-400/25 dark:bg-purple-500/15 blur-3xl" />
          </div>

          <div className="min-h-screen">
            <Header />

            <main className="container mx-auto px-4 py-8">
              {children}
            </main>

            <footer className="border-t border-white/30 dark:border-white/[0.06] glass mt-16">
              <div className="container mx-auto px-4 py-6">
                <p className="text-sm text-muted-foreground text-center">
                  © 2026 Daily Bytes. All rights reserved.
                </p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
