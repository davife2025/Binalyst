# Binalyst — Hotfix 6: Clean dependency reinstall

## Problem
The entire dependency tree is conflicted:
- `next-auth@3.x` needs React 16/17 (project has React 18)
- `eslint-config-next@16` needs `eslint@>=9` (project has eslint@8)
- npm refuses to uninstall/install anything without `--force`

## Fix — clean reinstall with correct versions

Run these commands in order in your project root:

### Step 1: Delete node_modules and lockfile
```powershell
rmdir /s /q node_modules
del package-lock.json
```

### Step 2: Replace package.json
Copy the `package.json` from this zip into your project root,
replacing the existing one.

### Step 3: Fresh install
```powershell
npm install
```

### Step 4: Run dev
```powershell
npm run dev
```

## What changed in package.json
- `next-auth`: `^3.29.10` → `4.24.11` (React 18 compatible)
- `eslint`: `^8.57.1` → `^9.0.0` (Next.js 16 compatible)
- Removed stray/conflicting version pins
- All other deps kept at same versions

## Expected result
```
▲ Next.js 16.2.7 (Turbopack)
✓ Ready in ~5s
```
Login page loads, no module errors.
