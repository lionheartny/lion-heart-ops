import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Persona → agent_status ID map
const PERSONA_TO_AGENT: Record<string, string> = {
  donny:    'donny',
  mark:     'mark',
  boris:    'boris',
  svetlana: 'svetlana',
  morgan:   'morgan',
  tara:     'tara',
  owen:     'owen',
  priya:    'priya',
  nina:     'nina',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, persona, tier, subject, description, draftContent } = body

    // Auth
    if (token !== process.env.QUEUE_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Map persona → agent id
    const agentId = PERSONA_TO_AGENT[persona?.toLowerCase()] ?? 'donny'

    // Tier B = YELLOW (needs approval), C = RED (flag only)
    if (tier !== 'B' && tier !== 'C') {
      return NextResponse.json({ error: 'invalid tier' }, { status: 400 })
    }

    const { data, error } = await supabase.from('approval_queue').insert({
      agent_id:      agentId,
      tier,
      subject:       subject ?? '(no subject)',
      description:   description ?? '',
      draft_content: draftContent ?? null,
      status:        'pending',
    }).select().single()

    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[/api/queue]', err)
    return NextResponse.json({ error: 'insert failed' }, { status: 500 })
  }
}
