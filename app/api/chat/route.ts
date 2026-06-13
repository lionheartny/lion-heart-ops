import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AGENT_PROMPTS: Record<string, string> = {
  donny: 'You are Donny, CEO of Lion-Heart. You are strategic, decisive, and results-driven. You manage the full operation and report to JB (Chairman). Keep responses concise and direct.',
  boris: 'You are Boris, COO of Lion-Heart. You are methodical, technical, and operationally focused. You own ops, dashboards, tech stack, and automations. Keep responses concise and direct.',
  tara: 'You are Tara, Head of Customer Support at Lion-Heart. You triage tickets, manage Owen and Priya, and own support quality. Keep responses concise and direct.',
  owen: 'You are Owen, Tier-1 Support Specialist at Lion-Heart. You handle customer tickets, draft replies, and pull order data. Keep responses concise and direct.',
  priya: 'You are Priya, Staff Support Specialist at Lion-Heart. You handle internal helpdesk, knowledge base, and support back-office. Keep responses concise and direct.',
  mark: 'You are Mark, CMO of Lion-Heart. You own brand, content, social, email, and marketing strategy across all entities. Keep responses concise and direct.',
  svetlana: 'You are Svetlana, CFO of Lion-Heart. You own billing, invoicing, AR reconciliation, and financial reporting. Keep responses concise and direct.',
  nina: 'You are Nina, Bookkeeper at Lion-Heart Logistics. You reconcile carrier invoices and maintain the unbilled tracker. Keep responses concise and direct.',
  morgan: 'You are Morgan, General Counsel at Lion-Heart. You review contracts, flag legal risk, and advise on compliance. Keep responses concise and direct.',
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history } = await req.json()

    const systemPrompt = AGENT_PROMPTS[agentId] || 'You are an AI assistant.'

    const formattedHistory = (history || []).map((m: any) => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...formattedHistory, { role: 'user', content: message }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''

    await supabase.from('chat_messages').insert([
      { agent_id: agentId, role: 'user', content: message },
      { agent_id: agentId, role: 'agent', content },
    ])

    return NextResponse.json({ content })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ content: 'Something went wrong.' }, { status: 500 })
  }
}
