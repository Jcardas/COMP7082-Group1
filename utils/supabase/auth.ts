import { createClient } from '@/utils/supabase/client'

/**
 * Signs out the current user session and redirects to the login page.
 */
export async function signOut(redirectTo: string = '/login') {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error.message)
    throw error
  }

  if (typeof window !== 'undefined') {
    window.location.href = redirectTo
  }
}
