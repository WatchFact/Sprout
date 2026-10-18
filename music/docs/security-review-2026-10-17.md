# Security review — 17 October 2026

Scope: Video and Music source, independent Sprout authentication and parent/brand isolation, owner/moderator permissions, media access, JSON/binary inputs, reporting, browser headers and dependency audits. Tests use the real route/crypto code with in-memory SQLite, mocked cookies/storage and server-rendered UI. No attack traffic was sent to other users and no production records were changed by the tests. This is a targeted source review, not an independent penetration test or proof that every vulnerability is absent. Browser interaction/visual QA was unavailable in this environment.

## Reproduced and fixed

| Finding | Fix and regression evidence |
| --- | --- |
| Sign-out mutated authentication state on GET | GET returns 405; forms submit same-origin POST. Tests prove GET/cross-origin POST preserve the session and valid POST revokes it. Sign-out also revokes its stored second-factor token. |
| JSON was parsed before any input-size bound | Shared streaming byte limits reject oversized requests before accumulation; JSON must be an object. Auth uses 4 KB; general JSON uses 32 KB. Malformed, scalar, array, chunked-oversize and cross-site metadata tests pass. |
| Binary size validation trusted a declared length | Streaming byte validation enforces the declared length and hard cap; rejected writes remove the object. Cloudflare FixedLengthStream preserves R2's known-length requirement without buffering large media. Tests cover successful uploads, false/truncated lengths, caption success and oversized captions. |
| Stale owner updates could restore old credentials | Suspension patches only suspension/version JSON fields. Credential changes use a compare-and-swap transaction. Tests change hashes/recovery/email between read and save and prove newer values survive. |
| Disabling 2FA could leave earlier app sessions usable | Disabling rotates the parent credential version, deletes all old app/second-factor sessions and issues only a fresh current app session. Setup is capped at 3 requests per 5 minutes. Old-token and throttle tests pass. |
| Comment names trusted the request | Author names come from the active channel's stored profile, with a server-derived fallback. A forged site-owner name is ignored. |
| Report records could be resubmitted/reset and were weakly bounded | Targets must exist and be visible to the reporter; repeated record IDs return 409, generic deletion is blocked, existing moderation state cannot be replaced on conflict. Limit is 5 per hour per parent across brands. Tests preserve resolved reports and enforce caps. |
| Private-video history writes revealed existence | Writes require a published, accessible video; other accounts receive 404 for private/draft targets. |
| Browser hardening incomplete | Added HTTPS Strict-Transport-Security, same-origin resource policy, and CSP frame ancestors restricted to this origin and ChatGPT. Existing no-referrer, nosniff, permission restrictions, same-origin assets and no-store account responses remain. |

The auth suite also checks password/recovery/session rotation, independent hosting/app identities, 2FA parent enforcement and replay resistance, owner-only administration, cross-account isolation and safe email sign-in. The moderation, profile, routing and qualified-view regression suites pass.

## Dependencies

Next.js is pinned to 16.3.8; React, React DOM and React Server DOM are aligned at 19.2.8; Vite is pinned to 8.0.16. Vulnerable transitive versions are overridden in the active pnpm workspace configuration and locked. A critical Next.js dependency advisory was present initially; the referenced Node ImageResponse/SVG path is not used by this application, so that flag alone was not evidence of exploitation. React Server DOM was checked even though the package manager labels it development, because bundling can carry framework code into a deployed Worker.

Final locked production audit: 0 advisories. Full dependency audit including build tools: 1 high advisory remains for `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm), for which the registry reports no patched version. It is pulled through fast-glob/micromatch in ESLint and Vinext common-JS build tooling. Application routes do not pass uploaded/user strings into these build glob parsers. Build only trusted project sources/patterns; do not treat an untrusted project build as isolated by these tools. A future upstream fix is still needed. Audits measure known advisory matches, not overall site safety.

Commands: `pnpm audit --prod --json`, `pnpm audit --json`, `npx tsc --noEmit`, `node tests/security-review.cjs`, `node tests/sprout-auth.cjs`, `node tests/email-login.cjs`, `node tests/account-security.cjs`, and (Video) `node tests/studio.cjs`. Both production builds must pass before deployment.

References: OWASP CSRF and File Upload Prevention cheat sheets; Cloudflare Workers TransformStream/FixedLengthStream documentation; advisories GHSA-vcvr-r3jv-pc5j (Next.js), GHSA-wx67-qw84-cm4g (React Server DOM), GHSA-vfj7-8cjw-p6xm (braces).

## CSS/privacy

Only useful scoped pieces of the supplied November 2020 CSS are adapted. The global link/div hiding rules, consent suppression and external font requests are omitted. Roboto v20 is self-hosted with its Apache 2.0 licence; YT Sans is not included. See archive-2020-css.md.

## Remaining limits

- CSP still permits inline scripts/styles required by the current framework; this is not a nonce-based strict CSP.
- No paid AI moderation, malware scanning or production load/DDoS test was added. Existing Cloudflare hosting is retained; this review does not establish custom WAF rules or a security guarantee.
- Email delivery still needs an independently configured sender. 2FA does not verify ownership of the contact email.
- Runtime encryption/password secrets are preserved; replacing them would break existing credentials. This release does not reset user data.
