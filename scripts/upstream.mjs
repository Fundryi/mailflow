#!/usr/bin/env node
// Fork upkeep: is upstream ahead, and do the fork's invariants still hold? Design: AGENTS.md "Upstream check".
// Usage: node scripts/upstream.mjs [--check] [--watch[=minutes]]
//   (none)   fetch upstream, report what is ahead, check the invariants; exit 1 when one fails
//   --check  no fetch: invariants only (run after a merge)
//   --watch  report now and every N minutes (default 60); never exits
// Lines of the form "<file>:<line>: <message>" feed the problem matcher in mailflow.code-workspace, so
// the nag shows up in VS Code's Problems panel; "[upstream] round start/done" bracket one round for it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = "https://github.com/maathimself/mailflow.git";
const REPO = "Fundryi/mailflow";
const MARKER = "<!-- upstream:CLAUDE.md -->";
const STUB = "@AGENTS.md\n\n<!-- Project rules live in AGENTS.md. Do not add rules here. -->";

// A hung git or gh call must not freeze the watcher for good, and a credential prompt has nobody to answer it.
const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5 * 60_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
const git = (...args) => run("git", args);
const ok = (...args) => {
  try {
    git(...args);
    return true;
  } catch {
    return false;
  }
};
const lines = (text) => text.split("\n").filter(Boolean);
// core.autocrlf=true: the working tree is CRLF, git objects are LF. Compare both as LF.
const lf = (text) => text.replace(/\r\n/g, "\n");
const read = (file) => lf(readFileSync(join(root, file), "utf8"));
const time = () => new Date().toLocaleTimeString();
const errorText = (error) => error.stderr?.toString().trim() || error.message;
// Our release tags use upstream's vX.Y.Z scheme; fetching their tags would clobber ours and fail the round.
const fetch = () => git("fetch", "-q", "--no-tags", "upstream");

// Local state a fresh clone does not have; set it rather than fail on it.
function ensureLocalSetup() {
  if (!lines(git("remote")).includes("upstream")) git("remote", "add", "upstream", UPSTREAM);
  // So a hand-typed `git fetch upstream` cannot clobber our vX.Y.Z tags with theirs either.
  if (!ok("config", "--get", "remote.upstream.tagOpt")) git("config", "remote.upstream.tagOpt", "--no-tags");
  if (!ok("rev-parse", "-q", "--verify", "upstream/main")) fetch();
  if (!ok("config", "--get", "merge.ours.driver")) git("config", "merge.ours.driver", "true");
}

// The upstream commit whose CLAUDE.md the fork has taken in. During an uncommitted merge HEAD is still the
// old commit, so MERGE_HEAD counts too; the newer of the two merge bases is the one to compare against.
function upstreamBase() {
  const heads = ok("rev-parse", "-q", "--verify", "MERGE_HEAD") ? ["HEAD", "MERGE_HEAD"] : ["HEAD"];
  let base = null;
  for (const head of heads) {
    const candidate = git("merge-base", head, "upstream/main");
    if (!base || ok("merge-base", "--is-ancestor", base, candidate)) base = candidate;
  }
  return base;
}

