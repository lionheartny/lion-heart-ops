import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function zenCreds() {
  const apiKey = process.env.ZENVENTORY_API_KEY!
  const apiSecret = process.env.ZENVENTORY_API_SECRET!
  const baseUrl = process.env.ZENVENTORY_BASE_URL ?? 'https://app.zenventory.com'
  const creds = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  return { baseUrl, headers: { Authorization: `Basic ${creds}` } }
}

async function countOrders(params: string): Promise<number> {
  const { baseUrl, headers } = zenCreds()
  let total = 0, page = 1
  while (true) {
    const res = await fetch(
      `${baseUrl}/rest/customer-orders?${params}&per_page=100&page=${page}`,
      { headers, next: { revalidate: 0 } }
    )
    if (!res.ok) break
    const data = await res.json()
    const orders: unknown[] = data.customerOrders ?? []
    total += orders.length
    if (orders.length < 100) break
    page++
  }
  return total
}

async function getOpenOrderCount(): Promise<number> {
  return countOrders('open=true')
}

async function getOnHoldCount(): Promise<number> {
  return countOrders('onHold=true')
}

async function getShippedTodayCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  return countOrders(`completed=true&from=${today}&to=${today}`)
}

async function getAgentActivityCount(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('agent_activity')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())
  return count ?? 0
}

export async function GET() {
  try {
    const [openOrders, onHold, shippedToday, actionsToday] = await Promise.all([
      getOpenOrderCount(),
      getOnHoldCount(),
      getShippedTodayCount(),
      getAgentActivityCount(),
    ])

    // Upsert live values into metrics table (triggers Realtime on the frontend)
    await supabase.from('metrics').upsert([
      { key: 'open_tickets',   value: String(openOrders),   label: 'Open orders' },
      { key: 'on_hold',        value: String(onHold),        label: 'On hold' },
      { key: 'shipped_today',  value: String(shippedToday),  label: 'Shipped today' },
      { key: 'actions_today',  value: String(actionsToday),  label: 'Actions today' },
    ])

    return NextResponse.json({ openOrders, onHold, shippedToday, actionsToday, refreshed: new Date().toISOString() })
  } catch (err) {
    console.error('[/api/metrics]', err)
    return NextResponse.json({ error: 'refresh failed' }, { status: 500 })
  }
}
