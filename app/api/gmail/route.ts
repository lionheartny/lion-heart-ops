import { NextResponse } from 'next/server'

const TOKEN_URI  = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1'

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function fetchInbox(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  account: 'LH' | 'BSJ'
): Promise<{ messages: any[]; unreadCount: number }> {
  const token   = await getAccessToken(clientId, clientSecret, refreshToken)
  const headers = { Authorization: `Bearer ${token}` }

  const listRes  = await fetch(
    `${GMAIL_BASE}/users/me/messages?maxResults=15&q=in:inbox (is:unread OR is:important)`,
    { headers }
  )
  const listData = await listRes.json()
  const messages: Array<{ id: string }> = listData.messages ?? []

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
    const gmailUser = account === 'BSJ' ? 'u/1' : 'u/0'
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
      url:         `https://mail.google.com/mail/${gmailUser}/#inbox/${d.threadId}`,
      account,
    }
  })

  const countRes  = await fetch(`${GMAIL_BASE}/users/me/labels/INBOX`, { headers })
  const countData = await countRes.json()

  return { messages: parsed, unreadCount: countData.messagesUnread ?? 0 }
}

export async function GET() {
  try {
    // Always fetch LH
    const lhPromise = fetchInbox(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REFRESH_TOKEN_JB!,
      'LH'
    )

    // Fetch BSJ only if credentials are present
    const bsjRefresh = process.env.GOOGLE_REFRESH_TOKEN_BSJ
    const bsjPromise = bsjRefresh
      ? fetchInbox(
          process.env.GOOGLE_CLIENT_ID_BSJ!,
          process.env.GOOGLE_CLIENT_SECRET_BSJ!,
          bsjRefresh,
          'BSJ'
        ).catch(() => ({ messages: [], unreadCount: 0 }))
      : Promise.resolve({ messages: [], unreadCount: 0 })

    const [lh, bsj] = await Promise.all([lhPromise, bsjPromise])

    // Merge and sort by date descending
    const allMessages = [...lh.messages, ...bsj.messages].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return NextResponse.json({
      messages:       allMessages,
      unreadCount:    lh.unreadCount,
      unreadCountBSJ: bsj.unreadCount,
      hasBSJ:         !!bsjRefresh,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, messages: [], unreadCount: 0, unreadCountBSJ: 0, hasBSJ: false }, { status: 500 })
  }
}
