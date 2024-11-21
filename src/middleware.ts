import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only apply to /api/submit-request
  if (request.nextUrl.pathname === '/api/submit-request') {
    // Check content length
    const contentLength = parseInt(request.headers.get('content-length') || '0')
    if (contentLength > 100 * 1024 * 1024) { // 100MB
      return NextResponse.json(
        { success: false, message: 'Request too large' },
        { status: 413 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/submit-request'
} 