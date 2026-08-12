# MoneyWise AI

A mobile-first, AI-powered personal financial coach. This project is structured so the web app (in `www/`) can be wrapped into **native iOS and Android apps with Capacitor**.

> **Status:** working web MVP. Data is stored locally on-device (no account/backend yet). The AI Coach uses a built-in rule-based engine — see "Wiring the real AI" below before shipping.

## Project structure

```
moneywise-app/
├── www/                     <- web assets (Capacitor webDir)
│   ├── index.html           <- app shell
│   ├── css/style.css        <- all styling
│   ├── js/app.js            <- all app logic + AI coach
│   ├── manifest.webmanifest <- (optional PWA manifest)
│   └── icons/               <- add app icons here
├── capacitor.config.json    <- app id, name, webDir
├── package.json             <- scripts for Capacitor
└── README.md
```

## Run it in the browser (no install)

```bash
npx serve www
# open http://localhost:3000
```

## Build native iOS + Android with Capacitor

Requirements: Node.js 18+, and for native builds **Xcode (macOS, for iOS)** and **Android Studio (for Android)**.

```bash
cd moneywise-app
npm install                 # installs Capacitor CLI & core

# 1) Add the native projects
npx cap add android
npx cap add ios             # only on a Mac

# 2) After any web changes, refresh the native copy
npm run sync                # = npx cap sync

# 3) Open in the native IDE and build/run
npx cap open android
npx cap open ios
```

Then use Android Studio / Xcode to run on a device or emulator, or produce release builds for the Play Store and App Store.

## PWA (optional, installable without the stores)

The `www/manifest.webmanifest` is included. Add a service worker and it can be installed to a phone home screen. (Stores still require the Capacitor route for official distribution.)

## Wiring the AI Coach to a real model

The app ships with a local, offline engine (`js/app.js` → `aiReply()`) so it works with no backend. To use a real LLM, a Node server is included:

- `server.js` — exposes `POST /api/coach`. It takes `{ message, snapshot }`, builds a safety-constrained system prompt, calls the LLM, and returns `{ reply }`.
- The API key is read from **`process.env` only** (see `.env.example`) and **never sent to the app**.
- It uses the OpenAI-compatible chat completions shape, so it works with OpenAI and most compatible providers by setting `LLM_API_URL`.

### Run the real AI coach

```bash
cd moneywise-app
cp .env.example .env      # then edit .env and set LLM_API_KEY
npm install
npm start                # coach API on http://localhost:4000

# in another terminal
npm run serve            # web app on http://localhost:3000
# open the app with ?ai=1 to send questions to the server:
#   http://localhost:3000/?ai=1
```

When `?ai=1` is set, the app `fetch`es `/api/coach` with the user's current finance snapshot (income, expenses, money left, savings, debts, goals, health score). If the server is down or unreachable, it automatically falls back to the built-in local engine and marks the reply accordingly.

> Note: for a device build, point `AI_CONFIG.url` in `www/js/app.js` at your deployed server URL and enable it (or gate it behind a setting/premium flag).

## Adding real accounts & a database

Currently data persists in `localStorage`. For multi-device:
- Add sign-in (Firebase Auth / Supabase Auth / Auth0).
- Move financial data to a database (Supabase, Firebase, PostgreSQL) keyed to the user.
- Keep the local-first UI the same.

## CI/CD (GitHub Actions)

Two workflows live in `.github/workflows/`:

- **`build.yml`** — on push to `main` and on PRs: a **secret-scan guard** fails the run if any signing secret is in the tree; then deploys `www/` to **GitHub Pages** (live URL; enable Settings → Pages → Source: “GitHub Actions”), builds an Android **debug APK**, and compiles iOS (simulator, no signing).
- **`release.yml`** — signed store builds, triggered on a `vX` tag or manual dispatch. On a tag push, a **`bump-versions`** job auto-updates `www/versions.json` `currentVersion` from the tag and commits it (so the live manifest / update prompt moves forward). **Android** → signed release APK + AAB; **iOS** → Fastlane signs & uploads to TestFlight. A **GitHub Release** is published with **APK + AAB + .ipa all in one place** (downloadable binaries + auto release notes).

### Required repo secrets for `release.yml`

| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of your `.jks` release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | keystore store password |
| `ANDROID_KEY_ALIAS` | keystore alias |
| `ANDROID_KEY_PASSWORD` | alias password |
| `APP_STORE_CONNECT_API_ISSUER_ID` | App Store Connect API key issuer ID |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API key ID |
| `APP_STORE_CONNECT_API_KEY` | App Store Connect API key (P8) |
| `MATCH_GIT_URL` | private git repo hosting certs/profiles (fastlane match) |
| `MATCH_PASSWORD` | passphrase for the match repo |

Add these under **Settings → Secrets and variables → Actions**. Never commit the keystore, `signing.properties`, or any API key.

### Update prompts (`versions.json`)

The app checks for a newer version at `/versions.json` on startup and shows an “Update available” modal when the live version is newer than the installed one. It keeps a `currentVersion`, `message`, release-notes URL, and per-platform download links. A dismissed version is remembered (no re-nag until an even newer release).

- The manifest lives at **`www/versions.json`** (served at `https://<your-site>/versions.json`, so Pages deploys it automatically).
- Bump **`APP_VERSION`** in `www/js/app.js` **and** `currentVersion` in `www/versions.json` when cutting a release.
- For native builds, set **`UPDATE_MANIFEST_URL`** in `app.js` to the hosted URL (there’s no server origin inside a Capacitor app).

### Guarding against accidental secret commits

- `.gitignore` already excludes `*.jks`, `*.keystore`, `*.p12`, `*.p8`, `*.mobileprovision`, and `signing.properties`.
- A zero-dependency pre-commit hook in `.githooks/pre-commit` refuses any commit that stages a signing secret (works even for `git add -f`). Enable it once from the repo root:

  ```bash
  git config core.hooksPath .githooks
  chmod +x .githooks/pre-commit
  ```

  Alternatively, for the `pre-commit` framework, add this to your root `.pre-commit-config.yaml`:

  ```yaml
  repos:
    - repo: local
      hooks:
        - id: no-signing-secrets
          name: block signing secrets
          entry: bash .githooks/pre-commit
          language: system
          stages: [pre-commit]
  ```

## Feature map (MVP implemented)

- Onboarding (4 steps) · Home dashboard + Financial Health score
- Budget (11 categories + AI analysis) · Goals (progress + AI)
- **AI Coach** (conversational, uses your numbers)
- Can I Afford It? · Debt Payoff (Snowball/Avalanche simulation)
- Savings Calculator · Make More Money · Premium (Pro) screen
- Notifications toggles · Edit / Reset / Delete data · Sample data loader

**Disclaimer:** MoneyWise AI provides educational information and estimates, not professional financial advice.
