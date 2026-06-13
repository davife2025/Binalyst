# Binalyst — Hotfix 14: Fix HuggingFace API key non-null assertions

## Problem
Routes using `process.env.HUGGINGFACE_API_KEY!` crash at build time
when the key isn't set, because the `!` tells TypeScript it's guaranteed
to exist but Next.js evaluates the module during static page collection.

## Fix
Replace `!` with `?? 'placeholder'` in all AI routes.
The actual key is validated per-request, not at module init.

## Files to replace
```
app/api/agent/strategy/route.ts    ← HUGGINGFACE_API_KEY! → ?? 'placeholder'
app/api/agent/dorahacks/route.ts   ← HUGGINGFACE_API_KEY! → ?? 'placeholder'
```

## Pattern used across all AI routes
```ts
const kimi = new OpenAI({
  apiKey:  process.env.HUGGINGFACE_API_KEY ?? 'placeholder',
  baseURL: 'https://router.huggingface.co/v1',
})
```

## Required .env.local entry
```
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxx
```
Get a free key at: https://huggingface.co/settings/tokens
