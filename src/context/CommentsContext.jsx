import { createContext, useContext, useState, useCallback } from 'react'

const CommentsContext = createContext(null)

export function CommentsProvider({ children, comments, onCommentsChange, user }) {
  const [open, setOpen] = useState(false)
  const [activeItem, setActiveItem] = useState({ id: null, label: '' })

  const openComments = useCallback((itemId, label) => {
    setActiveItem({ id: itemId, label })
    setOpen(true)
  }, [])

  const closeComments = useCallback(() => {
    setOpen(false)
  }, [])

  function commentCount(itemId) {
    const arr = comments[itemId] || []
    return arr.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)
  }

  function addComment(itemId, text) {
    if (!text.trim() || !user) return
    const newComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      authorEmail: user.email,
      authorUserId: user.userId,
      timestamp: new Date().toISOString(),
      replies: [],
    }
    onCommentsChange({
      ...comments,
      [itemId]: [...(comments[itemId] || []), newComment],
    })
  }

  function addReply(itemId, commentId, text) {
    if (!text.trim() || !user) return
    const newReply = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      authorEmail: user.email,
      authorUserId: user.userId,
      timestamp: new Date().toISOString(),
    }
    onCommentsChange({
      ...comments,
      [itemId]: (comments[itemId] || []).map(c =>
        c.id === commentId
          ? { ...c, replies: [...(c.replies || []), newReply] }
          : c
      ),
    })
  }

  function deleteComment(itemId, commentId) {
    onCommentsChange({
      ...comments,
      [itemId]: (comments[itemId] || []).filter(c => c.id !== commentId),
    })
  }

  function deleteReply(itemId, commentId, replyId) {
    onCommentsChange({
      ...comments,
      [itemId]: (comments[itemId] || []).map(c =>
        c.id === commentId
          ? { ...c, replies: (c.replies || []).filter(r => r.id !== replyId) }
          : c
      ),
    })
  }

  return (
    <CommentsContext.Provider value={{
      open, activeItem,
      openComments, closeComments,
      commentCount, addComment, addReply, deleteComment, deleteReply,
      comments, user,
    }}>
      {children}
    </CommentsContext.Provider>
  )
}

export function useComments() {
  const ctx = useContext(CommentsContext)
  if (!ctx) throw new Error('useComments must be used within CommentsProvider')
  return ctx
}
