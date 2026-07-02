# Releases

Teacher ships as a **VSIX** file. Tagged releases build automatically on GitHub; Open VSX publish is optional.

## Build

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

Creates **`teacher-<version>.vsix`** in the repo root (version from `package.json`).

## Changelog

User-facing changes go in **[CHANGELOG.md](../CHANGELOG.md)** (Keep a Changelog format).  
GitHub Releases use generated notes; copy the matching version section into release notes when publishing manually.

## GitHub Release (recommended)

### Automated (after this repo's workflow is on GitHub)

1. Bump `package.json` version and update `CHANGELOG.md`.
2. Commit, tag, push:

```powershell
$v = (node -p "require('./package.json').version")
git tag "v$v"
git push origin master
git push origin "v$v"
```

Push tag **`v*`** triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml):

- `npm run package`
- Upload `teacher-*.vsix` to GitHub Releases
- Publish to Open VSX if repository secret **`OVSX_PAT`** is set

### Manual

```powershell
npm run package
$v = (node -p "require('./package.json').version")
gh release create "v$v" "teacher-$v.vsix" --title "Teacher $v" --notes-file CHANGELOG.md
```

Install: **Extensions: Install from VSIX...** → pick the VSIX → Reload.

## Open VSX (open extension registry)

**Open VSX** ([open-vsx.org](https://open-vsx.org)) is the open-source extension registry used by VSCodium, Gitpod, and others — **not** the Microsoft VS Code Marketplace.

Publisher namespace: **`muhib-beekun`**

### One-time setup

1. Log in at [open-vsx.org](https://open-vsx.org) with GitHub.
2. **Settings** → **Log in with Eclipse** → sign the **Publisher Agreement** (separate from the Eclipse Contributor Agreement).
3. **Settings → Access Tokens** → generate a token.
4. Create the namespace (once per publisher name):

```powershell
npx ovsx create-namespace muhib-beekun -p <your-ovsx-token>
npx ovsx verify-pat muhib-beekun -p <your-ovsx-token>
```

5. Add GitHub repo secret **`OVSX_PAT`** (for CI), or use locally:

```powershell
npm run package
npm run publish:ovsx -- <your-ovsx-token>
```

On Windows, `publish:ovsx` reads the version from `package.json` via `tools/publish-ovsx.mjs` (or pass token with `$env:OVSX_PAT` set).

**Live listing:** [open-vsx.org/extension/muhib-beekun/teacher](https://open-vsx.org/extension/muhib-beekun/teacher)

Users can then install **Teacher** from the Extensions view in Open VSX–compatible editors.

## What not to attach

- `.env`, API keys, `outputs/`, `data/synthetic/`
- VSIX files are gitignored locally; attach only to GitHub Releases / Open VSX

See [INSTALL-CURSOR.md](./INSTALL-CURSOR.md) for day-to-day install and [SETUP.md](./SETUP.md) § Open your browser for the mic URL.
