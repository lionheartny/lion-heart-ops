'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070711',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '48px 44px',
        width: '100%',
        maxWidth: 400,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60,
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            borderRadius: 16,
            margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
            boxShadow: '0 8px 30px rgba(139,92,246,0.45)',
          }}>🦁</div>

          <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Lion-Heart
          </div>
          <div style={{
            fontSize: 11, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4,
          }}>
            Agent Operations
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Team password"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${error ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                color: '#f1f5f9',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⚠</span> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '13px',
              background: loading || !password
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              color: loading || !password ? '#475569' : '#fff',
              border: loading || !password ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: loading || !password ? 'none' : '0 4px 20px rgba(139,92,246,0.4)',
              letterSpacing: '0.01em',
            }}
          >
            {loading ? 'Verifying…' : 'Sign in →'}
          </button>
        </form>

        <div style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 12, color: '#334155',
        }}>
          Internal access only · Lion-Heart Holdings
        </div>
      </div>
    </div>
  )
}
