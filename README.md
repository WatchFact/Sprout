# Sprout

A privacy-focused alternative to YouTube, with a 2020-inspired interface, independent Sprout accounts, and randomized discovery. This repository contains the current video site, Music site, and Studio redirect source.

## Projects

| Directory | Application |
| --- | --- |
| Repository root | Sprout video site and Creator Studio (`/studio`) |
| `music/` | Independent Sprout Music application |
| `studio/dist/` | Static redirect to the video site's Creator Studio |

Live sites: [Sprout](https://sproutstream.rectifydata.chatgpt.site), [Music](https://sproutstream-dist.rectifydata.chatgpt.site), [Studio](https://studio-sproutstream.rectifydata.chatgpt.site).

## Development

Use Node.js 22.13 or newer and the exact pnpm version specified in `package.json`.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Run the same commands inside `music/` to work on Music. Each application has its own lockfile, database migrations, and runtime bindings.

```sh
pnpm exec tsc --noEmit
for test in tests/*.cjs; do node "$test" || exit 1; done
pnpm build
```

The clean-checkout execution profile is portable. Managed Sites environments can select their own local execution profile. GitHub Actions checks and builds both applications, then publishes a source release after a successful push to `main`.

## Runtime and deployment

These applications target Cloudflare Workers through Vinext, with D1 (`DB`) and R2 (`BUCKET`) bindings. See `vite.config.ts`, `drizzle/`, and `.openai/hosting.json` for the existing hosting configuration. A standalone deployment must provision its own resources, apply the migrations, configure trusted identity handling, and set its own secrets. Build success alone does not provision a working deployment.

`.dev.vars.example` lists authentication secret names with empty values. Set strong, independently generated secrets through your deployment's secret manager. Do not reuse the test fixtures. Email delivery also requires a configured sender. Sprout's email/password login is separate from the hosting access check.

## Included functionality

- Video publishing, browser-side compression for large uploads, comments, subscriptions, playlists, and an opt-in watch history.
- Randomized discovery without a behavior-based recommendation profile.
- Email/password accounts, parent-account two-factor authentication, recovery codes, account switching, and optional viewing-only parents with brand channels.
- Profile pictures, channel banners, and personalized channel IDs after the subscriber requirement is met.
- Creator Studio, video categories, moderation controls, and authorization checks.
- A separate Music publishing application.

No user database, uploaded videos, account credentials, runtime secrets, dependencies, or generated build caches are included. Existing security review notes and third-party notices are retained in the source. This source snapshot does not promise feature parity with YouTube or a paid moderation service.
