# SkillBridge frontend

React 19, Vite 8, Tailwind CSS 4, React Router and the shared Axios client.

Follow [local setup and operations](../knowledge/LOCAL_SETUP_AND_OPERATIONS.md)
for prerequisites, safe configuration, install/run/check commands, the Windows
npm-launcher workaround and browser-fixture requirements.

Use `npm ci` with the committed lockfile, `npm run lint`, `npm run build` and
`node --test "src/**/*.test.mjs"`. Shared summary tests also read the repository's
`knowledge/fixtures/`; keep the normal repository layout.

Copy `.env.example` only in a fresh checkout. VITE_* values are public browser
configuration; backend service keys and database credentials do not belong here.
