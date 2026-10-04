import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  console.log(`[Auth Callback] Incoming request URL: "${request.url}"`)

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    console.log(`[Auth Callback] Code search parameter successfully extracted: "${code.substring(0, 8)}..."`)
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error(`[Auth Callback] Error returned by exchangeCodeForSession(code):`, error)
      const errorRedirectUrl = `${origin}/login?error=auth-code-error`
      console.log(`[Auth Callback] Redirecting to error URL: "${errorRedirectUrl}"`)
      return NextResponse.redirect(errorRedirectUrl)
    }

    console.log(`[Auth Callback] Successfully exchanged code for session.`)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    
    let redirectTarget = `${origin}${next}`
    if (!isLocalEnv && forwardedHost) {
      redirectTarget = `https://${forwardedHost}${next}`
    }

    console.log(`[Auth Callback] Final absolute URL being passed to NextResponse.redirect(): "${redirectTarget}"`)
    return NextResponse.redirect(redirectTarget)
  }

  console.error(`[Auth Callback] Error: Code search parameter missing from URL search params.`)
  const missingCodeRedirectUrl = `${origin}/login?error=missing-code`
  console.log(`[Auth Callback] Redirecting to missing code URL: "${missingCodeRedirectUrl}"`)
  return NextResponse.redirect(missingCodeRedirectUrl)
}
