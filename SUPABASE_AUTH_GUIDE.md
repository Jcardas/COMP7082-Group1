# Minecraft Modpack Team - Supabase Authentication Guide

Welcome to the Minecraft Modpack Team repository! This guide provides step-by-step instructions for setting up, testing, and understanding the authentication flow built with Next.js (App Router), TypeScript, Tailwind CSS, and `@supabase/ssr`.

---

## 1. Project Context

This web application uses **Next.js (App Router)** and **@supabase/ssr** to manage secure sessions for our Minecraft modpack team. It supports OAuth authentication through three primary providers:
- **Discord**
- **GitHub**
- **Google**

---

## 2. Local Setup for Team Members

Follow these steps to run the application locally and test the authentication flow:

1. **Clone and Install Dependencies**:
   Ensure you have Node.js installed, then install project dependencies:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env.local` file in the root of the project (you can copy from an `.env.example` template if available):
   ```bash
   cp .env.example .env.local
   ```
   *(If `.env.example` does not exist, simply create a new `.env.local` file).*

3. **Get Supabase API Keys**:
   - Go to your project dashboard on [Supabase](https://supabase.com).
   - Navigate to **Settings > API**.
   - Copy your **Project URL** and **anon / public** key.

4. **Populate `.env.local`**:
   Add your credentials to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```
   > ⚠️ **Security Warning**: Never commit `.env.local` or any secrets to version control. It is already included in `.gitignore`.

5. **Run the Development Server**:
   Start the Next.js local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser. Unauthenticated users will automatically be redirected to `/login`.

---

## 3. Supabase Dashboard Configuration

For OAuth redirects to work correctly, make sure your Supabase project dashboard is configured as follows:

1. **Authentication > URL Configuration**:
   - **Site URL**: Set to `http://localhost:3000` (or your production domain when deployed).
   - **Redirect URLs**: Add `http://localhost:3000/auth/callback` to the list of allowed callback URLs.

2. **Authentication > Providers**:
   - Enable **Discord**, **GitHub**, and **Google**.
   - Each provider requires configuring developer credentials (Client ID and Client Secret) obtained from their respective developer portals (Discord Developer Portal, GitHub OAuth Apps, Google Cloud Console), with the callback/redirect URL pointing to your Supabase project's auth callback endpoint (`https://<your-project-id>.supabase.co/auth/v1/callback`).

---

## 4. Code Architecture

Our authentication architecture follows modern Next.js App Router and Supabase best practices:

```
COMP7082-Group1/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts       # PKCE code exchange API route
│   ├── login/
│   │   └── page.tsx           # Dark-themed gaming login page with OAuth buttons
│   ├── globals.css            # Tailwind CSS styles & gaming glows
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Protected dashboard (Cobblemon Team Server workspace)
├── components/
│   └── SignOutButton.tsx      # Client component handling session sign out
└── utils/
    └── supabase/
        ├── client.ts          # Browser Supabase client (@supabase/ssr)
        ├── server.ts          # Server Supabase client with cookie handlers
        └── auth.ts            # Sign out utility helpers
```

- **`utils/supabase/`**: Contains helper utilities initialized with `@supabase/ssr` to handle cookie persistence across browser and server contexts.
- **`app/login/page.tsx`**: Client component where team members select Discord, GitHub, or Google to sign in.
- **`app/auth/callback/route.ts`**: API route that intercepts the OAuth redirect, extracts the authorization `code`, exchanges it for a user session via `supabase.auth.exchangeCodeForSession(code)`, and redirects to the app.
- **`app/page.tsx`**: Server component protecting the dashboard, verifying the session, displaying the user's email address, and showcasing the **Cobblemon Team Server** modpack workspace.
