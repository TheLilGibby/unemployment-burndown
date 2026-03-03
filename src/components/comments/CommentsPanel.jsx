import { useState, useEffect, useRef } from 'react'
import { useComments } from '../../context/CommentsContext'

// ── Color helpers ────────────────────────────────────────────────────────
const COLOR_CLASSES = {
  blue:    'bg-blue-500',
  purple:  'bg-purple-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-400',
  rose:    'bg-rose-500',
  cyan:    'bg-cyan-500',
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function getEmailInitials(email = '') {
  const local = email.split('@')[0]
  return local.slice(0, 2).toUpperCase() || '?'
}

function getDisplayName(email = '') {
  return email.split('@')[0]
}

function relTime(iso) {
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function UserAvatar({ email, color, size = 7 }) {
  const sizeClass = size === 6 ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-xs'
  const bgClass = COLOR_CLASSES[color] ?? 'bg-blue-500'
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${bgClass}`}
      title={email}
    >
      {getEmailInitials(email)}
    </div>
  )
}

// ── Reply row ──────────────────────────────────────────────────────────────
function ReplyRow({ reply, itemId, commentId, currentUser }) {
  const { deleteReply } = useComments()
  const isOwn = reply.authorUserId === currentUser?.userId || reply.authorEmail === currentUser?.email

  return (
    <div className="flex gap-2 pl-3 border-l-2 border-blue-500/20 group">
      <UserAvatar
        email={reply.authorEmail || '?'}
        color={reply.authorUserId === currentUser?.userId ? currentUser?.profileColor : 'blue'}
        size={6}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {reply.authorEmail ? getDisplayName(reply.authorEmail) : 'Unknown'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{relTime(reply.timestamp)}</span>
        </div>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {reply.text}
        </p>
      </div>
      {isOwn && (
        <button
          onClick={() => deleteReply(itemId, commentId, reply.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start mt-0.5"
          style={{ color: 'var(--text-muted)' }}
          title="Delete reply"
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Comment row ────────────────────────────────────────────────────────────
function CommentRow({ comment, itemId, currentUser }) {
  const { addReply, deleteComment } = useComments()
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const replyRef = useRef(null)

  const isOwn = comment.authorUserId === currentUser?.userId || comment.authorEmail === currentUser?.email

  function submitReply() {
    if (!replyText.trim()) return
    addReply(itemId, comment.id, replyText)
    setReplyText('')
    setReplyOpen(false)
  }

  function handleReplyKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() }
    if (e.key === 'Escape') { setReplyOpen(false); setReplyText('') }
  }

  useEffect(() => {
    if (replyOpen) replyRef.current?.focus()
  }, [replyOpen])

  return (
    <div
      className="rounded-xl p-3 space-y-2.5 group"
      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Top: avatar + author + time + delete */}
      <div className="flex items-start gap-2">
        <UserAvatar
          email={comment.authorEmail || '?'}
          color={isOwn ? currentUser?.profileColor : 'blue'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {comment.authorEmail ? getDisplayName(comment.authorEmail) : 'Unknown'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{relTime(comment.timestamp)}</span>
          </div>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {comment.text}
          </p>
        </div>
        {isOwn && (
          <button
            onClick={() => deleteComment(itemId, comment.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
            style={{ color: 'var(--text-muted)' }}
            title="Delete comment"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Replies */}
      {(comment.replies?.length > 0) && (
        <div className="space-y-2 ml-1">
          {comment.replies.map(reply => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              itemId={itemId}
              commentId={comment.id}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      {replyOpen ? (
        <div className="flex gap-2 items-start ml-1">
          <UserAvatar email={currentUser?.email || '?'} color={currentUser?.profileColor} size={6} />
          <div className="flex-1 flex gap-1">
            <input
              ref={replyRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleReplyKey}
              placeholder="Write a reply… (Enter to send)"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg outline-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-blue)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={submitReply}
              disabled={!replyText.trim()}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
            >
              Send
            </button>
            <button
              onClick={() => { setReplyOpen(false); setReplyText('') }}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReplyOpen(true)}
          className="text-xs ml-9 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          ↩ Reply
        </button>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function CommentsPanel() {
  const {
    open, activeItem, closeComments,
    comments, addComment, user,
  } = useComments()

  const [text, setText] = useState('')
  const textareaRef = useRef(null)
  const itemComments = comments[activeItem.id] || []

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') closeComments() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closeComments])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80)
  }, [open, activeItem.id])

  // Reset text when switching items
  useEffect(() => { setText('') }, [activeItem.id])

  function submit() {
    addComment(activeItem.id, text)
    setText('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') closeComments()
  }

  if (!open) return null

  const totalCount = itemComments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={closeComments}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-[60] flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>
                <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
              </svg>
              <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {activeItem.label || 'Comments'}
              </h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {totalCount} comment{totalCount !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={closeComments}
            className="p-1 rounded hover:opacity-60 transition-opacity ml-2 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close comments"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {itemComments.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-3 py-8"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z" />
              </svg>
              <p className="text-sm">No comments yet</p>
              <p className="text-xs opacity-60">Be the first to add a note about this item.</p>
            </div>
          ) : (
            itemComments.map(comment => (
              <CommentRow
                key={comment.id}
                comment={comment}
                itemId={activeItem.id}
                currentUser={user}
              />
            ))
          )}
        </div>

        {/* New comment input */}
        <div
          className="flex-shrink-0 px-4 py-3 space-y-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {user && (
            <div className="flex items-center gap-2 mb-1">
              <UserAvatar email={user.email} color={user.profileColor} size={6} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {getDisplayName(user.email)}
              </span>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              rows={2}
              placeholder={
                !user
                  ? 'Sign in to comment…'
                  : 'Add a comment… (Enter to send, Shift+Enter for new line)'
              }
              disabled={!user}
              className="flex-1 text-sm px-3 py-2 rounded-xl resize-none outline-none disabled:opacity-40"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
            />
            <button
              onClick={submit}
              disabled={!text.trim() || !user}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 flex-shrink-0"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
              title="Send comment (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L1 8l5 2 2 5 6-13z" />
              </svg>
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}
