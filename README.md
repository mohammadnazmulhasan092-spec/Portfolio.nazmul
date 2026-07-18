# Cyberpunk Portfolio — Mohammad Nazmul Hasan

Production-ready vanilla HTML / CSS / JavaScript portfolio powered by **Supabase** (database, auth, storage, realtime). Deployable to GitHub Pages, Netlify, Cloudflare Pages, or any static host.

---

## 1. One-time Supabase setup

1. The project is already wired to:
   - URL: `https://pbchnkflyrjyvzbunhfb.supabase.co`
   - Publishable key: `sb_publishable_eviN5Hr9KEv6cd7ToA5iLQ__xdZHiMb`
2. Open your Supabase Dashboard → **SQL Editor** → New query.
3. Paste the full contents of **`SETUP.sql`** and click **Run**. This creates all tables, RLS policies, the storage bucket, the visitor-counter RPC, and enables realtime.
4. Go to **Authentication → Users → Add user** and create your admin (email + password). Optionally turn off "Confirm email" under Providers → Email for instant login.

That's it — no other configuration is needed.

## 2. Run locally

Because pages use ES modules and `fetch`, open via a local server (not `file://`):

```bash
cd portfolio-mobile
python3 -m http.server 8080
# open http://localhost:8080
```

## 3. Deploy to GitHub Pages

1. Create a new GitHub repo and push the contents of this folder to the `main` branch.
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / root → Save.
3. Wait ~1 minute. Your site goes live at `https://<user>.github.io/<repo>/`.

The included `_headers` and `_redirects` files apply automatically on Netlify / Cloudflare Pages if you deploy there instead.

## 4. Admin panel

- Open `/admin.html`.
- Log in with the admin user you created in step 1.
- Manage **General**, **About**, **Contact**, **Gallery**, **Achievements**, **Educational**, and change your **Password** — all changes go live instantly.
- Image uploads go to the `portfolio-images` Supabase Storage bucket and are served via public CDN URLs.

## 5. File map

| File | Purpose |
|---|---|
| `index.html` | Home (hero, about, status, live feed, visitor analytics) |
| `gallery.html` | Public gallery, realtime from `gallery` table |
| `achievements.html` | Achievements list, realtime |
| `educational.html` | Education / skills timeline, realtime |
| `contact.html` | Contact channels, realtime |
| `admin.html` | Full secured admin dashboard |
| `supabase.js` | Supabase client + helpers (auth, CRUD, realtime, storage) |
| `script.js` | Shared UI (cursor, loader, nav, glitch, mobile menu, audio) |
| `style.css` | Cyberpunk design system |
| `SETUP.sql` | Database / RLS / storage / RPC setup |

> Note: all images (gallery, achievements, favicon, logo) are uploaded through the admin panel and served from Supabase Storage — there is no local `assets/images/` folder to manage.

## 5.1 Upgrading an existing deployment (already ran SETUP.sql before)

If you set this project up before **17 July 2026**, your `achievements` and `educational` tables don't have a `published` column yet (needed for the new HIDE/PUBLISH toggle in the admin panel, matching what Gallery already had). Re-run just these two lines in Supabase → SQL Editor — they're safe to run on an existing database and won't touch any existing data:

```sql
alter table public.achievements add column if not exists published boolean not null default true;
alter table public.educational  add column if not exists published boolean not null default true;
```

(Running the full `SETUP.sql` again also works — every statement in it is idempotent.)

## 6. Security notes

- The publishable key is safe to ship in client code; it is gated by **Row Level Security**.
- All write access requires an authenticated session; anonymous visitors can only read.
- The visitor counter uses a `SECURITY DEFINER` RPC so anonymous clients can't tamper with the row directly.
- Passwords are managed entirely by Supabase Auth (bcrypt + JWT).

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| "Invalid credentials" on login | Create the user in Supabase → Authentication → Users. |
| Images don't upload | Re-run `SETUP.sql` — the storage bucket / policies may be missing. |
| Gallery empty after upload | Hit refresh once; realtime should auto-update afterwards. |
| 401 / RLS errors in console | Make sure SETUP.sql was run in full on the correct project. |

---

© All Rights Reserved
