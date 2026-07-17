# Together Sports Hub

Session tracking, volunteer logs, coach management and public impact reporting
for Together Sports — one small Node server, one SQLite file, no build step.

## Run it locally

```bash
npm install
npm start          # → http://localhost:3000
```

That's it. The app is fully self-hosted: React, Babel and the brand fonts are
vendored under `public/vendor/`, so it works with no internet connection and
no build tooling.

| Page | URL | Access |
|---|---|---|
| Admin dashboard | `http://localhost:3000/admin.html` (also `/`) | admin password |
| Coach portal | `http://localhost:3000/coach.html` | per-coach access code |
| Outreach HQ (per coach, AI-assisted) | `http://localhost:3000/outreach.html` | per-coach access code |
| Impact Viewer (read-only, full depth) | `http://localhost:3000/viewer.html` | shareable link, admin-issued |
| Public impact page | `http://localhost:3000/impact.html` | open |
| Testimonial form | `http://localhost:3000/submit.html` | open |

The default admin password is `together-sports`. Change it in
**Admin → Settings → Admin password** (stored in the database, takes effect
immediately). The `ADMIN_PASSWORD` environment variable seeds the initial
password and is the recovery fallback — if the changed password is ever
lost, delete the `admin_password` row from the `settings` table in
`data/together.db` and the env var (or default) works again:

```bash
ADMIN_PASSWORD='something-strong' npm start
```

Coach access codes are created in the admin dashboard under
**Manage Coaches → Generate**.

## Where the data lives

Everything is stored in `data/together.db` (SQLite, WAL mode) and uploaded
photos in `data/uploads/`. Back up = copy that folder. The `data/` directory
is gitignored and created on first boot, with chapters, sports and the
starting coach roster seeded automatically.

## Admin dashboard architecture

`public/admin.html` is a static shell that loads a modular React app from
`public/app/` — compiled in the browser by Babel standalone, no bundler:

```
app/data.jsx      API client, auth token, shared helpers
app/ui.jsx        icons + UI primitives (buttons, modals, drawer, toasts)
app/shell.jsx     sidebar, topbar, login screen
app/palette.jsx   ⌘K command palette
app/view_*.jsx    one file per view (overview, sessions, volunteer, …)
app/app.jsx       root: auth gate, data store, routing
```

Files share code through `window.TS`; the design system lives inline in
`admin.html` with additions in `public/outreach.css`.

## Outreach HQ (AI-assisted, per coach)

Every coach gets a chapter-scoped outreach workspace at `/outreach.html`
(they sign in with the same access code as the coach portal):

- **Pipeline** — partners, venues, schools, donors, volunteers and families,
  with stages, touch history, and next-action dates that drive a computed
  follow-up list. Contacts are shared within a chapter so co-coaches
  collaborate; chapters never see each other's pipelines.
- **Events** — clinics, tournaments and fundraisers with goals and plans.
- **AI drafting desk** — Claude drafts intro emails, follow-ups (aware of the
  touch history), event plans and weekly priorities, grounded in the
  chapter's real session numbers. **Drafts only**: the system has no email
  credentials and no send capability by design — coaches copy drafts into
  their own email or messages app.

Turn the AI on by setting one environment variable on the server:

```bash
ANTHROPIC_API_KEY='sk-ant-…' npm start
```

Get a key at https://platform.claude.com. Without the key everything else
works and the AI buttons explain what's missing. Optional:
`ANTHROPIC_MODEL` overrides the default model (`claude-opus-4-8`). AI usage
is rate-limited to 25 drafts per coach per hour.

## Partner Log

**Admin → Partner Log** tracks the schools, businesses, nonprofits, venues
and funders behind the program — type, status (Active / Prospect / Past),
contact person, chapter, start date, and what they provide. Partners with
status Active feed the "active partnerships" metric on the Impact Viewer
(names, types and statuses are shown there; contact details and notes are
not).

## Impact Viewer (shareable, read-only)

For someone outside the coach team — a board member, funder, or a college
counselor — who should see everything the admin dashboard sees but never be
able to change it: Admin → Settings → **Shareable view-only links** → give it
a label and hit **Create link**. That copies a URL like
`/viewer.html?key=…` to the clipboard; send it to them directly.

Opening the link signs them into `/viewer.html`, a read-only **impact
summary**: headline metrics (kids served, dollars raised, chapters, active
partnerships), external validation (family stories), and the full records
behind every number — sessions, participants with parent contacts,
volunteer logs, partners, photos, and the coach roster — with tabs and
search but no create/edit/delete anywhere. No write endpoint on the server
accepts a view key, so the link can never be used to change data. Coach
access codes and partner contact details are never included.

The **dollars raised** figure is entered by hand in Admin → Settings
(Organization card); **partnerships** counts Active partners in the
Partner Log.

Revoke a link any time from the same Settings card — it stops working
immediately, no matter how many people have it.

## Deploying

The repo ships a `Dockerfile` (Node 20 + build tools for `better-sqlite3`)
and `railway.json` configured to build with it. Any host that can run a
Docker container with a persistent volume mounted at `/app/data` works.
