# Upstream merges

One entry per merge of https://github.com/maathimself/mailflow (remote `upstream`) into this fork. Newest last.

Routine: `git fetch --no-tags upstream`, `git merge upstream/main` (never a rebase of published history, never GitHub's "Sync fork" button). Resolve: our own files keep our version, upstream files take upstream's version unless one of our hooks lives there. Then the checklist, then write here what broke and what was done, then commit and push.

## Checklist after every merge

- `node scripts/upstream.mjs --check` passes (it works mid-merge too): CLAUDE.md is the stub, AGENTS.md below the marker equals the merged upstream CLAUDE.md, Actions still disabled. When it reports a difference, port upstream's diff (`git diff <previous upstream sha> upstream/main -- CLAUDE.md`) into the section, nothing else. If upstream dropped CLAUDE.md or added its own AGENTS.md, stop and redesign the layout by hand.
- `.github/workflows/` is exactly upstream's. Nothing of ours in there. If publish.yml changed, re-diff `scripts/publish-local.sh` against it (build args, tags, images).
- New files under `backend/migrations/`: read them before the next deploy. They run against live mail data and do not roll back.
- `package-lock.json` changed on both sides: take upstream's and run `npm install` in that folder.
- `cd backend && npm test && npm run lint && npm run lint:plugins`, then `cd frontend && npm test && npm run lint && npm run build`.
- Our own changes still hook in. (List them here as they appear.)

## fork-start, 2026-10-18

- Base: upstream f042cd2. No merge yet; main is upstream/main plus the fork files: AGENTS.md, the CLAUDE.md stub, .gitattributes, the .gitignore block, scripts/upstream.mjs, scripts/publish-local.sh, this log.
