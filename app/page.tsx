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

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
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
    { k: 'textline_status', l: 'Textline 848', icon: '📱', accent: '#10b981' },
    { k: 'open_tickets', l: 'Open tickets', icon: '🎫', accent: '#3b82f6' },
    { k: 'held_for_you', l: 'Awaiting you', icon: '⏳', accent: held > 0 ? '#f59e0b' : '#8b5cf6' },
    { k: 'actions_today', l: 'Actions today', icon: '⚡', accent: '#8b5cf6' },
  ]

  return (
    <div style={{
      background: '#070711', minHeight: '100vh', color: '#f1f5f9',
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
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: '#0a0a0a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <img src="/lh-logo.png" alt="Lion-Heart" style={{ width: 34, height: 34, objectFit: 'contain' }} />
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
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 600 }}>
                  {flag} {label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: '#e2e8f0', lineHeight: 1 }}>
                  {t}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{d}</div>
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
    </div>
  )
}
