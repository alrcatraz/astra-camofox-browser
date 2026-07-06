# Versioning Convention

## Summary

| Field | Convention |
|:------|:-----------|
| Format | **SemVer 2.0.0** — `MAJOR.MINOR.PATCH` |
| Git tag | `v` prefix: `v1.0.0`, `v2.1.0` |
| SKILL.md/AGENTS.md | `version:` field = current SemVer |
| registry.yaml | Clean version only (no suffix) |
| Local tweaks | Suffix `+local.N` — e.g. `1.0.0+local.1` |
| Fork tweaks | Suffix `+author.N` — e.g. `1.0.0+lilei.1` |

## Rationale

We use SemVer 2.0.0 with the **build metadata** (`+`) suffix for local and
forked modifications. Why `+` instead of `-`?

| Suffix | SemVer meaning | Priority effect |
|:-------|:---------------|:----------------|
| `1.0.0-nanaly.1` | Pre-release | `1.0.0-nanaly.1` < `1.0.0` (wrong — local is at least as mature) |
| `1.0.0+nanaly.1` | Build metadata | `1.0.0+nanaly.1` == `1.0.0` (correct — equal maturity) |

The `+` suffix is **ignored in version comparison** — `1.0.0+local.1` is
semantically equal to `1.0.0`, which accurately represents that the component
has the same release maturity with minor local adjustments.

## Lifecycle

```
Git tag v1.0.0
    │  SKILL.md → 1.0.0
    │  registry.yaml → 1.0.0
    │
    ├── Local config tweak
    │   └── SKILL.md → 1.0.0+local.1  (no tag, no registry update)
    │
    ├── Another local fix
    │   └── SKILL.md → 1.0.0+local.2  (incremental)
    │
    ├── Fork by Lilei
    │   └── SKILL.md → 1.0.0+lilei.1  (identity-clear)
    │
    └── Official release v1.1.0
        └── All repos → 1.1.0  (suffix cleared)
```

## Where to Put It

| Artifact | Where to write |
|:---------|:---------------|
| **SKILL.md** | Frontmatter: `version: 1.0.0` |
| **registry.yaml** | Component entry: `version: 1.0.0` (clean only) |
| **AGENTS.md** | Optional: near top, `version:` field |
| **pyproject.toml** | `project.version = "1.0.0"` |

## Sync with Git Tags

- Every official release **must** have a matching `git tag vMAJOR.MINOR.PATCH`
- The tag and SKILL.md/registry.yaml version must match exactly
- Local suffix changes do **not** create tags

## Detection

The `execution-framework` skill's `sync-routing.py` script can detect version
mismatches between registry.yaml and local SKILL.md files. Run:

```bash
cd astra-skill-execution-framework
uv run scripts/sync-routing.py --diff --detail
```

to check for version drift across the ecosystem.
