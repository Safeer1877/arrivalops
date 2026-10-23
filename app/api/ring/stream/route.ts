import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth'

const API_BASE = 'https://api.amazonvision.com'

// WHEP session URLs stay on the server; the browser only gets an opaque id to close the session with, so a
// caller can never make the server send the Ring token to a URL of its choosing.
const sessions = new Map<string, string>()

export async function POST(request: NextRequest) {
  try {
    const { sdpOffer, deviceId } = await request.json()

    if (!sdpOffer) {
      return NextResponse.json({ error: 'Missing sdpOffer' }, { status: 400 })
    }

    // Use deviceId from request body, fall back to env var
    const resolvedDeviceId = deviceId || process.env.NEXT_PUBLIC_RING_DEVICE_ID
    if (!resolvedDeviceId) {
      return NextResponse.json(
        { error: 'No device ID provided. Pass deviceId in request body or set NEXT_PUBLIC_RING_DEVICE_ID.' },
        { status: 400 }
      )
    }

    const token = await getAccessToken()
    const whepUrl = `${API_BASE}/v1/devices/${resolvedDeviceId}/media/streaming/whep/sessions`

    const response = await fetch(whepUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: sdpOffer,
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: `WHEP failed: ${response.status} - ${error}` },
        { status: response.status }
      )
    }

    const sdpAnswer = await response.text()
    const location = response.headers.get('Location')
    const sessionUrl = location ? new URL(location, API_BASE).toString() : null
    // The URL came from Ring's own response, never from the browser.
    const sessionId = sessionUrl ? crypto.randomUUID() : null
    if (sessionId && sessionUrl) sessions.set(sessionId, sessionUrl)

    return NextResponse.json({ sdpAnswer, sessionId })
  } catch (error) {
    console.error('Stream error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stream failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    const sessionUrl = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined
    if (!sessionUrl) {
      return NextResponse.json({ error: 'Unknown session' }, { status: 404 })
    }
    sessions.delete(sessionId)

    const token = await getAccessToken()
    await fetch(sessionUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 })
  }
}
