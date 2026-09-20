#!/usr/bin/env node
/**
 * Symlinks `platform-core/frontend/node_modules` -> this project's own
 * `node_modules`, so files under the platform-core git submodule resolve
 * bare imports (react, react-router-dom, @tanstack/react-query, ...) to the
 * EXACT SAME installed copy this app uses.
 *
 * Why this matters: GoalNexa imports platform-core's frontend source files
 * directly (`main.tsx` imports `App`/`registerOrgScopedEntity` from
 * `../platform-core/frontend/src/...` — "consume in place", see
 * README.md). Node/Vite's module resolution for a bare specifier walks UP
 * the directory tree from the importing FILE's own location looking for a
 * `node_modules` folder — starting from `platform-core/frontend/src/...`,
 * that walk would find `platform-core/frontend/node_modules` (if it
 * existed) or `platform-core/node_modules`, NEITHER of which is an
 * ancestor of `frontend/node_modules` (they're siblings under the repo
 * root). Without this symlink, npm-installing platform-core/frontend
 * separately would give React two independent copies loaded into the same
 * page — the classic "Invalid hook call" / duplicate-React-instance crash,
 * since React's hooks require every component in the tree to share one
 * React module instance.
 *
 * Runs as this project's own `postinstall` (see package.json) — every
 * `npm install` in `frontend/` re-creates the symlink, so it can't go
 * stale after a dependency change.
 *
 * The symlink is created RELATIVE (`../../frontend/node_modules`), not
 * absolute — this bit a real bug during development: this same script also
 * runs inside the docker-compose frontend container's own `npm install`,
 * where an absolute target (`/app/frontend/node_modules`, correct from
 * INSIDE that container) got written into the bind-mounted host checkout
 * verbatim, leaving a symlink on the HOST pointing at a path that only
 * exists inside a container — dangling the moment anything ran against the
 * checkout outside Docker. A relative target resolves correctly from
 * wherever it's read: the container's `/app/platform-core/frontend/
 * node_modules` and the host's `.../platform-core/frontend/node_modules`
 * sit at the same relative depth from their respective `frontend/
 * node_modules`, so one relative link is correct in both places at once.
 */
import { existsSync, lstatSync, readdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(frontendDir, "..");
const platformCoreFrontend = join(repoRoot, "apps", "platform-core", "frontend");
const target = join(frontendDir, "node_modules");
const linkPath = join(platformCoreFrontend, "node_modules");
const relativeTarget = relative(platformCoreFrontend, target);

function warn(message) {
  console.warn(`[link-platform-core-node-modules] ${message}`);
}

if (!existsSync(platformCoreFrontend)) {
  warn(`${platformCoreFrontend} not found - is the platform-core submodule initialized ` + `(git submodule update --init)? Skipping.`);
  process.exit(0);
}

if (!existsSync(target)) {
  warn(`${target} not found - this project's own npm install may not have finished yet. Skipping.`);
  process.exit(0);
}

try {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    // NOT rmSync here: it refuses a symlink whose TARGET is a directory
    // ("Path is a directory") unless given `recursive: true`, even though
    // removing a symlink itself is never actually recursive - unlinkSync is
    // the call that means "remove this link entry, don't follow it". A
    // silent bug lived here during development: the old `rmSync(linkPath,
    // { force: true })` threw exactly that error, which the catch below
    // swallowed as "didn't exist yet", leaving the stale symlink in place
    // and making the symlinkSync below fail with EEXIST every subsequent
    // run.
    unlinkSync(linkPath);
  } else if (stat.isDirectory() && readdirSync(linkPath).length === 0) {
    // The empty-directory case is the docker-compose dev setup: a named
    // volume mounted at this exact path so the symlink this script creates
    // never touches the HOST's platform-core checkout (a bind-mounted
    // symlink pointing at a container-internal path like /app/frontend/
    // node_modules would dangle the moment you ran this outside Docker).
    // Docker creates that mount point as an empty real directory, not a
    // symlink, so it needs this separate check rather than being treated
    // as "a real, separately-installed node_modules" below.
    rmSync(linkPath, { recursive: true, force: true });
  } else {
    warn(`${linkPath} already exists and is not a symlink or an empty directory - leaving it alone. ` + `Remove it manually if you want this script to manage it (a real, separately-installed ` + `node_modules there would cause a duplicate-React-instance crash).`);
    process.exit(0);
  }
} catch (error) {
  // ENOENT (doesn't exist yet) is the only expected failure here - anything
  // else (e.g. a permissions error) should surface loudly rather than be
  // silently treated as "nothing to remove," which is exactly the shape of
  // bug this file's own header now warns about for the unlinkSync/rmSync
  // choice above.
  if (error.code !== "ENOENT") {
    throw error;
  }
}

symlinkSync(relativeTarget, linkPath, "dir");
console.log(`[link-platform-core-node-modules] linked ${linkPath} -> ${relativeTarget} (relative)`);
