'use client'

import React, { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Eye, EyeOff, Check, X } from 'lucide-react'

type AuthMode = 'signin' | 'signup'
type Provider = 'discord' | 'github' | 'google'

type StrengthLevel = 'weak' | 'fair' | 'strong'

interface PasswordStrength {
  score: number
  label: string
  level: StrengthLevel
  color: string
}

function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', level: 'weak', color: '#94A3B8' }
  }

  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) {
    return { score, label: 'Weak', level: 'weak', color: '#94A3B8' }
  } else if (score === 2 || score === 3) {
    return { score, label: 'Medium', level: 'fair', color: '#818CFC' }
  } else {
    return { score, label: 'Strong', level: 'strong', color: '#3B82F6' }
  }
}

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Password visibility state:
  // - Login: hidden by default (showPassword = false)
  // - Sign Up: visible by default (showPassword = true)
  const [showPassword, setShowPassword] = useState(false)

  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const supabase = createClient()

  // Real-time criteria checks
  const criteria = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }
  }, [password])

  const allCriteriaMet = criteria.minLength && criteria.hasUppercase && criteria.hasNumber && criteria.hasSpecial
  const strength = useMemo(() => evaluatePasswordStrength(password), [password])

  // Handle switching views and setting default password visibility
  const handleToggleAuthMode = (mode: AuthMode) => {
    setAuthMode(mode)
    setErrorMessage(null)
    setInfoMessage(null)
    setPassword('')
    setShowPassword(mode === 'signup')
  }

  // Handle Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    try {
      setLoadingAction('signin')
      setErrorMessage(null)
      setInfoMessage(null)

      console.log(`[Auth] Attempting sign in with email: ${email}`)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('[Auth] Error signing in:', error)
        setErrorMessage(error.message)
        setLoadingAction(null)
      } else {
        console.log('[Auth] Successfully signed in:', data)
        window.location.href = '/'
      }
    } catch (err: any) {
      console.error('[Auth] Unexpected error during sign in:', err)
      setErrorMessage(err?.message || 'An unexpected error occurred.')
      setLoadingAction(null)
    }
  }

  // Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMessage('Please fill in all fields.')
      return
    }
    if (!allCriteriaMet) {
      setErrorMessage('Please ensure your password meets all required criteria.')
      return
    }

    try {
      setLoadingAction('signup')
      setErrorMessage(null)
      setInfoMessage(null)

      console.log(`[Auth] Attempting sign up with email: ${email}`)
      const redirectToUrl = `${window.location.origin}/auth/callback`
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectToUrl,
        },
      })

      if (error) {
        console.error('[Auth] Error signing up:', error)
        setErrorMessage(error.message)
      } else {
        console.log('[Auth] Successfully signed up:', data)
        if (data.session) {
          window.location.href = '/'
        } else {
          setInfoMessage('Registration successful! Please check your email to confirm your account.')
        }
      }
    } catch (err: any) {
      console.error('[Auth] Unexpected error during sign up:', err)
      setErrorMessage(err?.message || 'An unexpected error occurred.')
    } finally {
      setLoadingAction(null)
    }
  }

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!email) {
      setErrorMessage('Please enter your email address above before clicking "Forgot Password?".')
      return
    }

    try {
      setLoadingAction('forgot-password')
      setErrorMessage(null)
      setInfoMessage(null)

      console.log(`[Auth] Requesting password reset for email: ${email}`)
      const redirectToUrl = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectToUrl,
      })

      if (error) {
        console.error('[Auth] Error resetting password:', error)
        setErrorMessage(error.message)
      } else {
        console.log('[Auth] Password reset email sent successfully.')
        setInfoMessage('Password reset link sent! Check your inbox.')
      }
    } catch (err: any) {
      console.error('[Auth] Unexpected error during password reset:', err)
      setErrorMessage(err?.message || 'An unexpected error occurred.')
    } finally {
      setLoadingAction(null)
    }
  }

  // Handle OAuth Sign In
  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      setLoadingAction(provider)
      setErrorMessage(null)
      setInfoMessage(null)

      const redirectToUrl = `${window.location.origin}/auth/callback`
      console.log(`[Auth] Triggering signInWithOAuth for provider: "${provider}"`)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectToUrl,
        },
      })

      if (error) {
        console.error(`[Auth] Error returned by signInWithOAuth for ${provider}:`, error)
        setErrorMessage(error.message)
        setLoadingAction(null)
      }
    } catch (err: any) {
      console.error(`[Auth] Unexpected exception during ${provider} sign in:`, err)
      setErrorMessage(err?.message || 'An unexpected error occurred during sign in.')
      setLoadingAction(null)
    }
  }

  return (
    <main 
      className="min-h-screen flex items-center justify-center p-6 sm:p-10 relative overflow-hidden"
      style={{ backgroundColor: '#0B0F19' }}
    >
      {/* Decorative Gaming Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-auto">
        {/* Main Card */}
        <div 
          className="rounded-2xl p-8 sm:p-10 shadow-2xl border backdrop-blur-xl space-y-6"
          style={{ backgroundColor: '#161D2F', borderColor: '#24304A' }}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg border mb-1"
              style={{ 
                backgroundColor: '#161D2F', 
                borderColor: '#24304A',
                color: '#818CFC'
              }}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: '#F8FAFC' }}>
              {authMode === 'signin' ? 'Log In' : 'Create Account'}
            </h1>
            <p className="text-xs sm:text-sm" style={{ color: '#94A3B8' }}>
              Minecraft Modpack Team Portal
            </p>
          </div>

          {/* Error Notification */}
          {errorMessage && (
            <div 
              className="p-4 rounded-xl text-sm flex items-center gap-3 border"
              style={{ backgroundColor: 'rgba(127, 29, 29, 0.4)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#FCA5A5' }}
            >
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Notification */}
          {infoMessage && (
            <div 
              className="p-4 rounded-xl text-sm flex items-center gap-3 border"
              style={{ backgroundColor: 'rgba(6, 78, 59, 0.4)', borderColor: 'rgba(5, 150, 105, 0.3)', color: '#6EE7B7' }}
            >
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

          {authMode === 'signin' ? (
            /* Sign In Form */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: '#94A3B8' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all"
                  style={{
                    backgroundColor: '#161D2F',
                    borderColor: '#24304A',
                    color: '#F8FAFC',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#24304A')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium" style={{ color: '#94A3B8' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: '#818CFC' }}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === 'forgot-password' ? 'Sending...' : 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm border outline-none transition-all"
                    style={{
                      backgroundColor: '#161D2F',
                      borderColor: '#24304A',
                      color: '#F8FAFC',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#24304A')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: '#94A3B8' }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Primary Sign In Button */}
              <button
                type="submit"
                disabled={loadingAction !== null}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                style={{
                  backgroundColor: '#3B82F6',
                  color: '#F8FAFC',
                }}
                onMouseEnter={(e) => {
                  if (loadingAction === null) e.currentTarget.style.backgroundColor = '#818CFC'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3B82F6'
                }}
              >
                {loadingAction === 'signin' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: '#94A3B8' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all"
                  style={{
                    backgroundColor: '#161D2F',
                    borderColor: '#24304A',
                    color: '#F8FAFC',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#24304A')}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: '#94A3B8' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm border outline-none transition-all"
                    style={{
                      backgroundColor: '#161D2F',
                      borderColor: '#24304A',
                      color: '#F8FAFC',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#24304A')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: '#94A3B8' }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {password.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: '#94A3B8' }}>Strength:</span>
                      <span className="font-semibold" style={{ color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                      {[1, 2, 3, 4].map((seg) => (
                        <div
                          key={seg}
                          className="rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              strength.score >= seg ? strength.color : '#24304A',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Explicit Password Criteria Checklist */}
                <div className="mt-3 p-3 rounded-xl border space-y-2" style={{ backgroundColor: '#0B0F19', borderColor: '#24304A' }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>
                    Password requirements:
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: criteria.minLength ? '#3B82F6' : '#94A3B8' }}>
                      {criteria.minLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </span>
                    <span style={{ color: criteria.minLength ? '#3B82F6' : '#94A3B8' }}>
                      At least 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: criteria.hasUppercase ? '#3B82F6' : '#94A3B8' }}>
                      {criteria.hasUppercase ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </span>
                    <span style={{ color: criteria.hasUppercase ? '#3B82F6' : '#94A3B8' }}>
                      Contains an uppercase letter
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: criteria.hasNumber ? '#3B82F6' : '#94A3B8' }}>
                      {criteria.hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </span>
                    <span style={{ color: criteria.hasNumber ? '#3B82F6' : '#94A3B8' }}>
                      Contains a number
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: criteria.hasSpecial ? '#3B82F6' : '#94A3B8' }}>
                      {criteria.hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </span>
                    <span style={{ color: criteria.hasSpecial ? '#3B82F6' : '#94A3B8' }}>
                      Contains a special character
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Sign Up Button */}
              <button
                type="submit"
                disabled={loadingAction !== null || !allCriteriaMet}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                style={{
                  backgroundColor: '#3B82F6',
                  color: '#F8FAFC',
                }}
                onMouseEnter={(e) => {
                  if (loadingAction === null && allCriteriaMet) {
                    e.currentTarget.style.backgroundColor = '#818CFC'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3B82F6'
                }}
              >
                {loadingAction === 'signup' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Sign Up</span>
                )}
              </button>
            </form>
          )}

          {/* Toggle View Link */}
          <div className="text-center text-xs pt-2" style={{ color: '#94A3B8' }}>
            {authMode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleAuthMode('signup')}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#818CFC' }}
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleAuthMode('signin')}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#818CFC' }}
                >
                  Log in
                </button>
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center my-2">
            <div className="flex-grow border-t" style={{ borderColor: '#24304A' }}></div>
            <span className="flex-shrink mx-4 text-xs uppercase tracking-wider" style={{ color: '#94A3B8' }}>Or continue with</span>
            <div className="flex-grow border-t" style={{ borderColor: '#24304A' }}></div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            {/* Discord */}
            <button
              onClick={() => handleOAuthSignIn('discord')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all border disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                backgroundColor: '#161D2F',
                borderColor: '#24304A',
                color: '#F8FAFC',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#24304A')}
            >
              {loadingAction === 'discord' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 fill-current text-[#5865F2]" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.011c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              )}
              <span>Sign in with Discord</span>
            </button>

            {/* GitHub */}
            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all border disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                backgroundColor: '#161D2F',
                borderColor: '#24304A',
                color: '#F8FAFC',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#24304A')}
            >
              {loadingAction === 'github' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              )}
              <span>Sign in with GitHub</span>
            </button>

            {/* Google */}
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loadingAction !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all border disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{
                backgroundColor: '#161D2F',
                borderColor: '#24304A',
                color: '#F8FAFC',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#818CFC')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#24304A')}
            >
              {loadingAction === 'google' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.22 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.18C.43 8.13 0 9.87 0 12s.43 3.87 1.18 5.4l4.09-3.16z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.15 2.68 1.18 6.6l4.09 3.15c.95-2.85 3.6-4.99 6.73-4.99z"/>
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="pt-4 border-t text-center" style={{ borderColor: '#24304A' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Secured with Supabase Auth &bull; Minecraft Modpack Team
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
