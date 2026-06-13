'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SC: Record<string, string> = { active: '#22c55e', needs_you: '#f59e0b', idle: '#6b7280' }
const SL: Record<string, string> = { active: 'active', needs_you: 'needs you', idle: 'idle' }
const TC: Record<string, string> = { B: '#f59e0b', C: '#ef4444' }
const TL: Record<string, string> = { B: 'YELLOW', C: 'RED' }

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
    // Trigger live Zenventory refresh on mount (updates metrics table → fires Realtime)
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

  const mm = Object.fromEntries(metrics.map((m: any) => [m.key, m]))
  const held = queue.length

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui,sans-serif', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 600 }}>Lion-Heart agent operations</div>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>{time.toLocaleTimeString()}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { k: 'textline_status', l: 'Text line 848', c: '#22c55e' },
          { k: 'open_tickets', l: 'Open tickets', c: '#fff' },
          { k: 'held_for_you', l: 'Held for you', c: held > 0 ? '#f59e0b' : '#fff' },
          { k: 'actions_today', l: 'Actions today', c: '#fff' },
        ].map(({ k, l, c }) => (
          <div key={k} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>{l}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: c }}>
              {k === 'held_for_you' ? held : (mm[k]?.value || '—')}
            </div>
          </div>
        ))}
      </div>

      {queue.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Held for your approval</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queue.map((item: any) => {
              const agent = agents.find(a => a.id === item.agent_id)
              return (
                <div key={item.id} style={{ background: '#1a1a1a', border: `1px solid ${TC[item.tier]}33`, borderLeft: `3px solid ${TC[item.tier]}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: TC[item.tier] + '22', color: TC[item.tier], fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>{TL[item.tier]}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>{agent?.name} · {agent?.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {item.tier === 'B' && (
                        <button onClick={() => handleQueue(item.id, 'approved')} disabled={acting === item.id}
                          style={{ background: '#22c55e22', border: '1px solid #22c55e', color: '#22c55e', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          {acting === item.id ? '...' : 'Approve'}
                        </button>
                      )}
                      <button onClick={() => handleQueue(item.id, 'rejected')} disabled={acting === item.id}
                        style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        {acting === item.id ? '...' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.subject}</div>
                  <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: item.draft_content ? '10px' : 0 }}>{item.description}</div>
                  {item.draft_content && (
                    <div style={{ background: '#2a2a2a', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#d1d5db', fontStyle: 'italic' }}>
                      Draft: "{item.draft_content}"
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '12px', color: '#6b7280' }}>
        {['active', 'needs_you', 'idle'].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', border: `2px solid ${SC[s]}` }} />
            {SL[s]}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {agents.map((a: any) => (
          <div key={a.id} onClick={() => { setSelected(a); setChatOpen(false) }}
            style={{ background: '#1a1a1a', border: `1px solid ${selected?.id === a.id ? '#3b82f6' : '#2a2a2a'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                {a.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{a.name}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{a.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: SC[a.status] }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', border: `2px solid ${SC[a.status]}` }} />
              {SL[a.status]}
            </div>
          </div>
        ))}
      </div>

      {selected && !chatOpen && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{selected.name[0]}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{selected.name} · {selected.role}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>Reports to Boris</div>
              </div>
            </div>
            <div style={{ color: SC[selected.status], fontSize: '12px' }}>{SL[selected.status]}</div>
          </div>
          {selected.current_task && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Working on</div>
              <div>{selected.current_task}</div>
            </div>
          )}
          {activity.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>Recent activity</div>
              {activity.map((a: any) => <div key={a.id} style={{ color: '#d1d5db', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #2a2a2a' }}>{a.description}</div>)}
            </div>
          )}
          <button onClick={() => setChatOpen(true)} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Open {selected.name} in chat ↗
          </button>
        </div>
      )}

      {selected && chatOpen && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', height: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600 }}>Chat with {selected.name}</div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#3b82f6' : '#2a2a2a', padding: '10px 14px', borderRadius: '12px', maxWidth: '80%', fontSize: '13px' }}>
                {m.content}
              </div>
            ))}
            {sending && <div style={{ color: '#6b7280', fontSize: '13px' }}>{selected.name} is typing...</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={`Message ${selected.name}...`}
              style={{ flex: 1, background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
            <button onClick={sendMessage} disabled={sending}
              style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
