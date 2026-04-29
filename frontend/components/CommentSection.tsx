'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { Send, Trash2, CornerDownRight } from 'lucide-react'
import { getComments, addComment, deleteComment, Comment } from '@/lib/api'

const timeAgo = (ts: string): string => {
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return '' }
}

interface Props { articleId: string }

export function CommentSection({ articleId }: Props) {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  useEffect(() => { load() }, [articleId])

  const load = async () => {
    setLoading(true)
    setComments(await getComments(articleId))
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    try {
      await addComment(articleId, body.trim())
      setBody('')
      await load()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      await addComment(articleId, replyBody.trim(), parentId)
      setReplyBody('')
      setReplyTo(null)
      await load()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(articleId, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId))
    } catch (e) { console.error(e) }
  }

  const topLevel = comments.filter(c => !c.parentId)
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id)

  return (
    <div className="pt-2 border-t border-border/60 space-y-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        Comments ({comments.length})
      </p>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {topLevel.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No comments yet. Be the first!</p>
          )}
          {topLevel.map(c => (
            <div key={c.id}>
              <CommentItem
                comment={c}
                currentUserId={user?.id}
                onDelete={handleDelete}
                onReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
              />
              {repliesOf(c.id).map(r => (
                <div key={r.id} className="ml-5 mt-1.5 flex gap-1 items-start">
                  <CornerDownRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                  <CommentItem
                    comment={r}
                    currentUserId={user?.id}
                    onDelete={handleDelete}
                    onReply={() => {}}
                    isReply
                  />
                </div>
              ))}
              {replyTo === c.id && isSignedIn && (
                <form onSubmit={(e) => handleReply(e, c.id)} className="ml-5 mt-1.5 flex gap-1.5">
                  <input
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder="Write a reply…"
                    maxLength={500}
                    autoFocus
                    className="flex-1 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-[11px] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={!replyBody.trim() || submitting}
                    className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 disabled:opacity-40 transition-opacity"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {isSignedIn ? (
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-[11px] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 disabled:opacity-40 transition-opacity"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          <a href="/sign-in" className="text-indigo-500 hover:underline">Sign in</a> to comment.
        </p>
      )}
    </div>
  )
}

function CommentItem({ comment, currentUserId, onDelete, onReply, isReply = false }: {
  comment: Comment
  currentUserId?: string
  onDelete: (id: string) => void
  onReply: () => void
  isReply?: boolean
}) {
  const initials = ((comment.userFirstName?.[0] ?? '') + (comment.userLastName?.[0] ?? '')).toUpperCase() ||
    (comment.userEmail?.[0]?.toUpperCase() ?? '?')
  const displayName = [comment.userFirstName, comment.userLastName].filter(Boolean).join(' ') ||
    comment.userEmail || 'Anonymous'

  return (
    <div className="flex gap-2 items-start group/comment flex-1">
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-[8px] font-bold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed break-words">{comment.body}</p>
        {!isReply && (
          <button
            onClick={onReply}
            className="text-[9px] text-muted-foreground/40 hover:text-indigo-500 mt-0.5 transition-colors"
          >
            Reply
          </button>
        )}
      </div>
      {currentUserId === comment.userId && (
        <button
          onClick={() => onDelete(comment.id)}
          className="p-1 rounded opacity-0 group-hover/comment:opacity-100 text-muted-foreground/30 hover:text-rose-500 transition-all flex-shrink-0"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}
