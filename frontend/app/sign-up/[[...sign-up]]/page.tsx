import { SignUp } from "@clerk/nextjs";
import { Zap, TrendingUp, Bell, Bookmark, Sparkles } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Daily Bytes</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            Start your<br />
            <span className="text-indigo-200">AI-powered</span><br />
            news journey.
          </h1>
          <p className="text-indigo-100/80 text-lg max-w-sm leading-relaxed">
            Join thousands of readers who get smarter every day with AI-curated news.
          </p>

          <ul className="space-y-3">
            {[
              { icon: Sparkles, text: 'Personalised feed based on your interests' },
              { icon: Bell,     text: 'Never miss breaking news on your topics' },
              { icon: TrendingUp, text: 'Market sentiment at a glance' },
              { icon: Bookmark, text: 'Build your personal knowledge base' },
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

        <div className="relative">
          <p className="text-indigo-200/60 text-xs">Free to start. No credit card required.</p>
        </div>
      </div>

      {/* ── Right panel: Clerk ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-950 dark:to-violet-950/20 p-6 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Daily Bytes
          </span>
        </div>

        <SignUp
          appearance={{
            variables: {
              colorPrimary: '#7c3aed',
              colorBackground: '#ffffff',
              colorInputBackground: '#f8f7ff',
              colorInputText: '#1e1b4b',
              borderRadius: '12px',
              fontFamily: 'inherit',
              fontSize: '15px',
            },
            elements: {
              rootBox: 'w-full max-w-md',
              card: 'shadow-2xl shadow-violet-500/10 border border-violet-100/50 rounded-3xl',
              headerTitle: 'text-2xl font-bold text-slate-800',
              headerSubtitle: 'text-slate-500',
              formButtonPrimary:
                'bg-gradient-to-r from-violet-500 to-indigo-600 hover:opacity-90 transition-opacity text-sm font-semibold',
              footerActionLink: 'text-violet-600 hover:text-violet-700 font-semibold',
            },
          }}
        />
      </div>
    </div>
  );
}
