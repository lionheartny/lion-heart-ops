import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type AgentStatus = {
  id: string
  name: string
  role: string
  status: 'active' | 'needs_you' | 'idle'
  current_task: string | null
  last_updated: string
}

export type AgentActivity = {
  id: string
  agent_id: string
  description: string
  tier: string | null
  created_at: string
}

export type ChatMessage = {
  id: string
  agent_id: string
  role: 'user' | 'agent'
  content: string
  created_at: string
}

export type Metric = {
  key: string
  value: string
  label: string
  updated_at: string
}

export type ApprovalItem = {
  id: string
  agent_id: string
  tier: 'B' | 'C'
  subject: string
  description: string
  draft_content: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
