# Quick Patch — Import Wallet via Private Key

Adds a "Private key" import option alongside "Seed phrase" in the Celo
Agent tab's Import step.

## Files (full updated versions — drop in over existing copies)
```
lib/celo/client.ts             — +celoWalletFromPrivateKey()
components/tabs/CeloAgentTab.tsx — Import step now has a mode toggle
                                    (Seed phrase / Private key)
```

Typechecked — zero new errors.

## How to use
1. Go to Celo Agent tab → "Import Existing"
2. Click the "Private key" toggle
3. Paste your private key (with or without `0x` prefix)
4. Set a local password (encrypts it for storage, same as the other flows)
