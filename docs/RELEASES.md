# Releases

Teacher ships as a **VSIX** file. There is no automated release workflow yet — publish manually.

## Build

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

Creates **`teacher-<version>.vsix`** in the repo root (version from `package.json`).

## GitHub Release (recommended)

After `package`, tag and upload the VSIX:

```powershell
$v = (node -p "require('./package.json').version")
git tag "v$v"
git push origin "v$v"
gh release create "v$v" "teacher-$v.vsix" --title "Teacher $v" --notes "See commit log."
```

Install: **Extensions: Install from VSIX...** → pick the downloaded `teacher-*.vsix` → Reload.

## Open VSX (later)

1. Create publisher at [open-vsx.org](https://open-vsx.org) (`muhib-beekun`)
2. `npx ovsx publish teacher-<version>.vsix -p <token>`
3. Users install from Extensions search (no VSIX step)

See [INSTALL-CURSOR.md](./INSTALL-CURSOR.md) for day-to-day install.

## What not to attach

- `.env`, API keys, `outputs/`, `data/synthetic/`
- VSIX files are gitignored locally; attach only to GitHub Releases
