# Upstream merges

One entry per merge of https://github.com/maathimself/mailflow (remote `upstream`) into this fork. Newest last.

Routine: `git fetch --no-tags upstream`, `git merge upstream/main` (never a rebase of published history, never GitHub's "Sync fork" button). Resolve: our own files keep our version, upstream files take upstream's version unless one of our hooks lives there. Then the checklist, then write here what broke and what was done, then commit and push.

## Checklist after every merge

- `node scripts/upstream.mjs --check` passes (it works mid-merge too): CLAUDE.md is the stub, AGENTS.md below the marker equals the merged upstream CLAUDE.md, Actions still disabled. When it reports a difference, port upstream's diff (`git diff <previous upstream sha> upstream/main -- CLAUDE.md`) into the section, nothing else. If upstream dropped CLAUDE.md or added its own AGENTS.md, stop and redesign the layout by hand.
- `.github/workflows/` is exactly upstream's. Nothing of ours in there. If publish.yml changed, re-diff `scripts/publish-local.sh` against it (build args, tags, images).
- New files under `backend/migrations/`: read them before the next deploy. They run against live mail data and do not roll back.
- `package-lock.json` changed on both sides: take upstream's and run `npm install` in that folder.
- `cd backend && npm test && npm run lint && npm run lint:plugins`, then `cd frontend && npm test && npm run lint && npm run build`.
- Our own changes still hook in:
  - `routes/mail.js` deleteMessage: the non-UIDPLUS branch deletes the row and resyncs Trash (011394c). Upstream's test in `mail.delete.test.js` was extended, so a merge that touches that test needs a look.
  - `imapManager.js` `_fetchSnippetBatch` + the indexer's `parts` state; `messageParser.js` exports `findSnippetPart` (7f9d0a4).

## fork-start, 2026-10-18

- Base: upstream f042cd2. No merge yet; main is upstream/main plus the fork files: AGENTS.md, the CLAUDE.md stub, .gitattributes, the .gitignore block, scripts/upstream.mjs, scripts/publish-local.sh, this log.

## Fork releases

Version is `<merged upstream version>-fork.<n>`. After main is tested and pushed, `scripts/fork-release.sh` (workspace task "Fork: release latest") tags the next number, pushes the tag and publishes both images with `latest`; the hub's stack follows `latest` on its auto-update. No package.json bump (the image gets APP_VERSION from the tag), so upstream's own version bumps merge without conflict. Rollback on the hub: pin the previous fork tag.

- v4.0.1-fork.1 (2026-10-18): upstream f042cd2 plus the two hydroxide fixes above.

## merge upstream c1c4469, 2026-10-19

- One upstream commit, fix(reading) #639, frontend only (MessageBodyView.jsx and its render test). Clean merge, no CLAUDE.md or workflow change, no migrations, our two fixes untouched. Both suites and lints run after the merge. Not released as an image yet.
