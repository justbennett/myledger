# Safe Example Files

These fixtures use invented accounts, descriptions, and amounts. Keep real
journals, CSV exports, and import rules in the root-level `journals/`, `data/`,
and `rules/` directories; those directories are ignored by Git.

For a clean test checkout, copy these examples into the locations expected by
the app. `-NoClobber` prevents replacing files that already exist:

```powershell
New-Item -ItemType Directory -Force journals, data, rules | Out-Null
Copy-Item examples/journals/* journals/ -NoClobber
Copy-Item examples/data/* data/ -NoClobber
Copy-Item examples/rules/* rules/ -NoClobber
```

Do not copy examples over an existing private ledger. The sample journal is
intended only for a clean checkout or a separate test copy.