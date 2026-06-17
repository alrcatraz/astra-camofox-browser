# astra-aiagent-infra-template

> 项目模板 · 统一 Astra AI Agent 生态的组件结构、文档规范与命名约定。

使用 GitHub 的 **"Use this template"** 按钮，或 clone 后手动复制，快速初始化一个新的生态组件。

---

## 结构

```
astra-<name>/
├── README.md                ← 统一 README 骨架（替换内容）
├── AGENTS.md                ← AI Agent 指南（推荐）
├── LICENSE                  ← MIT（按项目调整）
├── .gitignore               ← 基座 + Python/Node 选配（按项目调整）
│
├── config/                  ← 配置样例 *.yaml.example（推荐）
├── scripts/                 ← 工具脚本（推荐）
├── references/              ← 设计文档、决策记录（推荐）
├── tests/                   ← 测试（推荐）
```

## 约定速查

| 层面 | 规范 |
|:----|:------|
| Repo 名 | `astra-` + kebab-case |
| Python 标识符 | snake_case |
| 通用文件名 | kebab-case |
| 配置文件 | YAML > TOML > JSON |
| 数据交换 | JSON |
| README 语言 | English |
| Commit | Conventional Commits |

## 使用方法

### 创建新组件

1. 点本仓库页面的 **"Use this template"** → 输入新 repo 名
2. clone 到本地
3. 替换以下内容：

| 文件 | 做什么 |
|:----|:-------|
| `README.md` | 把骨架中的 `{{ ... }}` 占位符替换为真实内容 |
| `AGENTS.md` | 替换为 AI Agent 操作指南 |
| `LICENSE` | 替换为项目合适的许可证（MIT / CC-BY-SA 4.0 / AGPL-3.0 / …） |
| `.gitignore` | 取消注释项目语言对应的部分 |
| `config/` | 添加配置样例，删除 `.gitkeep` |
| `scripts/` | 添加工具脚本，删除 `.gitkeep` |
| `tests/` | 添加测试，删除 `.gitkeep` |
| `references/` | 添加设计文档，删除 `.gitkeep` |

### 改善现有组件

参照 [结构](#结构) 和 [约定速查](#约定速查) 表，补齐缺失的文件、统一命名与格式。

---

## README 骨架

以下是 `README.md` 的标准布局。创建新组件时以此为准，替换 `{{ ... }}` 占位符：

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

[CC-BY-SA 4.0](LICENSE) — 模板本身使用 CC-BY-SA 4.0，方便各组件选用不同许可证而模板说明不受限。
