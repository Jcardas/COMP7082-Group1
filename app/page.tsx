import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardPage() {
  const supabase = createClient()

  // Fetch the current session on the server
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('[Dashboard] Error fetching session on server:', error)
  }

  // If no session exists, automatically redirect back to /login
  if (!session) {
    console.log('[Dashboard] No active session found. Redirecting to /login.')
    redirect('/login')
  }

  const userEmail = session.user.email ?? 'Unknown User'
  const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail.split('@')[0]
  const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative overflow-hidden">
      {/* Decorative Gaming Glows */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-emerald-900/10 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Top Navbar Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center text-emerald-400 glow-emerald">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Minecraft Modpack Hub
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                  v1.2.0-rc
                </span>
              </h1>
              <p className="text-sm text-slate-400">Team Collaboration Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* User Profile Info */}
            <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full border border-emerald-500/40 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs">
                  {userName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200 truncate max-w-[160px]">{userName}</p>
                <p className="text-[11px] text-slate-400 truncate max-w-[160px]" title={userEmail}>
                  {userEmail}
                </p>
              </div>
            </div>

            <SignOutButton />
          </div>
        </header>

        {/* Welcome Banner */}
        <section className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 shadow-2xl">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-emerald-400">{userName}</span>!
            </h2>
            <p className="text-slate-300 mt-2 text-sm sm:text-base leading-relaxed">
              You are successfully authenticated as <code className="text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono text-xs">{userEmail}</code>. Ready to build, test, and package today's mods?
            </p>
          </div>
        </section>

        {/* Workspace Section: Modpack Manager ("Cobblemon Team Server") */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Active Modpacks
            </h3>
            <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-emerald-600/20">
              + New Modpack
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Mock Modpack Card: Cobblemon Team Server */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 shadow-xl hover:border-emerald-500/60 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-medium border border-emerald-500/30">
                  Minecraft 1.20.1
                </span>
              </div>
              
              <h4 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Cobblemon Team Server
              </h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Official team survival modpack featuring Cobblemon, JourneyMap, JEI, and custom fakemon expansions.
              </p>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>142 Mods &bull; Forge 47.3.0</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Manage &rarr;
                </span>
              </div>
            </div>

            {/* Additional Placeholder Modpack Card */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl hover:border-slate-700 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-medium border border-slate-700">
                  Minecraft 1.21
                </span>
              </div>
              
              <h4 className="text-lg font-bold text-white">
                Tech & Magic Reloaded
              </h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Experimental automation and arcane magic pack for weekly team playtesting sessions.
              </p>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>98 Mods &bull; Fabric 0.16</span>
                <span className="text-slate-300 font-medium">Manage &rarr;</span>
              </div>
            </div>

            {/* Empty Slot Card */}
            <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-slate-300 group-hover:text-white mt-3 transition-colors">
                Import New Modpack
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Upload CurseForge or Modrinth export ZIP
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
