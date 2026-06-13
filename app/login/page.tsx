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
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#12121a',
        border: '1px solid #1e1e2e',
        borderRadius: '16px',
        padding: '48px',
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: '12px',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px',
          }}>🦁</div>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Lion-Heart Ops
          </h1>
          <p style={{ color: '#6b6b8a', fontSize: '14px', marginTop: '8px' }}>
            Enter your team password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#0a0a0f',
              border: error ? '1px solid #ef4444' : '1px solid #1e1e2e',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '12px',
              background: loading || !password
                ? '#2a2a3a'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: loading || !password ? '#6b6b8a' : '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Checking...' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  )
}
