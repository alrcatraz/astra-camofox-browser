# astra-aiagent-infra-template

> Project template — unify the Astra AI Agent ecosystem's component structure, documentation conventions, and naming standards.

Use GitHub's **"Use this template"** button, or clone and copy manually, to bootstrap a new ecosystem component.

---

## Layout

```
astra-<name>/
├── README.md                ← Standard README skeleton (replace content)
├── AGENTS.md                ← AI Agent guide (recommended)
├── LICENSE                  ← MIT (adjust per project)
├── .gitignore               ← Base + Python (default) / Node (opt-in)
│
├── config/                  ← Sample config *.yaml.example (recommended)
├── scripts/                 ← Utility scripts (recommended)
├── references/              ← Design docs, decision records (recommended)
├── tests/                   ← Tests (recommended)
│
├── pyproject.toml           ← Python projects (uv, stdlib-only by default)
├── package.json             ← Node.js projects (alternative to pyproject.toml)
```

## Conventions Quick Reference

| Scope | Convention |
|:------|:-----------|
| Repo name | `astra-` + kebab-case |
| Python identifiers | snake_case |
| Generic filenames | kebab-case |
| Config files | YAML > TOML > JSON |
| Data interchange | JSON |
| README language | English (main) + Chinese (translation at end) |
| Commit style | Conventional Commits |
| Dependencies | Declare in `README.md` table + `AGENTS.md`; aggregated in meta-repo `registry.yaml` |
| Task routing | Prefer `execution-framework` as single entry point (language-independent) over keyword-based triggers in individual skills |
| Versioning | SemVer `X.Y.Z` in SKILL.md frontmatter + `git tag vX.Y.Z`. Local tweaks use `+local.N` suffix; forks use `+author.N`. Registry.yaml stores clean version only (no suffix). See [VERSIONING.md](VERSIONING.md) |

## How to Use

### Creating a New Component

1. Click **"Use this template"** on this repo's GitHub page → enter the new repo name
2. Clone locally
3. Replace the following:

| File | Action |
|:-----|:-------|
| `README.md` | Replace `{{ ... }}` placeholders with real content |
| `AGENTS.md` | Write AI Agent workflow guide |
| `LICENSE` | Replace with the appropriate license (MIT / CC-BY-SA 4.0 / AGPL-3.0 / …) |
| `.gitignore` | Remove Python section if not Python; uncomment Node section if Node.js |
| `pyproject.toml` | Update name, description; add dependencies |
| `config/` | Add config samples, delete `.gitkeep` |
| `scripts/` | Add utility scripts, delete `.gitkeep` |
| `tests/` | Add tests, delete `.gitkeep` |
| `references/` | Add design docs, delete `.gitkeep` |

### Migrating an Existing Component

Refer to the [Layout](#layout) and [Conventions](#conventions-quick-reference) tables above. Fill in missing files and align naming/format.

---

## README Skeleton

The standard `README.md` layout. When creating a new component, replace placeholders with real content:

```markdown
# astra-<component_name>

> <one_liner> · Part of [Astra AI Agent Infrastructure](https://github.com/alrcatraz/astra-aiagent-infra)
>
> [![License](https://badgen.net/github/license/alrcatraz/astra-<component_name>)](LICENSE)
> [![GitHub stars](https://badgen.net/github/stars/alrcatraz/astra-<component_name>)](https://github.com/alrcatraz/astra-<component_name>)
> [![GitHub last commit](https://badgen.net/github/last-commit/alrcatraz/astra-<component_name>)](https://github.com/alrcatraz/astra-<component_name>/commits)

## Overview

<what_it_does>

Key features:

- <feature_1>
- <feature_2>
- <feature_3>

## Prerequisites

- <prerequisite_1>
- <prerequisite_2>

## Setup

```bash
<setup_command>
```

## Configuration

| Variable | Required | Default | Description |
|:---------|:--------:|:--------|:------------|
| `<VAR_NAME>` | ✅/— | `<default>` | <description> |

## Dependencies

| Repository | Resource | Required | Purpose |
|:-----------|:---------|:--------:|:--------|
| `alrcatraz/astra-<dependency>` | — | Optional/Recommended | <why> |

## Usage

### CLI / API / MCP Tools

```bash
<example>
```

## Architecture

```
<ascii_diagram>
```

---

## Related

- [astra-aiagent-infra](https://github.com/alrcatraz/astra-aiagent-infra) — ecosystem portal
- [astra-<sibling>](https://github.com/alrcatraz/astra-<sibling>) — <description>

## License

<license_name> — see [LICENSE](LICENSE).

> CI/CD: coming soon — see [astra-aiagent-infra](https://github.com/alrcatraz/astra-aiagent-infra) for ecosystem-wide pipeline plans.

---

<p align="center">
  <a href="https://star-history.com/#alrcatraz/astra-<component_name>&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=alrcatraz/astra-<component_name>&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=alrcatraz/astra-<component_name>&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=alrcatraz/astra-<component_name>&type=Date" width="600" />
    </picture>
  </a>
</p>
```

---

## License

[CC-BY-SA 4.0](LICENSE) — The template itself uses CC-BY-SA 4.0 so that each component can choose its own license without being constrained by the template's.

---

## 中文版

### 布局

```
astra-<名称>/
├── README.md              ← 标准 README 骨架（替换内容）
├── AGENTS.md              ← AI Agent 指南（推荐）
├── LICENSE                ← MIT（按项目调整）
├── .gitignore             ← 基础 + Python（默认）/ Node（按需启用）
│
├── config/                ← 示例配置 *.yaml.example（推荐）
├── scripts/               ← 工具脚本（推荐）
├── references/            ← 设计文档、决策记录（推荐）
├── tests/                 ← 测试（推荐）
│
├── pyproject.toml         ← Python 项目（uv，默认仅 stdlib）
├── package.json           ← Node.js 项目（替代 pyproject.toml）
```

### 约定速查

| 范围 | 约定 |
|:-----|:------|
| 仓库名 | `astra-` + kebab-case |
| Python 标识符 | snake_case |
| 通用文件名 | kebab-case |
| 配置文件 | YAML > TOML > JSON |
| 数据交换 | JSON |
| README 语言 | 英文（正文）+ 中文（末尾翻译）|
| 提交风格 | Conventional Commits |
| 依赖声明 | 在 `README.md` 表格 + `AGENTS.md` 中声明；meta-repo 的 `registry.yaml` 做聚合 |
| 版本号 | SemVer `X.Y.Z` 写入 SKILL.md 头部 + `git tag vX.Y.Z`。本地小修改用 `+local.N` 后缀；fork 用 `+作者.N`。registry.yaml 只存干净版本号。详见 [VERSIONING.md](VERSIONING.md) |
