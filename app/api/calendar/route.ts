import { NextResponse } from 'next/server'

const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const CAL_BASE  = 'https://www.googleapis.com/calendar/v3'

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN_JB_CAL ?? process.env.GOOGLE_REFRESH_TOKEN_JB!,
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

    const now       = new Date()
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
    const endOfWeek  = new Date(now); endOfWeek.setDate(now.getDate() + 7)

    // Get events from all calendars (primary)
    const eventsRes = await fetch(
      `${CAL_BASE}/calendars/primary/events?` +
      `timeMin=${startOfDay.toISOString()}&timeMax=${endOfWeek.toISOString()}` +
      `&singleEvents=true&orderBy=startTime&maxResults=20`,
      { headers }
    )
    const eventsData = await eventsRes.json()
    const items: any[] = eventsData.items ?? []

    const events = items.map((e: any) => {
      const start = e.start?.dateTime ?? e.start?.date ?? ''
      const end   = e.end?.dateTime   ?? e.end?.date   ?? ''
      const isAllDay = !e.start?.dateTime
      const startDate = new Date(start)
      const isToday   = startDate.toDateString() === now.toDateString()
      const isPast    = startDate < now && !isAllDay
      const minutesUntil = Math.round((startDate.getTime() - now.getTime()) / 60000)

      return {
        id:           e.id,
        title:        e.summary ?? '(no title)',
        start,
        end,
        isAllDay,
        isToday,
        isPast,
        minutesUntil,
        location:     e.location ?? '',
        description:  (e.description ?? '').slice(0, 200),
        attendees:    (e.attendees ?? []).slice(0, 5).map((a: any) => ({
          email: a.email, name: a.displayName ?? a.email.split('@')[0],
        })),
        meetLink:     e.hangoutLink ?? e.conferenceData?.entryPoints?.[0]?.uri ?? '',
        url:          e.htmlLink ?? '',
        colorId:      e.colorId ?? '',
        organizer:    e.organizer?.displayName ?? e.organizer?.email ?? '',
      }
    })

    // Next upcoming event
    const nextEvent = events.find(e => !e.isPast && !e.isAllDay && e.minutesUntil >= 0) ?? null

    return NextResponse.json({ events, nextEvent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, events: [], nextEvent: null }, { status: 500 })
  }
}
