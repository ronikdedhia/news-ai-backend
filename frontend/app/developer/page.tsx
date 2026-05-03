'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Copy, Check, Trash2, Plus, Eye, EyeOff, Key, Zap, AlertCircle, Code2, Globe } from 'lucide-react'
import { getApiKeys, createApiKey, deleteApiKey, ApiKey } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export default function DeveloperPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [apiKey, setApiKey] = useState<ApiKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    getApiKeys()
      .then(keys => setApiKey(keys[0] ?? null))
      .catch(() => setError('Failed to load API key.'))
      .finally(() => setLoading(false))
  }, [isSignedIn, isLoaded])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const key = await createApiKey(keyName.trim() || 'My API Key')
      setApiKey(key)
      setKeyName('')
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to create key.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!apiKey) return
    if (!confirm('Delete this API key? Any apps using it will stop working.')) return
    setDeleting(true)
    try {
      await deleteApiKey(apiKey.id)
      setApiKey(null)
      setShowKey(false)
    } catch {
      setError('Failed to delete key.')
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = async () => {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const maskedKey = apiKey ? `${apiKey.key.slice(0, 8)}${'•'.repeat(24)}${apiKey.key.slice(-4)}` : ''

  if (!isLoaded) return null

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <Key className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sign in to access the developer portal.</p>
          <a href="/sign-in" className="inline-flex px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Developer Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground">Access the Daily Bytes public API to build apps on top of our news feed.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* API Key Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-foreground">Your API Key</h2>
          </div>

          <div className="p-5 space-y-4">
            {loading ? (
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : apiKey ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{apiKey.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-border font-mono text-xs text-foreground overflow-hidden">
                      <span className="truncate">{showKey ? apiKey.key : maskedKey}</span>
                    </div>
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title="Copy key"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Created {new Date(apiKey.createdAt).toLocaleDateString()}{apiKey.lastUsedAt ? ` · Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Daily Limit</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{apiKey.dailyLimit.toLocaleString()} requests / day</span>
                </div>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Deleting…' : 'Delete key'}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No API key yet. Create one to start using the API.</p>
                <div className="flex gap-2">
                  <input
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    placeholder="Key name (optional)"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-white dark:bg-slate-800 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    maxLength={80}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    {creating ? 'Creating…' : 'Create key'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* API Docs */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-foreground">API Reference</h2>
          </div>

          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</p>
              <code className="block px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono text-foreground">{API_BASE}/api/v1</code>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authentication</p>
              <p className="text-xs text-muted-foreground">Pass your API key in the <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">X-API-Key</code> request header.</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endpoints</p>

              <EndpointDoc
                method="GET"
                path="/api/v1/articles"
                description="Fetch paginated articles. Optional query params: limit (max 50), offset, category."
                example={`curl ${API_BASE}/api/v1/articles?limit=10 \\
  -H "X-API-Key: YOUR_KEY"`}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rate Limiting</p>
              <p className="text-xs text-muted-foreground">1,000 requests/day per key. Resets at midnight UTC. Exceeded requests return <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">429</code> with a <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">rateLimit</code> object in the response.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EndpointDoc({ method, path, description, example }: { method: string; path: string; description: string; example: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(example)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">{method}</span>
        <code className="text-xs font-mono text-foreground">{path}</code>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="relative">
          <pre className="text-[11px] font-mono text-foreground bg-slate-900 dark:bg-black rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap">{example}</pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  )
}
