import { NextRequest, NextResponse } from 'next/server'

const ZEN_BASE = process.env.ZENVENTORY_BASE_URL ?? 'https://app.zenventory.com'
const ZEN_KEY  = process.env.ZENVENTORY_API_KEY!
const ZEN_SEC  = process.env.ZENVENTORY_API_SECRET!

function zenHeaders() {
  const creds = Buffer.from(`${ZEN_KEY}:${ZEN_SEC}`).toString('base64')
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' }
}

const EXPRESS_KEYWORDS = ['OVERNIGHT', 'EXPRESS', 'PRIORITY', '2_DAY', '2DAY', 'NEXT_DAY', '1_DAY', '1DAY', 'PRIORITY_OVERNIGHT']

function isExpressShip(shipVia: string): boolean {
  if (!shipVia) return false
  const up = shipVia.toUpperCase()
  return EXPRESS_KEYWORDS.some(k => up.includes(k))
}

function fmtOrder(o: any) {
  const items = o.items ?? o.orderItems ?? []
  const unallocatedItems = items.filter((i: any) => (i.allocatedQuantity ?? 0) < (i.quantity ?? i.orderQuantity ?? 0))
  return {
    id:               o.id,
    orderNumber:      o.orderNumber,
    customer:         `${o.customer?.name ?? ''} ${o.customer?.surname ?? ''}`.trim(),
    email:            o.customer?.email ?? '',
    company:          o.customer?.company ?? '',
    status:           o.completed ? 'completed' : o.cancelled ? 'cancelled' : o.onHold ? 'on hold' : 'open',
    orderedDate:      o.orderedDate,
    shipVia:          o.shipVia ?? '',
    isExpress:        isExpressShip(o.shipVia ?? ''),
    isUnallocated:    unallocatedItems.length > 0,
    unallocatedCount: unallocatedItems.length,
    items:            items.map((i: any) => ({
      sku: i.sku, name: i.description ?? i.name, qty: i.quantity ?? i.orderQuantity,
      allocated: i.allocatedQuantity ?? 0,
    })),
    itemCount:        items.length,
    tracking:         (o.shipments ?? []).flatMap((s: any) =>
      (s.packages ?? []).map((p: any) => ({ carrier: s.carrier, tracking: p.trackingNumber }))
    ),
    shippingAddress:  o.shippingAddress
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
    const q          = searchParams.get('q')?.trim() ?? ''
    const from       = searchParams.get('from') ?? ''
    const to         = searchParams.get('to') ?? ''
    const open       = searchParams.get('open')
    const express    = searchParams.get('express')
    const unalloc    = searchParams.get('unallocated')
    const onhold     = searchParams.get('onhold')

    // Build Zenventory query params
    const params: Record<string, string> = {}
    if (from) params['from'] = from
    if (to)   params['to']   = to
    if (open === 'true' || express === 'true' || unalloc === 'true' || onhold === 'true') params['open'] = 'true'

    let orders: any[] = []

    // Express, onhold or unallocated: fetch open orders and filter client-side
    if (express === 'true' || unalloc === 'true' || onhold === 'true') {
      const all = await fetchOrders(params)
      if (express === 'true')  orders = all.filter((o: any) => o.isExpress)
      if (unalloc === 'true')  orders = all.filter((o: any) => o.isUnallocated)
      if (onhold === 'true')   orders = all.filter((o: any) => o.status === 'on hold')
      return NextResponse.json({ orders, count: orders.length })
    }

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
