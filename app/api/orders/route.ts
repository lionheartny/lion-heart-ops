import { NextRequest, NextResponse } from 'next/server'

const ZEN_BASE = process.env.ZENVENTORY_BASE_URL ?? 'https://app.zenventory.com'
const ZEN_KEY  = process.env.ZENVENTORY_API_KEY!
const ZEN_SEC  = process.env.ZENVENTORY_API_SECRET!

function zenHeaders() {
  const creds = Buffer.from(`${ZEN_KEY}:${ZEN_SEC}`).toString('base64')
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' }
}

function fmtOrder(o: any) {
  return {
    id:          o.id,
    orderNumber: o.orderNumber,
    customer:    `${o.customer?.name ?? ''} ${o.customer?.surname ?? ''}`.trim(),
    email:       o.customer?.email ?? '',
    company:     o.customer?.company ?? '',
    status:      o.completed ? 'completed' : o.cancelled ? 'cancelled' : o.onHold ? 'on hold' : 'open',
    orderedDate: o.orderedDate,
    items:       (o.orderItems ?? []).map((i: any) => ({
      sku: i.sku, name: i.name, qty: i.quantity,
    })),
    itemCount:   (o.orderItems ?? []).length,
    tracking:    (o.shipments ?? []).flatMap((s: any) =>
      (s.packages ?? []).map((p: any) => ({ carrier: s.carrier, tracking: p.trackingNumber }))
    ),
    shippingAddress: o.shippingAddress
      ? `${o.shippingAddress.line1}, ${o.shippingAddress.city}, ${o.shippingAddress.state} ${o.shippingAddress.zip}`
      : '',
  }
}

async function fetchOrders(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${ZEN_BASE}/rest/customer-orders?${qs}&per_page=100`,
    { headers: zenHeaders(), next: { revalidate: 0 } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.customerOrders ?? []).map(fmtOrder)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const q    = searchParams.get('q')?.trim() ?? ''
    const from = searchParams.get('from') ?? ''
    const to   = searchParams.get('to') ?? ''
    const open = searchParams.get('open')

    // Build Zenventory query params
    const params: Record<string, string> = {}
    if (from) params['from'] = from
    if (to)   params['to']   = to
    if (open === 'true') params['open'] = 'true'

    let orders: any[] = []

    if (q) {
      // Looks like an order number (e.g. SB1007, LH-42)
      const looksLikeOrderNum = /^[a-zA-Z0-9\-]+$/.test(q) && q.length <= 20
      if (looksLikeOrderNum) {
        // Try exact order number lookup first
        const byNum = await fetchOrders({ ...params, orderNumber: q })
        if (byNum.length > 0) {
          orders = byNum
        } else {
          // Fallback: fetch and filter client-side
          const all = await fetchOrders(params)
          orders = all.filter((o: any) =>
            o.orderNumber.toLowerCase().includes(q.toLowerCase()) ||
            o.customer.toLowerCase().includes(q.toLowerCase()) ||
            o.email.toLowerCase().includes(q.toLowerCase()) ||
            o.company.toLowerCase().includes(q.toLowerCase())
          )
        }
      } else {
        // Name / email search — fetch and filter
        const all = await fetchOrders(params)
        orders = all.filter((o: any) =>
          o.customer.toLowerCase().includes(q.toLowerCase()) ||
          o.email.toLowerCase().includes(q.toLowerCase()) ||
          o.company.toLowerCase().includes(q.toLowerCase())
        )
      }
    } else {
      orders = await fetchOrders(params)
    }

    return NextResponse.json({ orders, count: orders.length })
  } catch (err) {
    console.error('[/api/orders]', err)
    return NextResponse.json({ error: 'search failed' }, { status: 500 })
  }
}
