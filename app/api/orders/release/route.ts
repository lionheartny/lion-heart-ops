import { NextRequest, NextResponse } from 'next/server'

const ZEN_BASE = process.env.ZENVENTORY_BASE_URL ?? 'https://app.zenventory.com'
const ZEN_KEY  = process.env.ZENVENTORY_API_KEY!
const ZEN_SEC  = process.env.ZENVENTORY_API_SECRET!

function zenHeaders() {
  const creds = Buffer.from(`${ZEN_KEY}:${ZEN_SEC}`).toString('base64')
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' }
}

export async function POST(req: NextRequest) {
  try {
    const { id, orderNumber } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing order id' }, { status: 400 })

    const res = await fetch(`${ZEN_BASE}/rest/customer-orders/${id}`, {
      method: 'PUT',
      headers: zenHeaders(),
      body: JSON.stringify({ onHold: false }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[release-hold] Zenventory ${res.status}:`, text)
      return NextResponse.json({ error: `Zenventory error ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true, orderNumber })
  } catch (err) {
    console.error('[/api/orders/release]', err)
    return NextResponse.json({ error: 'Release failed' }, { status: 500 })
  }
}
