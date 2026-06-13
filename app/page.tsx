'use client'
import { useEffect, useState } from 'react'
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
  const [expressOrders, setExpressOrders] = useState<any[]>([])
  const [unallocOrders, setUnallocOrders] = useState<any[]>([])
  const [watchLoading, setWatchLoading] = useState(true)
  // Command Orb
  const [orbOpen, setOrbOpen] = useState(false)
  const [orbInput, setOrbInput] = useState('')
  const [orbSending, setOrbSending] = useState(false)
  const [orbMessages, setOrbMessages] = useState<Array<{role:'user'|'agent'; agent?: string; content: string}>>([])
  const [orbState, setOrbState] = useState<'idle'|'thinking'|'responding'>('idle')

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
    supabase.from('metrics').select('*').then(({ data }) => { if (data) setMetrics(data) })
    fetchQueue()
    fetch('/api/metrics').catch(() => {})
    // Auto-load express + unallocated orders
    Promise.all([
      fetch('/api/orders?express=true').then(r => r.json()),
      fetch('/api/orders?unallocated=true').then(r => r.json()),
    ]).then(([exp, unalloc]) => {
      setExpressOrders(exp.orders ?? [])
      setUnallocOrders(unalloc.orders ?? [])
      setWatchLoading(false)
    }).catch(() => setWatchLoading(false))
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' }, () => {
        supabase.from('agent_status').select('*').then(({ data }) => { if (data) setAgents(data) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_queue' }, fetchQueue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metrics' }, () => {
        supabase.from('metrics').select('*').then(({ data }) => { if (data) setMetrics(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!selected) return
    supabase.from('agent_activity').select('*').eq('agent_id', selected.id)
      .order('created_at', { ascending: false }).limit(5)
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
    else params.set('open', 'true')
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setSearchResults(data.orders ?? [])
    setSearching(false)
  }

  const mm = Object.fromEntries(metrics.map((m: any) => [m.key, m]))
  const held = queue.length
  const metricTiles = [
    { k: 'open_tickets',  l: 'Open orders',   icon: '📦', accent: '#3b82f6' },
    { k: 'on_hold',       l: 'On hold',        icon: '⏸️',  accent: '#f59e0b' },
    { k: 'shipped_today', l: 'Shipped today',  icon: '🚚', accent: '#10b981' },
    { k: 'held_for_you',  l: 'Awaiting you',   icon: '⏳', accent: held > 0 ? '#ef4444' : '#8b5cf6' },
    { k: 'actions_today', l: 'Agent actions',  icon: '⚡', accent: '#8b5cf6' },
  ]

  return (
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
            <div style={{ width: 80, height: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/lh-logo-dark.png" alt="Lion-Heart" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0 0 12px rgba(139,92,246,0.7))' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Lion-Heart</div>
              <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Agent Operations</div>
            </div>
          </div>
        </header>

        {/* ── WORLD CLOCKS ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
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

        {/* ── CENTERED SEARCH ── */}
        <div style={{ maxWidth: 640, margin: '0 auto 32px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchOrders(searchQ)}
              placeholder="Search by order # or customer name / email…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9',
                padding: '12px 18px', borderRadius: 10, fontSize: 14, outline: 'none',
                boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
              }}
            />
            <button onClick={() => searchOrders(searchQ)} disabled={searching}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                border: 'none', color: '#fff', padding: '12px 22px',
                borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                boxShadow: '0 4px 14px rgba(139,92,246,0.4)', whiteSpace: 'nowrap',
              }}>
              {searching ? '…' : '🔍 Search'}
            </button>
            <button onClick={() => searchOrders('')} disabled={searching}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
              }}>
              Open
            </button>
          </div>

          {/* Search Results */}
          {(searchResults.length > 0 || (hasSearched && !searching)) && (
            <div style={{ marginTop: 10 }}>
              {searching ? null : searchResults.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No orders found for "{searchQ}"</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                  <div style={{ color: '#475569', fontSize: 12, marginBottom: 2 }}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</div>
                  {searchResults.map((o: any) => {
                    const exp = expandedOrder === o.orderNumber
                    const sc = o.status === 'completed' ? '#10b981' : o.status === 'cancelled' ? '#ef4444' : o.status === 'on hold' ? '#f59e0b' : '#3b82f6'
                    return (
                      <div key={o.orderNumber} onClick={() => setExpandedOrder(exp ? null : o.orderNumber)}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{o.orderNumber}</span>
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>{o.customer}{o.company ? ` · ${o.company}` : ''}</span>
                            {o.itemCount > 0 && <span style={{ color: '#475569', fontSize: 12 }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ background: sc + '18', color: sc, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{o.status}</span>
                            <span style={{ color: '#475569', fontSize: 12 }}>{o.orderedDate ? new Date(o.orderedDate).toLocaleDateString() : ''}</span>
                            <span style={{ color: '#475569', fontSize: 11 }}>{exp ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {exp && (
                          <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, fontSize: 13 }}>
                            {o.email && <div style={{ color: '#94a3b8', marginBottom: 6 }}>📧 {o.email}</div>}
                            {o.shippingAddress && <div style={{ color: '#94a3b8', marginBottom: 10 }}>📍 {o.shippingAddress}</div>}
                            {o.items?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ color: '#475569', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Items</div>
                                {o.items.map((item: any, i: number) => (
                                  <div key={i} style={{ color: '#cbd5e1', padding: '2px 0' }}>{item.qty}× {item.name || item.sku}</div>
                                ))}
                              </div>
                            )}
                            {o.tracking?.length > 0 ? (
                              <div>
                                <div style={{ color: '#475569', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tracking</div>
                                {o.tracking.map((t: any, i: number) => (
                                  <div key={i} style={{ color: '#10b981', fontFamily: 'monospace', fontSize: 13 }}>{t.carrier}: {t.tracking}</div>
                                ))}
                              </div>
                            ) : <div style={{ color: '#475569', fontSize: 12 }}>No tracking yet</div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── METRIC TILES ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
          {metricTiles.map(({ k, l, icon, accent }) => {
            const val = k === 'held_for_you' ? held : (mm[k]?.value ?? '—')
            return (
              <Card key={k} style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{l}</div>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{val}</div>
              </Card>
            )
          })}
        </div>

        {/* ── WATCH LISTS: EXPRESS + UNALLOCATED ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

          {/* Express */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🚨</span>
              <div style={{ fontSize: 11, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Express / Overnight</div>
              {!watchLoading && (
                <div style={{ background: '#ef444418', border: '1px solid #ef444444', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{expressOrders.length}</div>
              )}
            </div>
            {watchLoading ? (
              <div style={{ color: '#475569', fontSize: 13 }}>Loading…</div>
            ) : expressOrders.length === 0 ? (
              <Card style={{ padding: '14px 16px' }}><div style={{ color: '#475569', fontSize: 13 }}>No express orders</div></Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {expressOrders.map((o: any) => (
                  <Card key={o.orderNumber} style={{ padding: '12px 16px', cursor: 'pointer', borderColor: 'rgba(239,68,68,0.2)' }}
                    onClick={() => { setSearchQ(o.orderNumber); setSearchResults([o]); setHasSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#fca5a5' }}>{o.orderNumber}</span>
                      <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>{o.shipVia}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 3 }}>{o.customer || '—'}{o.company ? ` · ${o.company}` : ''}</div>
                    <div style={{ color: '#475569', fontSize: 11 }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''} · {o.orderedDate ? new Date(o.orderedDate).toLocaleDateString() : '—'}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Unallocated */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Unallocated</div>
              {!watchLoading && (
                <div style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{unallocOrders.length}</div>
              )}
            </div>
            {watchLoading ? (
              <div style={{ color: '#475569', fontSize: 13 }}>Loading…</div>
            ) : unallocOrders.length === 0 ? (
              <Card style={{ padding: '14px 16px' }}><div style={{ color: '#475569', fontSize: 13 }}>All orders allocated ✓</div></Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {unallocOrders.map((o: any) => (
                  <Card key={o.orderNumber} style={{ padding: '12px 16px', cursor: 'pointer', borderColor: 'rgba(245,158,11,0.2)' }}
                    onClick={() => { setSearchQ(o.orderNumber); setSearchResults([o]); setHasSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#fcd34d' }}>{o.orderNumber}</span>
                      <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{o.unallocatedCount} unalloc</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 3 }}>{o.customer || '—'}{o.company ? ` · ${o.company}` : ''}</div>
                    <div style={{ color: '#475569', fontSize: 11 }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''} · {o.orderedDate ? new Date(o.orderedDate).toLocaleDateString() : '—'}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>

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
                        {item.tier === 'B' && (
                          <button onClick={() => handleQueue(item.id, 'approved')} disabled={acting === item.id}
                            style={{ background: '#10b98118', border: '1px solid #10b98155', color: '#10b981', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            {acting === item.id ? '…' : '✓ Approve'}
                          </button>
                        )}
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

        {/* ── AGENT DETAIL ── */}
        {selected && !chatOpen && (
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <AgentAvatar name={selected.name} size={48} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
                  <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{selected.role}</div>
                  <div style={{ marginTop: 6 }}><StatusDot status={selected.status} /></div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            {selected.current_task && (
              <div style={{ marginBottom: 18, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, fontWeight: 600 }}>Working on</div>
                <div style={{ fontSize: 14, color: '#e2e8f0' }}>{selected.current_task}</div>
              </div>
            )}
            {activity.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>Recent activity</div>
                {activity.map((a: any) => (
                  <div key={a.id} style={{ color: '#94a3b8', fontSize: 13, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{a.description}</div>
                ))}
              </div>
            )}
            <button onClick={() => setChatOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(139,92,246,0.35)' }}>
              Chat with {selected.name} ↗
            </button>
          </Card>
        )}

        {/* ── CHAT ── */}
        {selected && chatOpen && (
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AgentAvatar name={selected.name} size={30} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Chat with {selected.name}</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {messages.map((m, i) => {
                const ac = AGENT_COLORS[selected.id] ?? '#8b5cf6'
                return (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    background: m.role === 'user' ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'rgba(255,255,255,0.05)',
                    border: m.role === 'user' ? 'none' : `1px solid ${ac}33`,
                    padding: '10px 14px', borderRadius: 12, maxWidth: '80%', fontSize: 13, lineHeight: 1.5,
                    color: m.role === 'user' ? '#fff' : '#e2e8f0',
                  }}>
                    {m.content}
                  </div>
                )
              })}
              {sending && <div style={{ color: '#475569', fontSize: 13 }}>● ● ●</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={`Message ${selected.name}…`}
                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', padding: '10px 14px', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              <button onClick={sendMessage} disabled={sending}
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Send
              </button>
            </div>
          </Card>
        )}

      </div>

      {/* ── COMMAND ORB HUD ── */}
      <style>{`
        @keyframes orbCore {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(59,130,246,0),
              0 0 40px rgba(96,165,250,0.7),
              0 0 90px rgba(59,130,246,0.4),
              0 0 160px rgba(29,78,216,0.2);
          }
          50% {
            box-shadow:
              0 0 0 0 rgba(59,130,246,0),
              0 0 60px rgba(147,197,253,0.9),
              0 0 130px rgba(96,165,250,0.55),
              0 0 220px rgba(37,99,235,0.3);
          }
        }
        @keyframes orbThink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.9), 0 0 30px rgba(245,158,11,0.6); }
          50%       { box-shadow: 0 0 0 24px rgba(245,158,11,0), 0 0 60px rgba(245,158,11,0.3); }
        }
        @keyframes orbRespond {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.9), 0 0 30px rgba(16,185,129,0.6); }
          50%       { box-shadow: 0 0 0 22px rgba(16,185,129,0), 0 0 50px rgba(16,185,129,0.3); }
        }
        @keyframes ringGlow {
          0%, 100% {
            opacity: 0.75;
            box-shadow: 0 0 18px rgba(96,165,250,0.6), 0 0 50px rgba(59,130,246,0.3);
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 32px rgba(147,197,253,0.9), 0 0 80px rgba(96,165,250,0.5);
          }
        }
        @keyframes waveFlow {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -60; }
        }
        @keyframes waveFlowR {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: 60; }
        }
        @keyframes traceFade {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.9; }
        }
        @keyframes cmdSlideUp {
          from { opacity: 0; transform: translateY(20px) translateX(-50%) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)  translateX(-50%) scale(1); }
        }
        @keyframes orbDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>

      {/* Full-width HUD fixed at bottom */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 960, height: 230, pointerEvents: 'none' }}>

        {/* SVG HUD LAYER */}
        <svg width={960} height={230} viewBox="0 0 960 230"
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <radialGradient id="orbAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(96,165,250,0.22)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0)" />
            </radialGradient>
          </defs>

          {/* Ambient glow behind orb */}
          <ellipse cx={480} cy={158} rx={118} ry={90} fill="url(#orbAura)" />

          {/* BASE PLATFORM arcs */}
          <path d="M 358,222 A 138,52 0 0 1 602,222" fill="none" stroke="rgba(37,99,235,0.5)" strokeWidth={1.5} strokeDasharray="14 6" />
          <path d="M 374,226 A 116,42 0 0 1 586,226" fill="none" stroke="rgba(59,130,246,0.38)" strokeWidth={1} strokeDasharray="9 5" />
          <path d="M 392,229 A 96,32 0 0 1 568,229" fill="none" stroke="rgba(96,165,250,0.28)" strokeWidth={1} strokeDasharray="6 4" />
          {[358,376,394,412,430,448,466,484,502,520,538,556,574,590,604].map((x: number, i: number) => (
            <line key={i} x1={x} y1={217} x2={x} y2={217 + (i % 3 === 0 ? 7 : 4)} stroke="rgba(59,130,246,0.55)" strokeWidth={1} />
          ))}

          {/* LEFT CIRCUIT TRACES */}
          <path d="M 420,143 L 326,143 L 326,127 L 260,127 L 260,112 L 156,112"
            fill="none" stroke="rgba(59,130,246,0.62)" strokeWidth={1.5} strokeDasharray="10 5"
            style={{ animation: 'waveFlow 2.8s linear infinite' }} />
          <path d="M 420,161 L 332,161 L 332,176 L 176,176"
            fill="none" stroke="rgba(37,99,235,0.52)" strokeWidth={1} strokeDasharray="8 6"
            style={{ animation: 'waveFlow 3.8s linear infinite' }} />
          <path d="M 416,151 L 366,151"
            fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth={1} strokeDasharray="5 4"
            style={{ animation: 'traceFade 2.2s 0.4s ease-in-out infinite' }} />
          {/* Node pads */}
          <circle cx={326} cy={143} r={3.5} fill="rgba(96,165,250,0.88)" />
          <circle cx={260} cy={127} r={2.5} fill="rgba(59,130,246,0.78)" />
          <circle cx={332} cy={161} r={2} fill="rgba(59,130,246,0.65)" />
          <rect x={322} y={139} width={8} height={8} rx={1} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth={1} />
          <rect x={256} y={123} width={8} height={8} rx={1} fill="none" stroke="rgba(59,130,246,0.45)" strokeWidth={1} />
          {/* Left chevrons toward orb */}
          {[355, 385, 415].map((x: number, i: number) => (
            <polyline key={i} points={`${x+10},137 ${x},143 ${x+10},149`} fill="none" stroke="rgba(96,165,250,0.72)" strokeWidth={1.3} />
          ))}
          {/* Left waveform */}
          <path d="M 156,186 C 173,173 183,199 200,186 C 217,173 227,199 244,186 C 261,173 271,199 288,186 C 305,173 315,199 332,186 C 349,173 359,199 376,186 C 393,173 403,199 420,186"
            fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="160"
            style={{ animation: 'waveFlow 4.5s linear infinite' }} />

          {/* LEFT BIG HUD CIRCLE */}
          <g transform="translate(195,130)">
            <circle r={52} fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth={2} strokeDasharray="30 8 10 8">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="15s" repeatCount="indefinite" />
            </circle>
            <circle r={38} fill="none" stroke="rgba(59,130,246,0.65)" strokeWidth={1.5} strokeDasharray="22 6">
              <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="9s" repeatCount="indefinite" />
            </circle>
            <circle r={24} fill="none" stroke="rgba(96,165,250,0.72)" strokeWidth={2} strokeDasharray="15 5">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
            </circle>
            <circle r={6} fill="rgba(59,130,246,0.95)" />
            <circle r={6} fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth={1.5} />
            <line x1={-9} y1={0} x2={-62} y2={0} stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="4 3" />
            <line x1={9} y1={0} x2={62} y2={0} stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="4 3" />
            <line x1={0} y1={-9} x2={0} y2={-62} stroke="rgba(59,130,246,0.35)" strokeWidth={1} strokeDasharray="4 3" />
          </g>

          {/* LEFT SMALL HUD CIRCLE */}
          <g transform="translate(72,110)">
            <circle r={30} fill="none" stroke="rgba(59,130,246,0.52)" strokeWidth={1.5} strokeDasharray="17 7">
              <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="12s" repeatCount="indefinite" />
            </circle>
            <circle r={18} fill="none" stroke="rgba(96,165,250,0.58)" strokeWidth={1} strokeDasharray="11 4">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7.5s" repeatCount="indefinite" />
            </circle>
            <circle r={5} fill="rgba(59,130,246,0.8)" />
          </g>

          {/* RIGHT CIRCUIT TRACES (mirror) */}
          <path d="M 540,143 L 634,143 L 634,127 L 700,127 L 700,112 L 804,112"
            fill="none" stroke="rgba(59,130,246,0.62)" strokeWidth={1.5} strokeDasharray="10 5"
            style={{ animation: 'waveFlowR 2.8s linear infinite' }} />
          <path d="M 540,161 L 628,161 L 628,176 L 784,176"
            fill="none" stroke="rgba(37,99,235,0.52)" strokeWidth={1} strokeDasharray="8 6"
            style={{ animation: 'waveFlowR 3.8s linear infinite' }} />
          <path d="M 544,151 L 594,151"
            fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth={1} strokeDasharray="5 4"
            style={{ animation: 'traceFade 2.2s 1.1s ease-in-out infinite' }} />
          <circle cx={634} cy={143} r={3.5} fill="rgba(96,165,250,0.88)" />
          <circle cx={700} cy={127} r={2.5} fill="rgba(59,130,246,0.78)" />
          <circle cx={628} cy={161} r={2} fill="rgba(59,130,246,0.65)" />
          <rect x={630} y={139} width={8} height={8} rx={1} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth={1} />
          <rect x={696} y={123} width={8} height={8} rx={1} fill="none" stroke="rgba(59,130,246,0.45)" strokeWidth={1} />
          {[535, 505, 475].map((x: number, i: number) => (
            <polyline key={i} points={`${x},137 ${x+10},143 ${x},149`} fill="none" stroke="rgba(96,165,250,0.72)" strokeWidth={1.3} />
          ))}
          <path d="M 540,186 C 557,173 567,199 584,186 C 601,173 611,199 628,186 C 645,173 655,199 672,186 C 689,173 699,199 716,186 C 733,173 743,199 760,186 C 777,173 787,199 804,186"
            fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="160"
            style={{ animation: 'waveFlowR 4.5s linear infinite' }} />

          {/* RIGHT BIG HUD CIRCLE */}
          <g transform="translate(765,130)">
            <circle r={52} fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth={2} strokeDasharray="30 8 10 8">
              <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="15s" repeatCount="indefinite" />
            </circle>
            <circle r={38} fill="none" stroke="rgba(59,130,246,0.65)" strokeWidth={1.5} strokeDasharray="22 6">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
            </circle>
            <circle r={24} fill="none" stroke="rgba(96,165,250,0.72)" strokeWidth={2} strokeDasharray="15 5">
              <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="6s" repeatCount="indefinite" />
            </circle>
            <circle r={6} fill="rgba(59,130,246,0.95)" />
            <circle r={6} fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth={1.5} />
            <line x1={-9} y1={0} x2={-62} y2={0} stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="4 3" />
            <line x1={9} y1={0} x2={62} y2={0} stroke="rgba(59,130,246,0.4)" strokeWidth={1} strokeDasharray="4 3" />
            <line x1={0} y1={-9} x2={0} y2={-62} stroke="rgba(59,130,246,0.35)" strokeWidth={1} strokeDasharray="4 3" />
          </g>

          {/* RIGHT SMALL HUD CIRCLE */}
          <g transform="translate(888,110)">
            <circle r={30} fill="none" stroke="rgba(59,130,246,0.52)" strokeWidth={1.5} strokeDasharray="17 7">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite" />
            </circle>
            <circle r={18} fill="none" stroke="rgba(96,165,250,0.58)" strokeWidth={1} strokeDasharray="11 4">
              <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="7.5s" repeatCount="indefinite" />
            </circle>
            <circle r={5} fill="rgba(59,130,246,0.8)" />
          </g>
        </svg>

        {/* ORB + PANEL — pointer-events re-enabled */}
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Command Panel */}
          {orbOpen && (
            <div style={{
              position: 'absolute', bottom: 155, left: '50%', transform: 'translateX(-50%)',
              width: 430, background: 'rgba(4,6,18,0.98)',
              border: '1px solid rgba(59,130,246,0.45)', borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(59,130,246,0.1), 0 0 80px rgba(37,99,235,0.18)',
              animation: 'cmdSlideUp 0.22s ease',
            }}>
              <div style={{ padding: '14px 18px 13px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(29,78,216,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle,#60a5fa,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🦁</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9' }}>Lion-Heart Command</div>
                    <div style={{ fontSize: 10, color: '#3b82f6', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>9 agents · always on</div>
                  </div>
                </div>
                <button onClick={() => setOrbOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 6 }}>×</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {orbMessages.length === 0 && (
                  <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>🦁</div>
                    Ask anything — the right agent picks up.
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 10 }}>
                      {['Donny','Mark','Boris','Svetlana','Morgan','Tara','Owen','Priya','Nina'].map(n => {
                        const ac = AGENT_COLORS[n.toLowerCase()] ?? '#3b82f6'
                        return <span key={n} style={{ background: ac+'18', color: ac, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{n}</span>
                      })}
                    </div>
                  </div>
                )}
                {orbMessages.map((m, i) => {
                  if (m.role === 'user') return (
                    <div key={i} style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 3px 14px', maxWidth: '80%', fontSize: 13, lineHeight: 1.55 }}>{m.content}</div>
                  )
                  const agentId = m.agent ?? 'donny'
                  const ac = AGENT_COLORS[agentId] ?? '#3b82f6'
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
                  <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '11px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: '3px 14px 14px 14px', border: '1px solid rgba(59,130,246,0.15)' }}>
                    {[0,160,320].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: `orbDot 1.3s ${d}ms infinite` }} />)}
                  </div>
                )}
              </div>
              <div style={{ padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input autoFocus value={orbInput} onChange={e => setOrbInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOrbMessage()}
                  placeholder="Ask the team anything…"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.25)', color: '#f1f5f9', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={sendOrbMessage} disabled={orbSending}
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 800, boxShadow: '0 4px 14px rgba(37,99,235,0.5)', opacity: orbSending ? 0.6 : 1 }}>↑</button>
              </div>
            </div>
          )}

          {/* Outer glow ring */}
          <div style={{
            position: 'absolute', top: -14, left: -14, right: -14, bottom: -14, borderRadius: '50%',
            border: '2px solid rgba(147,197,253,0.72)',
            boxShadow: '0 0 24px rgba(96,165,250,0.75), 0 0 60px rgba(59,130,246,0.4), inset 0 0 20px rgba(59,130,246,0.15)',
            animation: 'ringGlow 2.6s ease-in-out infinite', pointerEvents: 'none',
          }} />

          {/* Plasma ball orb */}
          <button onClick={() => setOrbOpen(o => !o)} title="Lion-Heart Command"
            style={{
              width: 128, height: 128, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: orbState === 'thinking'
                ? 'radial-gradient(circle at 38% 33%, #fffbeb 0%, #fde68a 10%, #f59e0b 30%, #b45309 58%, #431407 84%)'
                : orbState === 'responding'
                ? 'radial-gradient(circle at 38% 33%, #ecfdf5 0%, #6ee7b7 10%, #10b981 30%, #065f46 58%, #022c22 84%)'
                : 'radial-gradient(circle at 38% 33%, #ffffff 0%, #dbeafe 10%, #93c5fd 22%, #3b82f6 42%, #1e40af 65%, #0f2057 85%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              animation: orbState === 'thinking' ? 'orbThink 0.9s ease-in-out infinite'
                : orbState === 'responding' ? 'orbRespond 1.1s ease-in-out infinite'
                : 'orbCore 3s ease-in-out infinite',
              transition: 'background 0.5s',
              position: 'relative',
            }}>
            {/* Specular highlight */}
            <div style={{ position: 'absolute', top: 10, left: 18, width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 32, left: 8, width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <span style={{ fontSize: 36, lineHeight: 1, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))', position: 'relative' }}>🦁</span>
            <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.2em', textTransform: 'uppercase', position: 'relative', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>Command</span>
          </button>
        </div>
      </div>

    </div>
  )
}
