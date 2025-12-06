# s2p — Source2Prompt TUI

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue)
![Runtime](https://img.shields.io/badge/runtime-Bun%201.3+-purple)
![Status](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-MIT-green)

A world-class terminal UI for combining source code files into LLM-ready prompts. Features a tree explorer, live syntax preview, token estimation, presets, and structured XML-like output — all in a single compiled binary.

<div align="center">

```bash
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/source_to_prompt_tui/main/install.sh | bash
```

</div>

---

## Highlights

- **Zero-setup binaries**: Installer downloads pre-built binaries for your platform; falls back to Bun source build automatically.
- **Tree file explorer**: Navigate your project with vim-style keys (j/k/h/l), expand/collapse directories, filter by path.
- **Quick file-type selects**: Press `t` for all text files, or `1-9,0,r` for JS/React/TS/JSON/MD/Python/Go/Java/Ruby/PHP/Rust.
- **Live syntax preview**: See file contents with syntax highlighting as you navigate.
- **Token & cost estimation**: Real-time token count using tiktoken, with context window usage bar and cost estimate.
- **Presets**: Save/load file selections and options to `~/.source2prompt.json`.
- **Structured output**: XML-like tags (`<preamble>`, `<goal>`, `<project_tree>`, `<files>`) for optimal LLM parsing.
- **Minification & comment stripping**: JS/TS via Bun.transform or Terser, CSS via csso, HTML via html-minifier-terser.
- **Git-aware scanning**: Respects `.gitignore` files recursively throughout your project.

## Why s2p exists

- Manually copying files into prompts loses structure and context. s2p preserves project hierarchy with a tree view.
- Token limits matter. s2p shows real-time token counts so you know what fits in your context window.
- Consistency matters. s2p uses structured XML-like output that LLMs parse reliably.
- Speed matters. Navigate and select files with keyboard shortcuts, not mouse clicks.

## Quickstart

```bash
# Install via one-liner
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/source_to_prompt_tui/main/install.sh | bash

# Or with Bun directly
bun install -g source2prompt-tui

# Run in any project directory
s2p
```

## Usage

Launch `s2p` in your project directory. The TUI displays three panes:

| Pane | Purpose |
|------|---------|
| **Explorer** | Tree view of files; select with Space/Enter |
| **Config** | Preamble/goal text, presets, options (minify, strip comments) |
| **Preview** | Syntax-highlighted preview of current file + token stats |

A fourth **Prompt Sample** pane shows a live preview of what the combined output will look like.

Press `Ctrl+G` to generate the combined prompt and open the Combined Output view.

## Keyboard Shortcuts

### Global
| Key | Action |
|-----|--------|
| `Tab` | Switch between panes |
| `Ctrl+G` | Generate combined prompt |
| `Ctrl+C` | Exit |

### Explorer Pane
| Key | Action |
|-----|--------|
| `j` / `k` | Move cursor down/up |
| `h` / `l` | Collapse/expand directory |
| `Space` / `Enter` | Toggle file selection (or expand/collapse directory) |
| `/` or `f` | Focus filter input |
| `d` | Focus root directory input |
| `t` | Toggle all text files |
| `1-9,0,r` | Quick select by file type |
| `u` | Clear selection for filtered files |

### Config Pane
| Key | Action |
|-----|--------|
| `←` / `→` | Switch tabs (Inputs/Presets/Options) |
| `p` | Edit preamble (Inputs tab) |
| `g` | Edit goal (Inputs tab) |
| `i` | Toggle include preamble (Options tab) |
| `o` | Toggle include goal (Options tab) |
| `x` | Toggle remove comments (Options tab) |
| `m` | Toggle minify (Options tab) |
| `j` / `k` | Navigate presets (Presets tab) |
| `l` | Load preset |
| `d` | Delete preset |
| `s` | Save new preset |

### Combined Output View
| Key | Action |
|-----|--------|
| `y` | Copy to clipboard |
| `w` | Save to file |
| `Esc` / `q` | Return to main view |

## Output Format

Generated prompts use a structured format optimized for LLM parsing:

```xml
===== SOURCE2PROMPT v2 =====

[meta]
project_root: /path/to/project
generated_at: 2024-01-15T10:30:00.000Z
files_selected: 5
body_bytes: 12345
body_lines: 456
body_tokens_est: 3200
options: include_preamble=true, include_goal=true, remove_comments=false, minify=false
[/meta]

<preamble>
Your system instructions here...
</preamble>

<goal>
Your task objective here...
</goal>

<project_tree>
+ project-root
  - src/index.ts
  - src/utils.ts
  + src/components
    - Button.tsx
</project_tree>

<files>
<file path="src/index.ts" lang="ts" lines="50" bytes="1234" tokens="320">
// file contents...
</file>
</files>
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| Include Preamble | ON | Add `<preamble>` section with context instructions |
| Include Goal | OFF | Add `<goal>` section with task objective |
| Remove Comments | OFF | Strip comments from code (C-style and hash-style) |
| Minify | OFF | Minify JS/TS/CSS/HTML/JSON for smaller output |

## Presets

Presets save your current configuration including:
- Selected files
- Preamble and goal text
- Include flags
- Minify and comment-stripping options
- Root directory

Presets are stored in `~/.source2prompt.json` and can be loaded across projects.

## Local Development

```bash
# Clone and install
git clone https://github.com/Dicklesworthstone/source_to_prompt_tui.git
cd source_to_prompt_tui
bun install

# Development
bun run dev          # Run TUI directly

# Build
bun run build        # TypeScript compile
bun run build:bin    # Single-file binary for current platform

# Cross-platform builds
bun run build:mac-arm64
bun run build:mac-x64
bun run build:linux-x64
bun run build:linux-arm64
bun run build:all
```

## CI & Releases

- Workflow: lint → typecheck → matrix builds (macOS/Linux) → upload artifacts
- Tagged pushes (`v*`) create a GitHub release with binaries and `sha256.txt`
- Installer fetches from latest release or falls back to building from source

## Environment Variables

### Installer
| Variable | Description |
|----------|-------------|
| `VERSION` | Pin to specific release tag (e.g., `v0.3.0`) |
| `DEST` | Install directory (default: `~/.local/bin`) |
| `OWNER` | GitHub owner (default: `Dicklesworthstone`) |
| `REPO` | GitHub repo (default: `source_to_prompt_tui`) |
| `BINARY` | Installed binary name (default: `s2p`) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Binary not on PATH | Add `~/.local/bin` to PATH; restart shell |
| Large file excluded | Files >5MB are skipped; this is intentional |
| Token count seems off | Estimation uses tiktoken cl100k_base; actual may vary by model |
| Minify fails silently | Some files can't be minified; original content is used |
| Clipboard fails | Ensure `xclip` or `pbcopy` is available |

## Comparison

Compared to manually copying files:
- Preserves project structure with tree view
- Shows real-time token counts and costs
- Uses consistent structured output format
- Supports presets for repeated workflows
- Handles file selection with keyboard shortcuts

## License

MIT
