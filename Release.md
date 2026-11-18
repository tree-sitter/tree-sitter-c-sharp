# Releasing tree-sitter-c-sharp

Pushing a tag publishes the release. Published versions cannot be reused, so do the checks below **before** you push it.

## Quick checklist

- [ ] [Publishing prerequisites](#1-check-the-publishing-prerequisites) still hold
- [ ] CI is green on `master`
- [ ] Version chosen and bumped through a PR
- [ ] PR merged and `master` shows the new version
- [ ] Tag pushed
- [ ] Every job in the publish run passed
- [ ] [Checksums](#7-verify-what-was-published) and [install tests](#8-test-the-published-packages) passed
- [ ] GitHub release notes written
- [ ] Fixed issues closed

## What a tag publishes

`.github/workflows/publish.yml` runs on **any** tag and calls the shared workflows in [tree-sitter/workflows](https://github.com/tree-sitter/workflows). It first checks that the tag matches the version in `Cargo.toml`, `package.json`, `pyproject.toml` and `tree-sitter.json`, and publishes nothing if any differ.

| Target | What is published | Credential |
|---|---|---|
| GitHub Releases | `tree-sitter-c-sharp.tar.gz` and `tree-sitter-c_sharp.wasm`, with attestations | Built-in token |
| npm | Package with 6 prebuilt binaries and the Wasm file | `NPM_TOKEN` (repo secret) |
| crates.io | Rust crate | `CARGO_REGISTRY_TOKEN` (org secret) |
| PyPI | 8 wheels and a source package | `PYPI_API_TOKEN` (org secret) |
| Go, Swift | Nothing to upload. Consumers use the tag | None |

NuGet is not part of the release.

This repo has several git remotes, so the `gh` commands below pass `-R` explicitly.

```bash
REPO=tree-sitter/tree-sitter-c-sharp
PKG=tree-sitter-c-sharp
VERSION=0.0.0   # the version being released, without the leading v
```

## 1. Check the publishing prerequisites

These are the things that broke the 0.24.0 release.

**Repository variables.** The org still sets `NODE_VERSION=20` and `PYTHON_VERSION=3.8`, which no longer work, so this repo overrides them.

```bash
gh variable list -R "$REPO"
```

Expect `NODE_VERSION` to be 24 and `PYTHON_VERSION` to be 3.11.

- Node 20 and 22 ship a `node-gyp` that cannot find Visual Studio 2026 on the Windows ARM runner.
- Python 3.8 is not available on Ubuntu 26.04, which `ubuntu-latest` now uses.

**Node binding.** `package-lock.json` must pin the `tree-sitter` Node binding at 0.25.1 or later. Version 0.25.0 compiles as C++17, and Node 24's headers need C++20.

```bash
git show origin/master:package-lock.json | grep -A1 '"node_modules/tree-sitter": {'
```

**npm token.** `NPM_TOKEN` must be a granular token with read and write access to `tree-sitter-c-sharp` and two-factor bypass turned on. Without the bypass, `npm publish` fails with `EOTP`, after all the builds have passed.

npm limits how long write tokens last, so check the token's expiry on npmjs.com. GitHub only shows when the secret was last changed:

```bash
gh secret list -R "$REPO"
```

To replace it, create the token on npmjs.com and run `gh secret set NPM_TOKEN -R "$REPO"`, which prompts for the value.

**Tree-sitter CLI.** npm builds with the CLI version in `package-lock.json`. GitHub, crates.io and PyPI regenerate the parser with the **latest** CLI release. If these differ, update this repo first, or the packages may be generated differently.

```bash
gh release view -R tree-sitter/tree-sitter --json tagName --jq .tagName
npx tree-sitter --version
```

## 2. Choose the version

This project is on 0.x:

- **Minor** (0.24.0 to 0.25.0): new node types or fields, or existing code parsing to a different tree. Either can break downstream queries.
- **Patch** (0.24.0 to 0.24.1): anything else.

See what changed since the last release:

```bash
LAST=$(git describe --tags --abbrev=0 origin/master)
LAST_VERSION=${LAST#v}
git log "$LAST..origin/master" --oneline
git diff --stat "$LAST" origin/master -- src/node-types.json queries
```

## 3. Check master

```bash
git switch master
git pull
npm ci
npx tree-sitter generate
git diff --exit-code -- src
npx tree-sitter test
cargo test
gh run list -R "$REPO" --branch master --limit 5
```

`generate` must leave `src/` unchanged, and the latest CI run on `master` must have passed.

## 4. Bump the version

```bash
git switch -c "release-$VERSION"
npx tree-sitter version "$VERSION"
npm install --package-lock-only --ignore-scripts
cargo update -p tree-sitter-c-sharp
npx tree-sitter generate
git status --short
```

Exactly these nine files should change:

`CMakeLists.txt`, `Cargo.lock`, `Cargo.toml`, `Makefile`, `package-lock.json`, `package.json`, `pyproject.toml`, `src/parser.c` and `tree-sitter.json`.

The `src/parser.c` diff should be only the three version numbers in its metadata. Search for the old version too. A match on `go-tree-sitter` in `go.mod` or `go.sum` is a separate dependency, so leave it alone.

```bash
git grep -nF "$LAST_VERSION" -- . ':!examples'
```

Commit with the version as the message, for example `0.25.0`, open a PR with the same title, and merge it once CI passes.

`master` requires a linear history, so merge by squash or rebase.

## 5. Tag the release

Pushing the tag is the step that publishes, and it cannot be undone.

```bash
git fetch origin
git show origin/master:package.json | grep '"version"'
git tag -a "v$VERSION" -m "Release v$VERSION" origin/master
git push origin "v$VERSION"
```

## 6. Watch the publish run

```bash
gh run list -R "$REPO" --workflow publish.yml --limit 1
gh run view <run-id> -R "$REPO"
```

The run takes roughly 20 minutes, and Windows ARM is usually the slowest build.

**A passing publish job does not prove the package is complete:**

- The PyPI source package build may fail while the wheels still publish.
- The npm Wasm build may fail while the package still publishes without it.

Read every job's result, then run the checks in step 7.

If a job failed, see [When something fails](#when-something-fails).

## 7. Verify what was published

This downloads every published file and compares it with the checksum its registry reports. It needs `gh`, `curl`, `node`, `tar`, `sha1sum` and `sha256sum`. Every line should start with `ok`.

```bash
cd "$(mktemp -d)" || exit 1
json() { node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log($1)"; }
check() { if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1: expected $2, got $3"; fi; }
sum() { "$1" "$2" | cut -d' ' -f1; }

# npm
want=$(curl -fsSL "https://registry.npmjs.org/$PKG/$VERSION?nocache=$(date +%s)" | json 'd.dist.shasum')
curl -fsSL -o npm.tgz "https://registry.npmjs.org/$PKG/-/$PKG-$VERSION.tgz?nocache=$(date +%s)"
check "npm tarball" "$want" "$(sum sha1sum npm.tgz)"
check "npm prebuilds" 6 "$(tar -tzf npm.tgz | grep -c '^package/prebuilds/.*\.node$')"
check "npm wasm" 1 "$(tar -tzf npm.tgz | grep -c '^package/.*\.wasm$')"
check "npm latest tag" "$VERSION" "$(curl -fsSL "https://registry.npmjs.org/-/package/$PKG/dist-tags?nocache=$(date +%s)" | json 'd.latest')"

# crates.io
want=$(curl -fsSL -A release-check "https://crates.io/api/v1/crates/$PKG/$VERSION" | json 'd.version.checksum')
curl -fsSL -o crate.crate "https://static.crates.io/crates/$PKG/$PKG-$VERSION.crate"
check "crate" "$want" "$(sum sha256sum crate.crate)"

# PyPI
curl -fsSL "https://pypi.org/pypi/$PKG/$VERSION/json?nocache=$(date +%s)" > pypi.json
json 'd.urls.map(u=>[u.digests.sha256,u.filename,u.url].join(" ")).join("\n")' < pypi.json > pypi.txt
while read -r want name url; do
  curl -fsSL -o "$name" "$url"
  check "pypi $name" "$want" "$(sum sha256sum "$name")"
done < pypi.txt
check "pypi wheels" 8 "$(grep -c '\.whl ' pypi.txt)"
check "pypi source package" 1 "$(grep -c '\.tar\.gz ' pypi.txt)"

# GitHub release
gh release download "v$VERSION" -R "$REPO" -D github
gh api "repos/$REPO/releases/tags/v$VERSION" --jq '.assets[] | "\(.digest) \(.name)"' > github.txt
while read -r want name; do
  check "github $name" "${want#sha256:}" "$(sum sha256sum "github/$name")"
  gh attestation verify "github/$name" -R "$REPO" --signer-repo tree-sitter/workflows >/dev/null 2>&1 \
    && echo "ok    attestation $name" || echo "FAIL  attestation $name"
done < github.txt
```

The attestation check needs `--signer-repo` because the shared workflow, not this repo, signs the files.

Registries can take several minutes to catch up. See [Registry delays](#registry-delays) before treating a 404 as a failure.

## 8. Test the published packages

Each test installs the release from its registry and parses some C#. Each should print `compilation_unit ok`.

**npm**

```bash
cd "$(mktemp -d)" || exit 1
npm init -y >/dev/null
npm i --no-audit --no-fund tree-sitter "tree-sitter-c-sharp@$VERSION"
cat > smoke.mjs <<'EOF'
import Parser from 'tree-sitter';
import CSharp from 'tree-sitter-c-sharp';
const parser = new Parser();
parser.setLanguage(CSharp);
const { rootNode } = parser.parse('class C { int M() => 1; }');
console.log(rootNode.type, rootNode.hasError ? 'has errors' : 'ok');
EOF
node --no-deprecation smoke.mjs
```

**PyPI**

```bash
cd "$(mktemp -d)" || exit 1
python -m venv .venv
PY=.venv/bin/python; [ -x "$PY" ] || PY=.venv/Scripts/python
"$PY" -m pip install -q 'tree-sitter>=0.25' "tree-sitter-c-sharp==$VERSION"
"$PY" -c "
import tree_sitter, tree_sitter_c_sharp
parser = tree_sitter.Parser(tree_sitter.Language(tree_sitter_c_sharp.language()))
root = parser.parse(b'class C { int M() => 1; }').root_node
print(root.type, 'has errors' if root.has_error else 'ok')"
```

**crates.io**

```bash
cd "$(mktemp -d)" || exit 1
cargo new -q smoke && cd smoke || exit 1
cargo add -q tree-sitter "tree-sitter-c-sharp@$VERSION"
cat > src/main.rs <<'EOF'
fn main() {
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&tree_sitter_c_sharp::LANGUAGE.into()).unwrap();
    let tree = parser.parse("class C { int M() => 1; }", None).unwrap();
    let root = tree.root_node();
    println!("{} {}", root.kind(), if root.has_error() { "has errors" } else { "ok" });
}
EOF
cargo run -q
```

## 9. Finish the release

**Release notes.** The workflow creates the release with a one-line note about the source tarball. Keep that line and add:

- New language support
- Parsing fixes, with PR numbers
- Other notable changes
- Upgrade notes: tree shape changes, new node types and fields, and changed dependency requirements

```bash
gh release edit "v$VERSION" -R "$REPO" --notes-file notes.md
```

**Issues.** Close issues whose fixes shipped in this release, with a note naming the fixing PR and the version. Check each one against the released parser first. A corpus test is a quick way to do that.

**Prerequisites.** If anything in step 1 turned out wrong, update this file.

## When something fails

Publish jobs are independent, so one registry failing does not stop the others. Re-run only what failed:

```bash
gh run rerun <run-id> -R "$REPO" --failed
```

A re-run:

- uses the **tagged commit**, so it cannot pick up a fix made to the repo afterwards
- does pick up changed repository variables and secrets
- reuses the output of jobs that already passed, while their artifacts last (2 days)

Re-running PyPI after a partial publish is safe. It re-uploaded the identical wheels without error and added the missing source package.

| Symptom | Cause | Fix |
|---|---|---|
| `npm error code EOTP` | `NPM_TOKEN` cannot bypass two-factor authentication | Replace the token, then re-run |
| `could not find a version of Visual Studio` | Node version's `node-gyp` is too old | Set `NODE_VERSION=24`, then re-run |
| `unknown type name 'concept'` while building `tree-sitter` | Node binding too old for Node 24 | Update the lockfile. This needs a new commit, see below |
| `version '3.8' ... was not found` | `PYTHON_VERSION` is too old | Set `PYTHON_VERSION=3.11`, then re-run |
| One npm build fails and others show cancelled | The build matrix stops at the first failure | Fix the failed build. The cancelled ones are not separate problems |
| npm publish skipped | A build failed | Fix the build, then re-run |

### If the tag itself cannot build

When the fix needs a change to the repo, you have two options.

**Release a new patch version.** This is the simplest route and keeps all registries on one version. It leaves the failed version unpublished on some of them.

**Publish the missing registry from a temporary branch.** We did this for npm 0.24.0. The package version stays the same, but it is built from a commit that differs from the tag, so keep the change to files that are not in the package.

1. Branch from the tag: `git switch -c npm-publish-$VERSION v$VERSION`
2. Apply the fix.
3. Add `.github/workflows/npm-publish.yml`, replacing `<branch>` with the branch name:

   ```yaml
   name: Publish npm
   on:
     push:
       branches: [<branch>]
   permissions:
     contents: read
   jobs:
     npm:
       uses: tree-sitter/workflows/.github/workflows/package-npm.yml@main
       secrets:
         NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
       with:
         generate: true
   ```

4. Commit and push. Pushing **publishes**, provided every build passes. To test first, push a copy of the build jobs from the shared workflow without its publish job.
5. Run the checks in steps 7 and 8, then delete the branch.

Pushing workflow files needs the `workflow` scope: `gh auth refresh -h github.com -s workflow`.

### Registry delays

- **npm:** the version can take several minutes to appear after a successful publish. A request made too early can leave a 404 cached for up to 5 minutes, so `npm install` keeps failing after the file exists. Adding a query string such as `?nocache=1` to the URL bypasses that cache.
- **PyPI:** the JSON API can lag behind the [simple index](https://pypi.org/simple/tree-sitter-c-sharp/). Check the index before assuming a file is missing.

If a file is still missing after about 15 minutes, investigate it as a real failure.

## Background

**CI path filters.** CI runs only when grammar, source, test or binding files change. A PR that changes only `package-lock.json` or the workflows gets no CI, so test those changes another way.

**npm trusted publishing.** This would remove `NPM_TOKEN`. The `tree-sitter` core and Node binding repos use it, but it [does not currently work through the shared reusable workflow](https://github.com/tree-sitter/workflows/issues/46). Adopting it here means moving the npm job into `publish.yml`.

**Go.** `go.mod` pins `go-tree-sitter` v0.24.0, the latest tag visible on GitHub. It is only used by `bindings/go/binding_test.go`.
