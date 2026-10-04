'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      console.log('[SignOutButton] Initiating sign out...')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[SignOutButton] Error signing out:', error)
      } else {
        console.log('[SignOutButton] Sign out successful, redirecting to /login')
        window.location.href = '/login'
      }
    } catch (err) {
      console.error('[SignOutButton] Unexpected error during sign out:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all duration-200 border border-slate-700 hover:border-slate-600 disabled:opacity-50 shadow-lg"
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )}
      <span>Sign Out</span>
    </button>
  )
}
