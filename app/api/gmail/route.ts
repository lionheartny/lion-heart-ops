import { NextResponse } from 'next/server'

const TOKEN_URI  = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1'

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN_JB!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

export async function GET() {
  try {
    const token   = await getAccessToken()
    const headers = { Authorization: `Bearer ${token}` }

    // Unread + important inbox messages
    const listRes = await fetch(
      `${GMAIL_BASE}/users/me/messages?maxResults=15&q=in:inbox (is:unread OR is:important)`,
      { headers }
    )
    const listData = await listRes.json()
    const messages: Array<{ id: string }> = listData.messages ?? []

    // Fetch metadata in parallel
    const details = await Promise.all(
      messages.slice(0, 12).map(async (m) => {
        const r = await fetch(
          `${GMAIL_BASE}/users/me/messages/${m.id}?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers }
        )
        return r.json()
      })
    )

    const parsed = details.map((d: any) => {
      const hdrs: Array<{ name: string; value: string }> = d.payload?.headers ?? []
      const get  = (name: string) => hdrs.find(h => h.name === name)?.value ?? ''
      const from = get('From')
      const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
      const senderName = nameMatch ? nameMatch[1].trim() : from.replace(/<.*>/, '').trim() || from.split('@')[0]
      const labels = d.labelIds ?? []
      return {
        id:          d.id,
        threadId:    d.threadId,
        subject:     get('Subject') || '(no subject)',
        from:        senderName,
        fromFull:    from,
        date:        get('Date'),
        snippet:     (d.snippet ?? '').slice(0, 120),
        isUnread:    labels.includes('UNREAD'),
        isStarred:   labels.includes('STARRED'),
        isImportant: labels.includes('IMPORTANT'),
        url:         `https://mail.google.com/mail/u/0/#inbox/${d.threadId}`,
      }
    })

    // Inbox unread count
    const countRes  = await fetch(`${GMAIL_BASE}/users/me/labels/INBOX`, { headers })
    const countData = await countRes.json()

    return NextResponse.json({
      messages:    parsed,
      unreadCount: countData.messagesUnread ?? 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, messages: [], unreadCount: 0 }, { status: 500 })
  }
}
