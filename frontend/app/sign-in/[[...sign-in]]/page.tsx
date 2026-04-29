import { SignIn } from "@clerk/nextjs";
import { Zap, TrendingUp, Bell, Bookmark, Sparkles } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
        {/* animated blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-indigo-300/15 blur-2xl" />

        {/* logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Daily Bytes</span>
        </div>

        {/* headline */}
        <div className="relative space-y-6">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            News that<br />
            <span className="text-indigo-200">moves you</span><br />
            forward.
          </h1>
          <p className="text-indigo-100/80 text-lg max-w-sm leading-relaxed">
            AI-curated headlines, sentiment analysis, and personalized briefings — all in one place.
          </p>

          <ul className="space-y-3">
            {[
              { icon: Sparkles, text: 'AI summaries & sentiment for every article' },
              { icon: Bell,     text: 'Keyword alerts delivered in real-time' },
              { icon: TrendingUp, text: 'Bullish / Bearish market signals' },
              { icon: Bookmark, text: 'Save and organise your reading list' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-indigo-100/90">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* fake stat pills */}
        <div className="relative flex items-center gap-3">
          {[
            { val: '10k+', label: 'Articles indexed' },
            { val: '99%', label: 'Uptime' },
            { val: 'Live', label: 'AI analysis' },
          ].map(({ val, label }) => (
            <div key={label} className="flex flex-col items-center px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <span className="text-white font-bold text-sm">{val}</span>
              <span className="text-indigo-200/70 text-[10px] font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: Clerk ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20 p-6 overflow-y-auto">
        {/* mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Daily Bytes
          </span>
        </div>

        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#6366f1',
              colorBackground: '#ffffff',
              colorInputBackground: '#f8f9ff',
              colorInputText: '#1e1b4b',
              borderRadius: '12px',
              fontFamily: 'inherit',
              fontSize: '15px',
            },
            elements: {
              rootBox: 'w-full max-w-md',
              card: 'shadow-2xl shadow-indigo-500/10 border border-indigo-100/50 rounded-3xl',
              headerTitle: 'text-2xl font-bold text-slate-800',
              headerSubtitle: 'text-slate-500',
              formButtonPrimary:
                'bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 transition-opacity text-sm font-semibold',
              footerActionLink: 'text-indigo-600 hover:text-indigo-700 font-semibold',
              identityPreviewText: 'text-slate-700',
            },
          }}
        />
      </div>
    </div>
  );
}
