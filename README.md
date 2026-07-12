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
| Public impact page | `http://localhost:3000/impact.html` | open |
| Testimonial form | `http://localhost:3000/submit.html` | open |

The default admin password is `together-sports`. Change it by setting the
`ADMIN_PASSWORD` environment variable before starting the server:

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

## Deploying

The repo ships a `Dockerfile` (Node 20 + build tools for `better-sqlite3`)
and `railway.json` configured to build with it. Any host that can run a
Docker container with a persistent volume mounted at `/app/data` works.
