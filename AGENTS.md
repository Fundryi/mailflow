# MailFlow (Fundryi fork)

The owner's fork of maathimself/mailflow: the owner's own self-hosted install, with our changes on top. Origin https://github.com/Fundryi/mailflow, upstream https://github.com/maathimself/mailflow.

Everything below the line `<!-- upstream:CLAUDE.md -->` is upstream's CLAUDE.md, byte for byte. Its rules apply here too; where the two disagree, the fork rules above the marker win.

## Hard rules (owner)

- **Upstream stays mergeable.** Our changes live in their own files (a new file beside the upstream one, or a plugin, see "Core or plugin?" below); touch an upstream file only where a feature must hook in, in the smallest way. Merge on this PC with `git fetch upstream && git merge upstream/main`, never a rebase of pushed history and never GitHub's "Sync fork" button (it merges without our merge driver and offers to discard our commits). Log every merge in docs/UPSTREAM.md.
- **Files upstream owns outright stay untouched:** README.md, sponsors.json and .github/assets/ (upstream's bot rewrites them), the locales/*.json files (upstream edits all twelve per commit; fork strings go in a plugin locale), and package-lock.json (take upstream's version, then `npm install`). A fork migration under backend/migrations/ is numbered 9000 and up so it sorts after every upstream one.
- **Instruction files.** `CLAUDE.md` is the stub (`@AGENTS.md` plus a comment); `.gitattributes` gives it `merge=ours`, so a merge keeps the stub and drops upstream's CLAUDE.md edits on the floor. Those edits are ported by hand: apply upstream's diff to the section below the marker, nowhere else. The fork rules above the marker never change because upstream changed something. `node scripts/upstream.mjs --check` fails while the section differs from the merged upstream CLAUDE.md. If upstream drops CLAUDE.md or adds its own AGENTS.md, stop and redesign this layout by hand.
- **Nothing builds on GitHub.** Actions are disabled on the fork (a repo setting; `--check` asserts it). The workflow files stay exactly as upstream ships them so merges do not conflict; they never run here. Images are built on this PC: `scripts/fork-release.sh` tags the next `v<upstream version>.<n>` on the pushed main and runs `scripts/publish-local.sh`, which pushes the images to ghcr.io/fundryi with the `latest` tag the hub follows. When upstream changes publish.yml, re-diff publish-local.sh against it. Never enable Actions, never add a workflow.
- **CI does not run here, so run it yourself** before every push: `cd backend && npm test && npm run lint && npm run lint:plugins`, then `cd frontend && npm test && npm run lint && npm run build`.

## Upstream check

`mailflow.code-workspace` (gitignored; CLAUDE.local.md says how to open it) starts the task "Upstream: keep up to date", `node scripts/upstream.mjs --watch=60`: every hour it fetches upstream and checks the fork invariants. When upstream is ahead it prints a paste-ready message naming the new commits, the files both sides changed (the likely conflicts), new migrations, and whether CLAUDE.md or a workflow moved; that message and any broken invariant land in VS Code's Problems panel. The merge is then an agent's job, following docs/UPSTREAM.md: merge, resolve, port the CLAUDE.md diff, `--check`, the test and lint commands above, log entry, push.

## Where things are

- `docs/UPSTREAM.md`: the merge log and the post-merge checklist. `scripts/upstream.mjs`: the check. `scripts/fork-release.sh`: tag, build and publish a fork release (uses `scripts/publish-local.sh`).
- Owner-only rules and machine notes (paths, where the install runs, logins, writing style) are imported from the gitignored `CLAUDE.local.md`:

@CLAUDE.local.md

---

<!-- upstream:CLAUDE.md -->

# MailFlow

A self-hosted, unified webmail client. Dual-licensed: AGPL-3.0, plus a paid commercial
license for use that AGPL does not suit. Node/Express backend, React frontend, PostgreSQL
and Redis, shipped as Docker images.

This file is context for coding agents and for anyone new to the project. It says what
MailFlow is for and how to decide what belongs in it. The mechanics live elsewhere and are
linked rather than repeated.

## What this project is for

**The goal is a rock solid unified webmail client.** Everything else is secondary.

Other features are welcome, but not at the expense of that. A change that makes mail sync,
sending or reading less reliable is not worth the feature it buys, however good the feature
is. When a trade-off appears between "more capable" and "more dependable", dependable wins.

Two consequences worth stating plainly, because they are easy to get wrong:

- **Silent degradation is the worst failure mode here.** Mail that quietly stops syncing, or
  a connection that reconnects forever, looks fine from the outside. Prefer a loud failure,
  a warning in the log, or a health check that asserts the invariant, over something that
  limps.
- **Data loss is unacceptable.** IMAP expunge is permanent. Anything that deletes, moves or
  rewrites a user's mail needs to be sure it is acting on the message it thinks it is.

## Priorities

The roadmap lives on the website in a Now / Next / Later format, with no dates and no
commitments: mailflow.sh/#roadmap. It is deliberately kept in one place, so check it there
rather than trusting a copy.

