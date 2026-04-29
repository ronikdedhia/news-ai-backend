'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useApiClient } from '@/lib/useApiClient'
import { getCurrentUser, getUserBookmarks, getAlerts, createAlert, deleteAlert, getFolders, createFolder, deleteFolder, assignToFolder, Article, UserAlert, BookmarkFolder } from '@/lib/api'
import { NewsCard } from '@/components/NewsCard'
import { PreferencesManager } from '@/components/PreferencesManager'
import { StreakWidget } from '@/components/StreakWidget'
import { AlertCircle, Bell, Trash2, Plus, BookmarkIcon, Settings, Mail, Calendar, Eye, Zap, FolderOpen, Folder, FolderPlus, ChevronDown } from 'lucide-react'

interface UserData {
  id: string
  email: string
  firstName?: string
  lastName?: string
  isPremium: number
  articlesViewedCount: number
  createdAt: string
}

export default function ProfilePage() {
  const { user: clerkUser, isLoaded } = useUser()
  useApiClient()
  const [userData, setUserData]           = useState<UserData | null>(null)
  const [bookmarks, setBookmarks]         = useState<Article[]>([])
  const [bookmarkCount, setBookmarkCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'preferences' | 'bookmarks' | 'alerts'>('preferences')
  const [alerts, setAlerts]               = useState<UserAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [newKeyword, setNewKeyword]       = useState('')
  const [alertError, setAlertError]       = useState<string | null>(null)
  const [alertSaving, setAlertSaving]     = useState(false)
  const [folders, setFolders]             = useState<BookmarkFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderSaving, setFolderSaving]   = useState(false)
  const [assigningId, setAssigningId]     = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!clerkUser) { setLoading(false); return }

    const fetchUserData = async () => {
      try {
        const data = await getCurrentUser()
        setUserData({
          id: data.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          isPremium: data.isPremium ? 1 : 0,
          articlesViewedCount: data.articlesViewedCount,
          createdAt: data.createdAt || new Date().toISOString(),
        })
        const bookmarksData = await getUserBookmarks(1, 0)
        setBookmarkCount(bookmarksData.count)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchUserData()
  }, [clerkUser, isLoaded])

  const loadBookmarks = async (folderId?: string | null) => {
    if (bookmarksLoading) return
    setBookmarksLoading(true)
    try {
      const data = await getUserBookmarks(20, 0, folderId ?? undefined)
      setBookmarks(data.bookmarks)
      setBookmarkCount(data.count)
    } catch (err) { console.error(err) }
    finally { setBookmarksLoading(false) }
  }

  const loadFolders = async () => {
    try { setFolders(await getFolders()) }
    catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (activeTab === 'bookmarks') {
      loadBookmarks(activeFolderId)
      if (folders.length === 0) loadFolders()
    }
    if (activeTab === 'alerts' && alerts.length === 0) loadAlerts()
  }, [activeTab])

  const handleFolderSelect = (folderId: string | null) => {
    setActiveFolderId(folderId)
    loadBookmarks(folderId)
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setFolderSaving(true)
    try {
      const f = await createFolder(newFolderName.trim())
      setFolders(prev => [...prev, f])
      setNewFolderName('')
      setShowNewFolder(false)
    } catch (err) { console.error(err) }
    finally { setFolderSaving(false) }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId)
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (activeFolderId === folderId) { setActiveFolderId(null); loadBookmarks(null) }
    } catch (err) { console.error(err) }
  }

  const handleAssignFolder = async (articleId: string, folderId: string | null) => {
    setAssigningId(articleId)
    try {
      await assignToFolder(articleId, folderId)
      loadBookmarks(activeFolderId)
    } catch (err) { console.error(err) }
    finally { setAssigningId(null) }
  }

  const loadAlerts = async () => {
    setAlertsLoading(true)
    try { setAlerts(await getAlerts()) }
    catch (err) { console.error(err) }
    finally { setAlertsLoading(false) }
  }

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyword.trim()) return
    setAlertSaving(true); setAlertError(null)
    try {
      const alert = await createAlert(newKeyword.trim())
      setAlerts(prev => [{ ...alert, userId: '', isActive: 1, createdAt: new Date().toISOString() }, ...prev])
      setNewKeyword('')
    } catch (err: any) {
      setAlertError(err?.response?.data?.error || err.message || 'Failed to create alert')
    } finally { setAlertSaving(false) }
  }

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteAlert(alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (err) { console.error(err) }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3" />
          <p className="text-muted-foreground text-sm">Loading profile…</p>
        </div>
      </div>
    )
  }

  if (!clerkUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-strong rounded-3xl p-10 text-center max-w-sm mx-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Not Signed In</h2>
          <p className="text-muted-foreground text-sm">Sign in to view your profile.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-strong rounded-3xl p-10 text-center max-w-sm mx-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Error</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'preferences' as const, label: 'Preferences', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'bookmarks'   as const, label: `Saved (${bookmarkCount})`, icon: <BookmarkIcon className="w-3.5 h-3.5" /> },
    { id: 'alerts'      as const, label: 'Alerts', icon: <Bell className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* ── profile header card ── */}
      <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 opacity-20 blur-xl -z-10" />
        <div className="glass-strong rounded-[calc(1.5rem-1.5px)] p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* avatar */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 blur-md opacity-50" />
              {clerkUser.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt={clerkUser.fullName || 'Profile'}
                  className="relative w-24 h-24 rounded-full ring-2 ring-indigo-400/60 shadow-xl"
                />
              ) : (
                <div className="relative w-24 h-24 rounded-full ring-2 ring-indigo-400/60 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl">
                  <span className="text-white text-3xl font-bold">
                    {(clerkUser.fullName || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* name + email */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent leading-tight">
                {clerkUser.fullName || 'User'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm flex items-center justify-center sm:justify-start gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {clerkUser.primaryEmailAddress?.emailAddress}
              </p>
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-400/20">
                  Active Member
                </span>
                {userData?.isPremium ? (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Premium
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: <Mail className="w-4 h-4" />, label: 'Email', value: clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || '—' },
              { icon: <Calendar className="w-4 h-4" />, label: 'Member Since', value: userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—' },
              { icon: <Eye className="w-4 h-4" />, label: 'Articles Read', value: userData?.articlesViewedCount?.toLocaleString() || '0' },
              { icon: <BookmarkIcon className="w-4 h-4" />, label: 'Bookmarked', value: bookmarkCount.toString() },
            ].map(({ icon, label, value }) => (
              <div key={label} className="glass rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                  {icon}
                  <span className="text-[11px] font-medium">{label}</span>
                </div>
                <p className="text-sm font-bold text-foreground truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* streak */}
          <div className="mt-4 glass rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">Reading Streak</p>
            <StreakWidget />
          </div>
        </div>
      </div>

      {/* ── pill tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/40 dark:border-white/[0.08] shadow-sm">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === id
                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === 'bookmarks' ? bookmarkCount : ''}</span>
          </button>
        ))}
      </div>

      {/* ── Preferences Tab ── */}
      {activeTab === 'preferences' && (
        <div className="glass-card rounded-3xl p-6">
          <PreferencesManager />
        </div>
      )}

      {/* ── Bookmarks Tab ── */}
      {activeTab === 'bookmarks' && (
        <div className="glass-card rounded-3xl p-6 space-y-5">
          {/* folder sidebar */}
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap flex-1">
              <button
                onClick={() => handleFolderSelect(null)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeFolderId === null
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md'
                    : 'glass border border-white/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground'
                }`}
              >
                <BookmarkIcon className="w-3.5 h-3.5" />
                All ({bookmarkCount})
              </button>
              {folders.map(f => (
                <div key={f.id} className="group/folder relative">
                  <button
                    onClick={() => handleFolderSelect(f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all pr-6 ${
                      activeFolderId === f.id
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md'
                        : 'glass border border-white/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {f.name}
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(f.id)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/folder:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-rose-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div>
              {showNewFolder ? (
                <form onSubmit={handleCreateFolder} className="flex gap-1.5">
                  <input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Folder name…"
                    maxLength={50}
                    autoFocus
                    className="px-3 py-1.5 rounded-xl glass border border-white/40 dark:border-white/[0.08] bg-transparent text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36"
                  />
                  <button
                    type="submit"
                    disabled={!newFolderName.trim() || folderSaving}
                    className="p-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setShowNewFolder(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass border border-white/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> New folder
                </button>
              )}
            </div>
          </div>

          {/* bookmark grid */}
          {bookmarksLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
                <p className="text-muted-foreground text-sm">Loading bookmarks…</p>
              </div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-16">
              <BookmarkIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {activeFolderId ? 'No bookmarks in this folder.' : 'No bookmarked articles yet.'}
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                {activeFolderId ? 'Assign bookmarks to this folder from the "All" view.' : 'Start bookmarking articles from the news feed!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bookmarks.map(article => (
                <div key={article.id} className="flex flex-col gap-1.5">
                  <NewsCard
                    article={{ ...article, isBookmarked: true }}
                    onBookmarkChange={() => loadBookmarks(activeFolderId)}
                  />
                  {/* folder assignment */}
                  <div className="flex items-center gap-1.5 px-1">
                    <Folder className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                    <select
                      value={article.bookmarkFolderId ?? ''}
                      disabled={assigningId === article.id}
                      onChange={e => handleAssignFolder(article.id, e.target.value || null)}
                      className="flex-1 text-[10px] text-muted-foreground bg-transparent focus:outline-none cursor-pointer hover:text-foreground transition-colors"
                    >
                      <option value="">No folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {activeTab === 'alerts' && (
        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-foreground">Keyword Alerts</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Get notified when articles match your keywords.
                {alerts.length >= 10 && <span className="text-rose-500 ml-1">Limit reached — delete one to add more.</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold tabular-nums px-3 py-1.5 glass rounded-xl">
              <span className={alerts.length >= 10 ? 'text-rose-500' : 'text-indigo-500'}>{alerts.length}</span>
              <span className="text-muted-foreground">/ 10</span>
            </div>
          </div>

          {/* add alert */}
          <form onSubmit={handleCreateAlert} className="flex gap-2 mb-5">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="e.g. Bitcoin, AI, RBI…"
              maxLength={50}
              disabled={alerts.length >= 10}
              className="flex-1 px-4 py-2.5 rounded-xl glass border border-white/40 dark:border-white/[0.08] bg-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={alertSaving || !newKeyword.trim() || alerts.length >= 10}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm font-semibold shadow-md shadow-indigo-500/25 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>

          {alertError && (
            <p className="text-sm text-rose-500 mb-4 px-1">{alertError}</p>
          )}

          {alertsLoading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-10">
              <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No alerts set. Add a keyword above to get notified.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map(alert => (
                <li key={alert.id} className="flex items-center justify-between px-4 py-3 rounded-2xl glass border border-white/40 dark:border-white/[0.07] group/alert hover:border-indigo-400/30 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{alert.keyword}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