function invariants() {
  const problems = [];
  if (read("CLAUDE.md").trim() !== STUB) problems.push("CLAUDE.md:1: CLAUDE.md is not the stub (AGENTS.md: Instruction files)");

  const base = upstreamBase();
  let theirs = null;
  try {
    theirs = lf(git("show", `${base}:CLAUDE.md`)).trim();
  } catch {
    problems.push(`AGENTS.md:1: upstream has no CLAUDE.md at ${base.slice(0, 12)}: the instruction-file layout needs a redesign by hand`);
  }
  const agents = read("AGENTS.md");
  const at = agents.indexOf(`\n${MARKER}\n`);
  if (at < 0) problems.push(`AGENTS.md:1: no "${MARKER}" line`);
  else if (theirs !== null) {
    const ours = agents.slice(at + MARKER.length + 2).trim();
    if (ours !== theirs) {
      const a = ours.split("\n");
      const b = theirs.split("\n");
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      const line = agents.slice(0, at + 1).split("\n").length + 1 + i;
      problems.push(
        `AGENTS.md:${line}: section below the marker differs from upstream CLAUDE.md at ${base.slice(0, 12)}` +
          ` (ours: ${JSON.stringify(a[i] ?? "<end>")}, upstream: ${JSON.stringify(b[i] ?? "<end>")}). Port upstream's diff there.`,
      );
    }
  }

  try {
    const perms = JSON.parse(run("gh", ["api", `repos/${REPO}/actions/permissions`]));
    if (perms.enabled) problems.push(`AGENTS.md:1: GitHub Actions are enabled on ${REPO}: gh api -X PUT repos/${REPO}/actions/permissions -F enabled=false`);
  } catch (error) {
    problems.push(`AGENTS.md:1: Actions check could not run (gh): ${errorText(error)}`);
  }
  return problems;
}

function report() {
  fetch();
  const behind = Number(git("rev-list", "--count", "HEAD..upstream/main"));
  if (!behind) return console.log(`${time()} Up to date with upstream/main.`);

  const base = git("merge-base", "HEAD", "upstream/main");
  const theirs = lines(git("diff", "--name-only", base, "upstream/main"));
  const ours = new Set(lines(git("diff", "--name-only", base, "HEAD")));
  // CLAUDE.md is on both sides by design; merge=ours handles it and the notes say to port it.
  const both = theirs.filter((file) => ours.has(file) && file !== "CLAUDE.md");
  const notes = [];
  if (theirs.includes("CLAUDE.md")) notes.push("upstream changed CLAUDE.md: port that diff into AGENTS.md below the marker");
  const workflows = theirs.filter((file) => file.startsWith(".github/workflows/"));
  if (workflows.length) notes.push(`workflows changed (${workflows.join(", ")}): take upstream's version, they never run here`);
  if (theirs.includes(".github/workflows/publish.yml")) notes.push("publish.yml changed: re-diff scripts/publish-local.sh against it");
  const migrations = theirs.filter((file) => file.startsWith("backend/migrations/"));
  if (migrations.length) notes.push(`migrations: ${migrations.join(", ")} (run against live mail data, read them before the next deploy)`);
  if (both.length) notes.push(`changed on both sides (possible conflicts): ${both.join(", ")}`);

  console.log(`\n${time()} upstream/main is ${behind} commit(s) ahead of HEAD:`);
  console.log(git("log", "--oneline", "--no-decorate", "-20", "HEAD..upstream/main") + (behind > 20 ? "\n  ..." : ""));
  console.log(
    `\nPaste the next line to the AI:\ndocs/UPSTREAM.md:1: Upstream mailflow is ${behind} commit(s) ahead. Merge it following docs/UPSTREAM.md: git merge upstream/main, resolve, port the CLAUDE.md diff into AGENTS.md if any, node scripts/upstream.mjs --check, both test suites and lints, then the log entry.` +
      (notes.length ? ` Notes: ${notes.join("; ")}.` : "") +
      "\n",
  );
}

function round(doFetch) {
  console.log("[upstream] round start");
  let problems = [];
  try {
    ensureLocalSetup();
    if (doFetch) report();
    problems = invariants();
  } catch (error) {
    problems.push(`AGENTS.md:1: upstream check failed: ${errorText(error)}`);
  }
  for (const problem of problems) console.log(problem);
  console.log("[upstream] round done");
  return problems.length === 0;
}

const watchArg = process.argv.find((arg) => arg.startsWith("--watch"));
if (watchArg) {
  const minutes = Number(watchArg.split("=")[1] ?? 60);
  if (!(minutes >= 1 && minutes <= 24 * 60)) throw new Error("--watch needs a number of minutes from 1 to 1440");
  // A failed round (offline, GitHub down) is reported and retried next round, never fatal.
  round(true);
  setInterval(() => round(true), minutes * 60_000);
} else if (!round(!process.argv.includes("--check"))) {
  process.exitCode = 1;
}