What does not change with it: polish and stability come first. Bug fixes and reliability
work take precedence over new features.

## Core or plugin?

A feature belongs in a **plugin** if it can do its job through the capability surface in
`backend/src/plugins/api.js`. It belongs in **core** only if it genuinely cannot.

This matters because the boundary is what makes review tractable: a plugin cannot reach
core, the database, the network, or another user's data, and `eslint.plugins-boundary.js`
enforces that in CI. So a plugin PR can be reviewed for whether the feature works, rather
than for whether it could compromise the application.

GTD is the reference plugin. See `backend/src/plugins/README.md` for the surface, the rules
and the directory layout. When it is ambiguous, ask rather than guess.

## Layout

| | Path |
|---|---|
| Backend (Express routes, services) | `backend/src/` |
| IMAP engine | `backend/src/services/imapManager.js` |
| Message parsing and sanitizing | `backend/src/services/messageParser.js`, `emailSanitizer.js` |
| Migrations | `backend/migrations/` |
| Frontend (React) | `frontend/src/` |
| Plugins | `backend/src/plugins/<name>/`, `frontend/src/plugins/<name>/` |
| Desktop and mobile shells | `frontend/packages/` |

## Commands

```bash
cd backend
npm test              # vitest
npm run lint          # eslint, zero warnings allowed
npm run lint:plugins  # plugin import boundary, must be 0 violations

cd frontend
npm test              # node --test
npm run lint
npm run build
```

Both suites and both lints must pass. CI runs them on every PR.

## Working on this codebase

- **Write the test that fails without the fix.** Then revert the fix and confirm it fails.
  A test that passes either way is worse than no test, because it looks like coverage.
- **Keep PRs small and focused.** One fix or feature. Follow-ups go in their own PR rather
  than growing the current one.
- **Open an issue before large work** so the approach can be agreed first. A large PR that
  arrives unannounced may be unmergeable no matter how good it is.
- **Match the surrounding code.** Comments are for the reason behind something surprising,
  not for narrating what the code already says.
- **No half-finished implementations** and no feature flags for hypothetical futures.
- Frontend styling is inline `style={{...}}` objects plus a few shared classes in
  `index.css`. Tailwind is configured but is not the prevailing convention.
- Avoid new dependencies on either side without discussing it first.

See `CONTRIBUTING.md` for commit format, branch naming and PR requirements.

## Paths that need maintainer review

`.github/CODEOWNERS` lists them and GitHub requests review automatically. They are the
places where a mistake is expensive, invisible until much later, or both:

- `emailSanitizer.js`, the boundary that stops untrusted mail executing script
- encryption, sessions and the auth routes
- `backend/migrations/`, which run against live user data and are not reversible in practice
- the connection lifecycle in `imapManager.js`: budgets, IDLE, reconnect, health checks
- workflows, the release script, Dockerfiles and compose, which decide what ships to every
  self-hosted install

## Sharp edges

Things that will bite you if you do not know them. `RELIABILITY_REVIEW.md` and
`COUNT_INTEGRITY_DESIGN.md` carry the detail behind the first two.

- **Counts cannot currently detect that the cache is wrong.** MailFlow never asks IMAP
  `STATUS` how many messages a folder holds; every count is derived from its own rows. So
  "the row count matches the folder count" is a tautology, not evidence of a healthy sync,
  and it has already been misread as reassurance while mail was missing. This is a known
  open design problem, not something to solve casually in passing.
- **Defensive code around connections and errors is not redundant.** An unhandled
  EventEmitter error on the PostgreSQL pool or the WebSocket server takes the process down,
  so those listeners matter even though they look inert. LOGOUT is just another queued IMAP
  command and cannot rescue a hung transport, which is why failed connections are
  force-closed instead. Removing any of it because it looks like it does nothing has
  already been a bug.
- **IMAP IDLE is easy to break silently.** `maxIdleTime` controls how long an IDLE lasts;
  `autoIdleDelay` controls whether one starts at all. A sync interval equal to the arming
  delay cancels IDLE forever, and mail still arrives by polling, so nothing looks wrong. A
  health check now asserts that IDLE-capable accounts are actually idling.
- **Mail is not UTF-8.** Header encoded-words declare their own charset, and plenty of
  senders put raw 8-bit bytes in headers. Decode what the message says, not what is
  convenient.
- **There are two email renderers.** The default renders the sanitized body in an iframe; an
  experimental div-based renderer sits behind `VITE_EMAIL_DIV_RENDER`, default false, and
  compiles away when it is off. Anything touching body rendering has to hold for both.
- **The two attachment extension lists disagree.** `backend/src/services/spamRules.js` and
  `frontend/src/utils/attachmentRisk.js` classify overlapping sets differently. Check both
  before changing either.
- **A host with no provider profile is not a host without quirks.** `providerProfile()` in
  `imapManager.js` has entries for google, yahoo, apple, microsoft and purelymail. Everything
  else, Zoho included, falls through to `generic`.
