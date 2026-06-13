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
  const clocksRef = useRef<HTMLDivElement>(null)
  const [orbTop, setOrbTop] = useState(200)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const update = () => {
      if (clocksRef.current) {
        // getBoundingClientRect at mount time (scrollY≈0) gives correct fixed-position top
        setOrbTop(Math.round(clocksRef.current.getBoundingClientRect().bottom) + 10)
      }
    }
    requestAnimationFrame(update)
    setTimeout(update, 300)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
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
    // Auto-load on-hold + unallocated orders
    Promise.all([
      fetch('/api/orders?onhold=true').then(r => r.json()),
      fetch('/api/orders?unallocated=true').then(r => r.json()),
    ]).then(([held, unalloc]) => {
      setOnHoldOrders(held.orders ?? [])
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
    else { setSearching(false); return }
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setSearchResults(data.orders ?? [])
    setSearching(false)
  }

  const mm = Object.fromEntries(metrics.map((m: any) => [m.key, m]))
  const held = queue.length
  const metricTiles = [
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
        <div ref={clocksRef} style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
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

        {/* ── WATCH TILES ── */}
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
                    ) : orders.map((o: any) => (
                      <Card key={o.orderNumber} style={{ padding: '12px 16px', cursor: 'pointer', borderColor: 'rgba(245,158,11,0.25)' }}
                        onClick={e => { e.stopPropagation(); setSearchQ(o.orderNumber); setSearchResults([o]); setHasSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#fcd34d' }}>{o.orderNumber}</span>
                          {isOnHold
                            ? <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>{o.shipVia}</span>
                            : <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{o.unallocatedCount} unalloc</span>
                          }
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 3 }}>{o.customer || '—'}{o.company ? ` · ${o.company}` : ''}</div>
                        <div style={{ color: '#475569', fontSize: 11 }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''} · {o.orderedDate ? new Date(o.orderedDate).toLocaleDateString() : '—'}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
          0%   { box-shadow: 0 0 50px rgba(147,197,253,1), 0 0 110px rgba(96,165,250,0.7), 0 0 220px rgba(59,130,246,0.4), 0 0 360px rgba(30,64,175,0.18); }
          38%  { box-shadow: 0 0 28px rgba(255,255,255,0.9), 0 0 65px rgba(147,197,253,0.7), 0 0 140px rgba(96,165,250,0.3), 0 0 240px rgba(59,130,246,0.12); }
          70%  { box-shadow: 0 0 80px rgba(255,255,255,1), 0 0 170px rgba(147,197,253,0.9), 0 0 300px rgba(96,165,250,0.6), 0 0 480px rgba(59,130,246,0.25); }
          100% { box-shadow: 0 0 50px rgba(147,197,253,1), 0 0 110px rgba(96,165,250,0.7), 0 0 220px rgba(59,130,246,0.4), 0 0 360px rgba(30,64,175,0.18); }
        }
        @keyframes orbThink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.9), 0 0 40px rgba(96,165,250,0.7); }
          50%       { box-shadow: 0 0 0 28px rgba(96,165,250,0), 0 0 80px rgba(96,165,250,0.3); }
        }
        @keyframes orbRespond {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.9), 0 0 30px rgba(16,185,129,0.6); }
          50%       { box-shadow: 0 0 0 22px rgba(16,185,129,0), 0 0 50px rgba(16,185,129,0.3); }
        }
        @keyframes ringGlow {
          0%, 100% { opacity: 0.75; box-shadow: 0 0 20px rgba(96,165,250,0.75), 0 0 55px rgba(59,130,246,0.4); }
          50%       { opacity: 1;    box-shadow: 0 0 38px rgba(147,197,253,1),   0 0 95px rgba(96,165,250,0.6); }
        }
        @keyframes orbRingSpin  { from { transform: rotate(0deg);    } to { transform: rotate(360deg);  } }
        @keyframes orbRingSpinR { from { transform: rotate(0deg);    } to { transform: rotate(-360deg); } }
        @keyframes sweepRotate  { from { transform: rotate(0deg);    } to { transform: rotate(360deg);  } }
        @keyframes outerPulse   { 0%,100% { opacity: 0.45; } 50% { opacity: 0.78; } }
        @keyframes cmdSlideUp {
          from { opacity: 0; transform: translateY(20px) translateX(-50%) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    translateX(-50%) scale(1); }
        }
        @keyframes orbDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>

      {/* Full-width HUD fixed at bottom */}
      <div style={{ position: 'fixed', top: orbTop, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 980, height: 300, pointerEvents: 'none' }}>

        {/* SVG HUD LAYER */}
        <svg width={980} height={300} viewBox="0 0 980 300"
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <radialGradient id="coreAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(147,197,253,0.25)" />
              <stop offset="55%"  stopColor="rgba(96,165,250,0.06)" />
              <stop offset="100%" stopColor="rgba(30,64,175,0)" />
            </radialGradient>
          </defs>

          {/* Ambient core glow */}
          <ellipse cx={490} cy={205} rx={240} ry={195} fill="url(#coreAura)" />

          {/* Outer containing rings */}
          <circle cx={490} cy={205} r={232} fill="none" stroke="rgba(30,64,175,0.55)" strokeWidth={1.5} strokeDasharray="18 7" style={{ animation: 'outerPulse 3.2s ease-in-out infinite' }} />
          <circle cx={490} cy={205} r={220} fill="none" stroke="rgba(59,130,246,0.32)" strokeWidth={1}   strokeDasharray="9 12" />
          <circle cx={490} cy={205} r={208} fill="none" stroke="rgba(96,165,250,0.18)" strokeWidth={0.7} />

          {/* Dense radial network — 64 lines */}
          {Array.from({length: 64}, (_, i) => {
            const angleRad = i * 5.625 * Math.PI / 180
            const len = 85 + (i * 11 % 45) + (i * 7 % 35)
            const startR = 78, cx = 490, cy = 205
            const x1 = cx + startR * Math.cos(angleRad)
            const y1 = cy + startR * Math.sin(angleRad)
            const x2 = cx + (startR + len) * Math.cos(angleRad)
            const y2 = cy + (startR + len) * Math.sin(angleRad)
            const op = parseFloat((0.2 + (i * 3 % 5) * 0.1).toFixed(2))
            const w  = i % 4 === 0 ? 1.2 : i % 2 === 0 ? 0.75 : 0.45
            const hasBranch = i % 5 === 0
            const bAngle = angleRad + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2)
            const bLen = 16 + (i * 4 % 24)
            const bx = x2 + bLen * Math.cos(bAngle)
            const by = y2 + bLen * Math.sin(bAngle)
            const has2nd = i % 16 === 0
            const b2x = (x1 + x2) / 2 + 12 * Math.cos(bAngle)
            const b2y = (y1 + y2) / 2 + 12 * Math.sin(bAngle)
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={`rgba(96,165,250,${op})`} strokeWidth={w} strokeLinecap="square" />
                {hasBranch && (
                  <line x1={x2} y1={y2} x2={bx} y2={by}
                    stroke={`rgba(59,130,246,${(op*0.6).toFixed(2)})`} strokeWidth={0.5} />
                )}
                {has2nd && (
                  <line x1={(x1+x2)/2} y1={(y1+y2)/2} x2={b2x} y2={b2y}
                    stroke="rgba(96,165,250,0.15)" strokeWidth={0.4} />
                )}
              </g>
            )
          })}

          {/* Mid-ring arc segments */}
          <circle cx={490} cy={205} r={158} fill="none" stroke="rgba(96,165,250,0.25)"  strokeWidth={1}   strokeDasharray="42 16 22 16" />
          <circle cx={490} cy={205} r={132} fill="none" stroke="rgba(59,130,246,0.2)"  strokeWidth={0.8} strokeDasharray="26 20" />
          <circle cx={490} cy={205} r={110} fill="none" stroke="rgba(147,197,253,0.28)"  strokeWidth={1}   strokeDasharray="32 11 12 11" />

          {/* Rotating sweep arm */}
          <g style={{ transformOrigin: '490px 205px', animation: 'sweepRotate 7s linear infinite' }}>
            <line x1={490} y1={205} x2={706} y2={205} stroke="rgba(96,165,250,0.55)" strokeWidth={1.5} />
            <circle cx={706} cy={205} r={4.5} fill="rgba(147,197,253,0.85)" />
            <circle cx={706} cy={205} r={8}   fill="none" stroke="rgba(59,130,246,0.35)" strokeWidth={1} />
          </g>

          {/* Inner fast-spinning orbital rings */}
          <circle cx={490} cy={205} r={86} fill="none" stroke="rgba(147,197,253,0.88)" strokeWidth={2} strokeDasharray="24 9 8 9">
            <animateTransform attributeName="transform" type="rotate" from="0 490 205" to="-360 490 205" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={490} cy={205} r={93} fill="none" stroke="rgba(96,165,250,0.38)" strokeWidth={1} strokeDasharray="12 15">
            <animateTransform attributeName="transform" type="rotate" from="0 490 205" to="360 490 205" dur="9s" repeatCount="indefinite" />
          </circle>

          {/* HUD frame — top-left */}
          <line x1={44} y1={16} x2={290} y2={16} stroke="rgba(59,130,246,0.6)" strokeWidth={1.5} />
          <line x1={44} y1={16} x2={44}  y2={42} stroke="rgba(59,130,246,0.6)" strokeWidth={1.5} />
          <line x1={66} y1={26} x2={255} y2={26} stroke="rgba(30,64,175,0.4)" strokeWidth={1} />
          <rect x={47} y={30} width={32} height={5} rx={1} fill="rgba(96,165,250,0.35)" />
          <rect x={87} y={30} width={20} height={5} rx={1} fill="rgba(59,130,246,0.28)" />
          <rect x={115} y={30} width={12} height={5} rx={1} fill="rgba(30,64,175,0.22)" />

          {/* HUD frame — top-right */}
          <line x1={690} y1={16} x2={936} y2={16} stroke="rgba(59,130,246,0.6)" strokeWidth={1.5} />
          <line x1={936} y1={16} x2={936} y2={42} stroke="rgba(59,130,246,0.6)" strokeWidth={1.5} />
          <line x1={725} y1={26} x2={914} y2={26} stroke="rgba(30,64,175,0.4)" strokeWidth={1} />
          <rect x={861} y={30} width={32} height={5} rx={1} fill="rgba(96,165,250,0.35)" />
          <rect x={843} y={30} width={14} height={5} rx={1} fill="rgba(59,130,246,0.28)" />

          {/* Side tick marks */}
          {[48,66,84,102,120,138,156].map((y, i) => (
            <g key={i}>
              <line x1={936} y1={y} x2={936+(i%3===0?16:10)} y2={y} stroke="rgba(59,130,246,0.45)" strokeWidth={1} />
              <line x1={44}  y1={y} x2={44 -(i%3===0?16:10)} y2={y} stroke="rgba(59,130,246,0.45)" strokeWidth={1} />
            </g>
          ))}

          {/* Corner node indicators */}
          <circle cx={924} cy={275} r={11} fill="none" stroke="rgba(59,130,246,0.55)" strokeWidth={1.5} strokeDasharray="5 3" />
          <circle cx={924} cy={275} r={4.5} fill="rgba(96,165,250,0.55)" />
          <circle cx={56}  cy={275} r={11} fill="none" stroke="rgba(59,130,246,0.55)" strokeWidth={1.5} strokeDasharray="5 3" />
          <circle cx={56}  cy={275} r={4.5} fill="rgba(96,165,250,0.55)" />
        </svg>

        {/* ORB + PANEL — pointer-events re-enabled */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Command Panel */}
          {orbOpen && (
            <div style={{
              position: 'absolute', top: 150, left: '50%', transform: 'translateX(-50%)',
              width: 430, background: 'rgba(5,2,0,0.98)',
              border: '1px solid rgba(96,165,250,0.35)', borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(96,165,250,0.06), 0 0 80px rgba(59,130,246,0.12)',
              animation: 'cmdSlideUp 0.22s ease',
            }}>
              <div style={{ padding: '14px 18px 13px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(135deg,rgba(30,64,175,0.18),rgba(15,32,87,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(30,64,175,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(96,165,250,0.4)' }}>
                    <img src="/lh-logo.png" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#dbeafe' }}>Lion-Heart Command</div>
                    <div style={{ fontSize: 10, color: '#93c5fd', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>9 agents · always on</div>
                  </div>
                </div>
                <button onClick={() => setOrbOpen(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 6 }}>×</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {orbMessages.length === 0 && (
                  <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>🦁</div>
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
                    <div key={i} style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', color: '#dbeafe', padding: '10px 14px', borderRadius: '14px 14px 3px 14px', maxWidth: '80%', fontSize: 13, lineHeight: 1.55 }}>{m.content}</div>
                  )
                  const agentId = m.agent ?? 'donny'
                  const ac = AGENT_COLORS[agentId] ?? '#60a5fa'
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
                  <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '11px 16px', background: 'rgba(96,165,250,0.06)', borderRadius: '3px 14px 14px 14px', border: '1px solid rgba(96,165,250,0.2)' }}>
                    {[0,160,320].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: `orbDot 1.3s ${d}ms infinite` }} />)}
                  </div>
                )}
              </div>
              <div style={{ padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input autoFocus value={orbInput} onChange={e => setOrbInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOrbMessage()}
                  placeholder="Ask the team anything…"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(96,165,250,0.3)', color: '#f1f5f9', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={sendOrbMessage} disabled={orbSending}
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#1e40af)', border: 'none', color: '#dbeafe', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 800, boxShadow: '0 4px 14px rgba(59,130,246,0.5)', opacity: orbSending ? 0.6 : 1 }}>↑</button>
              </div>
            </div>
          )}

          {/* Spinning dashed rings */}
          <div style={{ position: 'absolute', top: -25, left: -25, right: -25, bottom: -25, borderRadius: '50%', border: '1.5px dashed rgba(96,165,250,0.5)', animation: 'orbRingSpin 10s linear infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -36, left: -36, right: -36, bottom: -36, borderRadius: '50%', border: '1px dashed rgba(59,130,246,0.3)', animation: 'orbRingSpinR 17s linear infinite', pointerEvents: 'none' }} />

          {/* Outer glow ring */}
          <div style={{ position: 'absolute', top: -14, left: -14, right: -14, bottom: -14, borderRadius: '50%', border: '2px solid rgba(147,197,253,0.78)', boxShadow: '0 0 26px rgba(96,165,250,0.85), 0 0 65px rgba(59,130,246,0.48), inset 0 0 22px rgba(96,165,250,0.18)', animation: 'ringGlow 2.4s ease-in-out infinite', pointerEvents: 'none' }} />

          {/* Amber plasma ball */}
          <button onClick={() => setOrbOpen(o => !o)} title="Lion-Heart Command"
            style={{
              width: 136, height: 136, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: orbState === 'responding'
                ? 'radial-gradient(circle at 38% 33%, #ecfdf5 0%, #6ee7b7 10%, #10b981 30%, #065f46 58%, #022c22 84%)'
                : 'radial-gradient(circle at 38% 33%, #ffffff 0%, #dbeafe 10%, #93c5fd 22%, #3b82f6 42%, #1e40af 65%, #0f2057 85%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: orbState === 'thinking'   ? 'orbThink 0.9s ease-in-out infinite'
                       : orbState === 'responding' ? 'orbRespond 1.1s ease-in-out infinite'
                       : 'orbCore 3.5s ease-in-out infinite',
              transition: 'background 0.5s',
              position: 'relative',
            }}>
            <div style={{ position: 'absolute', top: 12, left: 20, width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, transparent 72%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 38, left: 10, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.38) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <img src="/lh-logo.png" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'brightness(0) invert(1) drop-shadow(0 2px 20px rgba(0,0,0,0.95))', position: 'relative', flexShrink: 0 }} />
          </button>
        </div>
      </div>

    </div>
  )
}
