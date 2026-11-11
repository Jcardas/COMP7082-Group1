# Supabase Authentication Setup (Vite + React)

To run the authentication flow locally, you need to configure your environment variables to point to our Supabase instance. Vite requires environment variables to be prefixed with `VITE_`.

## 1. Create your local environment file
At the root of the `client` directory, create a file named `.env.local`. 
*(Note: This file is included in `.gitignore` and will never be committed to GitHub).*

## 2. Retrieve your keys
1. Log into the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select our MCMC project.
3. Navigate to **Project Settings** (the gear icon) > **API**.
4. Copy the **Project URL** and the **`anon` `public` API Key**.

## 3. Configure `.env.local`
Paste the keys into your `.env.local` file using the exact variable names below:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
