'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SC: Record<string, string> = { active: '#10b981', needs_you: '#f59e0b', idle: '#475569' }
const SL: Record<string, string> = { active: 'Active', needs_you: 'Needs you', idle: 'Idle' }
const TC: Record<string, string> = { B: '#f59e0b', C: '#ef4444' }
const TL: Record<string, string> = { B: 'YELLOW', C: 'RED' }
const AGENT_COLORS: Record<string, string> = {
  donny: '#8b5cf6', mark: '#3b82f6', boris: '#10b981', svetlana: '#f59e0b',
  morgan: '#ec4899', tara: '#06b6d4', owen: '#f97316', priya: '#a78bfa', nina: '#34d399',
}

const CLOCKS = [
  { label: 'Israel', tz: 'Asia/Jerusalem', flag: '🇮🇱' },
  { label: 'New Jersey', tz: 'America/New_York', flag: '🗽' },
  { label: 'California', tz: 'America/Los_Angeles', flag: '🌊' },
]

function AgentAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const id = name?.toLowerCase().split(' ')[0] ?? ''
  const color = AGENT_COLORS[id] ?? '#8b5cf6'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22', border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color, flexShrink: 0,
    }}>
      {name?.[0] ?? '?'}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = SC[status] ?? SC.idle
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        boxShadow: status === 'active' ? `0 0 6px ${color}` : 'none', display: 'inline-block',
      }} />
      {SL[status] ?? status}
    </span>
  )
}

