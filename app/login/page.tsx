'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Provider = 'discord' | 'github' | 'google'

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const supabase = createClient()

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      setLoadingProvider(provider)
      setErrorMessage(null)

      const redirectToUrl = `${window.location.origin}/auth/callback`
      console.log(`[Login] Triggering signInWithOAuth for provider: "${provider}"`)
      console.log(`[Login] Exact redirectTo URL being passed: "${redirectToUrl}"`)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectToUrl,
        },
      })

      if (error) {
        console.error(`[Login] Error returned by signInWithOAuth for ${provider}:`, error)
        setErrorMessage(error.message)
        setLoadingProvider(null)
      } else {
        console.log(`[Login] Successfully initiated OAuth flow for ${provider}. Data returned:`, data)
      }
    } catch (err: any) {
      console.error(`[Login] Unexpected exception during ${provider} sign in:`, err)
      setErrorMessage(err?.message || 'An unexpected error occurred during sign in.')
      setLoadingProvider(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Minecraft Modpack Cyber/Gaming Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-900/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/80 border border-emerald-600/30 text-emerald-400 mb-4 glow-emerald">
            {/* Minecraft Style Cube / Portal Icon */}
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Modpack Portal</h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to collaborate on the team's Minecraft modpacks</p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl glow-emerald-lg">
          <div className="space-y-4">
            {/* Discord OAuth Button */}
            <button
              onClick={() => handleOAuthSignIn('discord')}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#5865F2]/90 hover:bg-[#5865F2] text-white font-medium transition-all duration-200 border border-transparent hover:border-[#5865F2]/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5865F2]/20"
            >
              {loadingProvider === 'discord' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.011c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              )}
              <span className="font-semibold text-sm">Sign in with Discord</span>
            </button>

            {/* GitHub OAuth Button */}
            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all duration-200 border border-slate-700 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loadingProvider === 'github' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              )}
              <span className="font-semibold text-sm">Sign in with GitHub</span>
            </button>

            {/* Google OAuth Button */}
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-medium transition-all duration-200 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loadingProvider === 'google' ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.22 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.18C.43 8.13 0 9.87 0 12s.43 3.87 1.18 5.4l4.09-3.16z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.15 2.68 1.18 6.6l4.09 3.15c.95-2.85 3.6-4.99 6.73-4.99z"/>
                </svg>
              )}
              <span className="font-semibold text-sm">Sign in with Google</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">
              Secured with Supabase Auth &bull; Minecraft Modpack Team
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
