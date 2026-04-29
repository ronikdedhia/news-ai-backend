'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useApiClient } from '@/lib/useApiClient'
import { getDashboardMetrics, DashboardMetrics } from '@/lib/api'
import { Activity, Newspaper, Users, ThumbsUp, Bell, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground font-medium capitalize">{label || 'Unknown'}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-500',
  neutral: 'bg-gray-400',
  negative: 'bg-red-500',
}

const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-indigo-500',
]

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth()
  useApiClient()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setLoading(false); return }

    getDashboardMetrics()
      .then(setMetrics)
      .catch(e => setError(e.message || 'Failed to load metrics'))
      .finally(() => setLoading(false))
  }, [isLoaded, isSignedIn])

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3" />
          <p className="text-muted-foreground text-sm">Loading metrics...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Sign in to view the dashboard.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (!metrics) return null

  const maxCategory = Math.max(...metrics.categoryBreakdown.map(c => c.count), 1)
  const maxSentiment = Math.max(...metrics.sentimentBreakdown.map(s => s.count), 1)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Observability Dashboard</h1>
        <p className="text-muted-foreground mt-1">Pipeline health, content analytics, and platform metrics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Newspaper} label="Total Articles" value={metrics.totals.articles.toLocaleString()} />
        <StatCard icon={Users} label="Total Users" value={metrics.totals.users.toLocaleString()} />
        <StatCard icon={ThumbsUp} label="Total Upvotes" value={metrics.totals.upvotes.toLocaleString()} />
        <StatCard icon={Bell} label="Active Alerts" value={metrics.totals.activeAlerts.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Pipeline Success Rate */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Pipeline Success Rate</h2>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-bold">{metrics.pipelineSuccessRate}%</span>
            <span className="text-muted-foreground text-sm mb-1">last {metrics.recentRuns.length} runs</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${metrics.pipelineSuccessRate >= 80 ? 'bg-green-500' : metrics.pipelineSuccessRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${metrics.pipelineSuccessRate}%` }}
            />
          </div>
        </div>

        {/* Sentiment Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Sentiment Breakdown</h2>
          </div>
          {metrics.sentimentBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sentiment data yet. Run the pipeline to populate.</p>
          ) : (
            metrics.sentimentBreakdown.map(s => (
              <HorizontalBar
                key={s.sentiment}
                label={s.sentiment || 'unknown'}
                value={s.count}
                max={maxSentiment}
                color={SENTIMENT_COLORS[s.sentiment || ''] || 'bg-gray-400'}
              />
            ))
          )}
        </div>

        {/* Top Upvoted Articles */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Top Articles</h2>
          </div>
          {metrics.topArticles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No upvotes yet.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.topArticles.map((a, i) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium line-clamp-2">{a.title}</p>
                    <span className="text-xs text-muted-foreground">{a.upvoteCount} upvotes</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Articles by Category</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {metrics.categoryBreakdown.map((c, idx) => (
            <HorizontalBar
              key={c.category}
              label={c.category || 'Uncategorized'}
              value={c.count}
              max={maxCategory}
              color={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
            />
          ))}
        </div>
      </div>

      {/* Recent Pipeline Runs */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Recent Pipeline Runs</h2>
        </div>
        {metrics.recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pipeline runs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left pb-2 pr-4">Source</th>
                  <th className="text-left pb-2 pr-4">Status</th>
                  <th className="text-right pb-2 pr-4">Saved</th>
                  <th className="text-right pb-2 pr-4">Errors</th>
                  <th className="text-right pb-2 pr-4">Duration</th>
                  <th className="text-left pb-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentRuns.map(run => (
                  <tr key={run.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-medium capitalize">{run.source.replace('_', ' ')}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        run.status === 'success' ? 'bg-green-100 text-green-700' :
                        run.status === 'failed'  ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {run.status === 'success' ? <CheckCircle className="w-3 h-3" /> :
                         run.status === 'failed'  ? <XCircle className="w-3 h-3" /> :
                         <Clock className="w-3 h-3" />}
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{run.saved}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">{run.errors}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