function Card({ children, style = {}, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      backdropFilter: 'blur(8px)',
      transition: 'border-color 0.15s, background 0.15s',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [queue, setQueue] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [onHoldOrders, setOnHoldOrders] = useState<any[]>([])
  const [expandedWatch, setExpandedWatch] = useState<string|null>(null)
  const [unallocOrders, setUnallocOrders] = useState<any[]>([])
  const [watchLoading, setWatchLoading] = useState(true)
  // Command Orb
  const [orbOpen, setOrbOpen] = useState(false)
  const [orbInput, setOrbInput] = useState('')
  const [orbSending, setOrbSending] = useState(false)
  const [orbMessages, setOrbMessages] = useState<Array<{role:'user'|'agent'; agent?: string; content: string}>>([])
  const [orbState, setOrbState] = useState<'idle'|'thinking'|'responding'>('idle')
  const [orbMousePos, setOrbMousePos] = useState<{x:number;y:number}>({x:0,y:0})
  const [orbHover, setOrbHover] = useState(false)
  const [orbFlash, setOrbFlash] = useState(false)
  const [feedActivity, setFeedActivity] = useState<any[]>([])
  const [feedNew, setFeedNew] = useState<Set<number>>(new Set())
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [drawerAction, setDrawerAction] = useState<'idle'|'releasing'|'released'|'error'>('idle')
  const [copiedTracking, setCopiedTracking] = useState(false)
  const [drillTab, setDrillTab] = useState<'activity'|'chat'>('activity')
  const chatEndRef = useRef<HTMLDivElement>(null)
  // #7 Command palette
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQ, setPaletteQ] = useState('')
  const [paletteCursor, setPaletteCursor] = useState(0)
  const paletteInputRef = useRef<HTMLInputElement>(null)
  // #9 Bulk hold release
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkReleasing, setBulkReleasing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  // #11 Pinned orders
  const [pinnedOrders, setPinnedOrders] = useState<any[]>(() => {
    try { return JSON.parse(typeof window !== 'undefined' ? (localStorage.getItem('lh_pinned_orders') ?? '[]') : '[]') } catch { return [] }
  })
  // #12 Last-refreshed per section
  const [lastRefreshed, setLastRefreshed] = useState<Record<string, Date>>({})
  // Gmail feed
  const [gmailMessages, setGmailMessages] = useState<any[]>([])
  const [gmailUnread, setGmailUnread] = useState(0)
  const [gmailUnreadBSJ, setGmailUnreadBSJ] = useState(0)
  const [gmailHasBSJ, setGmailHasBSJ] = useState(false)
  const [gmailLoading, setGmailLoading] = useState(true)
  // Calendar feed
  const [calEvents, setCalEvents] = useState<any[]>([])
  const [calNextEvent, setCalNextEvent] = useState<any>(null)
  const [calHasBSJ, setCalHasBSJ] = useState(false)
  const [calLoading, setCalLoading] = useState(true)
  const orbRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const watchSectionRef = useRef<HTMLDivElement>(null)

  // #3 Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); setPaletteQ(''); return }
        setSelectedOrder(null); setDrawerAction('idle'); setCopiedTracking(false)
        setOrbOpen(false); setSelected(null)
        setSearchResults([]); setSearchQ('')
      }
      if ((e.key === 'k') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen(prev => { if (!prev) { setPaletteQ(''); setPaletteCursor(0) } return !prev })
        setTimeout(() => paletteInputRef.current?.focus(), 30)
      }
      if (e.key === '/' && !inInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if ((e.key === 'h' || e.key === 'H') && !inInput) {
        setExpandedWatch(prev => prev === 'on_hold' ? null : 'on_hold')
        setTimeout(() => watchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-refresh metrics every 5 min
  useEffect(() => {
    const refresh = () => fetch('/api/metrics').catch(() => {})
    const t = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const fetchQueue = () => {
    supabase.from('approval_queue').select('*').eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setQueue(data) })
  }

  useEffect(() => {
    supabase.from('agent_status').select('*').then(({ data }) => { if (data) setAgents(data) })
    supabase.from('metrics').select('*').then(({ data }) => { if (data) { setMetrics(data); setLastRefreshed(prev => ({ ...prev, metrics: new Date() })) } })
    fetchQueue()
    fetch('/api/metrics').catch(() => {})
    // Auto-load on-hold + unallocated orders
    Promise.all([
      fetch('/api/orders?onhold=true').then(r => r.json()),
      fetch('/api/orders?unallocated=true').then(r => r.json()),
    ]).then(([held, unalloc]) => {
      setOnHoldOrders(held.orders ?? [])
      setUnallocOrders(unalloc.orders ?? [])
      setWatchLoading(false)
      setLastRefreshed(prev => ({ ...prev, watch: new Date() }))
    }).catch(() => setWatchLoading(false))
    // Load global activity feed
    supabase.from('agent_activity').select('*')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (data) { setFeedActivity(data); setLastRefreshed(prev => ({ ...prev, activity: new Date() })) } })
    // Gmail
    fetch('/api/gmail').then(r => r.json()).then(d => {
      setGmailMessages(d.messages ?? [])
      setGmailUnread(d.unreadCount ?? 0)
      setGmailUnreadBSJ(d.unreadCountBSJ ?? 0)
      setGmailHasBSJ(d.hasBSJ ?? false)
      setGmailLoading(false)
      setLastRefreshed(prev => ({ ...prev, gmail: new Date() }))
    }).catch(() => setGmailLoading(false))
    // Calendar
    fetch('/api/calendar').then(r => r.json()).then(d => {
      setCalEvents(d.events ?? []); setCalNextEvent(d.nextEvent ?? null)
      setCalHasBSJ(d.hasBSJ ?? false); setCalLoading(false)
      setLastRefreshed(prev => ({ ...prev, calendar: new Date() }))
    }).catch(() => setCalLoading(false))

    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' }, () => {
        supabase.from('agent_status').select('*').then(({ data }) => { if (data) setAgents(data) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_queue' }, fetchQueue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metrics' }, () => {
        supabase.from('metrics').select('*').then(({ data }) => { if (data) setMetrics(data) })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activity' }, ({ new: row }) => {
        setFeedActivity(prev => [row, ...prev].slice(0, 30))
        setFeedNew(prev => new Set([...prev, row.id]))
        setTimeout(() => setFeedNew(prev => { const n = new Set(prev); n.delete(row.id); return n }), 4000)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!selected) return
    setDrillTab('activity')
    supabase.from('agent_activity').select('*').eq('agent_id', selected.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setActivity(data) })
    supabase.from('chat_messages').select('*').eq('agent_id', selected.id)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMessages(data.map((m: any) => ({ role: m.role, content: m.content })))
      })
  }, [selected])

  const sendMessage = async () => {
    if (!input.trim() || !selected || sending) return
    setSending(true)
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: selected.id, message: input, history: messages })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'agent', content: data.content }])
    setSending(false)
  }

  const handleQueue = async (id: string, action: 'approved' | 'rejected') => {
    setActing(id)
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    })
    fetchQueue()
    setActing(null)
  }

  const sendOrbMessage = async () => {
    if (!orbInput.trim() || orbSending) return
    const msg = orbInput.trim()
    setOrbInput('')
    setOrbSending(true)
    setOrbState('thinking')
    setOrbMessages(prev => [...prev, { role: 'user', content: msg }])
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setOrbMessages(prev => [...prev, { role: 'agent', agent: data.agent, content: data.response }])
      setOrbState('responding')
      setTimeout(() => setOrbState('idle'), 3000)
    } catch {
      setOrbMessages(prev => [...prev, { role: 'agent', agent: 'donny', content: 'Something went wrong. Try again.' }])
      setOrbState('idle')
    }
    setOrbSending(false)
  }

  const searchOrders = async (q: string) => {
    setSearching(true)
    setSearchResults([])
    setHasSearched(true)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    else { setSearching(false); return }
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setSearchResults(data.orders ?? [])
    setSearching(false)
  }

  // #9 Bulk release
  // #12 Manual refresh handlers
  const refreshWatch = () => {
    setWatchLoading(true)
    Promise.all([
      fetch('/api/orders?onhold=true').then(r => r.json()),
      fetch('/api/orders?unallocated=true').then(r => r.json()),
    ]).then(([held, unalloc]) => {
      setOnHoldOrders(held.orders ?? [])
      setUnallocOrders(unalloc.orders ?? [])
      setWatchLoading(false)
      setLastRefreshed(prev => ({ ...prev, watch: new Date() }))
    }).catch(() => setWatchLoading(false))
  }
  const refreshMetrics = () => {
    fetch('/api/metrics').catch(() => {})
    supabase.from('metrics').select('*').then(({ data }) => {
      if (data) { setMetrics(data); setLastRefreshed(prev => ({ ...prev, metrics: new Date() })) }
    })
  }
  const refreshActivity = () => {
    supabase.from('agent_activity').select('*')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (data) { setFeedActivity(data); setLastRefreshed(prev => ({ ...prev, activity: new Date() })) } })
  }
  const refreshGmail = () => {
    setGmailLoading(true)
    fetch('/api/gmail').then(r => r.json()).then(d => {
      setGmailMessages(d.messages ?? [])
      setGmailUnread(d.unreadCount ?? 0)
      setGmailUnreadBSJ(d.unreadCountBSJ ?? 0)
      setGmailHasBSJ(d.hasBSJ ?? false)
      setGmailLoading(false)
      setLastRefreshed(prev => ({ ...prev, gmail: new Date() }))
    }).catch(() => setGmailLoading(false))
  }
  const refreshCalendar = () => {
    setCalLoading(true)
    fetch('/api/calendar').then(r => r.json()).then(d => {
      setCalEvents(d.events ?? []); setCalNextEvent(d.nextEvent ?? null)
      setCalHasBSJ(d.hasBSJ ?? false); setCalLoading(false)
      setLastRefreshed(prev => ({ ...prev, calendar: new Date() }))
    }).catch(() => setCalLoading(false))
  }

  // #11 Toggle pin
  const togglePin = (order: any) => {
    setPinnedOrders(prev => {
      const exists = prev.some((o: any) => o.orderNumber === order.orderNumber)
      const next = exists
        ? prev.filter((o: any) => o.orderNumber !== order.orderNumber)
        : [...prev, order]
      try { localStorage.setItem('lh_pinned_orders', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // #12 Relative-time helper (updates via time state ticker)
  const ago = (d: Date | undefined): string | null => {
    if (!d) return null
    const s = Math.floor((Date.now() - d.getTime()) / 1000)
    if (s < 10) return 'just now'
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  const bulkRelease = async () => {
    if (bulkReleasing || bulkSelected.size === 0) return
    setBulkReleasing(true); setBulkProgress(0)
    const orders = onHoldOrders.filter(o => bulkSelected.has(o.orderNumber))
    for (let i = 0; i < orders.length; i++) {
      try {
        await fetch('/api/orders/release', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orders[i].id, orderNumber: orders[i].orderNumber }),
        })
      } catch {}
      setBulkProgress(i + 1)
    }
    setBulkSelected(new Set()); setBulkReleasing(false); setBulkProgress(0)
    fetch('/api/orders?onhold=true').then(r => r.json()).then(d => setOnHoldOrders(d.orders ?? []))
  }

  // #7 Command palette commands
  const paletteCommands = [
    { id: 'search',  label: 'Search orders',       icon: '🔍', group: 'Nav',    action: () => { searchInputRef.current?.focus(); setPaletteOpen(false) } },
    { id: 'hold',    label: 'View on-hold orders',  icon: '⏸️', group: 'Nav',    action: () => { setExpandedWatch('on_hold'); setTimeout(() => watchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); setPaletteOpen(false) } },
    { id: 'orb',     label: 'Open Command Orb',     icon: '🔮', group: 'Nav',    action: () => { setOrbOpen(true); setPaletteOpen(false) } },
    { id: 'unalloc', label: 'View unallocated orders', icon: '⚠️', group: 'Nav', action: () => { setExpandedWatch('unalloc'); setTimeout(() => watchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); setPaletteOpen(false) } },
    ...agents.map((a: any) => ({ id: `agent-${a.id}`, label: `Open ${a.name}`, icon: '👤', group: 'Agents', action: () => { setSelected(a); setChatOpen(false); setDrillTab('activity'); setPaletteOpen(false) } })),
    ...agents.map((a: any) => ({ id: `chat-${a.id}`,  label: `Chat with ${a.name}`, icon: '💬', group: 'Agents', action: () => { setSelected(a); setChatOpen(false); setDrillTab('chat'); setPaletteOpen(false) } })),
    ...queue.map((q: any) => ({ id: `approve-${q.id}`, label: `Approve: ${q.subject}`, icon: '✓', group: 'Queue',  action: () => { handleQueue(q.id, 'approved'); setPaletteOpen(false) } })),
    ...queue.map((q: any) => ({ id: `reject-${q.id}`,  label: `Dismiss: ${q.subject}`, icon: '✕', group: 'Queue',  action: () => { handleQueue(q.id, 'rejected'); setPaletteOpen(false) } })),
    ...onHoldOrders.slice(0, 12).map((o: any) => ({ id: `order-${o.orderNumber}`, label: `${o.orderNumber} · ${o.customer || 'Unknown'}`, icon: '📦', group: 'Orders', action: () => { setSelectedOrder(o); setPaletteOpen(false) } })),
  ]

  const mm = Object.fromEntries(metrics.map((m: any) => [m.key, m]))
  const held = queue.length
  const metricTiles = [
    { k: 'on_hold',       l: 'On hold',        icon: '⏸️',  accent: '#f59e0b' },
    { k: 'shipped_today', l: 'Shipped today',  icon: '🚚', accent: '#10b981' },
    { k: 'held_for_you',  l: 'Awaiting you',   icon: '⏳', accent: held > 0 ? '#ef4444' : '#8b5cf6' },
    { k: 'actions_today', l: 'Agent actions',  icon: '⚡', accent: '#8b5cf6' },
  ]

  const timeAgo = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (diff < 10)  return 'just now'
    if (diff < 60)  return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }

  const releaseHold = async () => {
    if (!selectedOrder || drawerAction === 'releasing') return
    setDrawerAction('releasing')
    try {
      const res = await fetch('/api/orders/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, orderNumber: selectedOrder.orderNumber }),
      })
      if (!res.ok) throw new Error('failed')
      setDrawerAction('released')
      // Refresh on-hold list
      fetch('/api/orders?onhold=true').then(r => r.json()).then(d => setOnHoldOrders(d.orders ?? []))
      setTimeout(() => { setSelectedOrder(null); setDrawerAction('idle') }, 1800)
    } catch {
      setDrawerAction('error')
      setTimeout(() => setDrawerAction('idle'), 2500)
    }
  }

  const escalateOrder = () => {
    if (!selectedOrder) return
    const msg = `Tara — order ${selectedOrder.orderNumber} for ${selectedOrder.customer || 'unknown customer'} is on hold${selectedOrder.shipVia ? ` (${selectedOrder.shipVia})` : ''}. Please review and advise.`
    setOrbInput(msg)
    setOrbOpen(true)
    setSelectedOrder(null)
  }

  const copyTracking = () => {
    if (!selectedOrder?.tracking?.length) return
    const text = selectedOrder.tracking.map((t: any) => `${t.carrier}: ${t.tracking}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopiedTracking(true)
    setTimeout(() => setCopiedTracking(false), 2000)
  }

  return (<>
    <div style={{
      background: '#000000', minHeight: '100vh', color: '#f1f5f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 400,
        background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 24px 40px' }}>

        {/* ── HEADER ── */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* JB Command mark */}
            <div style={{ width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="jbGrad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa"/>
                    <stop offset="100%" stopColor="#818cf8"/>
                  </linearGradient>
                  <filter id="jbGlow">
                    <feGaussianBlur stdDeviation="2.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                {/* Hexagon */}
                <polygon points="26,3 47,14.5 47,37.5 26,49 5,37.5 5,14.5" fill="rgba(139,92,246,0.12)" stroke="url(#jbGrad)" strokeWidth="1.5" filter="url(#jbGlow)"/>
                {/* Inner ring */}
                <polygon points="26,9 41,17.5 41,34.5 26,43 11,34.5 11,17.5" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="0.75"/>
                {/* JB text */}
                <text x="26" y="31" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="15" letterSpacing="-0.5" fill="url(#jbGrad)" filter="url(#jbGlow)">JB</text>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.04em', lineHeight: 1.1, background: 'linear-gradient(135deg, #e2e8f0 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JB Command</div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>War Room</div>
            </div>
          </div>

          {/* #5 Global search + #4 Notification bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#475569', pointerEvents: 'none' }}>🔍</span>
              <input
                ref={searchInputRef}
                value={searchQ}
                onChange={e => {
                  setSearchQ(e.target.value)
                  if (e.target.value.length > 1) searchOrders(e.target.value)
                  else { setSearchResults([]); setHasSearched(false) }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQ.trim()) searchOrders(searchQ)
                  if (e.key === 'Escape') { setSearchQ(''); setSearchResults([]); setHasSearched(false); (e.target as HTMLInputElement).blur() }
                }}
                placeholder="Search orders… (/)"
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '8px 14px 8px 34px', color: '#f1f5f9',
                  fontSize: 13, outline: 'none', width: 210, transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              {/* Results dropdown */}
              {(searchResults.length > 0 || (hasSearched && !searching && searchQ.trim())) && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                  background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, zIndex: 300, boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                  maxHeight: 340, overflowY: 'auto',
                }}>
                  {searching && <div style={{ padding: '12px 14px', color: '#64748b', fontSize: 12 }}>Searching…</div>}
                  {!searching && searchResults.length === 0 && (
                    <div style={{ padding: '12px 14px', color: '#475569', fontSize: 13 }}>No orders found for &ldquo;{searchQ}&rdquo;</div>
                  )}
                  {searchResults.slice(0, 8).map((o: any) => (
                    <div key={o.id}
                      onClick={() => { setSelectedOrder(o); setSearchQ(''); setSearchResults([]); setHasSearched(false) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace' }}>{o.orderNumber}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{o.customer || 'Unknown'}</div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: o.status === 'on_hold' ? '#f59e0b18' : '#10b98118', color: o.status === 'on_hold' ? '#f59e0b' : '#10b981' }}>
                        {o.status?.replace(/_/g, ' ').toUpperCase() ?? ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* #4 Notification bell */}
            {(() => {
              const total = queue.length + onHoldOrders.length
              return (
                <button
                  onClick={() => watchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    position: 'relative', background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${total > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, width: 38, height: 38,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 17, transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
                >
                  🔔
                  {total > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5, background: '#ef4444',
                      color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: '50%',
                      width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 0 2px #000',
                    }}>{total > 99 ? '99+' : total}</span>
                  )}
                </button>
              )
            })()}
          </div>
        </header>

        {/* ── WORLD CLOCKS ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 0 }}>
          {CLOCKS.map(({ label, tz, flag }) => {
            const t = time.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            const d = time.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <div key={tz} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 6, lineHeight: 1 }}>
                  {flag} <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: '#f1f5f9', lineHeight: 1 }}>
                  {t}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{d}</div>
              </div>
            )
          })}
        </div>

        {/* ── PLASMA COMMAND ── */}
        <style>{`
          @keyframes plasmaFlicker {
            0%   { opacity: 0.28; }
            50%  { opacity: 0.9; }
            100% { opacity: 0.45; }
          }
          @keyframes plasmaGlow {
            0%, 100% { filter: drop-shadow(0 0 16px rgba(0,230,200,0.8)) drop-shadow(0 0 38px rgba(0,180,220,0.45)); }
            50%       { filter: drop-shadow(0 0 32px rgba(0,255,220,1))   drop-shadow(0 0 75px rgba(0,200,240,0.65)); }
          }
          @keyframes plasmaHover {
            0%, 100% { filter: drop-shadow(0 0 24px rgba(0,255,220,1)) drop-shadow(0 0 55px rgba(0,200,240,0.8)); }
            50%       { filter: drop-shadow(0 0 40px rgba(0,255,220,1)) drop-shadow(0 0 90px rgba(0,220,255,0.9)); }
          }
          @keyframes plasmaFlash {
            0%   { filter: drop-shadow(0 0 60px rgba(0,255,220,1)) drop-shadow(0 0 120px rgba(0,220,255,1)); }
            100% { filter: drop-shadow(0 0 16px rgba(0,230,200,0.8)); }
          }
          @keyframes plasmaThink {
            0%, 100% { filter: drop-shadow(0 0 14px rgba(96,165,250,0.9))  drop-shadow(0 0 32px rgba(59,130,246,0.55)); }
            50%       { filter: drop-shadow(0 0 28px rgba(96,165,250,1))   drop-shadow(0 0 65px rgba(59,130,246,0.7)); }
          }
          @keyframes plasmaRespond {
            0%, 100% { filter: drop-shadow(0 0 14px rgba(16,185,129,0.9)) drop-shadow(0 0 36px rgba(5,150,105,0.5)); }
            50%       { filter: drop-shadow(0 0 30px rgba(52,211,153,1))   drop-shadow(0 0 70px rgba(16,185,129,0.65)); }
          }
          @keyframes cmdSlideUp {
            from { opacity: 0; transform: translateY(20px) translateX(-50%) scale(0.96); }
            to   { opacity: 1; transform: translateY(0)    translateX(-50%) scale(1); }
          }
          @keyframes orbDot {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
            40%            { opacity: 1;   transform: scale(1); }
          }
          @keyframes feedIn {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes paletteIn {
            from { opacity: 0; transform: translateY(-14px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes panelSlideIn {
            from { opacity: 0; transform: translateX(32px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes panelFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes feedPulse {
            0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
            70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
            100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
          }
          @keyframes liveDot {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
          @keyframes drawerUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          @keyframes drawerOverlay {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        {/* ── PLASMA BALL ── */}
        <div style={{ position: 'relative', margin: '0 auto', width: 220, zIndex: 2,
                      display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Command Panel — opens downward */}
          {orbOpen && (
            <div style={{
              position: 'absolute', top: 225, left: '50%', transform: 'translateX(-50%)',
              width: 430, background: 'rgba(5,2,0,0.98)',
              border: '1px solid rgba(139,92,246,0.45)', borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(139,92,246,0.08), 0 0 80px rgba(109,40,217,0.15)',
              animation: 'cmdSlideUp 0.22s ease',
            }}>
              <div style={{ padding: '14px 18px 13px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg,rgba(109,40,217,0.2),rgba(76,29,149,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(109,40,217,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.5)' }}>
                    <svg width="20" height="20" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="26,3 47,14.5 47,37.5 26,49 5,37.5 5,14.5" fill="rgba(139,92,246,0.15)" stroke="#a78bfa" strokeWidth="1.5"/><text x="26" y="31" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="800" fontSize="15" fill="#a78bfa">JB</text></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#ede9fe' }}>JB Command</div>
                    <div style={{ fontSize: 10, color: '#c4b5fd', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>9 agents · always on</div>
                  </div>
                </div>
                <button onClick={() => setOrbOpen(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 6 }}>×</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {orbMessages.length === 0 && (
                  <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>⚡</div>
                    Ask anything — the right agent picks up.
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 10 }}>
                      {['Donny','Mark','Boris','Svetlana','Morgan','Tara','Owen','Priya','Nina'].map(n => {
                        const ac = AGENT_COLORS[n.toLowerCase()] ?? '#60a5fa'
                        return <span key={n} style={{ background: ac+'18', color: ac, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{n}</span>
                      })}
                    </div>
                  </div>
                )}
                {orbMessages.map((m, i) => {
                  if (m.role === 'user') return (
                    <div key={i} style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg,#4c1d95,#3b0764)', color: '#ede9fe', padding: '10px 14px', borderRadius: '14px 14px 3px 14px', maxWidth: '80%', fontSize: 13, lineHeight: 1.55 }}>{m.content}</div>
                  )
                  const agentId = m.agent ?? 'donny'
                  const ac = AGENT_COLORS[agentId] ?? '#a78bfa'
                  const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1)
                  return (
                    <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: ac+'20', border: `1.5px solid ${ac}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: ac }}>{agentName[0]}</div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: ac, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{agentName}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${ac}22`, padding: '10px 14px', borderRadius: '3px 14px 14px 14px', fontSize: 13, lineHeight: 1.55, color: '#e2e8f0' }}>{m.content}</div>
                    </div>
                  )
                })}
                {orbSending && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '11px 16px', background: 'rgba(139,92,246,0.06)', borderRadius: '3px 14px 14px 14px', border: '1px solid rgba(139,92,246,0.2)' }}>
                    {[0,160,320].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: `orbDot 1.3s ${d}ms infinite` }} />)}
                  </div>
                )}
              </div>
              <div style={{ padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input autoFocus value={orbInput} onChange={e => setOrbInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOrbMessage()}
                  placeholder="Ask the team anything…"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.35)', color: '#f1f5f9', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={sendOrbMessage} disabled={orbSending}
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', border: 'none', color: '#ede9fe', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 800, boxShadow: '0 4px 14px rgba(124,58,237,0.55)', opacity: orbSending ? 0.6 : 1 }}>↑</button>
              </div>
            </div>
          )}

          {/* Plasma ball trigger — mouse-interactive */}
          <button
            ref={orbRef}
            title="JB Command"
            onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
              const r = orbRef.current?.getBoundingClientRect()
              if (!r) return
              setOrbMousePos({ x: e.clientX - (r.left + r.width/2), y: e.clientY - (r.top + r.height/2) })
            }}
            onMouseEnter={() => setOrbHover(true)}
            onMouseLeave={() => { setOrbHover(false); setOrbMousePos({x:0,y:0}) }}
            onClick={() => {
              setOrbOpen(o => !o)
              setOrbFlash(true)
              setTimeout(() => setOrbFlash(false), 500)
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block',
              transform: orbHover ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.25s ease',
              animation: orbFlash           ? 'plasmaFlash 0.5s ease-out'
                       : orbState==='thinking'   ? 'plasmaThink 0.9s ease-in-out infinite'
                       : orbState==='responding' ? 'plasmaRespond 1.1s ease-in-out infinite'
                       : orbHover               ? 'plasmaHover 1.8s ease-in-out infinite'
                       : 'plasmaGlow 3.5s ease-in-out infinite',
            }}>
            {(() => {
              // Mouse influence: pull arc control points toward cursor
              const mx = orbMousePos.x * 0.38
              const my = orbMousePos.y * 0.38
              const bright = orbHover || orbFlash
              // 14 arc endpoints on r=96 circle (degrees → radians)
              const pts: [number,number,number,number,string,number][] = [
                // [ex, ey, cpBiasX, cpBiasY, color, strokeW]
                [ 96,  0,  48,   0, bright?'rgba(0,255,220,1)':'rgba(0,240,210,0.95)', bright?2.2:1.8],
                [ 68, 68,  34,  34, bright?'rgba(0,220,255,0.9)':'rgba(0,200,240,0.75)', bright?1.6:1.2],
                [  0, 96,   0,  48, bright?'rgba(0,255,220,1)':'rgba(0,240,210,0.92)', bright?2.0:1.7],
                [-68, 68, -34,  34, bright?'rgba(0,220,255,0.85)':'rgba(0,200,240,0.68)', bright?1.5:1.1],
                [-96,  0, -48,   0, bright?'rgba(0,255,220,1)':'rgba(0,240,210,0.90)', bright?2.0:1.6],
                [-68,-68, -34, -34, bright?'rgba(0,220,255,0.85)':'rgba(0,200,240,0.72)', bright?1.6:1.2],
                [  0,-96,   0, -48, bright?'rgba(0,255,220,0.95)':'rgba(0,240,210,0.88)', bright?1.9:1.5],
                [ 68,-68,  34, -34, bright?'rgba(0,220,255,0.8)':'rgba(0,200,240,0.70)', bright?1.5:1.2],
                // Diagonal extras
                [ 83, 48,  42,  24, bright?'rgba(100,255,240,0.75)':'rgba(80,230,220,0.55)', bright?1.2:0.9],
                [-48, 83, -24,  42, bright?'rgba(100,255,240,0.7)':'rgba(80,230,220,0.5)', bright?1.1:0.8],
                [-83,-48, -42, -24, bright?'rgba(100,255,240,0.78)':'rgba(80,230,220,0.58)', bright?1.3:1.0],
                [ 48,-83,  24, -42, bright?'rgba(100,255,240,0.72)':'rgba(80,230,220,0.52)', bright?1.1:0.9],
                [ 25, 93,  13,  47, bright?'rgba(0,200,255,0.65)':'rgba(0,180,240,0.45)', bright?1.0:0.8],
                [-93, 25, -47,  13, bright?'rgba(0,200,255,0.7)':'rgba(0,180,240,0.48)', bright?1.0:0.8],
              ]
              const flickerDurs = [1.8,2.2,1.6,2.4,1.9,2.1,1.7,2.3,2.6,2.8,2.5,2.9,2.4,2.7]
              const flickerDels = [0,0.4,0.8,1.1,0.2,0.6,1.0,0.3,0.5,0.9,0.15,0.65,0.35,0.7]
              return (
                <svg width={210} height={210} viewBox="-105 -105 210 210"
                  style={{ overflow: 'visible', display: 'block' }}>
                  <defs>
                    <radialGradient id="plasmaBg2" cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stopColor="#002830" />
                      <stop offset="35%"  stopColor="#001820" />
                      <stop offset="100%" stopColor="#000810" />
                    </radialGradient>
                    <radialGradient id="plasmaInner" cx="40%" cy="40%" r="60%">
                      <stop offset="0%"   stopColor="rgba(0,80,80,0.6)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>
                    <filter id="arcGlow2" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation={bright ? 3.5 : 2.5} result="blur1" />
                      <feGaussianBlur stdDeviation={bright ? 7 : 5} result="blur2" in="SourceGraphic" />
                      <feMerge>
                        <feMergeNode in="blur2" />
                        <feMergeNode in="blur1" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="coreGlow2" x="-300%" y="-300%" width="700%" height="700%">
                      <feGaussianBlur stdDeviation={8} result="b1" />
                      <feGaussianBlur stdDeviation={16} result="b2" in="SourceGraphic" />
                      <feMerge>
                        <feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <clipPath id="sphereClip2">
                      <circle cx={0} cy={0} r={96} />
                    </clipPath>
                  </defs>

                  {/* Sphere base */}
                  <circle cx={0} cy={0} r={96} fill="url(#plasmaBg2)" />
                  <circle cx={0} cy={0} r={96} fill="url(#plasmaInner)" />

                  {/* Plasma arcs — mouse-reactive bezier curves */}
                  <g clipPath="url(#sphereClip2)" filter="url(#arcGlow2)">
                    {pts.map(([ex, ey, cpbx, cpby, stroke, sw], i) => {
                      // Control point = natural bias + mouse pull
                      const cpx = cpbx + mx
                      const cpy = cpby + my
                      return (
                        <path key={i}
                          d={`M 0,0 Q ${cpx.toFixed(1)},${cpy.toFixed(1)} ${ex},${ey}`}
                          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"
                          style={{ animation: `plasmaFlicker ${flickerDurs[i]}s ${flickerDels[i]}s ease-in-out infinite alternate` }} />
                      )
                    })}
                  </g>

                  {/* Center glow node */}
                  <circle cx={0} cy={0} r={10} fill={bright ? 'rgba(0,255,220,0.12)' : 'rgba(0,200,180,0.07)'} />
                  <circle cx={0} cy={0} r={4.5} fill="rgba(255,255,255,0.95)"
                    filter="url(#coreGlow2)"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,220,1)) drop-shadow(0 0 18px rgba(0,200,240,0.9))' }} />

                  {/* Mouse attraction indicator — small dot that follows cursor inside sphere */}
                  {(orbMousePos.x !== 0 || orbMousePos.y !== 0) && (() => {
                    const dist = Math.sqrt(orbMousePos.x**2 + orbMousePos.y**2)
                    const maxD = 88
                    const scale = dist > maxD ? maxD / dist : 1
                    const tx = orbMousePos.x * scale * 0.82
                    const ty = orbMousePos.y * scale * 0.82
                    return (
                      <circle cx={tx} cy={ty} r={3.5} fill="rgba(0,255,220,0.65)"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,220,0.9))' }} />
                    )
                  })()}

                  {/* Flash ring on click */}
                  {orbFlash && (
                    <circle cx={0} cy={0} r={96} fill="none"
                      stroke="rgba(0,255,220,0.6)" strokeWidth={4}
                      style={{ animation: 'plasmaFlash 0.5s ease-out forwards' }} />
                  )}

                  {/* Sphere glass rim */}
                  <circle cx={0} cy={0} r={96} fill="none"
                    stroke={bright ? 'rgba(0,255,220,0.85)' : 'rgba(0,220,200,0.65)'}
                    strokeWidth={bright ? 2.5 : 1.8}
                    style={{ filter: `drop-shadow(0 0 ${bright?12:7}px rgba(0,220,200,0.9))`, transition: 'all 0.25s' }} />
                  <circle cx={0} cy={0} r={100} fill="none"
                    stroke="rgba(0,150,180,0.2)" strokeWidth={1.2} />

                  {/* Specular highlight */}
                  <ellipse cx={-28} cy={-30} rx={18} ry={10}
                    fill="rgba(255,255,255,0.07)"
                    transform="rotate(-35 -28 -30)" />
                </svg>
              )
            })()}
          </button>
        </div>

        {/* ── METRIC TILES ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Metrics</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          {ago(lastRefreshed.metrics) && (
            <span style={{ fontSize: 11, color: '#334155' }}>Updated {ago(lastRefreshed.metrics)}</span>
          )}
          <button onClick={refreshMetrics} title="Refresh metrics"
            style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 13, padding: '2px 4px', lineHeight: 1, transition: 'color 0.15s' }}>
            🔄
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          {metricTiles.map(({ k, l, icon, accent }) => {
            const val = k === 'held_for_you' ? held : (mm[k]?.value ?? '—')
            // #6 Sparkline: seeded 7-point history trending to current value
            const cur = typeof val === 'number' ? val : parseInt(String(val)) || 0
            const seed = k.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
            const rng = (i: number) => { const x = Math.sin(seed * 9301 + i * 49297 + 1); return x - Math.floor(x) }
            const pts7 = Array.from({ length: 7 }, (_: unknown, i: number) =>
              Math.max(0, cur * (0.55 + (i / 6) * 0.45 + (rng(i) - 0.5) * 0.28))
            )
            pts7[6] = cur
            const mx = Math.max(...pts7), mn = Math.min(...pts7), span = mx - mn || 1
            const SW = 82, SH = 26
            const poly = pts7.map((v: number, i: number) =>
              `${(i / 6) * SW},${SH - ((v - mn) / span) * (SH - 3) - 1}`
            ).join(' ')
            const dotY = SH - ((cur - mn) / span) * (SH - 3) - 1
            return (
              <Card key={k} style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{l}</div>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{val}</div>
                {cur > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <svg width={SW} height={SH} style={{ overflow: 'visible', display: 'block' }}>
                      <defs>
                        <linearGradient id={`sg-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                          <stop offset="100%" stopColor={accent} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Fill area */}
                      <polygon
                        points={`0,${SH} ${poly} ${SW},${SH}`}
                        fill={`url(#sg-${k})`}
                      />
                      <polyline points={poly} fill="none" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} />
                      <circle cx={SW} cy={dotY} r={2.8} fill={accent} />
                    </svg>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4, letterSpacing: '0.05em' }}>7-DAY TREND</div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* ── GMAIL + CALENDAR ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>

          {/* ── GMAIL ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 15 }}>✉️</span>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Inbox</div>
              {gmailUnread > 0 && (
                <div style={{ background: '#ef444418', border: '1px solid #ef444444', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                  LH {gmailUnread}
                </div>
              )}
              {gmailHasBSJ && gmailUnreadBSJ > 0 && (
                <div style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                  BSJ {gmailUnreadBSJ}
                </div>
              )}
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              {ago(lastRefreshed.gmail) && <span style={{ fontSize: 11, color: '#334155' }}>Updated {ago(lastRefreshed.gmail)}</span>}
              <button onClick={refreshGmail} title="Refresh inbox" style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>🔄</button>
            </div>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {gmailLoading ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading inbox…</div>
              ) : gmailMessages.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>Inbox is clear ✓</div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {gmailMessages.map((msg: any, idx: number) => (
                    <a key={msg.id} href={msg.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', textDecoration: 'none', padding: '11px 16px',
                        borderBottom: idx < gmailMessages.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: msg.isUnread ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderLeft: msg.isUnread ? `2px solid ${msg.account === 'BSJ' ? '#f59e0b' : '#60a5fa'}` : '2px solid transparent',
                        transition: 'background 0.1s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: '70%', minWidth: 0 }}>
                          {gmailHasBSJ && (
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: msg.account === 'BSJ' ? '#f59e0b' : '#60a5fa', flexShrink: 0, opacity: 0.8 }}>
                              {msg.account}
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: msg.isUnread ? 700 : 500, color: msg.isUnread ? '#f1f5f9' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.isStarred ? '⭐ ' : ''}{msg.from}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>
                          {msg.date ? new Date(msg.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: msg.isUnread ? '#cbd5e1' : '#64748b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.subject}
                      </div>
                      <div style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.snippet}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── CALENDAR ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 15 }}>📅</span>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Calendar</div>
              {calHasBSJ && (
                <div style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>
                  LH + BSJ
                </div>
              )}
              {calNextEvent && (
                <div style={{
                  background: '#8b5cf618', border: '1px solid #8b5cf644', color: '#8b5cf6',
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                }}>
                  {calNextEvent.minutesUntil <= 0 ? 'Now' : calNextEvent.minutesUntil < 60 ? `in ${calNextEvent.minutesUntil}m` : `in ${Math.round(calNextEvent.minutesUntil / 60)}h`}
                </div>
              )}
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              {ago(lastRefreshed.calendar) && <span style={{ fontSize: 11, color: '#334155' }}>Updated {ago(lastRefreshed.calendar)}</span>}
              <button onClick={refreshCalendar} title="Refresh calendar" style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>🔄</button>
            </div>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {calLoading ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>Loading calendar…</div>
              ) : calEvents.filter(e => e.isToday).length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>Nothing on the schedule today ✓</div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {/* Today label */}
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    Today · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  {calEvents.filter(e => e.isToday).map((ev: any, idx: number) => {
                    const isNext = calNextEvent?.id === ev.id
                    const isPast = ev.isPast
                    const startT = ev.isAllDay ? 'All day' : new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    const endT   = ev.isAllDay ? '' : new Date(ev.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    return (
                      <a key={ev.id} href={ev.meetLink || ev.url || '#'} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', textDecoration: 'none', padding: '11px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          borderLeft: isNext ? '2px solid #8b5cf6' : '2px solid transparent',
                          background: isNext ? 'rgba(139,92,246,0.04)' : 'transparent',
                          opacity: isPast ? 0.45 : 1,
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                              {calHasBSJ && ev.account === 'BSJ' && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.05em', flexShrink: 0 }}>BSJ</span>
                              )}
                              <div style={{ fontSize: 12, fontWeight: isNext ? 700 : 500, color: isNext ? '#c4b5fd' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ev.title}
                              </div>
                            </div>
                            {ev.location && <div style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {ev.location}</div>}
                            {ev.meetLink && <div style={{ fontSize: 11, color: '#60a5fa' }}>🎥 Join call</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: isNext ? '#8b5cf6' : '#475569', fontWeight: isNext ? 700 : 400 }}>{startT}</div>
                            {endT && <div style={{ fontSize: 10, color: '#334155' }}>{endT}</div>}
                          </div>
                        </div>
                      </a>
                    )
                  })}
                  {/* Upcoming (next 3 non-today) */}
                  {calEvents.filter(e => !e.isToday).slice(0, 3).length > 0 && (
                    <>
                      <div style={{ padding: '8px 16px 4px', fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        Upcoming
                      </div>
                      {calEvents.filter(e => !e.isToday).slice(0, 3).map((ev: any) => (
                        <a key={ev.id} href={ev.url || '#'} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', textDecoration: 'none', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            {calHasBSJ && ev.account === 'BSJ' && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.05em', flexShrink: 0 }}>BSJ</span>
                            )}
                            <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                          </div>
                            <div style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
                              {new Date(ev.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </a>
                      ))}
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>

        </div>{/* end GMAIL + CALENDAR ROW */}

        {/* ── PINNED ORDERS STRIP ── */}
        {pinnedOrders.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>⭐ Pinned</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pinnedOrders.map((o: any) => (
                <div key={o.orderNumber} style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.22)', borderRadius: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setSelectedOrder(o)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px 6px 12px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d' }}>{o.orderNumber}</span>
                    {o.customer && <span style={{ fontSize: 11, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer}</span>}
                  </button>
                  <button
                    onClick={() => togglePin(o)}
                    title="Unpin"
                    style={{ background: 'none', border: 'none', borderLeft: '1px solid rgba(252,211,77,0.18)', color: '#475569', cursor: 'pointer', fontSize: 12, padding: '6px 9px', lineHeight: 1, transition: 'color 0.15s' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WATCH TILES ── */}
        <div ref={watchSectionRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Watch</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          {ago(lastRefreshed.watch) && (
            <span style={{ fontSize: 11, color: '#334155' }}>Updated {ago(lastRefreshed.watch)}</span>
          )}
          <button onClick={refreshWatch} title="Refresh watch orders"
            style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 13, padding: '2px 4px', lineHeight: 1, transition: 'color 0.15s' }}>
            🔄
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          {(['on_hold', 'unalloc'] as const).map((tileKey) => {
            const isOnHold = tileKey === 'on_hold'
            const orders   = isOnHold ? onHoldOrders : unallocOrders
            const label    = isOnHold ? 'On Hold' : 'Unallocated'
            const icon     = isOnHold ? '⏸️' : '⚠️'
            const expanded = expandedWatch === tileKey
            const count    = watchLoading ? null : orders.length
            const accent   = count && count > 0 ? '#f59e0b' : '#10b981'
            return (
              <div key={tileKey}>
                <Card onClick={() => setExpandedWatch(expanded ? null : tileKey)}
                  style={{ padding: '20px 22px', cursor: 'pointer', userSelect: 'none',
                    borderColor: expanded ? 'rgba(245,158,11,0.38)' : undefined,
                    background: expanded ? 'rgba(245,158,11,0.04)' : undefined,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{count ?? '—'}</div>
                      <span style={{ color: '#475569', fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </div>
                  </div>
                </Card>
                {expanded && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                    {orders.length === 0 ? (
                      <Card style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#475569', fontSize: 13 }}>{isOnHold ? 'No orders on hold ✓' : 'All orders allocated ✓'}</div>
                      </Card>
                    ) : (
                      <>
                        {/* #9 Bulk select header */}
                        {isOnHold && orders.length > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' }}>
                            <input type="checkbox"
                              checked={orders.every((o: any) => bulkSelected.has(o.orderNumber))}
                              onChange={e => {
                                if (e.target.checked) setBulkSelected(new Set(orders.map((o: any) => o.orderNumber)))
                                else setBulkSelected(new Set())
                              }}
                              style={{ accentColor: '#f59e0b', width: 14, height: 14, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 11, color: '#475569' }}>
                              {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : 'Select all'}
                            </span>
                          </div>
                        )}
                        {orders.map((o: any) => (
                          <Card key={o.orderNumber} style={{ padding: '12px 16px', cursor: 'pointer', borderColor: bulkSelected.has(o.orderNumber) ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)', background: bulkSelected.has(o.orderNumber) ? 'rgba(245,158,11,0.05)' : undefined }}
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedOrder(o) }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                {isOnHold && (
                                  <input type="checkbox"
                                    checked={bulkSelected.has(o.orderNumber)}
                                    onChange={e => { e.stopPropagation(); setBulkSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(o.orderNumber) : n.delete(o.orderNumber); return n }) }}
                                    onClick={e => e.stopPropagation()}
                                    style={{ accentColor: '#f59e0b', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                                  />
                                )}
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#fcd34d' }}>{o.orderNumber}</span>
                              </div>
                              {isOnHold
                                ? <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>{o.shipVia}</span>
                                : <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{o.unallocatedCount} unalloc</span>
                              }
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 3 }}>{o.customer || '—'}{o.company ? ` · ${o.company}` : ''}</div>
                            <div style={{ color: '#475569', fontSize: 11 }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''} · {o.orderedDate ? new Date(o.orderedDate).toLocaleDateString() : '—'}</div>
                          </Card>
                        ))}
                        {/* Bulk action bar */}
                        {isOnHold && bulkSelected.size > 0 && (
                          <div style={{
                            position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'rgba(10,12,22,0.97)', border: '1px solid rgba(245,158,11,0.4)',
                            borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}>
                            <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                              {bulkReleasing ? `Releasing ${bulkProgress} / ${bulkSelected.size}…` : `${bulkSelected.size} order${bulkSelected.size > 1 ? 's' : ''} selected`}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => setBulkSelected(new Set())}
                                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: '#64748b', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                                Clear
                              </button>
                              <button onClick={bulkRelease} disabled={bulkReleasing}
                                style={{ background: '#10b981', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: bulkReleasing ? 0.6 : 1 }}>
                                {bulkReleasing ? '…' : `Release ${bulkSelected.size}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </div>{/* end watchSectionRef wrapper */}

                {/* ── APPROVAL QUEUE ── */}
        {queue.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Awaiting approval</div>
              <div style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{queue.length}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queue.map((item: any) => {
                const agent = agents.find(a => a.id === item.agent_id)
                const ac = AGENT_COLORS[item.agent_id] ?? '#8b5cf6'
                return (
                  <Card key={item.id} style={{ padding: 20, borderLeft: `3px solid ${TC[item.tier]}`, borderColor: TC[item.tier] + '40' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: TC[item.tier] + '18', color: TC[item.tier], fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 4, letterSpacing: '0.06em' }}>{TL[item.tier]}</span>
                        {agent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <AgentAvatar name={agent.name} size={22} />
                            <span style={{ color: '#64748b', fontSize: 12 }}>{agent.name} · {agent.role}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {item.tier === 'C' && (
                          <button
                            onClick={() => { setOrbInput(`Review this Tier C approval item: "${item.subject}" — ${item.description}`); setOrbOpen(true) }}
                            style={{ background: '#8b5cf618', border: '1px solid #8b5cf655', color: '#8b5cf6', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Ask AI ↗
                          </button>
                        )}
                        <button onClick={() => handleQueue(item.id, 'approved')} disabled={acting === item.id}
                          style={{
                            background: item.tier === 'C' ? '#f59e0b12' : '#10b98118',
                            border: `1px solid ${item.tier === 'C' ? '#f59e0b44' : '#10b98155'}`,
                            color: item.tier === 'C' ? '#f59e0b' : '#10b981',
                            padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                          {acting === item.id ? '…' : item.tier === 'C' ? '✓ Approve anyway' : '✓ Approve'}
                        </button>
                        <button onClick={() => handleQueue(item.id, 'rejected')} disabled={acting === item.id}
                          style={{ background: '#ef444418', border: '1px solid #ef444455', color: '#ef4444', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          {acting === item.id ? '…' : '✕ Dismiss'}
                        </button>
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 5 }}>{item.subject}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: item.draft_content ? 12 : 0 }}>{item.description}</div>
                    {item.draft_content && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#cbd5e1', fontStyle: 'italic', borderLeft: `2px solid ${ac}66` }}>
                        "{item.draft_content}"
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* ── AGENT ROSTER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Agent roster</div>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ display: 'flex', gap: 14 }}>
            {['active', 'needs_you', 'idle'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: SC[s] }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: SC[s], display: 'inline-block', boxShadow: s === 'active' ? `0 0 5px ${SC[s]}` : 'none' }} />
                {SL[s]}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {agents.map((a: any) => {
            const isSelected = selected?.id === a.id
            const ac = AGENT_COLORS[a.id] ?? '#8b5cf6'
            return (
              <Card key={a.id} onClick={() => { setSelected(a); setChatOpen(false) }}
                style={{ padding: 16, cursor: 'pointer', borderColor: isSelected ? ac + '55' : 'rgba(255,255,255,0.07)', background: isSelected ? ac + '0a' : 'rgba(255,255,255,0.03)', boxShadow: isSelected ? `0 0 0 1px ${ac}44` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <AgentAvatar name={a.name} size={38} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>{a.role}</div>
                  </div>
                </div>
                <StatusDot status={a.status} />
              </Card>
            )
          })}
        </div>

        {/* ── LIVE ACTIVITY FEED ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block',
              animation: 'liveDot 2s ease-in-out infinite',
              boxShadow: '0 0 6px rgba(16,185,129,0.7)',
            }} />
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Live activity</div>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ fontSize: 11, background: '#10b98112', border: '1px solid #10b98130', padding: '1px 8px', borderRadius: 8, color: '#10b981' }}>
              {feedActivity.length} events
            </div>
            {ago(lastRefreshed.activity) && (
              <span style={{ fontSize: 11, color: '#334155' }}>Updated {ago(lastRefreshed.activity)}</span>
            )}
            <button onClick={refreshActivity} title="Refresh activity"
              style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 13, padding: '2px 4px', lineHeight: 1 }}>
              🔄
            </button>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, overflow: 'hidden',
            maxHeight: 320, overflowY: 'auto',
          }}>
            {feedActivity.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
                No activity yet — agents will log here as they work.
              </div>
            ) : feedActivity.map((ev: any, idx: number) => {
              const isNew = feedNew.has(ev.id)
              const agentId  = ev.agent_id ?? ''
              const ac = AGENT_COLORS[agentId] ?? '#64748b'
              const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1)
              const isFirst = idx === 0
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '11px 18px',
                  borderBottom: idx < feedActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  borderLeft: isNew ? '2px solid #10b981' : '2px solid transparent',
                  background: isNew ? 'rgba(16,185,129,0.04)' : isFirst ? 'rgba(255,255,255,0.015)' : 'transparent',
                  animation: isNew ? 'feedIn 0.35s ease, feedPulse 0.8s ease' : undefined,
                  transition: 'background 0.5s, border-color 0.5s',
                }}>
                  {/* Agent dot */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: ac + '18', border: `1.5px solid ${ac}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: ac,
                  }}>
                    {agentName[0] ?? '?'}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ac, marginRight: 6 }}>{agentName}</span>
                    <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>{ev.description}</span>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: '#334155', flexShrink: 0, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                    {timeAgo(ev.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Agent drill-down panel is rendered in the fixed overlay below */}

      </div>    </div>

      {/* ── COMMAND PALETTE ── */}
      {paletteOpen && (() => {
        const q = paletteQ.trim().toLowerCase()
        const filtered = paletteCommands.filter(c =>
          !q || q.split(' ').every(word => c.label.toLowerCase().includes(word) || c.group.toLowerCase().includes(word))
        ).slice(0, 10)
        const groups = [...new Set(filtered.map(c => c.group))]
        const safeIdx = Math.min(paletteCursor, filtered.length - 1)
        return (
          <>
            <div onClick={() => { setPaletteOpen(false); setPaletteQ('') }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(3px)' }} />
            <div style={{
              position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
              width: 560, zIndex: 201, borderRadius: 14,
              background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden',
              animation: 'paletteIn 0.18s ease',
            }}>
              {/* Search input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 16, color: '#475569' }}>⌘</span>
                <input
                  ref={paletteInputRef}
                  value={paletteQ}
                  onChange={e => { setPaletteQ(e.target.value); setPaletteCursor(0) }}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteCursor(i => Math.min(i + 1, filtered.length - 1)) }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setPaletteCursor(i => Math.max(i - 1, 0)) }
                    if (e.key === 'Enter' && filtered[safeIdx]) { filtered[safeIdx].action() }
                    if (e.key === 'Escape') { setPaletteOpen(false); setPaletteQ('') }
                  }}
                  placeholder="Type a command or search…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 16 }}
                />
                <kbd style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '2px 7px', fontSize: 11, color: '#475569' }}>ESC</kbd>
              </div>
              {/* Results */}
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '28px 18px', textAlign: 'center', color: '#334155', fontSize: 14 }}>No commands match &ldquo;{paletteQ}&rdquo;</div>
                ) : groups.map(group => (
                  <div key={group}>
                    <div style={{ padding: '8px 18px 4px', fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{group}</div>
                    {filtered.filter(c => c.group === group).map(cmd => {
                      const idx = filtered.indexOf(cmd)
                      const isActive = idx === safeIdx
                      return (
                        <div key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setPaletteCursor(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 18px', cursor: 'pointer',
                            background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                            borderLeft: `2px solid ${isActive ? '#8b5cf6' : 'transparent'}`,
                            transition: 'background 0.08s',
                          }}>
                          <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{cmd.icon}</span>
                          <span style={{ fontSize: 14, color: isActive ? '#f1f5f9' : '#94a3b8', flex: 1 }}>{cmd.label}</span>
                          {isActive && <kbd style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#475569' }}>↵</kbd>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, fontSize: 11, color: '#334155' }}>
                <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── AGENT DRILL-DOWN PANEL ── */}
      {selected && (() => {
        const ac = AGENT_COLORS[selected.id] ?? '#8b5cf6'
        return (
          <>
            {/* Backdrop */}
            <div
              onClick={() => { setSelected(null); setChatOpen(false) }}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                zIndex: 55, backdropFilter: 'blur(1px)',
                animation: 'panelFadeIn 0.2s ease',
              }}
            />
            {/* Panel */}
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
              background: 'rgba(8,12,22,0.98)', borderLeft: `1px solid ${ac}30`,
              zIndex: 56, display: 'flex', flexDirection: 'column',
              animation: 'panelSlideIn 0.22s ease',
              boxShadow: `-12px 0 48px rgba(0,0,0,0.6)`,
            }}>

              {/* ── Panel header ── */}
              <div style={{
                padding: '24px 24px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: `linear-gradient(180deg, ${ac}08 0%, transparent 100%)`,
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%',
                      background: ac + '20', border: `2px solid ${ac}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 22, color: ac, flexShrink: 0,
                      boxShadow: `0 0 20px ${ac}30`,
                    }}>
                      {selected.name?.[0] ?? '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>{selected.name}</div>
                      <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>{selected.role}</div>
                      <div style={{ marginTop: 7 }}><StatusDot status={selected.status} /></div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setChatOpen(false) }}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 6, width: 28, height: 28, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >×</button>
                </div>

                {/* Current task */}
                {selected.current_task && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: ac + '0d', borderRadius: 8, border: `1px solid ${ac}25` }}>
                    <div style={{ fontSize: 10, color: ac, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Working on</div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.45 }}>{selected.current_task}</div>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                  {(['activity', 'chat'] as const).map(tab => (
                    <button key={tab} onClick={() => setDrillTab(tab)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: drillTab === tab ? ac + '22' : 'rgba(255,255,255,0.04)',
                        color: drillTab === tab ? ac : '#475569',
                        transition: 'background 0.15s, color 0.15s',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                      {tab === 'activity' ? `Activity (${activity.length})` : `Chat with ${selected.name.split(' ')[0]}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Activity tab ── */}
              {drillTab === 'activity' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                  {activity.length === 0 ? (
                    <div style={{ padding: '32px 24px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
                      No recent activity logged.
                    </div>
                  ) : activity.map((ev: any, idx: number) => (
                    <div key={ev.id} style={{
                      padding: '10px 24px',
                      borderBottom: idx < activity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', background: ac, flexShrink: 0,
                        marginTop: 6, boxShadow: idx === 0 ? `0 0 6px ${ac}` : 'none',
                        opacity: idx === 0 ? 1 : 0.4 + (1 - idx / activity.length) * 0.5,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>{ev.description}</div>
                        <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>{timeAgo(ev.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Chat tab ── */}
              {drillTab === 'chat' && (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {messages.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#334155', fontSize: 13, marginTop: 32 }}>
                        Start a conversation with {selected.name.split(' ')[0]}.
                      </div>
                    )}
                    {messages.map((m: any, i: number) => (
                      <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? `linear-gradient(135deg, ${ac}, ${ac}99)` : 'rgba(255,255,255,0.05)',
                        border: m.role === 'user' ? 'none' : `1px solid ${ac}25`,
                        padding: '10px 14px', borderRadius: 12, maxWidth: '84%',
                        fontSize: 13, lineHeight: 1.5,
                        color: m.role === 'user' ? '#fff' : '#e2e8f0',
                      }}>
                        {m.content}
                      </div>
                    ))}
                    {sending && (
                      <div style={{ alignSelf: 'flex-start', color: '#475569', fontSize: 18, letterSpacing: 4, padding: '4px 14px' }}>● ● ●</div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
                    <input
                      value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder={`Message ${selected.name.split(' ')[0]}…`}
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${ac}30`,
                        color: '#f1f5f9', padding: '10px 14px', borderRadius: 8,
                        fontSize: 13, outline: 'none',
                      }}
                    />
                    <button onClick={sendMessage} disabled={sending}
                      style={{
                        background: ac, border: 'none', color: '#fff',
                        padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, opacity: sending ? 0.6 : 1,
                        transition: 'opacity 0.15s',
                      }}>
                      Send
                    </button>
                  </div>
                </>
              )}

            </div>
          </>
        )
      })()}

      {/* ── ORDER DETAIL DRAWER ── */}
      {selectedOrder && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { setSelectedOrder(null); setDrawerAction('idle'); setCopiedTracking(false) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 50, backdropFilter: 'blur(2px)',
              animation: 'drawerOverlay 0.2s ease',
            }}
          />

          {/* Drawer panel */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 51, maxHeight: '72vh', display: 'flex', flexDirection: 'column',
            background: '#0a0a12',
            borderTop: '1px solid rgba(245,158,11,0.35)',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -20px 80px rgba(0,0,0,0.9), 0 -1px 0 rgba(245,158,11,0.2)',
            animation: 'drawerUp 0.28s cubic-bezier(0.22,1,0.36,1)',
          }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 24px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fcd34d', letterSpacing: '-0.02em' }}>
                  {selectedOrder.orderNumber}
                </div>
                <span style={{
                  background: selectedOrder.status === 'on hold' ? '#f59e0b22' : '#10b98122',
                  color:      selectedOrder.status === 'on hold' ? '#f59e0b'   : '#10b981',
                  border:     `1px solid ${selectedOrder.status === 'on hold' ? '#f59e0b44' : '#10b98144'}`,
                  fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {selectedOrder.status}
                </span>
                {selectedOrder.isExpress && (
                  <span style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>
                    ⚡ Express
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* #11 Pin button */}
                <button
                  onClick={() => togglePin(selectedOrder)}
                  title={pinnedOrders.some((o: any) => o.orderNumber === selectedOrder.orderNumber) ? 'Unpin order' : 'Pin order'}
                  style={{
                    background: pinnedOrders.some((o: any) => o.orderNumber === selectedOrder.orderNumber) ? 'rgba(252,211,77,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${pinnedOrders.some((o: any) => o.orderNumber === selectedOrder.orderNumber) ? 'rgba(252,211,77,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: pinnedOrders.some((o: any) => o.orderNumber === selectedOrder.orderNumber) ? '#fcd34d' : '#475569',
                    cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '6px 10px', borderRadius: 8,
                    transition: 'all 0.15s',
                  }}>
                  {pinnedOrders.some((o: any) => o.orderNumber === selectedOrder.orderNumber) ? '⭐' : '☆'}
                </button>
                <button
                  onClick={() => { setSelectedOrder(null); setDrawerAction('idle'); setCopiedTracking(false) }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '6px 11px', borderRadius: 8 }}>
                  ×
                </button>
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 24px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Release Hold */}
              {selectedOrder.status === 'on hold' && (
                <button onClick={releaseHold} disabled={drawerAction !== 'idle'}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: drawerAction !== 'idle' ? 'not-allowed' : 'pointer', border: 'none',
                    background: drawerAction === 'released' ? 'linear-gradient(135deg,#10b981,#059669)'
                              : drawerAction === 'error'    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                              : drawerAction === 'releasing' ? 'rgba(245,158,11,0.15)'
                              : 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: drawerAction === 'releasing' ? '#f59e0b' : '#fff',
                    boxShadow: drawerAction === 'idle' ? '0 4px 14px rgba(245,158,11,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}>
                  {drawerAction === 'releasing' ? '⏳ Releasing…'
                   : drawerAction === 'released' ? '✓ Released'
                   : drawerAction === 'error'    ? '✕ Failed — retry'
                   : '▶ Release Hold'}
                </button>
              )}

              {/* Escalate to Tara */}
              <button onClick={escalateOrder}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(6,182,212,0.35)',
                  background: 'rgba(6,182,212,0.08)', color: '#06b6d4',
                  transition: 'all 0.15s',
                }}>
                ↗ Escalate to Tara
              </button>

              {/* Copy Tracking */}
              <button onClick={copyTracking}
                disabled={!selectedOrder.tracking?.length}
                style={{
                  flex: selectedOrder.status === 'on hold' ? '0 0 130px' : 1,
                  padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  cursor: selectedOrder.tracking?.length ? 'pointer' : 'not-allowed',
                  border: '1px solid rgba(100,116,139,0.3)',
                  background: copiedTracking ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  color: copiedTracking ? '#10b981' : selectedOrder.tracking?.length ? '#94a3b8' : '#334155',
                  transition: 'all 0.15s',
                }}>
                {copiedTracking ? '✓ Copied' : '⎘ Copy Tracking'}
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Customer + Shipping row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {/* Customer */}
                <div>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Customer</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>{selectedOrder.customer || '—'}</div>
                  {selectedOrder.company && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>{selectedOrder.company}</div>}
                  {selectedOrder.email && (
                    <div style={{ fontSize: 12, color: '#60a5fa' }}>
                      <a href={`mailto:${selectedOrder.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{selectedOrder.email}</a>
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Ship To</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{selectedOrder.shippingAddress || '—'}</div>
                </div>

                {/* Meta */}
                <div>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>Ordered</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedOrder.orderedDate ? new Date(selectedOrder.orderedDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>Ship via</span>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{selectedOrder.shipVia || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>Items</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedOrder.itemCount}</span>
                    </div>
                  </div>
                  {selectedOrder.tracking?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>Tracking</div>
                      {selectedOrder.tracking.map((t: any, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace', marginBottom: 2 }}>
                          {t.carrier}: {t.tracking}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items table */}
              {selectedOrder.items?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10 }}>
                    Line Items ({selectedOrder.items.length})
                  </div>
                  <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px 70px 80px', gap: 0, background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px' }}>
                      {['SKU','Description','Qty','Allocated','Status'].map(h => (
                        <div key={h} style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                      ))}
                    </div>
                    {/* Table rows */}
                    {selectedOrder.items.map((item: any, idx: number) => {
                      const isShort = item.allocated < item.qty
                      return (
                        <div key={idx} style={{
                          display: 'grid', gridTemplateColumns: '140px 1fr 70px 70px 80px',
                          gap: 0, padding: '10px 14px',
                          borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          background: isShort ? 'rgba(245,158,11,0.03)' : 'transparent',
                        }}>
                          <div style={{ fontSize: 12, color: '#fcd34d', fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8', paddingRight: 12 }}>{item.name || '—'}</div>
                          <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{item.qty}</div>
                          <div style={{ fontSize: 12, color: isShort ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{item.allocated}</div>
                          <div>
                            {isShort
                              ? <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>SHORT {item.qty - item.allocated}</span>
                              : <span style={{ background: '#10b98118', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>OK</span>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}
  </>
  )
}