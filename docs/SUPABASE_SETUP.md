# Supabase setup

One-time setup. ~10 minutes. Everything here is on Supabase's free tier.

## 1. Create the project

1. Go to <https://supabase.com> and sign in (you can use your GitHub account).
2. **New project**:
   - **Name:** `granny-walking`
   - **Region:** choose the closest — **West EU (London)** for the UK.
   - **Database password:** generate a strong one and save it somewhere safe
     (a password manager). You rarely need it, but you can't recover it later.
3. Wait ~2 minutes while it provisions.

## 2. Create the database tables

1. Left sidebar -> **SQL Editor** -> **New query**.
2. Open `supabase/schema.sql` from this repo, copy all of it, paste, and click **Run**.
3. You should see "Success". This creates the `walks` table, security rules,
   and the private `gpx` storage bucket.

## 3. Lock down sign-ups (important)

So strangers can't create their own account:

1. **Authentication** -> **Sign In / Providers** (or **Settings**).
2. Turn **OFF** "Allow new users to sign up" / disable public email sign-ups.

## 4. Create the logins (you do this manually instead)

1. **Authentication** -> **Users** -> **Add user** -> **Create new user**.
2. Add one for Granny (her email + a password) and one for yourself.
   Add any other family who should see it.
3. Tick "Auto confirm user" so they don't need to verify an email.

These email/password logins are what the dashboard will ask for.

## 5. Get the credentials for the dashboard

1. **Project Settings** (gear icon) -> **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (a long token labelled `anon` `public`)

Send me those two. They are **safe to use in the website** — the `anon` key only
works within the security rules above (signed-in users only), so it can't leak data.

> **Do NOT send the `service_role` key.** That one bypasses security. It's only
> needed later by the automated pipeline, and you'll paste it straight into
> GitHub's secret store yourself — never into chat or the website.

## What I do with them

Once you send the Project URL + anon key, I'll wire up the login + dashboard
(`site/`) so you can sign in and see walks. Then we tackle importing Granny's
spreadsheet so there's data to show.
