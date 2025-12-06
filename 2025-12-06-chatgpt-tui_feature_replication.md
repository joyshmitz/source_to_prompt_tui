# ChatGPT Conversation: TUI feature replication

Source: https://chatgpt.com/share/69349b15-dfb8-800b-a881-b3459bbcec25
Retrieved: 2025-12-06T21:07:57.717Z

## User

I want to replicate the features and functionality of this utility: https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/your-source-to-prompt.html But as a TUI that using bun , typescript, opentui/ink and which can be distributed using bun as a single compiled binary that can be used from the terminal in Linux and Mac. It should present a super slick, visually appealing interface with world class UI-UX for terminal apps and make full use of all the available width on the screen. But all features and functionality should follow the linked file but in a way mapped to how TUIs work versus web pages.

## Assistant

Here’s a full Bun + TypeScript + Ink TUI that replicates the “Your Source to Prompt” utility, mapped to a terminal UI.

It:

-   Recursively scans a project folder honoring
    
    ```
    .gitignore
    ```
    
-   Detects text vs binary, loads text content, counts lines and sizes
    
-   Lets you filter files, select/deselect, and use quick file-type selects
    
-   Provides comment-stripping and minification options
    
-   Builds a structured “LLM-ready” combined prompt (preamble, goal, structure summary, then file blocks)
    
-   Manages presets (save/load/delete, export/import as JSON)
    
-   Copies combined output to clipboard (macOS + Linux)
    
-   Saves combined output to a file
    
-   Uses full width with a two-pane layout and keyboard-driven workflow
    
-   Can be compiled to a single binary via
    
    ```
    bun build --compile
    ```
    

Below are all the files you need.

* * *

### `package.json`

```
json

json{
  "name": "your-source-to-prompt-tui",
  "version": "0.1.0",
  "description": "Terminal UI version of Your Source to Prompt implemented with Bun, TypeScript, and Ink.",
  "type": "module",
  "bin": {
    "ystp": "dist/cli.js"
  },
  "scripts": {
    "dev": "bun run src/cli.tsx",
    "build": "tsc",
    "build:bin": "bun build src/cli.tsx --compile --outfile ystp"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "react": "^18.3.0",
    "ink-text-input": "^6.0.0",
    "ignore": "^5.3.0",
    "terser": "^5.31.0",
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8"
  }
}
```

* * *

### `tsconfig.json`

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

Create a

```
src
```

directory and put the following files inside.

* * *

### `src/types.ts`

```
ts

tsexport type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

export interface FileEntry {
  path: string; // relative to root
  absolutePath: string;
  sizeBytes: number;
  numLines: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  content: string;
}

export interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

export interface CombinedResult {
  output: string;
  totalBytes: number;
  totalLines: number;
  approxTokens: number;
}
```

* * *

### `src/fs-utils.ts`

```
ts

tsimport { promises as fs } from "fs";
import path from "path";
import ignore, { Ignore } from "ignore";
import { FileEntry, FileCategory } from "./types";

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".vercel"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

export function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

export type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

export const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

export async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ rootDir: string; files: FileEntry[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);
  const files: FileEntry[] = [];
  let processed = 0;

  async function walk(currentAbs: string, currentRel: string) {
    let dirEntries: import("fs").Dirent[];
    try {
      dirEntries = await fs.readdir(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      const relPath = currentRel ? path.posix.join(currentRel, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        let isText = isTextExtension(ext);
        let sizeBytes = 0;
        let numLines = 0;
        let content = "";

        try {
          const stat = await fs.stat(absPath);
          sizeBytes = stat.size;
          if (isText && sizeBytes < 5 * 1024 * 1024) {
            content = await fs.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } else if (isText) {
            // treat very large files as non-text for performance
            isText = false;
          }
        } catch {
          // ignore read errors
        }

        const category = getFileCategory(ext);
        files.push({
          path: relPath,
          absolutePath: absPath,
          sizeBytes,
          numLines,
          extension: ext.toLowerCase(),
          isText,
          category,
          content: isText ? content : ""
        });

        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, "");
  files.sort((a, b) => a.path.localeCompare(b.path));

  return { rootDir: resolvedRoot, files };
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES.map(d => `${d}/`));

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const gitignorePath = path.join(dirAbs, ".gitignore");
    try {
      const text = await fs.readFile(gitignorePath, "utf8");
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // no .gitignore
    }

    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix ? path.posix.join(relPrefix, entry.name) : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

export function filterFilesByQuickSelect(
  files: FileEntry[],
  key: QuickSelectKey
): FileEntry[] {
  switch (key) {
    case "allText":
      return files.filter(f => f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}
```

* * *

### `src/minify.ts`

```
ts

tsimport { Buffer } from "buffer";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { FileEntry, CombineOptions, CombinedResult } from "./types";

export function estimateTokens(charOrByteCount: number): number {
  if (!Number.isFinite(charOrByteCount) || charOrByteCount <= 0) return 0;
  return Math.round(charOrByteCount / 4);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

export async function transformFileContent(
  file: FileEntry,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  const ext = file.extension;
  if (!file.isText) return file.content;
  let text = file.content;

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fall through
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // fall through
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // fall through
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // fall through
      }
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    }
  }

  return text;
}

export async function buildCombinedOutput(
  selectedFiles: FileEntry[],
  options: CombineOptions
): Promise<CombinedResult> {
  const headers: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    headers.push("# Preamble", "", options.preambleText.trim(), "");
  }
  if (options.includeGoal && options.goalText.trim()) {
    headers.push("# Goal", "", options.goalText.trim(), "");
  }

  headers.push("# Project Structure Summary", "");
  for (const file of selectedFiles) {
    headers.push(
      `- ${file.path} (${file.numLines} lines, ${formatBytes(file.sizeBytes)})`
    );
  }

  const lines: string[] = [];
  lines.push(...headers, "", "# Files", "");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed || file.content;
    lines.push(
      `-------------------- FILE: ${file.path} (${file.numLines} lines) --------------------`,
      "",
      content.trimEnd(),
      ""
    );
  }

  const output = lines.join("\n");
  const totalBytes = Buffer.byteLength(output, "utf8");
  const totalLines = output.split(/\r?\n/).length;
  const approxTokens = estimateTokens(totalBytes);

  return {
    output,
    totalBytes,
    totalLines,
    approxTokens
  };
}
```

* * *

### `src/clipboard.ts`

```
ts

tsdeclare const Bun: any;

export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  try {
    if (platform === "darwin") {
      const proc = Bun.spawn(["pbcopy"], {
        stdin: "pipe",
        stdout: "ignore",
        stderr: "ignore"
      });
      proc.stdin.write(data);
      proc.stdin.end();
      await proc.exited;
      return proc.exitCode === 0;
    }

    if (platform === "linux") {
      const candidates: string[][] = [
        ["wl-copy"],
        ["xclip", "-selection", "clipboard"],
        ["xsel", "--clipboard", "--input"]
      ];
      for (const cmd of candidates) {
        try {
          const proc = Bun.spawn(cmd, {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore"
          });
          proc.stdin.write(data);
          proc.stdin.end();
          await proc.exited;
          if (proc.exitCode === 0) return true;
        } catch {
          // try next
        }
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}
```

* * *

### `src/presets.ts`

```
ts

tsimport { promises as fs } from "fs";
import path from "path";
import os from "os";
import { CombineOptions } from "./types";

export interface Preset {
  name: string;
  rootDir: string;
  selectedPaths: string[];
  options: CombineOptions;
  createdAt: string;
}

export interface PresetStore {
  presets: Preset[];
}

const CONFIG_DIR = path.join(os.homedir(), ".your-source-to-prompt-tui");
const PRESET_FILE = path.join(CONFIG_DIR, "presets.json");

async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function loadPresetStore(): Promise<PresetStore> {
  try {
    const json = await fs.readFile(PRESET_FILE, "utf8");
    const parsed = JSON.parse(json) as PresetStore;
    if (!parsed || !Array.isArray(parsed.presets)) {
      return { presets: [] };
    }
    return parsed;
  } catch {
    return { presets: [] };
  }
}

export async function savePresetStore(store: PresetStore): Promise<void> {
  await ensureConfigDir();
  const json = JSON.stringify(store, null, 2);
  await fs.writeFile(PRESET_FILE, json, "utf8");
}

export function createPresetFromState(
  name: string,
  rootDir: string,
  selectedPaths: Set<string>,
  options: CombineOptions
): Preset {
  return {
    name,
    rootDir,
    selectedPaths: Array.from(selectedPaths).sort(),
    options,
    createdAt: new Date().toISOString()
  };
}

export async function exportPresetsToFile(
  store: PresetStore,
  targetPath: string
): Promise<void> {
  const json = JSON.stringify(store, null, 2);
  await fs.writeFile(targetPath, json, "utf8");
}

export async function importPresetsFromFile(
  sourcePath: string
): Promise<PresetStore> {
  const json = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(json) as PresetStore;
  if (!parsed || !Array.isArray(parsed.presets)) {
    throw new Error("Invalid presets JSON.");
  }
  return parsed;
}
```

* * *

### `src/app.tsx`

```
tsx

tsximport React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import path from "path";
import {
  scanProject,
  filterFilesByQuickSelect,
  QUICK_SELECT_LABELS,
  QuickSelectKey
} from "./fs-utils";
import { FileEntry, CombineOptions, CombinedResult } from "./types";
import { buildCombinedOutput, estimateTokens } from "./minify";
import { copyToClipboard } from "./clipboard";
import {
  loadPresetStore,
  savePresetStore,
  createPresetFromState,
  exportPresetsToFile,
  importPresetsFromFile,
  PresetStore
} from "./presets";

type FocusField =
  | "none"
  | "rootDir"
  | "filter"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath"
  | "importPath";

type Mode = "main" | "output";

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

interface AppProps {
  initialRootDir?: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

const App: React.FC<AppProps> = ({ initialRootDir }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [rootDir, setRootDir] = useState(() =>
    path.resolve(initialRootDir || process.cwd())
  );
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusField, setFocusField] = useState<FocusField>("rootDir");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preambleText, setPreambleText] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goalText, setGoalText] = useState("");

  const [removeComments, setRemoveComments] = useState(false);
  const [minify, setMinify] = useState(false);

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [combining, setCombining] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [presetStore, setPresetStore] = useState<PresetStore>({ presets: [] });
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [exportPathInput, setExportPathInput] = useState("combined-prompt.txt");
  const [importPathInput, setImportPathInput] = useState("presets.json");

  const listHeight = Math.max(8, (stdout.rows ?? 30) - 12);

  const filteredFiles = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => f.path.toLowerCase().includes(q));
  }, [files, filterText]);

  const selectedFiles = useMemo(
    () => files.filter(f => selectedPaths.has(f.path)),
    [files, selectedPaths]
  );

  const totalSelectedBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [selectedFiles]
  );
  const totalSelectedLines = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.numLines, 0),
    [selectedFiles]
  );
  const approxTokens = useMemo(
    () => estimateTokens(totalSelectedBytes),
    [totalSelectedBytes]
  );

  const contextWarning = useMemo(() => {
    if (approxTokens > 200_000) {
      return "Very large context (> 200k tokens). Consider selecting fewer files or enabling minification.";
    }
    if (approxTokens > 100_000) {
      return "Large context (> 100k tokens). Some models may truncate this.";
    }
    if (approxTokens > 60_000) {
      return "Medium context (~60k+ tokens). You should be fine with 200k+ context models.";
    }
    return null;
  }, [approxTokens]);

  useEffect(() => {
    if (cursorIndex >= filteredFiles.length) {
      const nextIndex = filteredFiles.length > 0 ? filteredFiles.length - 1 : 0;
      setCursorIndex(nextIndex);
      setScrollOffset(0);
    }
  }, [filteredFiles.length, cursorIndex]);

  useEffect(() => {
    if (cursorIndex < scrollOffset) {
      setScrollOffset(cursorIndex);
    } else if (cursorIndex >= scrollOffset + listHeight) {
      setScrollOffset(cursorIndex - listHeight + 1);
    }
  }, [cursorIndex, scrollOffset, listHeight]);

  const handleScan = async (dir: string): Promise<FileEntry[]> => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setScanning(true);
    setScanError(null);
    setStatusMessage(null);
    setProgressText(null);
    setFiles([]);
    setSelectedPaths(new Set());
    setCursorIndex(0);
    setScrollOffset(0);

    let scanned: FileEntry[] = [];
    try {
      const result = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      scanned = result.files;
      setFiles(scanned);
      setStatusMessage(`Scanned ${scanned.length} files from ${resolved}`);
    } catch (err: any) {
      setScanError(err?.message || String(err));
    } finally {
      setScanning(false);
      setProgressText(null);
    }
    return scanned;
  };

  useEffect(() => {
    (async () => {
      const store = await loadPresetStore();
      setPresetStore(store);
      await handleScan(rootDir);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveCursor = (delta: number) => {
    if (filteredFiles.length === 0) return;
    setCursorIndex(prev => {
      let next = prev + delta;
      if (next < 0) next = 0;
      if (next >= filteredFiles.length) next = filteredFiles.length - 1;
      return next;
    });
  };

  const toggleFile = (file: FileEntry | undefined) => {
    if (!file) return;
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else if (file.isText) {
        next.add(file.path);
      }
      return next;
    });
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!files.length) return;
    const matches = filterFilesByQuickSelect(files, key).filter(f => f.isText);
    const matchPaths = new Set(matches.map(f => f.path));
    if (!matches.length) return;

    setSelectedPaths(prev => {
      const next = new Set(prev);
      const allSelected = matches.every(f => next.has(f.path));
      if (allSelected) {
        for (const p of matchPaths) next.delete(p);
      } else {
        for (const p of matchPaths) next.add(p);
      }
      return next;
    });
    setStatusMessage(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filteredFiles.length) return;
    const filterSet = new Set(filteredFiles.map(f => f.path));
    setSelectedPaths(prev => {
      const next = new Set(prev);
      for (const p of filterSet) next.delete(p);
      return next;
    });
    setStatusMessage("Cleared selections for files matching current filter.");
  };

  const handleCombine = async () => {
    if (!selectedFiles.length) {
      setStatusMessage("No files selected. Select at least one text file first.");
      return;
    }
    setCombining(true);
    setMode("output");
    setCopyStatus(null);
    setStatusMessage("Combining selected files...");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText,
        includeGoal,
        goalText,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(selectedFiles, options);
      setCombined(result);
      setStatusMessage(
        `Combined ${selectedFiles.length} files into ${formatBytes(
          result.totalBytes
        )} (~${result.approxTokens} tokens).`
      );
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    } finally {
      setCombining(false);
    }
  };

  const handleCopyCombined = async () => {
    if (!combined) return;
    const ok = await copyToClipboard(combined.output);
    setCopyStatus(
      ok ? "Copied combined output to clipboard." : "Clipboard copy failed."
    );
  };

  const handleSaveCombinedToFile = async (targetPath: string) => {
    if (!combined) return;
    try {
      const resolved =
        path.isAbsolute(targetPath) || !rootDir
          ? path.resolve(targetPath)
          : path.resolve(rootDir, targetPath);
      const fs = await import("fs/promises");
      await fs.writeFile(resolved, combined.output, "utf8");
      setStatusMessage(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  const handleSavePreset = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setStatusMessage("Preset name cannot be empty.");
      return;
    }
    const options: CombineOptions = {
      includePreamble,
      preambleText,
      includeGoal,
      goalText,
      removeComments,
      minify
    };
    const preset = createPresetFromState(trimmed, rootDir, selectedPaths, options);
    setPresetStore(prev => {
      const others = prev.presets.filter(p => p.name !== trimmed);
      const updated: PresetStore = {
        presets: [...others, preset].sort((a, b) => a.name.localeCompare(b.name))
      };
      void savePresetStore(updated);
      return updated;
    });
    setStatusMessage(`Saved preset "${trimmed}".`);
  };

  const handleLoadPreset = async (index: number) => {
    const preset = presetStore.presets[index];
    if (!preset) return;
    setIncludePreamble(preset.options.includePreamble);
    setPreambleText(preset.options.preambleText);
    setIncludeGoal(preset.options.includeGoal);
    setGoalText(preset.options.goalText);
    setRemoveComments(preset.options.removeComments);
    setMinify(preset.options.minify);
    setStatusMessage(`Loading preset "${preset.name}"...`);
    const newFiles = await handleScan(preset.rootDir);
    const availablePaths = new Set(newFiles.map(f => f.path));
    const newSelected = new Set<string>();
    for (const p of preset.selectedPaths) {
      if (availablePaths.has(p)) newSelected.add(p);
    }
    setSelectedPaths(newSelected);
    setStatusMessage(
      `Loaded preset "${preset.name}" (${newSelected.size} files selected).`
    );
  };

  const handleDeletePreset = async (index: number) => {
    const preset = presetStore.presets[index];
    if (!preset) return;
    setPresetStore(prev => {
      const updated: PresetStore = {
        presets: prev.presets.filter((_, i) => i !== index)
      };
      void savePresetStore(updated);
      return updated;
    });
    setSelectedPresetIndex(prev =>
      prev >= presetStore.presets.length - 1 ? Math.max(0, prev - 1) : prev
    );
    setStatusMessage(`Deleted preset "${preset.name}".`);
  };

  const handleExportPresets = async (target: string) => {
    try {
      await exportPresetsToFile(presetStore, target);
      setStatusMessage(`Exported presets to ${path.resolve(target)}`);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  const handleImportPresets = async (source: string) => {
    try {
      const imported = await importPresetsFromFile(source);
      const merged: PresetStore = {
        presets: [...presetStore.presets, ...imported.presets].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      };
      setPresetStore(merged);
      await savePresetStore(merged);
      setStatusMessage(
        `Imported ${imported.presets.length} presets from ${path.resolve(source)}`
      );
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      if (key.escape) {
        if (mode === "output") {
          setMode("main");
          setCopyStatus(null);
          return;
        }
        if (focusField !== "none") {
          setFocusField("none");
          return;
        }
      }

      if (mode === "output") {
        if (input.toLowerCase() === "y") {
          void handleCopyCombined();
          return;
        }
        if (input.toLowerCase() === "w") {
          setFocusField("exportPath");
          return;
        }
        if (input.toLowerCase() === "s") {
          setMode("main");
          return;
        }
        return;
      }

      if (focusField === "rootDir") {
        if (key.return) {
          void handleScan(rootDir);
          setFocusField("none");
        }
        return;
      }
      if (focusField === "filter") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "preamble") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "goal") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "presetName") {
        if (key.return) {
          void handleSavePreset(presetNameInput);
          setPresetNameInput("");
          setFocusField("none");
        }
        return;
      }
      if (focusField === "exportPath") {
        if (key.return) {
          if (mode === "output") {
            void handleSaveCombinedToFile(exportPathInput);
          } else {
            void handleExportPresets(exportPathInput);
          }
          setFocusField("none");
        }
        return;
      }
      if (focusField === "importPath") {
        if (key.return) {
          void handleImportPresets(importPathInput);
          setFocusField("none");
        }
        return;
      }

      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }
      if (key.pageUp) {
        moveCursor(-Math.max(5, listHeight - 2));
        return;
      }
      if (key.pageDown) {
        moveCursor(Math.max(5, listHeight - 2));
        return;
      }

      const lower = input.toLowerCase();

      if (input === " ") {
        toggleFile(filteredFiles[cursorIndex]);
        return;
      }

      if (key.return || lower === "c") {
        void handleCombine();
        return;
      }

      if (lower === "f") {
        setFocusField("filter");
        return;
      }
      if (lower === "d") {
        setFocusField("rootDir");
        return;
      }
      if (lower === "p" && !key.ctrl) {
        setFocusField("preamble");
        return;
      }
      if (lower === "g") {
        setFocusField("goal");
        return;
      }

      if (key.ctrl && lower === "p") {
        setIncludePreamble(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "g") {
        setIncludeGoal(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "m") {
        setMinify(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "x") {
        setRemoveComments(prev => !prev);
        return;
      }

      if (key.ctrl && lower === "s") {
        setFocusField("presetName");
        return;
      }
      if (key.ctrl && lower === "l") {
        void handleLoadPreset(selectedPresetIndex);
        return;
      }
      if (key.ctrl && lower === "d") {
        void handleDeletePreset(selectedPresetIndex);
        return;
      }
      if (key.ctrl && lower === "e") {
        setFocusField("exportPath");
        return;
      }
      if (key.ctrl && lower === "i") {
        setFocusField("importPath");
        return;
      }

      if (lower === "[") {
        setSelectedPresetIndex(prev => (prev <= 0 ? 0 : prev - 1));
        return;
      }
      if (lower === "]") {
        setSelectedPresetIndex(prev =>
          prev >= presetStore.presets.length - 1
            ? Math.max(0, presetStore.presets.length - 1)
            : prev + 1
        );
        return;
      }

      // Quick selects & filter-based clear
      if (lower === "u") {
        clearSelectionInFilter();
        return;
      }
      if (lower === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (lower === "r") {
        toggleQuickSelect("rust");
        return;
      }
    },
    [
      mode,
      focusField,
      filteredFiles,
      cursorIndex,
      listHeight,
      presetStore,
      presetNameInput,
      exportPathInput,
      importPathInput,
      selectedPresetIndex,
      rootDir,
      includePreamble,
      preambleText,
      includeGoal,
      goalText,
      removeComments,
      minify,
      selectedFiles,
      combined
    ]
  );

  const visibleFiles = useMemo(
    () => filteredFiles.slice(scrollOffset, scrollOffset + listHeight),
    [filteredFiles, scrollOffset, listHeight]
  );

  if (mode === "output") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyanBright">
            Your Source to Prompt — Combined Output (press Esc to go back)
          </Text>
        </Box>
        {combined && (
          <Box marginTop={1}>
            <Text>
              Files: {selectedFiles.length} | Size: {formatBytes(combined.totalBytes)} | Lines:{" "}
              {combined.totalLines} | ~Tokens: {combined.approxTokens}
            </Text>
          </Box>
        )}
        {copyStatus && (
          <Box marginTop={1}>
            <Text color="green">{copyStatus}</Text>
          </Box>
        )}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={0}
          marginTop={1}
          flexGrow={1}
          width={stdout.columns ?? undefined}
        >
          <Text>{combined ? combined.output : "(nothing combined yet)"}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text>
            Keys: [Y] Copy to clipboard  [W] Save to file  [S] Back to file selection  [Esc] Close
          </Text>
          {focusField === "exportPath" && (
            <Box marginTop={1}>
              <Text>Save as: </Text>
              <TextInput
                value={exportPathInput}
                onChange={setExportPathInput}
                focus={true}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyanBright">Your Source to Prompt — TUI</Text>
        <Text>  (Ctrl+C to exit)</Text>
      </Box>

      <Box marginTop={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box marginTop={0}>
        <Text>Filter: </Text>
        <TextInput
          value={filterText}
          onChange={setFilterText}
          focus={focusField === "filter"}
          placeholder="substring to match file paths"
        />
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="space-between">
        <Box>
          {scanning && (
            <Text color="yellow">
              {progressText || "Scanning project..."}
            </Text>
          )}
          {scanError && <Text color="red">Error: {scanError}</Text>}
          {statusMessage && !scanning && !scanError && (
            <Text color="green">{statusMessage}</Text>
          )}
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text>
            Selected files: {selectedFiles.length} / {files.length}
          </Text>
          <Text>
            Size: {formatBytes(totalSelectedBytes)} | Lines: {totalSelectedLines} | ~Tokens:{" "}
            {approxTokens}
          </Text>
          {contextWarning && <Text color="yellow">{contextWarning}</Text>}
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={2} marginRight={2}>
          <Text>
            Files (↑/↓/PgUp/PgDn or j/k; Space to toggle; Enter/C to combine)
          </Text>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={0}
            height={listHeight + 2}
            width={Math.floor((stdout.columns ?? 120) * 0.65)}
          >
            {visibleFiles.length === 0 && (
              <Text color="gray">No files match the current filter.</Text>
            )}
            {visibleFiles.map((file, index) => {
              const globalIndex = scrollOffset + index;
              const isCursor = globalIndex === cursorIndex;
              const isSelected = selectedPaths.has(file.path);
              const marker = isCursor ? ">" : " ";
              const checkbox = isSelected ? "[x]" : "[ ]";
              const color: any = isCursor
                ? "cyanBright"
                : isSelected
                ? "green"
                : undefined;

              return (
                <Text key={file.path} color={color}>
                  {marker} {checkbox} {file.path}{" "}
                  {file.isText
                    ? `(${formatBytes(file.sizeBytes)}, ${file.numLines} lines)`
                    : "(binary/unreadable)"}
                </Text>
              );
            })}
          </Box>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column">
            <Text color="cyan">Options</Text>
            <Text>
              [Ctrl+P] Preamble: {includePreamble ? "ON" : "OFF"}
            </Text>
            {includePreamble && (
              <Box marginLeft={2}>
                <Text>Preamble text: </Text>
                <TextInput
                  value={preambleText}
                  onChange={setPreambleText}
                  focus={focusField === "preamble"}
                />
              </Box>
            )}
            <Text>
              [Ctrl+G] Goal: {includeGoal ? "ON" : "OFF"}
            </Text>
            {includeGoal && (
              <Box marginLeft={2}>
                <Text>Goal text: </Text>
                <TextInput
                  value={goalText}
                  onChange={setGoalText}
                  focus={focusField === "goal"}
                />
              </Box>
            )}
            <Text>
              [Ctrl+X] Remove code comments: {removeComments ? "ON" : "OFF"}
            </Text>
            <Text>
              [Ctrl+M] Minify output: {minify ? "ON" : "OFF"}
            </Text>
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text color="cyan">Quick File-Type Selects</Text>
            <Text>
              [T] All text | [1] JS | [2] React | [3] TS | [4] JSON | [5] MD
            </Text>
            <Text>
              [6] Py | [7] Go | [8] Java | [9] Ruby | [0] PHP | [R] Rust
            </Text>
            <Text>[U] Clear selections for files matching current filter</Text>
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text color="cyan">Presets</Text>
            {presetStore.presets.length === 0 && (
              <Text color="gray">No presets yet. Save one with Ctrl+S.</Text>
            )}
            {presetStore.presets.length > 0 && (
              <Box flexDirection="column">
                <Text>
                  Active preset:{" "}
                  {presetStore.presets[selectedPresetIndex]
                    ? presetStore.presets[selectedPresetIndex].name
                    : "(none)"}
                </Text>
                <Text>
                  Navigate with [ [ ] ], load with [Ctrl+L], delete with [Ctrl+D]
                </Text>
                <Box flexDirection="column" marginLeft={2}>
                  {presetStore.presets.map((p, index) => {
                    const isActive = index === selectedPresetIndex;
                    return (
                      <Text key={p.name} color={isActive ? "cyanBright" : undefined}>
                        {isActive ? "•" : " "} {p.name}
                      </Text>
                    );
                  })}
                </Box>
              </Box>
            )}
            <Text>
              [Ctrl+S] Save preset  [Ctrl+E] Export presets  [Ctrl+I] Import presets
            </Text>
            {focusField === "presetName" && (
              <Box marginTop={1}>
                <Text>Preset name: </Text>
                <TextInput
                  value={presetNameInput}
                  onChange={setPresetNameInput}
                  focus={true}
                />
              </Box>
            )}
            {focusField === "importPath" && (
              <Box marginTop={1}>
                <Text>Import from: </Text>
                <TextInput
                  value={importPathInput}
                  onChange={setImportPathInput}
                  focus={true}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>
          Keys: ↑/↓/PgUp/PgDn or j/k to move, Space to select, Enter/C to combine, F to edit
          filter, D to edit root, U to clear filtered selections, Ctrl+P/G/X/M for options,
          Ctrl+S/L/D/E/I for presets, Esc to clear focus
        </Text>
      </Box>
    </Box>
  );
};

export default App;
```

* * *

### `src/cli.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import App from "./app";

const args = process.argv.slice(2);
const rootDirArg = args[0];

render(<App initialRootDir={rootDirArg} />);
```

* * *

## How to run and build

From the project root:

```
bash

bashbun install
bun run src/cli.tsx           # dev: full-screen TUI
bun build src/cli.tsx --compile --outfile ystp
```

You can then run the compiled binary:

```
bash

bash./ystp                      # uses current directory as project root
./ystp /path/to/project     # explicit root
```

## Key mappings / UX summary

**Navigation & selection**

-   ```
    ↑ / ↓
    ```
    
    or
    
    ```
    j / k
    ```
    
    — move cursor in file list
    
-   ```
    PgUp / PgDn
    ```
    
    — scroll faster
    
-   ```
    Space
    ```
    
    — toggle selection for the focused file
    
-   ```
    F
    ```
    
    — focus the filter input
    
-   ```
    D
    ```
    
    — focus the root directory input
    
-   ```
    Enter
    ```
    
    or
    
    ```
    C
    ```
    
    — combine selected files and open the Combined Output view
    

**Quick selection**

-   ```
    T
    ```
    
    — toggle all text files
    
-   ```
    1
    ```
    
    JS,
    
    ```
    2
    ```
    
    React (
    
    ```
    .jsx
    ```
    
    /
    
    ```
    .tsx
    ```
    
    ),
    
    ```
    3
    ```
    
    TS,
    
    ```
    4
    ```
    
    JSON,
    
    ```
    5
    ```
    
    Markdown
    
-   ```
    6
    ```
    
    Python,
    
    ```
    7
    ```
    
    Go,
    
    ```
    8
    ```
    
    Java,
    
    ```
    9
    ```
    
    Ruby,
    
    ```
    0
    ```
    
    PHP,
    
    ```
    R
    ```
    
    Rust
    
-   ```
    U
    ```
    
    — clear all selections for files matching the current filter
    

**Options**

-   ```
    Ctrl+P
    ```
    
    — toggle preamble; edit text by focusing “Preamble text” (press
    
    ```
    P
    ```
    
    )
    
-   ```
    Ctrl+G
    ```
    
    — toggle goal; edit text by focusing “Goal text” (press
    
    ```
    G
    ```
    
    )
    
-   ```
    Ctrl+X
    ```
    
    — toggle “remove code comments”
    
-   ```
    Ctrl+M
    ```
    
    — toggle “minify output”
    

**Presets**

-   ```
    Ctrl+S
    ```
    
    — save preset (will prompt for name)
    
-   ```
    [
    ```
    
    /
    
    ```
    ]
    ```
    
    — move active preset selection up/down
    
-   ```
    Ctrl+L
    ```
    
    — load active preset (rescan + restore options + selections)
    
-   ```
    Ctrl+D
    ```
    
    — delete active preset
    
-   ```
    Ctrl+E
    ```
    
    — export presets (prompts for JSON path, default
    
    ```
    combined-prompt.txt
    ```
    
    in non-output mode)
    
-   ```
    Ctrl+I
    ```
    
    — import presets from a JSON file
    

**Combined output view**

-   ```
    Y
    ```
    
    — copy combined output to clipboard (macOS via
    
    ```
    pbcopy
    ```
    
    , Linux via
    
    ```
    wl-copy
    ```
    
    /
    
    ```
    xclip
    ```
    
    /
    
    ```
    xsel
    ```
    
    )
    
-   ```
    W
    ```
    
    — save combined output to a file (prompts for path)
    
-   ```
    S
    ```
    
    or
    
    ```
    Esc
    ```
    
    — return to main view
    

This setup mirrors the original HTML tool’s behavior but in a full-width, keyboard-driven TUI you can compile into a single Bun binary for Linux and macOS.

## User

I asked a competing LLM to do the same thing and their response is presented below; please study it carefully and with an open mind and be intellectually honest about what they may have done that’s better or incremental/complementary to your own design, and then come up with a superior hybrid best of both worlds version of the complete code: This is a feature-complete, "World-Class" TUI implementation. It replicates every feature of the original web utility (Recursive Selection, Minification, Token Estimation, Preamble/Goal injection) and adds powerful TUI-specific enhancements like Vim-bindings, Live Syntax Highlighting, Search Filtering, and a Presets System (saved to ~/.source2prompt.json). It uses Bun for the runtime/compiler and Ink (the industry-standard React renderer for terminals) to achieve the "slick" UI you requested. 1. Project Setup Initialize a Bun project and install the high-fidelity UI components. mkdir source2prompt
cd source2prompt
bun init -y

# UI & Rendering
bun add ink react ink-text-input ink-spinner ink-gradient ink-big-text ink-progress-bar ink-syntax-highlight

# Logic & Utilities
bun add globby ignore clipboardy filesize js-tiktoken chalk lodash date-fns

# Dev Dependencies
bun add -d @types/react @types/node @types/lodash
 2. The Application Code Create src/index.tsx. This single file contains the Virtual Scroller, Git-Aware Scanner, Minifier, and Layout Engine. import React, { useState, useEffect, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useStdoutDimensions } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import ProgressBar from 'ink-progress-bar';
import SyntaxHighlight from 'ink-syntax-highlight';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { globby } from 'globby';
import ignore from 'ignore';
import clipboardy from 'clipboardy';
import { filesize } from 'filesize';
import { getEncoding } from 'js-tiktoken';
import \_ from 'lodash';

// --- CONFIGURATION ---
const PRESET\_FILE = path.join(os.homedir(), '.source2prompt.json');
const CONTEXT\_WINDOW = 128000; // GPT-4o / Claude 3.5 Context Limit
const COST\_PER\_1M\_TOKENS = 5.00; // Approx blended input cost

// --- TYPES ---
interface FileNode {
 path: string;
 relPath: string;
 name: string;
 isDirectory: boolean;
 size: number;
 depth: number;
 children?: FileNode\[\];
}

interface Preset {
 name: string;
 preamble: string;
 goal: string;
 minify: boolean;
 selectedPaths: string\[\];
}

type Pane = 'explorer' | 'config' | 'preview';
type ConfigTab = 'inputs' | 'presets';

// --- UTILS ---
const enc = getEncoding("cl100k\_base");
const countTokens = (text: string) => enc.encode(text).length;

const loadPresets = (): Preset\[\] => {
 try { return JSON.parse(fs.readFileSync(PRESET\_FILE, 'utf-8')); } catch { return \[\]; }
};

const savePresets = (presets: Preset\[\]) => {
 fs.writeFileSync(PRESET\_FILE, JSON.stringify(presets, null, 2));
};

// --- MAIN APPLICATION ---
const App = () => {
 const { exit } = useApp();
 const \[cols, rows\] = useStdoutDimensions();
 const \[cwd\] = useState(process.cwd());

 // --- STATE ---
 // Data
 const \[root, setRoot\] = useState<FileNode | null>(null);
 const \[flatFiles, setFlatFiles\] = useState<FileNode\[\]>(\[\]);
 const \[loading, setLoading\] = useState(true);
 
 // Selection & Nav
 const \[expanded, setExpanded\] = useState<Set<string>>(new Set());
 const \[selected, setSelected\] = useState<Set<string>>(new Set());
 const \[activePane, setActivePane\] = useState<Pane>('explorer');
 const \[configTab, setConfigTab\] = useState<ConfigTab>('inputs');
 const \[cursor, setCursor\] = useState(0);
 const \[scrollOffset, setScrollOffset\] = useState(0);
 const \[filter, setFilter\] = useState("");
 
 // Inputs
 const \[preamble, setPreamble\] = useState("");
 const \[goal, setGoal\] = useState("");
 const \[minify, setMinify\] = useState(false);
 const \[presetName, setPresetName\] = useState("");
 const \[presets, setPresets\] = useState<Preset\[\]>(\[\]);

 // Derived
 const \[status, setStatus\] = useState("Ready");
 const \[stats, setStats\] = useState({ count: 0, size: 0, tokens: 0, cost: 0 });
 const \[previewContent, setPreviewContent\] = useState<string>("");
 const \[previewLang, setPreviewLang\] = useState<string>("txt");

 // --- 1. SCANNING ENGINE ---
 useEffect(() => {
 const scan = async () => {
 const ig = ignore();
 try { ig.add(await Bun.file(path.join(cwd, '.gitignore')).text()); } catch {}
 ig.add(\['.git', 'node\_modules', '.DS\_Store', 'bun.lockb', '\*.lock', 'dist', 'build', '.next'\]);

 // Fast glob scan
 const paths = await globby(\['\*\*/\*'\], { cwd, markDirectories: true, dot: true, ignore: \['.git/\*\*'\] });
 
 const rootNode: FileNode = { path: cwd, relPath: '.', name: path.basename(cwd), isDirectory: true, size: 0, depth: 0, children: \[\] };
 const flat: FileNode\[\] = \[\];

 // Build Tree Structure
 for (const p of paths.sort()) {
 if (ig.ignores(p)) continue;
 const parts = p.split('/');
 let current = rootNode;
 let currentRel = "";
 
 for (let i = 0; i < parts.length; i++) {
 const part = parts\[i\];
 const isDir = i < parts.length - 1 || p.endsWith('/');
 const cleanName = part.replace(/\\/$/, '');
 if(!cleanName) continue;
 
 currentRel = currentRel ?

```
${currentRel}/${cleanName}
```

: cleanName;
 
 let child = current.children?.find(c => c.name === cleanName);
 if (!child) {
 let size = 0;
 if (!isDir) try { size = fs.statSync(path.join(cwd, currentRel)).size; } catch {}
 
 child = {
 path: path.join(cwd, currentRel),
 relPath: currentRel,
 name: cleanName,
 isDirectory: isDir,
 size,
 depth: current.depth + 1,
 children: isDir ? \[\] : undefined
 };
 current.children?.push(child);
 if (!isDir) flat.push(child);
 }
 current = child;
 }
 }
 
 // Sort: Folders first, then alphabetical
 const sortRecursive = (n: FileNode) => {
 n.children?.sort((a,b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
 n.children?.forEach(sortRecursive);
 };
 sortRecursive(rootNode);

 setRoot(rootNode);
 setFlatFiles(flat);
 setExpanded(new Set(\[rootNode.path\]));
 setPresets(loadPresets());
 setLoading(false);
 };
 scan();
 }, \[\]);

 // --- 2. VIRTUAL TREE & FILTERING ---
 const visibleNodes = useMemo(() => {
 if (!root) return \[\];
 const results: FileNode\[\] = \[\];
 
 const traverse = (node: FileNode) => {
 // If filtering, show match OR if it contains a match (heuristic simplification: show all if filter matches child? no, simple filter for files)
 const matches = !filter || node.name.toLowerCase().includes(filter.toLowerCase());
 
 // If filtering, we auto-expand everything to show matches. If not, check expanded set.
 const isExpanded = filter ? true : expanded.has(node.path);
 
 if (matches || (node.isDirectory && filter)) { 
 // If folder doesn't match but children might, we still need logic. 
 // For simple TUI, we just filter leaves and show path.
 if (!node.isDirectory && matches) results.push(node);
 else if (node.isDirectory) results.push(node);
 }

 if (node.isDirectory && isExpanded && node.children) {
 node.children.forEach(traverse);
 }
 };
 
 // To handle filtering properly in a tree, usually you prune. 
 // Here we use the standard "Visual Tree" approach.
 const flatten = (n: FileNode) => {
 results.push(n);
 if (n.isDirectory && expanded.has(n.path) && n.children) n.children.forEach(flatten);
 }
 
 // If filter is active, we search flatFiles instead to be faster and show flat list
 if (filter) {
 return flatFiles.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
 } else if (root) {
 if (root.children) root.children.forEach(flatten);
 }
 
 return results;
 }, \[root, expanded, filter, flatFiles\]);

 // --- 3. STATS & PREVIEW ---
 useEffect(() => {
 const debouncedCalc = \_.debounce(() => {
 const selectedFiles = flatFiles.filter(f => selected.has(f.path));
 const size = selectedFiles.reduce((acc, f) => acc + f.size, 0);
 const estimatedTokens = Math.ceil(size / 3.5) + countTokens(preamble) + countTokens(goal);
 
 setStats({
 count: selectedFiles.length,
 size,
 tokens: estimatedTokens,
 cost: (estimatedTokens / 1\_000\_000) \* COST\_PER\_1M\_TOKENS
 });
 }, 300);
 debouncedCalc();
 return () => debouncedCalc.cancel();
 }, \[selected, preamble, goal\]);

 useEffect(() => {
 const node = visibleNodes\[cursor\];
 if (node && !node.isDirectory) {
 setPreviewLang(path.extname(node.name).slice(1) || 'txt');
 if (node.size > 50000) setPreviewContent("// File too large to preview");
 else Bun.file(node.path).text().then(setPreviewContent).catch(() => setPreviewContent("Error reading file"));
 } else {
 setPreviewContent("");
 }
 }, \[cursor, visibleNodes\]);

 // --- ACTIONS ---
 const toggleSelect = (node: FileNode) => {
 const newSel = new Set(selected);
 const target = !newSel.has(node.path);
 const apply = (n: FileNode) => {
 if (target) newSel.add(n.path); else newSel.delete(n.path);
 n.children?.forEach(apply); // Recursive select/deselect
 };
 
 // If filtering, we just toggle the file. If tree, we recurse.
 if (filter) {
 if (target) newSel.add(node.path); else newSel.delete(node.path);
 } else {
 apply(node);
 }
 setSelected(newSel);
 };

 const generate = async () => {
 setStatus("Generating...");
 await new Promise(r => setTimeout(r, 50));

 let out = "";
 if (preamble) out +=

```
<preamble>\n${preamble}\n</preamble>\n\n
```

;
 if (goal) out +=

```
<goal>\n${goal}\n</goal>\n\n
```

;

 out +=

```
<project_tree>\n
```

;
 const printTree = (n: FileNode, prefix = "") => {
 const isSel = selected.has(n.path);
 const hasSelChild = n.children?.some(c => selected.has(c.path) || (c.isDirectory && c.children.some(g => selected.has(g.path))));
 
 if (isSel || hasSelChild) {
 out +=

```
${prefix}${n.isDirectory ? '📂' : '📄'} ${n.name}\n
```

;
 n.children?.forEach(c => printTree(c, prefix + " "));
 }
 };
 if (root) printTree(root);
 out +=

```
</project_tree>\n\n
```

;

 const files = flatFiles.filter(f => selected.has(f.path));
 for (const f of files) {
 try {
 let content = await Bun.file(f.path).text();
 if (minify && /\\.(js|ts|tsx|json)$/.test(f.name)) {
 const loader = f.name.endsWith('json') ? 'json' : 'tsx';
 const res = await Bun.transform(content, { loader, minify: true });
 content = res.code;
 }
 out +=

```
<file path="${f.relPath}">\n${content}\n</file>\n\n
```

;
 } catch {}
 }

 clipboardy.writeSync(out);
 setStatus(

```
✅ Copied ${files.length} files!
```

);
 setTimeout(() => setStatus("Ready"), 3000);
 };

 const savePreset = () => {
 if(!presetName) return;
 const newP = { name: presetName, preamble, goal, minify, selectedPaths: Array.from(selected).map(p => path.relative(cwd, p)) };
 const list = \[...presets.filter(p => p.name !== presetName), newP\];
 setPresets(list);
 savePresets(list);
 setPresetName("");
 setStatus(

```
Saved preset: ${newP.name}
```

);
 };

 const loadPreset = (p: Preset) => {
 setPreamble(p.preamble);
 setGoal(p.goal);
 setMinify(p.minify);
 const sel = new Set<string>();
 p.selectedPaths.forEach(r => sel.add(path.join(cwd, r)));
 setSelected(sel);
 setStatus(

```
Loaded: ${p.name}
```

);
 };

 // --- INPUT HANDLING ---
 useInput((input, key) => {
 if (key.ctrl && input === 'c') exit();
 if (key.ctrl && input === 'g') generate();
 
 // Global Tab Switching
 if (key.tab) {
 const panes: Pane\[\] = \['explorer', 'config', 'preview'\];
 setActivePane(panes\[(panes.indexOf(activePane) + 1) % panes.length\]);
 }

 // EXPLORER CONTROLS
 if (activePane === 'explorer') {
 if (key.upArrow || input === 'k') {
 const next = Math.max(0, cursor - 1);
 setCursor(next);
 if (next < scrollOffset) setScrollOffset(next);
 }
 if (key.downArrow || input === 'j') {
 const next = Math.min(visibleNodes.length - 1, cursor + 1);
 setCursor(next);
 if (next > scrollOffset + (rows - 10)) setScrollOffset(prev => prev + 1);
 }
 
 const node = visibleNodes\[cursor\];
 if (node) {
 // Space to Select
 if (input === ' ') toggleSelect(node);
 
 // Arrows/Enter to Expand
 if (node.isDirectory) {
 if (key.rightArrow || input === 'l' || key.return) setExpanded(prev => new Set(prev).add(node.path));
 if (key.leftArrow || input === 'h') setExpanded(prev => { const s = new Set(prev); s.delete(node.path); return s; });
 }
 }
 }

 // CONFIG CONTROLS
 if (activePane === 'config') {
 if (key.leftArrow || key.rightArrow) setConfigTab(t => t === 'inputs' ? 'presets' : 'inputs');
 if (configTab === 'inputs' && input === 'm' && !preamble && !goal) setMinify(!minify); 
 }
 });

 // --- RENDER LAYOUT ---
 if (loading) return <Box padding={2}><Spinner type="dots" /> <Text> Scanning Project...</Text></Box>;

 const LIST\_HEIGHT = rows - 9;
 const viewNodes = visibleNodes.slice(scrollOffset, scrollOffset + LIST\_HEIGHT);

 return (
 <Box flexDirection="column" paddingX={1} height={rows} width={cols}>
 
 {/\* 1. HEADER \*/}
 <Box justifyContent="center" height={3}>
 <Gradient name="pastel"><BigText text="Source2Prompt" font="tiny" /></Gradient>
 </Box>

 {/\* 2. MAIN DASHBOARD \*/}
 <Box flexDirection="row" flexGrow={1} borderStyle="round" borderColor="gray">
 
 {/\* LEFT: EXPLORER \*/}
 <Box width="35%" flexDirection="column" borderRight borderStyle="single" borderColor={activePane === 'explorer' ? "cyan" : "gray"}>
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
 <Text bold color={activePane === 'explorer' ? "cyan" : "white"}>EXPLORER</Text>
 <Text dimColor>{stats.count} sel</Text>
 </Box>
 
 {/\* Filter \*/}
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1}>
 <Text color="cyan">🔍 </Text>
 <TextInput value={filter} onChange={setFilter} focus={activePane === 'explorer'} placeholder="Filter..." />
 </Box>

 <Box flexDirection="column" paddingLeft={1}>
 {viewNodes.map((node, i) => {
 const isCursor = (scrollOffset + i) === cursor;
 const isSel = selected.has(node.path);
 return (
 <Box key={node.path}>
 <Text color={isCursor ? "cyan" : "black"}>{isCursor ? "›" : " "}</Text>
 <Text dimColor>{" ".repeat(filter ? 0 : node.depth)}</Text>
 <Text color={isSel ? "green" : (node.isDirectory ? "yellow" : "white")}>
 {node.isDirectory ? (expanded.has(node.path) ? "📂" : "📁") : (isSel ? "▣" : "📄")} {node.name}
 </Text>
 </Box>
 )
 })}
 {visibleNodes.length === 0 && <Text dimColor>No files match "{filter}"</Text>}
 </Box>
 </Box>

 {/\* CENTER: CONFIG \*/}
 <Box width="30%" flexDirection="column" borderRight borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"}>
 <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
 <Box paddingX={1} borderRight borderStyle="single" borderColor={configTab === 'inputs' ? "cyan" : "gray"}>
 <Text bold={configTab === 'inputs'}>Inputs</Text>
 </Box>
 <Box paddingX={1} borderColor={configTab === 'presets' ? "cyan" : "gray"}>
 <Text bold={configTab === 'presets'}>Presets</Text>
 </Box>
 </Box>

 {configTab === 'inputs' ? (
 <Box flexDirection="column" padding={1}>
 <Text bold>Preamble</Text>
 <Box borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"} height={4}>
 <TextInput value={preamble} onChange={setPreamble} focus={activePane === 'config'} placeholder="System Context..." />
 </Box>
 <Text bold>Goal</Text>
 <Box borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"} height={4}>
 <TextInput value={goal} onChange={setGoal} focus={activePane === 'config'} placeholder="Task..." />
 </Box>
 <Box marginTop={1}>
 <Text>Minify: {minify ? <Text color="green">ON</Text> : <Text color="red">OFF</Text>}</Text>
 <Text dimColor>(Press 'm' to toggle)</Text>
 </Box>
 </Box>
 ) : (
 <Box flexDirection="column" padding={1}>
 {presets.length === 0 && <Text dimColor>No saved presets.</Text>}
 {presets.map(p => (
 <Box key={p.name} marginBottom={1}>
 <Text color="cyan" bold onClick={() => loadPreset(p)}>▶ {p.name}</Text>
 </Box>
 ))}
 <Box borderTop borderStyle="single" borderColor="gray" paddingTop={1} flexDirection="column">
 <Text>Save Current:</Text>
 <TextInput value={presetName} onChange={setPresetName} focus={activePane === 'config' && configTab === 'presets'} onSubmit={savePreset} placeholder="Enter Name..." />
 </Box>
 </Box>
 )}
 </Box>

 {/\* RIGHT: PREVIEW & STATS \*/}
 <Box width="35%" flexDirection="column" borderColor={activePane === 'preview' ? "cyan" : "gray"}>
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1}>
 <Text bold>PREVIEW</Text>
 </Box>
 <Box flexGrow={1} overflowY="hidden" paddingX={1}>
 <SyntaxHighlight language={previewLang} code={previewContent.slice(0, 1500) || "// No selection"} />
 </Box>
 
 {/\* Stats Footer \*/}
 <Box borderTop borderStyle="single" borderColor="gray" flexDirection="column" padding={1}>
 <Box justifyContent="space-between">
 <Text>Tokens: <Text color="magenta">{stats.tokens.toLocaleString()}</Text></Text>
 <Text color="green">${stats.cost.toFixed(4)}</Text>
 </Box>
 <ProgressBar percent={stats.tokens / CONTEXT\_WINDOW} color={stats.tokens > CONTEXT\_WINDOW ? "red" : "green"} />
 <Text dimColor>{(stats.tokens/CONTEXT\_WINDOW\*100).toFixed(1)}% of 128k</Text>
 </Box>
 </Box>
 </Box>

 {/\* 3. FOOTER \*/}
 <Box height={1} justifyContent="space-between" paddingX={1}>
 <Text dimColor>Nav: j/k | Select: Space | Pane: Tab | Gen: Ctrl+G</Text>
 <Text bold color={status === "Ready" ? "white" : "green"}>{status}</Text>
 </Box>
 </Box>
 );
};

render(<App />);
 3. Build the Single Binary To distribute this as a standalone tool that doesn't require Bun/Node on the target machine: 1 Add this build script to your package.json:
"scripts": {
 "build": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
}

 2 Run the build:
bun run build

 3 Run it: ./s2p How to Use • Navigation: Use Up/Down (or Vim keys j/k) to scroll. • Filtering: In the Explorer pane, just start typing to filter files by name. • Selection: Press Space to toggle a file. Pressing Space on a folder recursively selects/deselects all its children. • Tabs: Press Tab to switch between the File Explorer, Configuration, and Preview panes. • Settings: • Switch to the Config pane (Center). • Type your Preamble and Goal. • Press m (if inputs aren't focused) to toggle Minification. • Press Right Arrow to switch to the Presets tab to save your current configuration. • Generate: Press Ctrl+G. The tool will compile your prompt, minify the code (if enabled), and copy everything to your clipboard.

## Assistant

Here’s a genuinely fused “best of both worlds” implementation:

-   Uses **Bun + TypeScript + Ink** (React renderer for terminal apps).
    
-   Keeps your **comment-stripping / deep minification / structured output** from my first design.
    
-   Pulls in the competitor’s **tree explorer, Vim-style navigation, gradient header, live syntax-highlighted preview, token-estimation, cost + context bar, presets to `~/.source2prompt.json`, recursive folder selection, and clipboard auto-copy**.
    
-   Adds a **full-screen Combined Output view** (with save-to-file and copy-to-clipboard) that the competitor implementation didn’t have.
    
-   Uses a **git-aware recursive scanner with deep `.gitignore` support**.
    
-   Supports **quick file-type selects**, **minify vs comment-strip toggles**, **preamble/goal on/off and editing**, and **LLM-ish XML-ish section tags**:
    
    ```
    <preamble>
    ```
    
    ,
    
    ```
    <goal>
    ```
    
    ,
    
    ```
    <project_tree>
    ```
    
    ,
    
    ```
    <file ...>
    ```
    
    .
    

Everything below is complete and paste‑ready. No placeholders, no “rest of code” omissions.

* * *

## `package.json`

```
json

json{
  "name": "source2prompt-tui",
  "version": "0.2.0",
  "description": "Hybrid world-class TUI version of Your Source to Prompt (Bun + TypeScript + Ink).",
  "type": "module",
  "bin": {
    "s2p": "dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.tsx",
    "build": "tsc",
    "build:bin": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
  },
  "dependencies": {
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0",
    "ignore": "^5.3.0",
    "ink": "^5.0.1",
    "ink-big-text": "^2.0.0",
    "ink-gradient": "^3.0.0",
    "ink-progress-bar": "^4.0.0",
    "ink-spinner": "^5.0.0",
    "ink-syntax-highlight": "^1.0.2",
    "ink-text-input": "^6.0.0",
    "js-tiktoken": "^1.0.14",
    "clipboardy": "^4.0.0",
    "react": "^18.3.0",
    "terser": "^5.31.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8",
    "typescript": "^5.6.3"
  }
}
```

> Note: version ranges are reasonable; bump if you want absolutely latest.

* * *

## `tsconfig.json`

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

## `src/index.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import ProgressBar from "ink-progress-bar";
import SyntaxHighlight from "ink-syntax-highlight";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore, { Ignore } from "ignore";
import clipboardy from "clipboardy";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { encodingForModel, getEncoding, Tiktoken } from "js-tiktoken";

/* ---------- Types & constants ---------- */

type Pane = "explorer" | "config" | "preview";
type ConfigTab = "inputs" | "presets" | "options";
type Mode = "main" | "combined";

type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

interface FileNode {
  path: string; // absolute
  relPath: string; // relative to root
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  depth: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  numLines: number;
  content: string; // only for text files <= threshold; else ""
  children?: FileNode[];
}

interface Preset {
  name: string;
  rootDir: string;
  includePreamble: boolean;
  includeGoal: boolean;
  preamble: string;
  goal: string;
  minify: boolean;
  removeComments: boolean;
  selectedRelPaths: string[];
  createdAt: string;
}

interface CombinedResult {
  text: string;
  bytes: number;
  tokens: number;
  lines: number;
}

type FocusField =
  | "none"
  | "filter"
  | "rootDir"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath";

type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

/* ---------- Tokenizer setup ---------- */

let encoder: Tiktoken | null = null;
try {
  encoder = encodingForModel("gpt-4o-mini");
} catch {
  try {
    encoder = getEncoding("cl100k_base");
  } catch {
    encoder = null;
  }
}

function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoder) {
    const bytes = Buffer.byteLength(text, "utf8");
    return Math.ceil(bytes / 4);
  }
  return encoder.encode(text).length;
}

/* ---------- FS & scanning utilities ---------- */

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  ".hg/",
  ".svn/",
  ".idea/",
  ".vscode/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".turbo/",
  ".vercel/"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

const PRESET_FILE = path.join(os.homedir(), ".source2prompt.json");
const CONTEXT_WINDOW = 128000;
const COST_PER_1M_TOKENS = 5.0;
const MAX_PREVIEW_CHARS = 2000;
const MAX_READ_BYTES = 5 * 1024 * 1024; // 5MB

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const giPath = path.join(dirAbs, ".gitignore");
    try {
      const content = await fsp.readFile(giPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // ignore
    }

    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix
          ? path.posix.join(relPrefix, entry.name)
          : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ root: FileNode; flatFiles: FileNode[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);

  const root: FileNode = {
    path: resolvedRoot,
    relPath: ".",
    name: path.basename(resolvedRoot),
    isDirectory: true,
    sizeBytes: 0,
    depth: 0,
    extension: "",
    isText: false,
    category: "other",
    numLines: 0,
    content: "",
    children: []
  };

  const flatFiles: FileNode[] = [];
  let processed = 0;

  async function walk(dirAbs: string, parent: FileNode, relDir: string, depth: number) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const relPath = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(dirAbs, entry.name);

      if (entry.isDirectory()) {
        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: true,
          sizeBytes: 0,
          depth: depth + 1,
          extension: "",
          isText: false,
          category: "other",
          numLines: 0,
          content: "",
          children: []
        };
        parent.children!.push(node);
        await walk(absPath, node, relPath, depth + 1);
      } else if (entry.isFile()) {
        let sizeBytes = 0;
        try {
          const stat = await fsp.stat(absPath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }

        const extension = path.extname(entry.name).toLowerCase();
        let isText = isTextExtension(extension);
        let content = "";
        let numLines = 0;

        if (isText && sizeBytes <= MAX_READ_BYTES) {
          try {
            content = await fsp.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } catch {
            isText = false;
            content = "";
          }
        } else if (isText) {
          // treat very large files as non-text for safety
          isText = false;
        }

        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: false,
          sizeBytes,
          depth: depth + 1,
          extension,
          isText,
          category: getFileCategory(extension),
          numLines,
          content,
          children: undefined
        };

        parent.children!.push(node);
        flatFiles.push(node);
        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, root, "", 0);

  const sortRecursive = (n: FileNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      n.children.forEach(sortRecursive);
    }
  };
  sortRecursive(root);

  return { root, flatFiles };
}

/* ---------- Minification & transformation ---------- */

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

async function transformFileContent(
  file: FileNode,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  if (!file.isText) return file.content;
  let text = file.content || (await fsp.readFile(file.path, "utf8").catch(() => "")) || "";
  const ext = file.extension;

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fall through
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // fall through
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // fall through
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // fall through
      }
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    }
  }

  return text;
}

async function buildCombinedOutput(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<CombinedResult> {
  const selectedFiles = flatFiles.filter(f => !f.isDirectory && f.isText && selected.has(f.path));
  const lines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    lines.push("<preamble>", options.preambleText.trim(), "</preamble>", "");
  }

  if (options.includeGoal && options.goalText.trim()) {
    lines.push("<goal>", options.goalText.trim(), "</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines: string[] = [];
    treeLines.push("<project_tree>");

    const selectedSet = selected;

    const collectTree = (node: FileNode, prefix: string): boolean => {
      const isSel = !node.isDirectory && selectedSet.has(node.path);
      let hasSel = isSel;

      if (node.children && node.children.length > 0) {
        const beforeChildCount = treeLines.length;
        for (const child of node.children) {
          const childHas = collectTree(child, prefix + "  ");
          hasSel = hasSel || childHas;
        }
        if (hasSel) {
          const icon = node.isDirectory ? "📂" : "📄";
          const label =
            node.relPath === "." ? node.name : node.relPath;
          treeLines.splice(
            beforeChildCount,
            0,
            `${prefix}${icon} ${label}`
          );
        }
      } else if (isSel) {
        const icon = node.isDirectory ? "📂" : "📄";
        const label =
          node.relPath === "." ? node.name : node.relPath;
        treeLines.push(`${prefix}${icon} ${label}`);
      }

      return hasSel;
    };

    if (root.children) {
      for (const child of root.children) {
        collectTree(child, "  ");
      }
    }

    treeLines.push("</project_tree>", "");
    lines.push(...treeLines);
  }

  lines.push("<files>");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed.trimEnd();
    const numLines = content ? content.split(/\r?\n/).length : 0;
    lines.push(
      `<file path="${file.relPath}" lines="${numLines}" bytes="${file.sizeBytes}">`,
      content,
      "</file>",
      ""
    );
  }

  lines.push("</files>");

  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text, "utf8");
  const tokens = countTokens(text);
  const linesCount = text.split(/\r?\n/).length;

  return { text, bytes, tokens, lines: linesCount };
}

/* ---------- Presets & clipboard ---------- */

function loadPresets(): Preset[] {
  try {
    const raw = fs.readFileSync(PRESET_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.presets)) return parsed.presets;
    return [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    fs.writeFileSync(PRESET_FILE, JSON.stringify(presets, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await clipboardy.write(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Quick-select helpers ---------- */

const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

function filterFilesByQuickSelect(
  files: FileNode[],
  key: QuickSelectKey
): FileNode[] {
  switch (key) {
    case "allText":
      return files.filter(f => !f.isDirectory && f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}

/* ---------- Small debounce ---------- */

function debounce<F extends (...args: any[]) => void>(
  fn: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

/* ---------- Main App ---------- */

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rootDir, setRootDir] = useState(path.resolve(process.cwd()));

  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [flatFiles, setFlatFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [status, setStatus] = useState("Scanning project...");
  const [progressText, setProgressText] = useState<string | null>(null);

  const [activePane, setActivePane] = useState<Pane>("explorer");
  const [configTab, setConfigTab] = useState<ConfigTab>("inputs");
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [focusField, setFocusField] = useState<FocusField>("none");

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goal, setGoal] = useState("");
  const [minify, setMinify] = useState(false);
  const [removeComments, setRemoveComments] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  const [statsTokens, setStatsTokens] = useState(0);
  const [statsSizeBytes, setStatsSizeBytes] = useState(0);
  const [statsFileCount, setStatsFileCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLang, setPreviewLang] = useState("txt");

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [exportPath, setExportPath] = useState("combined-prompt.txt");

  const rows = stdout.rows ?? 30;
  const cols = stdout.columns ?? 120;
  const listHeight = Math.max(8, rows - 12);

  const handleScan = async (dir: string) => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setLoading(true);
    setScanError(null);
    setStatus("Scanning project...");
    setProgressText(null);
    setRootNode(null);
    setFlatFiles([]);
    setExpanded(new Set());
    setSelected(new Set());
    setCursor(0);
    setScrollOffset(0);

    try {
      const { root, flatFiles: files } = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      setRootNode(root);
      setFlatFiles(files);
      setExpanded(new Set([root.path]));
      setStatus(`Scanned ${files.length} files from ${resolved}`);
    } catch (err: any) {
      setScanError(err?.message || String(err));
      setStatus("Scan error");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  useEffect(() => {
    (async () => {
      const loaded = loadPresets();
      setPresets(loaded);
      await handleScan(rootDir);
      setStatus("Ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNodes = useMemo(() => {
    if (!rootNode) return [];
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      return flatFiles.filter(f =>
        f.relPath.toLowerCase().includes(q)
      );
    }

    const out: FileNode[] = [];
    const traverse = (n: FileNode) => {
      out.push(n);
      if (n.isDirectory && expanded.has(n.path) && n.children) {
        for (const child of n.children) traverse(child);
      }
    };
    traverse(rootNode);
    return out;
  }, [rootNode, flatFiles, expanded, filter]);

  useEffect(() => {
    if (cursor >= visibleNodes.length) {
      setCursor(visibleNodes.length > 0 ? visibleNodes.length - 1 : 0);
      setScrollOffset(0);
    }
  }, [visibleNodes.length, cursor]);

  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + listHeight) {
      setScrollOffset(cursor - listHeight + 1);
    }
  }, [cursor, scrollOffset, listHeight]);

  const viewNodes = useMemo(
    () => visibleNodes.slice(scrollOffset, scrollOffset + listHeight),
    [visibleNodes, scrollOffset, listHeight]
  );

  const debouncedStats = useMemo(
    () =>
      debounce(
        (
          files: FileNode[],
          selected: Set<string>,
          includePreamble: boolean,
          preamble: string,
          includeGoal: boolean,
          goal: string
        ) => {
          const selectedFiles = files.filter(
            f => !f.isDirectory && f.isText && selected.has(f.path)
          );
          const size = selectedFiles.reduce(
            (acc, f) => acc + f.sizeBytes,
            0
          );

          const approxFromSize = Math.ceil(size / 3.5);
          const paramTokens =
            (includePreamble ? countTokens(preamble) : 0) +
            (includeGoal ? countTokens(goal) : 0);
          const totalTokens = approxFromSize + paramTokens;

          setStatsFileCount(selectedFiles.length);
          setStatsSizeBytes(size);
          setStatsTokens(totalTokens);
        },
        200
      ),
    []
  );

  useEffect(() => {
    debouncedStats(
      flatFiles,
      selected,
      includePreamble,
      preamble,
      includeGoal,
      goal
    );
  }, [flatFiles, selected, includePreamble, preamble, includeGoal, goal, debouncedStats]);

  useEffect(() => {
    const node = visibleNodes[cursor];
    if (!node || node.isDirectory || !node.isText) {
      setPreviewContent("");
      setPreviewLang("txt");
      return;
    }
    const ext = node.extension.toLowerCase();
    const lang =
      ext === ".ts" || ext === ".tsx"
        ? "ts"
        : ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs"
        ? "js"
        : ext === ".json"
        ? "json"
        : ext === ".md" || ext === ".markdown" || ext === ".mdx"
        ? "md"
        : ext === ".py"
        ? "py"
        : ext === ".java"
        ? "java"
        : ext === ".go"
        ? "go"
        : ext === ".rb"
        ? "rb"
        : ext === ".php"
        ? "php"
        : ext === ".rs"
        ? "rs"
        : ext === ".html" || ext === ".htm"
        ? "html"
        : ext === ".css" || ext === ".scss" || ext === ".sass" || ext === ".less"
        ? "css"
        : "txt";
    setPreviewLang(lang);

    if (node.content) {
      setPreviewContent(
        node.content.length > MAX_PREVIEW_CHARS
          ? node.content.slice(0, MAX_PREVIEW_CHARS)
          : node.content
      );
    } else if (node.isText) {
      fsp
        .readFile(node.path, "utf8")
        .then(content =>
          setPreviewContent(
            content.length > MAX_PREVIEW_CHARS
              ? content.slice(0, MAX_PREVIEW_CHARS)
              : content
          )
        )
        .catch(() => setPreviewContent("// Error reading file"));
    }
  }, [visibleNodes, cursor]);

  const toggleSelectNode = (node: FileNode) => {
    if (node.isDirectory && !filter.trim()) {
      const newSel = new Set(selected);
      const collectFiles = (n: FileNode) => {
        if (!n.isDirectory && n.isText) {
          if (newSel.has(n.path)) {
            // will be decided later
          }
        }
        if (n.children) {
          for (const child of n.children) collectFiles(child);
        }
      };
      const descendants: FileNode[] = [];
      const collectDesc = (n: FileNode) => {
        if (!n.isDirectory && n.isText) descendants.push(n);
        if (n.children) for (const c of n.children) collectDesc(c);
      };
      collectDesc(node);
      const allSelected = descendants.every(d => newSel.has(d.path));
      if (allSelected) {
        for (const d of descendants) newSel.delete(d.path);
      } else {
        for (const d of descendants) newSel.add(d.path);
      }
      setSelected(newSel);
      setStatus(
        `${allSelected ? "Deselected" : "Selected"} ${descendants.length} files in "${node.relPath}"`
      );
      return;
    }

    if (!node.isDirectory) {
      if (!node.isText) {
        setStatus("File is binary or too large to include.");
        return;
      }
      const newSel = new Set(selected);
      if (newSel.has(node.path)) newSel.delete(node.path);
      else newSel.add(node.path);
      setSelected(newSel);
    }
  };

  const moveCursor = (delta: number) => {
    if (!visibleNodes.length) return;
    const maxIndex = visibleNodes.length - 1;
    let next = cursor + delta;
    if (next < 0) next = 0;
    if (next > maxIndex) next = maxIndex;
    setCursor(next);
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!flatFiles.length) return;
    const matches = filterFilesByQuickSelect(flatFiles, key).filter(
      f => f.isText
    );
    if (!matches.length) {
      setStatus("No matching files for this quick select.");
      return;
    }

    const newSel = new Set(selected);
    const allSelected = matches.every(m => newSel.has(m.path));
    if (allSelected) {
      for (const m of matches) newSel.delete(m.path);
    } else {
      for (const m of matches) newSel.add(m.path);
    }
    setSelected(newSel);
    setStatus(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filter.trim()) return;
    const q = filter.trim().toLowerCase();
    const inFilter = flatFiles.filter(f =>
      f.relPath.toLowerCase().includes(q)
    );
    if (!inFilter.length) return;
    const newSel = new Set(selected);
    for (const f of inFilter) newSel.delete(f.path);
    setSelected(newSel);
    setStatus("Cleared selections for files matching current filter.");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setStatus("Preset name cannot be empty.");
      return;
    }
    const selectedRelPaths = flatFiles
      .filter(f => selected.has(f.path))
      .map(f => f.relPath)
      .sort();

    const preset: Preset = {
      name,
      rootDir,
      includePreamble,
      includeGoal,
      preamble,
      goal,
      minify,
      removeComments,
      selectedRelPaths,
      createdAt: new Date().toISOString()
    };

    const filtered = presets.filter(p => p.name !== name);
    const next = [...filtered, preset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setStatus(`Saved preset "${name}".`);
  };

  const handleLoadPreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    setIncludePreamble(preset.includePreamble);
    setIncludeGoal(preset.includeGoal);
    setPreamble(preset.preamble);
    setGoal(preset.goal);
    setMinify(preset.minify);
    setRemoveComments(preset.removeComments);
    setStatus(`Loading preset "${preset.name}"...`);

    if (path.resolve(preset.rootDir) !== path.resolve(rootDir)) {
      (async () => {
        await handleScan(preset.rootDir);
        const newSel = new Set<string>();
        for (const p of preset.selectedRelPaths) {
          const abs = path.join(path.resolve(preset.rootDir), p);
          const node = flatFiles.find(f => f.path === abs);
          if (node && node.isText) newSel.add(abs);
        }
        setSelected(newSel);
        setStatus(
          `Loaded preset "${preset.name}" (${newSel.size} files selected).`
        );
      })();
    } else {
      const newSel = new Set<string>();
      for (const p of preset.selectedRelPaths) {
        const abs = path.join(rootDir, p);
        const node = flatFiles.find(f => f.path === abs);
        if (node && node.isText) newSel.add(abs);
      }
      setSelected(newSel);
      setStatus(
        `Loaded preset "${preset.name}" (${newSel.size} files selected).`
      );
    }
  };

  const handleDeletePreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    const next = presets.filter((_, i) => i !== index);
    setPresets(next);
    savePresets(next);
    setSelectedPresetIndex(prev =>
      prev >= next.length ? Math.max(0, next.length - 1) : prev
    );
    setStatus(`Deleted preset "${preset.name}".`);
  };

  const handleGenerate = async () => {
    if (!rootNode) return;
    const selectedFiles = flatFiles.filter(
      f => !f.isDirectory && f.isText && selected.has(f.path)
    );
    if (!selectedFiles.length) {
      setStatus("No files selected. Select at least one text file first.");
      return;
    }

    setStatus("Generating combined prompt...");
    setMode("main");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText: preamble,
        includeGoal,
        goalText: goal,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(
        rootNode,
        flatFiles,
        selected,
        options
      );
      setCombined(result);
      const copied = await copyToClipboard(result.text);
      setMode("combined");
      setStatus(
        `${copied ? "Copied to clipboard" : "Generated"}: ${formatBytes(
          result.bytes
        )}, ~${result.tokens.toLocaleString()} tokens.`
      );
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  const handleSaveCombinedToFile = async () => {
    if (!combined) return;
    const target = exportPath.trim() || "combined-prompt.txt";
    const resolved = path.isAbsolute(target)
      ? target
      : path.resolve(rootDir, target);
    try {
      await fsp.writeFile(resolved, combined.text, "utf8");
      setStatus(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "combined") {
      if (focusField === "exportPath") {
        if (key.escape) {
          setFocusField("none");
          return;
        }
        if (key.return) {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
        return;
      }

      const lower = input.toLowerCase();
      if (key.escape || lower === "q") {
        setMode("main");
        setStatus("Back to main view.");
        return;
      }
      if (lower === "y") {
        if (combined) {
          void copyToClipboard(combined.text).then(ok =>
            setStatus(
              ok
                ? "Copied combined output to clipboard."
                : "Clipboard copy failed."
            )
          );
        }
        return;
      }
      if (lower === "w") {
        setFocusField("exportPath");
        return;
      }
      return;
    }

    if (focusField !== "none") {
      if (key.escape) {
        setFocusField("none");
        return;
      }
      if (key.return) {
        if (focusField === "rootDir") {
          void handleScan(rootDir);
          setFocusField("none");
          return;
        }
        if (focusField === "filter") {
          setFocusField("none");
          return;
        }
        if (focusField === "preamble") {
          setFocusField("none");
          return;
        }
        if (focusField === "goal") {
          setFocusField("none");
          return;
        }
        if (focusField === "presetName") {
          handleSavePreset();
          setFocusField("none");
          return;
        }
        if (focusField === "exportPath") {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === "g") {
      void handleGenerate();
      return;
    }

    if (key.tab) {
      const panes: Pane[] = ["explorer", "config", "preview"];
      const idx = panes.indexOf(activePane);
      const next = panes[(idx + 1) % panes.length];
      setActivePane(next);
      return;
    }

    if (activePane === "explorer") {
      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }

      const node = visibleNodes[cursor];

      if (key.leftArrow || input === "h") {
        if (node && node.isDirectory && expanded.has(node.path)) {
          const next = new Set(expanded);
          next.delete(node.path);
          setExpanded(next);
        }
        return;
      }

      if (key.rightArrow || input === "l") {
        if (node && node.isDirectory && !expanded.has(node.path)) {
          const next = new Set(expanded);
          next.add(node.path);
          setExpanded(next);
        }
        return;
      }

      if (input === " ") {
        if (node) toggleSelectNode(node);
        return;
      }

      if (key.return) {
        if (node) {
          if (node.isDirectory) {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          } else {
            toggleSelectNode(node);
          }
        }
        return;
      }

      if (input === "/" || input.toLowerCase() === "f") {
        setFocusField("filter");
        setActivePane("explorer");
        return;
      }

      if (input.toLowerCase() === "d") {
        setFocusField("rootDir");
        return;
      }

      if (input.toLowerCase() === "u") {
        clearSelectionInFilter();
        return;
      }

      if (input === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (input.toLowerCase() === "r") {
        toggleQuickSelect("rust");
        return;
      }
    }

    if (activePane === "config") {
      if (key.leftArrow || key.rightArrow) {
        setConfigTab(prev =>
          prev === "inputs"
            ? "presets"
            : prev === "presets"
            ? "options"
            : "inputs"
        );
        return;
      }

      if (configTab === "inputs") {
        if (input.toLowerCase() === "p") {
          setFocusField("preamble");
          return;
        }
        if (input.toLowerCase() === "g") {
          setFocusField("goal");
          return;
        }
      }

      if (configTab === "options") {
        if (input.toLowerCase() === "i") {
          setIncludePreamble(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "o") {
          setIncludeGoal(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "m") {
          setMinify(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "x") {
          setRemoveComments(prev => !prev);
          return;
        }
      }

      if (configTab === "presets") {
        if (key.upArrow || input === "k") {
          setSelectedPresetIndex(prev =>
            prev <= 0 ? 0 : prev - 1
          );
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedPresetIndex(prev =>
            prev >= presets.length - 1
              ? Math.max(0, presets.length - 1)
              : prev + 1
          );
          return;
        }
        if (input.toLowerCase() === "l") {
          if (presets.length) handleLoadPreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "d") {
          if (presets.length) handleDeletePreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "s") {
          setFocusField("presetName");
          return;
        }
      }
    }
  });

  const cost = (statsTokens / 1_000_000) * COST_PER_1M_TOKENS;
  const contextPercent = Math.min(
    1,
    statsTokens / CONTEXT_WINDOW
  );
  const contextWarning =
    statsTokens > CONTEXT_WINDOW
      ? "⚠️ Estimated tokens exceed context window; model may truncate."
      : statsTokens > 100_000
      ? "Large prompt; ensure you're using a 128k+ context model."
      : "";

  if (loading && !rootNode) {
    return (
      <Box padding={2} flexDirection="column">
        <Box>
          <Spinner type="dots" />
          <Text> Scanning project...</Text>
        </Box>
        {progressText && (
          <Box marginTop={1}>
            <Text>{progressText}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === "combined") {
    return (
      <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
        <Box justifyContent="center" height={3}>
          <Gradient name="pastel">
            <BigText text="Combined Prompt" font="tiny" />
          </Gradient>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={1}
          flexGrow={1}
          overflow="hidden"
        >
          <Text>
            {combined ? combined.text : "(nothing generated yet)"}
          </Text>
        </Box>
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          paddingTop={1}
          justifyContent="space-between"
        >
          <Text dimColor>
            [Y] Copy  [W] Save to file  [Esc/Q] Back
          </Text>
          {combined && (
            <Text>
              {formatBytes(combined.bytes)} | Lines: {combined.lines} | Tokens:{" "}
              {combined.tokens.toLocaleString()}
            </Text>
          )}
        </Box>
        {focusField === "exportPath" && (
          <Box marginTop={1}>
            <Text>Save as: </Text>
            <TextInput
              value={exportPath}
              onChange={setExportPath}
              focus={true}
            />
          </Box>
        )}
        <Box marginTop={1}>
          <Text color="green">{status}</Text>
        </Box>
      </Box>
    );
  }

  const explorerWidth = Math.floor(cols * 0.4);
  const configWidth = Math.floor(cols * 0.3);
  const previewWidth = cols - explorerWidth - configWidth - 4;

  return (
    <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
      <Box justifyContent="center" height={3}>
        <Gradient name="morning">
          <BigText text="Source2Prompt" font="tiny" />
        </Gradient>
      </Box>

      <Box marginBottom={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box
        flexDirection="row"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
      >
        {/* Explorer */}
        <Box
          width={explorerWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "explorer" ? "cyan" : "gray"}
        >
          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            justifyContent="space-between"
          >
            <Text bold color={activePane === "explorer" ? "cyan" : "white"}>
              EXPLORER
            </Text>
            <Text dimColor>
              {statsFileCount} sel / {flatFiles.length} files
            </Text>
          </Box>

          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <Text color="cyan">🔍 </Text>
            <TextInput
              value={filter}
              onChange={setFilter}
              focus={focusField === "filter" && activePane === "explorer"}
              placeholder="Filter by path..."
            />
          </Box>

          <Box flexDirection="column" paddingLeft={1}>
            {viewNodes.length === 0 && (
              <Text dimColor>No files match current filter.</Text>
            )}
            {viewNodes.map((node, idx) => {
              const isCursor = scrollOffset + idx === cursor;
              const isSel = selected.has(node.path);
              const marker = isCursor ? "›" : " ";
              const indent = filter.trim() ? 0 : node.depth;
              const icon = node.isDirectory
                ? expanded.has(node.path)
                  ? "📂"
                  : "📁"
                : isSel
                ? "▣"
                : node.isText
                ? "📄"
                : "⛔";

              let color: any = node.isDirectory
                ? "yellow"
                : node.isText
                ? isSel
                  ? "green"
                  : "white"
                : "red";

              if (isCursor) color = "cyan";

              return (
                <Box key={node.path}>
                  <Text color={isCursor ? "cyan" : "black"}>{marker}</Text>
                  <Text dimColor>{" ".repeat(indent)}</Text>
                  <Text color={color}>
                    {icon} {node.relPath === "." ? node.name : node.relPath}{" "}
                    {!node.isDirectory &&
                      `(${formatBytes(node.sizeBytes)}${node.isText ? "" : ", binary"})`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Config */}
        <Box
          width={configWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "config" ? "cyan" : "gray"}
        >
          <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
            <Box
              paddingX={1}
              borderRight
              borderStyle="single"
              borderColor={configTab === "inputs" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "inputs"}>Inputs</Text>
            </Box>
            <Box
              paddingX={1}
              borderRight
              borderStyle="single"
              borderColor={configTab === "presets" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "presets"}>Presets</Text>
            </Box>
            <Box
              paddingX={1}
              borderColor={configTab === "options" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "options"}>Options</Text>
            </Box>
          </Box>

          {configTab === "inputs" && (
            <Box flexDirection="column" padding={1}>
              <Text bold>
                Preamble{" "}
                <Text color={includePreamble ? "green" : "red"}>
                  [{includePreamble ? "ON" : "OFF"}]
                </Text>
              </Text>
              <Box
                borderStyle="single"
                borderColor={focusField === "preamble" ? "cyan" : "gray"}
                paddingX={1}
                marginBottom={1}
              >
                <TextInput
                  value={preamble}
                  onChange={setPreamble}
                  focus={focusField === "preamble"}
                  placeholder="System / context instructions..."
                />
              </Box>

              <Text bold>
                Goal{" "}
                <Text color={includeGoal ? "green" : "red"}>
                  [{includeGoal ? "ON" : "OFF"}]
                </Text>
              </Text>
              <Box
                borderStyle="single"
                borderColor={focusField === "goal" ? "cyan" : "gray"}
                paddingX={1}
              >
                <TextInput
                  value={goal}
                  onChange={setGoal}
                  focus={focusField === "goal"}
                  placeholder="High-level task / objective..."
                />
              </Box>

              <Box marginTop={1}>
                <Text dimColor>
                  [P] Edit preamble  [G] Edit goal (while in Inputs tab)
                </Text>
              </Box>
            </Box>
          )}

          {configTab === "presets" && (
            <Box flexDirection="column" padding={1}>
              {presets.length === 0 && (
                <Text dimColor>No presets yet. Press 'S' to save one.</Text>
              )}
              {presets.map((p, idx) => {
                const active = idx === selectedPresetIndex;
                return (
                  <Box key={p.name}>
                    <Text color={active ? "cyanBright" : "white"}>
                      {active ? "•" : " "} {p.name}
                    </Text>
                  </Box>
                );
              })}
              <Box
                borderTop
                borderStyle="single"
                borderColor="gray"
                paddingTop={1}
                flexDirection="column"
              >
                <Text>Save current selection as preset:</Text>
                <Box>
                  <Text>Name: </Text>
                  <TextInput
                    value={presetName}
                    onChange={setPresetName}
                    focus={focusField === "presetName"}
                    placeholder="Preset name..."
                  />
                </Box>
                <Box marginTop={1} flexDirection="column">
                  <Text dimColor>
                    [J/K] Move  [L] Load  [D] Delete  [S] Focus name + save
                  </Text>
                </Box>
              </Box>
            </Box>
          )}

          {configTab === "options" && (
            <Box flexDirection="column" padding={1}>
              <Text>
                Include preamble:{" "}
                <Text color={includePreamble ? "green" : "red"}>
                  {includePreamble ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [I])
              </Text>
              <Text>
                Include goal:{" "}
                <Text color={includeGoal ? "green" : "red"}>
                  {includeGoal ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [O])
              </Text>
              <Text>
                Remove comments:{" "}
                <Text color={removeComments ? "green" : "red"}>
                  {removeComments ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [X])
              </Text>
              <Text>
                Minify:{" "}
                <Text color={minify ? "green" : "red"}>
                  {minify ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [M])
              </Text>
              <Box marginTop={1}>
                <Text dimColor>
                  Options tab shortcuts: [I] preamble, [O] goal, [X] comments, [M] minify
                </Text>
              </Box>
            </Box>
          )}
        </Box>

        {/* Preview & stats */}
        <Box
          width={previewWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "preview" ? "cyan" : "gray"}
        >
          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <Text bold>PREVIEW</Text>
          </Box>
          <Box flexGrow={1} paddingX={1}>
            <SyntaxHighlight
              language={previewLang}
              code={
                previewContent ||
                "// Select a text file to preview (or press Ctrl+G to generate)."
              }
            />
          </Box>
          <Box
            borderTop
            borderStyle="single"
            borderColor="gray"
            flexDirection="column"
            padding={1}
          >
            <Box justifyContent="space-between">
              <Text>
                Tokens:{" "}
                <Text color="magenta">
                  {statsTokens.toLocaleString()}
                </Text>
              </Text>
              <Text color="green">${cost.toFixed(4)}</Text>
            </Box>
            <ProgressBar
              percent={contextPercent}
              color={statsTokens > CONTEXT_WINDOW ? "red" : "green"}
            />
            <Text dimColor>
              {Math.round(contextPercent * 1000) / 10}% of {CONTEXT_WINDOW.toLocaleString()}-token
              context
            </Text>
            {contextWarning && (
              <Text color="yellow">{contextWarning}</Text>
            )}
            <Box marginTop={1} flexDirection="column">
              <Text>
                Selected size: {formatBytes(statsSizeBytes)} | Files:{" "}
                {statsFileCount}
              </Text>
              <Text dimColor>
                Generation: press Ctrl+G to build combined prompt and open Combined view.
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        height={2}
        justifyContent="space-between"
        paddingX={1}
        borderTop
        borderStyle="single"
        borderColor="gray"
      >
        <Box flexDirection="column">
          <Text dimColor>
            Panes: Tab | Explorer: j/k, h/l, Space/Enter, / or F filter, D root, T/1-9/0/R quick
            select, U clear filter selection
          </Text>
          <Text dimColor>
            Config: arrows to tab, P/G (inputs), S/L/D (presets), I/O/X/M (options) | Generate:
            Ctrl+G | Combined view: see hints in that screen
          </Text>
        </Box>
        <Box alignItems="flex-end">
          {scanError ? (
            <Text color="red">Error: {scanError}</Text>
          ) : (
            <Text color={status.startsWith("Ready") ? "white" : "green"}>
              {status}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

render(<App />);
```

* * *

## Build & Run

From the project root:

```
bash

bashbun install

# Dev
bun run src/index.tsx          # or: bun run dev

# Type-check & JS build
bun run build

# Single-file native binary (Linux/macOS)
bun run build:bin              # outputs ./s2p

# Usage
./s2p                          # root = current directory
./s2p /path/to/project         # (if you wire args yourself later)
```

(If you want CLI args handled inside the app, you can wrap

```
App
```

in a tiny arg-parsing shim and pass an

```
initialRootDir
```

prop, but I kept

```
index.tsx
```

self-contained as requested.)

* * *

If you want, next step we can iterate specifically on:

-   prompt format (tags, headings, etc.),
    
-   tuning minification/comment-stripping defaults for different languages,
    
-   or adding a 4th pane that shows a live _partial_ combined prompt sample while still in main mode.

## User

Yes iterate on ALL those things and make it all WAY better

## Assistant

Alright, here’s a **much more refined “v2”** that:

-   Upgrades the **prompt format** to a clean, machine‑friendly, LLM‑centric structure with metadata and rich per‑file annotations.
    
-   Smartens **token estimation** (per file, using real tokenizer where possible).
    
-   Deepens **minification/comment stripping** behavior per language, and uses **Bun.transform** when available for JS/TS for better minification.
    
-   Adds a **4th live “Prompt Sample” pane** so you can see an always‑up‑to‑date snippet of the combined prompt while you’re still in the main UI.
    
-   Keeps/extends the **world‑class TUI UX**: Vim keys, multi‑pane layout, live syntax highlighting, presets, quick selects, tree explorer, combined output view with copy & save.
    

Everything below is complete, paste‑ready code. No ellipses, no stubs.

* * *

## `package.json`

You can keep your existing one, but here’s an updated, consistent version:

```
json

json{
  "name": "source2prompt-tui",
  "version": "0.3.0",
  "description": "Hybrid world-class TUI version of Your Source to Prompt (Bun + TypeScript + Ink).",
  "type": "module",
  "bin": {
    "s2p": "dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.tsx",
    "build": "tsc",
    "build:bin": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
  },
  "dependencies": {
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0",
    "ignore": "^5.3.0",
    "ink": "^5.0.1",
    "ink-big-text": "^2.0.0",
    "ink-gradient": "^3.0.0",
    "ink-progress-bar": "^4.0.0",
    "ink-spinner": "^5.0.0",
    "ink-syntax-highlight": "^1.0.2",
    "ink-text-input": "^6.0.0",
    "js-tiktoken": "^1.0.14",
    "clipboardy": "^4.0.0",
    "react": "^18.3.0",
    "terser": "^5.31.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8",
    "typescript": "^5.6.3"
  }
}
```

* * *

## `tsconfig.json`

If you already have this from the previous iteration, you can reuse it:

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

## `src/index.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import ProgressBar from "ink-progress-bar";
import SyntaxHighlight from "ink-syntax-highlight";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore, { Ignore } from "ignore";
import clipboardy from "clipboardy";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { encodingForModel, getEncoding, Tiktoken } from "js-tiktoken";

declare const Bun: any;

/* ---------- Types & constants ---------- */

type Pane = "explorer" | "config" | "preview";
type ConfigTab = "inputs" | "presets" | "options";
type Mode = "main" | "combined";

type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

interface FileNode {
  path: string; // absolute
  relPath: string; // relative to root
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  depth: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  numLines: number;
  content: string; // only for small text files; else ""
  children?: FileNode[];
}

interface Preset {
  name: string;
  rootDir: string;
  includePreamble: boolean;
  includeGoal: boolean;
  preamble: string;
  goal: string;
  minify: boolean;
  removeComments: boolean;
  selectedRelPaths: string[];
  createdAt: string;
}

interface CombinedResult {
  text: string;
  bytes: number;
  tokens: number;
  lines: number;
}

type FocusField =
  | "none"
  | "filter"
  | "rootDir"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath";

type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

/* ---------- Tokenizer setup ---------- */

let encoder: Tiktoken | null = null;
try {
  encoder = encodingForModel("gpt-4o-mini");
} catch {
  try {
    encoder = getEncoding("cl100k_base");
  } catch {
    encoder = null;
  }
}

function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoder) {
    const bytes = Buffer.byteLength(text, "utf8");
    return Math.ceil(bytes / 4);
  }
  return encoder.encode(text).length;
}

/* ---------- FS & scanning utilities ---------- */

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  ".hg/",
  ".svn/",
  ".idea/",
  ".vscode/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".turbo/",
  ".vercel/"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

const PRESET_FILE = path.join(os.homedir(), ".source2prompt.json");
const CONTEXT_WINDOW = 128000;
const COST_PER_1M_TOKENS = 5.0;
const MAX_PREVIEW_CHARS = 2000;
const MAX_READ_BYTES = 5 * 1024 * 1024; // 5MB

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

function languageFromExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".ts" || e === ".tsx") return "ts";
  if (e === ".js" || e === ".jsx" || e === ".mjs" || e === ".cjs") return "js";
  if (e === ".json") return "json";
  if (e === ".md" || e === ".markdown" || e === ".mdx") return "md";
  if (e === ".py") return "py";
  if (e === ".java") return "java";
  if (e === ".go") return "go";
  if (e === ".rb") return "rb";
  if (e === ".php") return "php";
  if (e === ".rs") return "rs";
  if (e === ".html" || e === ".htm") return "html";
  if (e === ".css" || e === ".scss" || e === ".sass" || e === ".less") return "css";
  if (e === ".yml" || e === ".yaml") return "yaml";
  if (e === ".xml") return "xml";
  return "txt";
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const giPath = path.join(dirAbs, ".gitignore");
    try {
      const content = await fsp.readFile(giPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // ignore
    }

    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix
          ? path.posix.join(relPrefix, entry.name)
          : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ root: FileNode; flatFiles: FileNode[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);

  const root: FileNode = {
    path: resolvedRoot,
    relPath: ".",
    name: path.basename(resolvedRoot),
    isDirectory: true,
    sizeBytes: 0,
    depth: 0,
    extension: "",
    isText: false,
    category: "other",
    numLines: 0,
    content: "",
    children: []
  };

  const flatFiles: FileNode[] = [];
  let processed = 0;

  async function walk(dirAbs: string, parent: FileNode, relDir: string, depth: number) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const relPath = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(dirAbs, entry.name);

      if (entry.isDirectory()) {
        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: true,
          sizeBytes: 0,
          depth: depth + 1,
          extension: "",
          isText: false,
          category: "other",
          numLines: 0,
          content: "",
          children: []
        };
        parent.children!.push(node);
        await walk(absPath, node, relPath, depth + 1);
      } else if (entry.isFile()) {
        let sizeBytes = 0;
        try {
          const stat = await fsp.stat(absPath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }

        const extension = path.extname(entry.name).toLowerCase();
        let isText = isTextExtension(extension);
        let content = "";
        let numLines = 0;

        if (isText && sizeBytes <= MAX_READ_BYTES) {
          try {
            content = await fsp.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } catch {
            isText = false;
            content = "";
          }
        } else if (isText) {
          isText = false;
        }

        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: false,
          sizeBytes,
          depth: depth + 1,
          extension,
          isText,
          category: getFileCategory(extension),
          numLines,
          content,
          children: undefined
        };

        parent.children!.push(node);
        flatFiles.push(node);
        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, root, "", 0);

  const sortRecursive = (n: FileNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      n.children.forEach(sortRecursive);
    }
  };
  sortRecursive(root);

  return { root, flatFiles };
}

/* ---------- Minification & transformation ---------- */

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

function stripHtmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "");
}

async function transformFileContent(
  file: FileNode,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  if (!file.isText) return file.content;
  let text =
    file.content || (await fsp.readFile(file.path, "utf8").catch(() => "")) || "";
  const ext = file.extension.toLowerCase();

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      const loader =
        ext === ".ts" || ext === ".tsx"
          ? "tsx"
          : ext === ".jsx"
          ? "jsx"
          : "js";

      if (typeof Bun !== "undefined" && Bun?.transform) {
        try {
          const res = await Bun.transform(text, { loader, minify: true });
          text = res.code;
          return text;
        } catch {
          // fallback to Terser below
        }
      }

      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fallback to raw
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // ignore
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // ignore
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // ignore
      }
    } else if (
      ext === ".md" ||
      ext === ".mdx" ||
      ext === ".markdown"
    ) {
      text = stripHtmlComments(text)
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    } else if (
      ext === ".md" ||
      ext === ".mdx" ||
      ext === ".markdown" ||
      ext === ".html" ||
      ext === ".htm"
    ) {
      text = stripHtmlComments(text);
    }
  }

  return text;
}

/* ---------- Project tree section ---------- */

function buildProjectTreeLines(
  root: FileNode | null,
  selected: Set<string>
): string[] {
  if (!root) return [];
  const lines: string[] = [];

  const cache = new Map<string, boolean>();
  const hasSelected = (node: FileNode): boolean => {
    if (cache.has(node.path)) return cache.get(node.path)!;
    let has =
      !node.isDirectory && selected.has(node.path);
    if (node.children) {
      for (const child of node.children) {
        if (hasSelected(child)) {
          has = true;
          break;
        }
      }
    }
    cache.set(node.path, has);
    return has;
  };

  if (!hasSelected(root)) {
    return [];
  }

  lines.push("<project_tree>");

  const printNode = (node: FileNode, prefix: string) => {
    if (!hasSelected(node)) return;
    const isRoot = node.relPath === ".";
    const label = isRoot ? node.name : node.relPath;
    const icon = node.isDirectory ? "📂" : "📄";
    lines.push(`${prefix}${icon} ${label}`);
    if (node.children && node.children.length) {
      for (const child of node.children) {
        printNode(child, prefix + "  ");
      }
    }
  };

  printNode(root, "");
  lines.push("</project_tree>");

  return lines;
}

/* ---------- Combined output & preview snippet ---------- */

async function buildCombinedOutput(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<CombinedResult> {
  const selectedFiles = flatFiles
    .filter(f => !f.isDirectory && f.isText && selected.has(f.path))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  const bodyLines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    bodyLines.push(
      "<preamble>",
      options.preambleText.trim(),
      "</preamble>",
      ""
    );
  }

  if (options.includeGoal && options.goalText.trim()) {
    bodyLines.push("<goal>", options.goalText.trim(), "</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines = buildProjectTreeLines(root, selected);
    if (treeLines.length > 0) {
      bodyLines.push(...treeLines, "");
    }
  }

  bodyLines.push("<files>");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed.trimEnd();
    const numLines =
      content.length === 0 ? 0 : content.split(/\r?\n/).length;
    const lang = languageFromExtension(file.extension);
    const fileTokens = countTokens(content);

    bodyLines.push(
      `<file path="${file.relPath}" lang="${lang}" lines="${numLines}" bytes="${file.sizeBytes}" tokens="${fileTokens}">`,
      content,
      "</file>",
      ""
    );
  }

  bodyLines.push("</files>");

  const bodyText = bodyLines.join("\n");
  const bodyBytes = Buffer.byteLength(bodyText, "utf8");
  const bodyTokens = countTokens(bodyText);
  const bodyLinesCount = bodyText.split(/\r?\n/).length;

  const headerLines = [
    "===== SOURCE2PROMPT v2 =====",
    "",
    "[meta]",
    `project_root: ${root?.path ?? "unknown"}`,
    `generated_at: ${new Date().toISOString()}`,
    `files_selected: ${selectedFiles.length}`,
    `body_bytes: ${bodyBytes}`,
    `body_lines: ${bodyLinesCount}`,
    `body_tokens_est: ${bodyTokens}`,
    `options: include_preamble=${options.includePreamble}, include_goal=${options.includeGoal}, remove_comments=${options.removeComments}, minify=${options.minify}`,
    "[/meta]",
    ""
  ];

  const text = [...headerLines, ...bodyLines].join("\n");
  const bytes = Buffer.byteLength(text, "utf8");
  const tokens = countTokens(text);
  const lines = text.split(/\r?\n/).length;

  return { text, bytes, tokens, lines };
}

async function buildPromptPreviewSnippet(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<string> {
  const selectedFiles = flatFiles
    .filter(f => !f.isDirectory && f.isText && selected.has(f.path))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  if (!selectedFiles.length && !options.preambleText.trim() && !options.goalText.trim()) {
    return "// Adjust preamble/goal and select some files to see a live sample of the combined prompt.";
  }

  const lines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    const pre = options.preambleText.trim();
    lines.push("<preamble>");
    lines.push(pre.length > 600 ? pre.slice(0, 600) + " …" : pre);
    lines.push("</preamble>", "");
  }

  if (options.includeGoal && options.goalText.trim()) {
    const g = options.goalText.trim();
    lines.push("<goal>");
    lines.push(g.length > 600 ? g.slice(0, 600) + " …" : g);
    lines.push("</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines = buildProjectTreeLines(root, selected);
    if (treeLines.length > 0) {
      lines.push(...treeLines, "");
    }
  }

  lines.push("<files_preview>");

  const previewFiles = selectedFiles.slice(0, 3);
  for (const f of previewFiles) {
    const transformed = await transformFileContent(f, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    let snippet = transformed || f.content;
    const maxLines = 40;
    const maxChars = 1200;
    const parts = snippet.split(/\r?\n/).slice(0, maxLines);
    snippet = parts.join("\n");
    if (snippet.length > maxChars) {
      snippet = snippet.slice(0, maxChars) + "\n…";
    }
    lines.push(
      `--- file: ${f.relPath} (${f.extension || "txt"}) ---`,
      snippet,
      ""
    );
  }

  if (selectedFiles.length > previewFiles.length) {
    lines.push(
      `… + ${selectedFiles.length - previewFiles.length} more file(s) in full prompt.`
    );
  }

  lines.push("</files_preview>");

  const text = lines.join("\n");
  return text.length > 4000 ? text.slice(0, 4000) + "\n…" : text;
}

/* ---------- Presets & clipboard ---------- */

function loadPresets(): Preset[] {
  try {
    const raw = fs.readFileSync(PRESET_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.presets)) return parsed.presets;
    return [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    fs.writeFileSync(PRESET_FILE, JSON.stringify(presets, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await clipboardy.write(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Quick-select helpers ---------- */

const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

function filterFilesByQuickSelect(
  files: FileNode[],
  key: QuickSelectKey
): FileNode[] {
  switch (key) {
    case "allText":
      return files.filter(f => !f.isDirectory && f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}

/* ---------- Small debounce ---------- */

function debounce<F extends (...args: any[]) => void>(
  fn: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

/* ---------- Main App ---------- */

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rootDir, setRootDir] = useState(path.resolve(process.cwd()));

  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [flatFiles, setFlatFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [status, setStatus] = useState("Scanning project...");
  const [progressText, setProgressText] = useState<string | null>(null);

  const [activePane, setActivePane] = useState<Pane>("explorer");
  const [configTab, setConfigTab] = useState<ConfigTab>("inputs");
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [focusField, setFocusField] = useState<FocusField>("none");

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goal, setGoal] = useState("");
  const [minify, setMinify] = useState(false);
  const [removeComments, setRemoveComments] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  const [statsTokens, setStatsTokens] = useState(0);
  const [statsSizeBytes, setStatsSizeBytes] = useState(0);
  const [statsFileCount, setStatsFileCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLang, setPreviewLang] = useState("txt");

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [exportPath, setExportPath] = useState("combined-prompt.txt");

  const [promptPreview, setPromptPreview] = useState("");

  const rows = stdout.rows ?? 30;
  const cols = stdout.columns ?? 120;
  const listHeight = Math.max(8, rows - 16);

  const handleScan = async (
    dir: string
  ): Promise<{ root: FileNode | null; files: FileNode[] }> => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setLoading(true);
    setScanError(null);
    setStatus("Scanning project...");
    setProgressText(null);
    setRootNode(null);
    setFlatFiles([]);
    setExpanded(new Set());
    setSelected(new Set());
    setCursor(0);
    setScrollOffset(0);

    try {
      const result = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      setRootNode(result.root);
      setFlatFiles(result.flatFiles);
      setExpanded(new Set([result.root.path]));
      setStatus(`Scanned ${result.flatFiles.length} files from ${resolved}`);
      setLoading(false);
      setProgressText(null);
      return { root: result.root, files: result.flatFiles };
    } catch (err: any) {
      setScanError(err?.message || String(err));
      setStatus("Scan error");
      setLoading(false);
      setProgressText(null);
      return { root: null, files: [] };
    }
  };

  useEffect(() => {
    (async () => {
      const loaded = loadPresets();
      setPresets(loaded);
      await handleScan(rootDir);
      setStatus("Ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNodes = useMemo(() => {
    if (!rootNode) return [];
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      return flatFiles.filter(f =>
        f.relPath.toLowerCase().includes(q)
      );
    }

    const out: FileNode[] = [];
    const traverse = (n: FileNode) => {
      out.push(n);
      if (n.isDirectory && expanded.has(n.path) && n.children) {
        for (const child of n.children) traverse(child);
      }
    };
    traverse(rootNode);
    return out;
  }, [rootNode, flatFiles, expanded, filter]);

  useEffect(() => {
    if (cursor >= visibleNodes.length) {
      setCursor(visibleNodes.length > 0 ? visibleNodes.length - 1 : 0);
      setScrollOffset(0);
    }
  }, [visibleNodes.length, cursor]);

  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + listHeight) {
      setScrollOffset(cursor - listHeight + 1);
    }
  }, [cursor, scrollOffset, listHeight]);

  const viewNodes = useMemo(
    () => visibleNodes.slice(scrollOffset, scrollOffset + listHeight),
    [visibleNodes, scrollOffset, listHeight]
  );

  const debouncedStats = useMemo(
    () =>
      debounce(
        (
          files: FileNode[],
          selectedSet: Set<string>,
          includePreamble: boolean,
          preambleText: string,
          includeGoal: boolean,
          goalText: string
        ) => {
          const selectedFiles = files.filter(
            f => !f.isDirectory && f.isText && selectedSet.has(f.path)
          );
          const size = selectedFiles.reduce(
            (acc, f) => acc + f.sizeBytes,
            0
          );

          const tokensFromFiles = selectedFiles.reduce((acc, f) => {
            if (f.content) return acc + countTokens(f.content);
            const approx = Math.ceil(f.sizeBytes / 4);
            return acc + approx;
          }, 0);

          const paramTokens =
            (includePreamble ? countTokens(preambleText) : 0) +
            (includeGoal ? countTokens(goalText) : 0);

          const totalTokens = tokensFromFiles + paramTokens;

          setStatsFileCount(selectedFiles.length);
          setStatsSizeBytes(size);
          setStatsTokens(totalTokens);
        },
        200
      ),
    []
  );

  useEffect(() => {
    debouncedStats(
      flatFiles,
      selected,
      includePreamble,
      preamble,
      includeGoal,
      goal
    );
  }, [flatFiles, selected, includePreamble, preamble, includeGoal, goal, debouncedStats]);

  useEffect(() => {
    const node = visibleNodes[cursor];
    if (!node || node.isDirectory || !node.isText) {
      setPreviewContent("");
      setPreviewLang("txt");
      return;
    }
    const lang = languageFromExtension(node.extension);
    setPreviewLang(lang);

    if (node.content) {
      setPreviewContent(
        node.content.length > MAX_PREVIEW_CHARS
          ? node.content.slice(0, MAX_PREVIEW_CHARS)
          : node.content
      );
    } else if (node.isText) {
      fsp
        .readFile(node.path, "utf8")
        .then(content =>
          setPreviewContent(
            content.length > MAX_PREVIEW_CHARS
              ? content.slice(0, MAX_PREVIEW_CHARS)
              : content
          )
        )
        .catch(() => setPreviewContent("// Error reading file"));
    }
  }, [visibleNodes, cursor]);

  useEffect(() => {
    if (!rootNode) {
      setPromptPreview("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        const options: CombineOptions = {
          includePreamble,
          preambleText: preamble,
          includeGoal,
          goalText: goal,
          removeComments,
          minify
        };
        const snippet = await buildPromptPreviewSnippet(
          rootNode,
          flatFiles,
          selected,
          options
        );
        if (!cancelled) setPromptPreview(snippet);
      })().catch(err => {
        if (!cancelled) {
          setPromptPreview(
            "// Error building preview: " + (err?.message || String(err))
          );
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rootNode, flatFiles, selected, includePreamble, preamble, includeGoal, goal, removeComments, minify]);

  const toggleSelectNode = (node: FileNode) => {
    if (node.isDirectory && !filter.trim()) {
      const descendants: FileNode[] = [];
      const collectDesc = (n: FileNode) => {
        if (!n.isDirectory && n.isText) descendants.push(n);
        if (n.children) for (const c of n.children) collectDesc(c);
      };
      collectDesc(node);
      const newSel = new Set(selected);
      const allSelected = descendants.every(d => newSel.has(d.path));
      if (allSelected) {
        for (const d of descendants) newSel.delete(d.path);
      } else {
        for (const d of descendants) newSel.add(d.path);
      }
      setSelected(newSel);
      setStatus(
        `${allSelected ? "Deselected" : "Selected"} ${descendants.length} files in "${node.relPath}"`
      );
      return;
    }

    if (!node.isDirectory) {
      if (!node.isText) {
        setStatus("File is binary or too large to include.");
        return;
      }
      const newSel = new Set(selected);
      if (newSel.has(node.path)) newSel.delete(node.path);
      else newSel.add(node.path);
      setSelected(newSel);
    }
  };

  const moveCursor = (delta: number) => {
    if (!visibleNodes.length) return;
    const maxIndex = visibleNodes.length - 1;
    let next = cursor + delta;
    if (next < 0) next = 0;
    if (next > maxIndex) next = maxIndex;
    setCursor(next);
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!flatFiles.length) return;
    const matches = filterFilesByQuickSelect(flatFiles, key).filter(
      f => f.isText
    );
    if (!matches.length) {
      setStatus("No matching files for this quick select.");
      return;
    }

    const newSel = new Set(selected);
    const allSelected = matches.every(m => newSel.has(m.path));
    if (allSelected) {
      for (const m of matches) newSel.delete(m.path);
    } else {
      for (const m of matches) newSel.add(m.path);
    }
    setSelected(newSel);
    setStatus(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filter.trim()) return;
    const q = filter.trim().toLowerCase();
    const inFilter = flatFiles.filter(f =>
      f.relPath.toLowerCase().includes(q)
    );
    if (!inFilter.length) return;
    const newSel = new Set(selected);
    for (const f of inFilter) newSel.delete(f.path);
    setSelected(newSel);
    setStatus("Cleared selections for files matching current filter.");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setStatus("Preset name cannot be empty.");
      return;
    }
    const selectedRelPaths = flatFiles
      .filter(f => selected.has(f.path))
      .map(f => f.relPath)
      .sort();

    const preset: Preset = {
      name,
      rootDir,
      includePreamble,
      includeGoal,
      preamble,
      goal,
      minify,
      removeComments,
      selectedRelPaths,
      createdAt: new Date().toISOString()
    };

    const filtered = presets.filter(p => p.name !== name);
    const next = [...filtered, preset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setStatus(`Saved preset "${name}".`);
  };

  const handleLoadPreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    setIncludePreamble(preset.includePreamble);
    setIncludeGoal(preset.includeGoal);
    setPreamble(preset.preamble);
    setGoal(preset.goal);
    setMinify(preset.minify);
    setRemoveComments(preset.removeComments);
    setStatus(`Loading preset "${preset.name}"...`);

    const presetRootResolved = path.resolve(preset.rootDir);
    const currentRootResolved = path.resolve(rootDir);

    if (presetRootResolved !== currentRootResolved) {
      (async () => {
        const result = await handleScan(preset.rootDir);
        const files = result.files;
        const base = presetRootResolved;
        const newSel = new Set<string>();
        for (const rel of preset.selectedRelPaths) {
          const abs = path.join(base, rel);
          const node = files.find(f => f.path === abs);
          if (node && node.isText) newSel.add(abs);
        }
        setSelected(newSel);
        setStatus(
          `Loaded preset "${preset.name}" (${newSel.size} files selected).`
        );
      })();
    } else {
      const base = currentRootResolved;
      const newSel = new Set<string>();
      for (const rel of preset.selectedRelPaths) {
        const abs = path.join(base, rel);
        const node = flatFiles.find(f => f.path === abs);
        if (node && node.isText) newSel.add(abs);
      }
      setSelected(newSel);
      setStatus(
        `Loaded preset "${preset.name}" (${newSel.size} files selected).`
      );
    }
  };

  const handleDeletePreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    const next = presets.filter((_, i) => i !== index);
    setPresets(next);
    savePresets(next);
    setSelectedPresetIndex(prev =>
      prev >= next.length ? Math.max(0, next.length - 1) : prev
    );
    setStatus(`Deleted preset "${preset.name}".`);
  };

  const handleGenerate = async () => {
    if (!rootNode) return;
    const selectedFiles = flatFiles.filter(
      f => !f.isDirectory && f.isText && selected.has(f.path)
    );
    if (!selectedFiles.length) {
      setStatus("No files selected. Select at least one text file first.");
      return;
    }

    setStatus("Generating combined prompt...");
    setMode("main");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText: preamble,
        includeGoal,
        goalText: goal,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(
        rootNode,
        flatFiles,
        selected,
        options
      );
      setCombined(result);
      const copied = await copyToClipboard(result.text);
      setMode("combined");
      setStatus(
        `${copied ? "Copied to clipboard" : "Generated"}: ${formatBytes(
          result.bytes
        )}, ~${result.tokens.toLocaleString()} tokens.`
      );
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  const handleSaveCombinedToFile = async () => {
    if (!combined) return;
    const target = exportPath.trim() || "combined-prompt.txt";
    const resolved = path.isAbsolute(target)
      ? target
      : path.resolve(rootDir, target);
    try {
      await fsp.writeFile(resolved, combined.text, "utf8");
      setStatus(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "combined") {
      if (focusField === "exportPath") {
        if (key.escape) {
          setFocusField("none");
          return;
        }
        if (key.return) {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
        return;
      }

      const lower = input.toLowerCase();
      if (key.escape || lower === "q") {
        setMode("main");
        setStatus("Back to main view.");
        return;
      }
      if (lower === "y") {
        if (combined) {
          void copyToClipboard(combined.text).then(ok =>
            setStatus(
              ok
                ? "Copied combined output to clipboard."
                : "Clipboard copy failed."
            )
          );
        }
        return;
      }
      if (lower === "w") {
        setFocusField("exportPath");
        return;
      }
      return;
    }

    if (focusField !== "none") {
      if (key.escape) {
        setFocusField("none");
        return;
      }
      if (key.return) {
        if (focusField === "rootDir") {
          void handleScan(rootDir);
          setFocusField("none");
          return;
        }
        if (focusField === "filter") {
          setFocusField("none");
          return;
        }
        if (focusField === "preamble") {
          setFocusField("none");
          return;
        }
        if (focusField === "goal") {
          setFocusField("none");
          return;
        }
        if (focusField === "presetName") {
          handleSavePreset();
          setFocusField("none");
          return;
        }
        if (focusField === "exportPath") {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === "g") {
      void handleGenerate();
      return;
    }

    if (key.tab) {
      const panes: Pane[] = ["explorer", "config", "preview"];
      const idx = panes.indexOf(activePane);
      const next = panes[(idx + 1) % panes.length];
      setActivePane(next);
      return;
    }

    if (activePane === "explorer") {
      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }

      const node = visibleNodes[cursor];

      if (key.leftArrow || input === "h") {
        if (node && node.isDirectory && expanded.has(node.path)) {
          const next = new Set(expanded);
          next.delete(node.path);
          setExpanded(next);
        }
        return;
      }

      if (key.rightArrow || input === "l") {
        if (node && node.isDirectory && !expanded.has(node.path)) {
          const next = new Set(expanded);
          next.add(node.path);
          setExpanded(next);
        }
        return;
      }

      if (input === " ") {
        if (node) toggleSelectNode(node);
        return;
      }

      if (key.return) {
        if (node) {
          if (node.isDirectory) {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          } else {
            toggleSelectNode(node);
          }
        }
        return;
      }

      if (input === "/" || input.toLowerCase() === "f") {
        setFocusField("filter");
        setActivePane("explorer");
        return;
      }

      if (input.toLowerCase() === "d") {
        setFocusField("rootDir");
        return;
      }

      if (input.toLowerCase() === "u") {
        clearSelectionInFilter();
        return;
      }

      if (input === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (input.toLowerCase() === "r") {
        toggleQuickSelect("rust");
        return;
      }
    }

    if (activePane === "config") {
      if (key.leftArrow || key.rightArrow) {
        setConfigTab(prev =>
          prev === "inputs"
            ? "presets"
            : prev === "presets"
            ? "options"
            : "inputs"
        );
        return;
      }

      if (configTab === "inputs") {
        if (input.toLowerCase() === "p") {
          setFocusField("preamble");
          return;
        }
        if (input.toLowerCase() === "g") {
          setFocusField("goal");
          return;
        }
      }

      if (configTab === "options") {
        if (input.toLowerCase() === "i") {
          setIncludePreamble(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "o") {
          setIncludeGoal(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "m") {
          setMinify(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "x") {
          setRemoveComments(prev => !prev);
          return;
        }
      }

      if (configTab === "presets") {
        if (key.upArrow || input === "k") {
          setSelectedPresetIndex(prev =>
            prev <= 0 ? 0 : prev - 1
          );
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedPresetIndex(prev =>
            prev >= presets.length - 1
              ? Math.max(0, presets.length - 1)
              : prev + 1
          );
          return;
        }
        if (input.toLowerCase() === "l") {
          if (presets.length) handleLoadPreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "d") {
          if (presets.length) handleDeletePreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "s") {
          setFocusField("presetName");
          return;
        }
      }
    }
  });

  const cost = (statsTokens / 1_000_000) * COST_PER_1M_TOKENS;
  const contextPercent = Math.min(
    1,
    statsTokens / CONTEXT_WINDOW
  );
  const contextWarning =
    statsTokens > CONTEXT_WINDOW
      ? "⚠️ Estimated tokens exceed context window; model may truncate."
      : statsTokens > 100_000
      ? "Large prompt; ensure you're using a 128k+ context model."
      : "";

  if (loading && !rootNode) {
    return (
      <Box padding={2} flexDirection="column">
        <Box>
          <Spinner type="dots" />
          <Text> Scanning project...</Text>
        </Box>
        {progressText && (
          <Box marginTop={1}>
            <Text>{progressText}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === "combined") {
    return (
      <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
        <Box justifyContent="center" height={3}>
          <Gradient name="pastel">
            <BigText text="Combined Prompt" font="tiny" />
          </Gradient>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={1}
          flexGrow={1}
        >
          <Text>
            {combined ? combined.text : "(nothing generated yet)"}
          </Text>
        </Box>
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          paddingTop={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Text dimColor>
              [Y] Copy  [W] Save to file  [Esc/Q] Back
            </Text>
            {combined && (
              <Text>
                {formatBytes(combined.bytes)} | Lines: {combined.lines} | Tokens:{" "}
                {combined.tokens.toLocaleString()}
              </Text>
            )}
          </Box>
          {combined && (
            <Box marginTop={1} flexDirection="column">
              <ProgressBar
                percent={Math.min(
                  1,
                  combined.tokens / CONTEXT_WINDOW
                )}
                color={
                  combined.tokens > CONTEXT_WINDOW ? "red" : "green"
                }
              />
              <Text dimColor>
                {Math.round(
                  (combined.tokens / CONTEXT_WINDOW) * 1000
                ) / 10}
                % of {CONTEXT_WINDOW.toLocaleString()}-token context
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="green">{status}</Text>
          </Box>
          {focusField === "exportPath" && (
            <Box marginTop={1}>
              <Text>Save as: </Text>
              <TextInput
                value={exportPath}
                onChange={setExportPath}
                focus={true}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  const explorerWidth = Math.floor(cols * 0.4);
  const configWidth = Math.floor(cols * 0.3);
  const previewWidth = cols - explorerWidth - configWidth - 4;

  return (
    <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
      <Box justifyContent="center" height={3}>
        <Gradient name="morning">
          <BigText text="Source2Prompt" font="tiny" />
        </Gradient>
      </Box>

      <Box marginBottom={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
      >
        <Box flexDirection="row" flexGrow={1}>
          {/* Explorer */}
          <Box
            width={explorerWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "explorer" ? "cyan" : "gray"}
          >
            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
              justifyContent="space-between"
            >
              <Text bold color={activePane === "explorer" ? "cyan" : "white"}>
                EXPLORER
              </Text>
              <Text dimColor>
                {statsFileCount} sel / {flatFiles.length} files
              </Text>
            </Box>

            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
            >
              <Text color="cyan">🔍 </Text>
              <TextInput
                value={filter}
                onChange={setFilter}
                focus={focusField === "filter" && activePane === "explorer"}
                placeholder="Filter by path..."
              />
            </Box>

            <Box flexDirection="column" paddingLeft={1}>
              {viewNodes.length === 0 && (
                <Text dimColor>No files match current filter.</Text>
              )}
              {viewNodes.map((node, idx) => {
                const isCursor = scrollOffset + idx === cursor;
                const isSel = selected.has(node.path);
                const marker = isCursor ? "›" : " ";
                const indent = filter.trim() ? 0 : node.depth;
                const icon = node.isDirectory
                  ? expanded.has(node.path)
                    ? "📂"
                    : "📁"
                  : isSel
                  ? "▣"
                  : node.isText
                  ? "📄"
                  : "⛔";

                let color: any = node.isDirectory
                  ? "yellow"
                  : node.isText
                  ? isSel
                    ? "green"
                    : "white"
                  : "red";

                if (isCursor) color = "cyan";

                return (
                  <Box key={node.path}>
                    <Text color={isCursor ? "cyan" : "black"}>{marker}</Text>
                    <Text dimColor>{" ".repeat(indent)}</Text>
                    <Text color={color}>
                      {icon}{" "}
                      {node.relPath === "." ? node.name : node.relPath}{" "}
                      {!node.isDirectory &&
                        `(${formatBytes(node.sizeBytes)}${
                          node.isText ? "" : ", binary"
                        })`}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Config */}
          <Box
            width={configWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "config" ? "cyan" : "gray"}
          >
            <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
              <Box
                paddingX={1}
                borderRight
                borderStyle="single"
                borderColor={configTab === "inputs" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "inputs"}>Inputs</Text>
              </Box>
              <Box
                paddingX={1}
                borderRight
                borderStyle="single"
                borderColor={configTab === "presets" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "presets"}>Presets</Text>
              </Box>
              <Box
                paddingX={1}
                borderColor={configTab === "options" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "options"}>Options</Text>
              </Box>
            </Box>

            {configTab === "inputs" && (
              <Box flexDirection="column" padding={1}>
                <Text bold>
                  Preamble{" "}
                  <Text color={includePreamble ? "green" : "red"}>
                    [{includePreamble ? "ON" : "OFF"}]
                  </Text>
                </Text>
                <Box
                  borderStyle="single"
                  borderColor={focusField === "preamble" ? "cyan" : "gray"}
                  paddingX={1}
                  marginBottom={1}
                >
                  <TextInput
                    value={preamble}
                    onChange={setPreamble}
                    focus={focusField === "preamble"}
                    placeholder="System / context instructions..."
                  />
                </Box>

                <Text bold>
                  Goal{" "}
                  <Text color={includeGoal ? "green" : "red"}>
                    [{includeGoal ? "ON" : "OFF"}]
                  </Text>
                </Text>
                <Box
                  borderStyle="single"
                  borderColor={focusField === "goal" ? "cyan" : "gray"}
                  paddingX={1}
                >
                  <TextInput
                    value={goal}
                    onChange={setGoal}
                    focus={focusField === "goal"}
                    placeholder="High-level task / objective..."
                  />
                </Box>

                <Box marginTop={1}>
                  <Text dimColor>
                    [P] Edit preamble  [G] Edit goal (while in Inputs tab)
                  </Text>
                </Box>
              </Box>
            )}

            {configTab === "presets" && (
              <Box flexDirection="column" padding={1}>
                {presets.length === 0 && (
                  <Text dimColor>No presets yet. Press 'S' to save one.</Text>
                )}
                {presets.map((p, idx) => {
                  const active = idx === selectedPresetIndex;
                  return (
                    <Box key={p.name}>
                      <Text color={active ? "cyanBright" : "white"}>
                        {active ? "•" : " "} {p.name}
                      </Text>
                    </Box>
                  );
                })}
                <Box
                  borderTop
                  borderStyle="single"
                  borderColor="gray"
                  paddingTop={1}
                  flexDirection="column"
                >
                  <Text>Save current selection as preset:</Text>
                  <Box>
                    <Text>Name: </Text>
                    <TextInput
                      value={presetName}
                      onChange={setPresetName}
                      focus={focusField === "presetName"}
                      placeholder="Preset name..."
                    />
                  </Box>
                  <Box marginTop={1} flexDirection="column">
                    <Text dimColor>
                      [J/K] Move  [L] Load  [D] Delete  [S] Focus name + save
                    </Text>
                  </Box>
                </Box>
              </Box>
            )}

            {configTab === "options" && (
              <Box flexDirection="column" padding={1}>
                <Text>
                  Include preamble:{" "}
                  <Text color={includePreamble ? "green" : "red"}>
                    {includePreamble ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [I])
                </Text>
                <Text>
                  Include goal:{" "}
                  <Text color={includeGoal ? "green" : "red"}>
                    {includeGoal ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [O])
                </Text>
                <Text>
                  Remove comments:{" "}
                  <Text color={removeComments ? "green" : "red"}>
                    {removeComments ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [X])
                </Text>
                <Text>
                  Minify:{" "}
                  <Text color={minify ? "green" : "red"}>
                    {minify ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [M])
                </Text>
                <Box marginTop={1}>
                  <Text dimColor>
                    Options tab shortcuts: [I] preamble, [O] goal, [X] comments, [M] minify
                  </Text>
                </Box>
              </Box>
            )}
          </Box>

          {/* Preview & stats */}
          <Box
            width={previewWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "preview" ? "cyan" : "gray"}
          >
            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
            >
              <Text bold>FILE PREVIEW</Text>
            </Box>
            <Box flexGrow={1} paddingX={1}>
              <SyntaxHighlight
                language={previewLang}
                code={
                  previewContent ||
                  "// Select a text file to preview (or press Ctrl+G to generate)."
                }
              />
            </Box>
            <Box
              borderTop
              borderStyle="single"
              borderColor="gray"
              flexDirection="column"
              padding={1}
            >
              <Box justifyContent="space-between">
                <Text>
                  Tokens:{" "}
                  <Text color="magenta">
                    {statsTokens.toLocaleString()}
                  </Text>
                </Text>
                <Text color="green">${cost.toFixed(4)}</Text>
              </Box>
              <ProgressBar
                percent={contextPercent}
                color={statsTokens > CONTEXT_WINDOW ? "red" : "green"}
              />
              <Text dimColor>
                {Math.round(contextPercent * 1000) / 10}% of{" "}
                {CONTEXT_WINDOW.toLocaleString()}-token context
              </Text>
              {contextWarning && (
                <Text color="yellow">{contextWarning}</Text>
              )}
              <Box marginTop={1} flexDirection="column">
                <Text>
                  Selected size: {formatBytes(statsSizeBytes)} | Files:{" "}
                  {statsFileCount}
                </Text>
                <Text dimColor>
                  Generation: press Ctrl+G to build combined prompt and open Combined view.
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Prompt sample pane (4th pane) */}
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          flexDirection="column"
          padding={1}
        >
          <Text bold>PROMPT SAMPLE</Text>
          <Text dimColor>
            Live preview of the first part of the combined prompt, based on your current
            selections and options.
          </Text>
          <Box marginTop={1}>
            <SyntaxHighlight language="txt" code={promptPreview} />
          </Box>
        </Box>
      </Box>

      <Box
        height={2}
        justifyContent="space-between"
        paddingX={1}
        borderTop
        borderStyle="single"
        borderColor="gray"
      >
        <Box flexDirection="column">
          <Text dimColor>
            Panes: Tab | Explorer: j/k, h/l, Space/Enter, / or F filter, D root, T/1-9/0/R quick
            select, U clear filter selection
          </Text>
          <Text dimColor>
            Config: arrows to tab, P/G (inputs), S/L/D (presets), I/O/X/M (options) | Generate:
            Ctrl+G | Combined view: [Y] copy, [W] save, [Esc/Q] back
          </Text>
        </Box>
        <Box alignItems="flex-end">
          {scanError ? (
            <Text color="red">Error: {scanError}</Text>
          ) : (
            <Text color={status.startsWith("Ready") ? "white" : "green"}>
              {status}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

render(<App />);
```

* * *

## Build & Run

```
bash

bashbun install

# dev TUI
bun run src/index.tsx

# TS build
bun run build

# single-file binary (Linux/macOS)
bun run build:bin          # produces ./s2p

./s2p                      # run in current project
```

This version:

-   Gives you a **structured, self-describing prompt** (
    
    ```
    [meta]
    ```
    
    ,
    
    ```
    <preamble>
    ```
    
    ,
    
    ```
    <goal>
    ```
    
    ,
    
    ```
    <project_tree>
    ```
    
    ,
    
    ```
    <file ...>
    ```
    
    ).
    
-   Uses a **more accurate token model** for both stats and final output.
    
-   Uses **language-aware minification** (JS/TS via Bun.transform + Terser fallback, CSS/HTML/JSON/Markdown tuned) and **language-aware comment stripping** (C/Java/Go/Rust/JS, Python/Ruby/shell, Markdown/HTML).
    
-   Adds a **dedicated prompt sample pane** so you see exactly what kind of prompt will be produced before you hit Ctrl+G.
    
-   Keeps all the UX goodies: tree explorer, Vim keys, search/filter, quick selects, live syntax highlighting, presets, clipboard copy, and combined output view with context‑window bar.
    

If you want, next iteration we can specialize the

```
<files>
```

section further for a specific provider (e.g., tag it for OpenAI vs Anthropic vs local tooling) or add a wholly different output profile selectable from the TUI (e.g., “Claude‑style prompt mode” vs “OpenAI‑style prompt mode”).

## Other

##### You said:

I want to replicate the features and functionality of this utility: https://raw.githubusercontent.com/Dicklesworthstone/your-source-to-prompt.html/refs/heads/main/your-source-to-prompt.html But as a TUI that using bun , typescript, opentui/ink and which can be distributed using bun as a single compiled binary that can be used from the terminal in Linux and Mac. It should present a super slick, visually appealing interface with world class UI-UX for terminal apps and make full use of all the available width on the screen. But all features and functionality should follow the linked file but in a way mapped to how TUIs work versus web pages.

## Other

###### ChatGPT said:

Reasoned for 17m 6s

Here’s a full Bun + TypeScript + Ink TUI that replicates the “Your Source to Prompt” utility, mapped to a terminal UI.

It:

-   Recursively scans a project folder honoring
    
    ```
    .gitignore
    ```
    
-   Detects text vs binary, loads text content, counts lines and sizes
    
-   Lets you filter files, select/deselect, and use quick file-type selects
    
-   Provides comment-stripping and minification options
    
-   Builds a structured “LLM-ready” combined prompt (preamble, goal, structure summary, then file blocks)
    
-   Manages presets (save/load/delete, export/import as JSON)
    
-   Copies combined output to clipboard (macOS + Linux)
    
-   Saves combined output to a file
    
-   Uses full width with a two-pane layout and keyboard-driven workflow
    
-   Can be compiled to a single binary via
    
    ```
    bun build --compile
    ```
    

Below are all the files you need.

* * *

### `package.json`

```
json

json{
  "name": "your-source-to-prompt-tui",
  "version": "0.1.0",
  "description": "Terminal UI version of Your Source to Prompt implemented with Bun, TypeScript, and Ink.",
  "type": "module",
  "bin": {
    "ystp": "dist/cli.js"
  },
  "scripts": {
    "dev": "bun run src/cli.tsx",
    "build": "tsc",
    "build:bin": "bun build src/cli.tsx --compile --outfile ystp"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "react": "^18.3.0",
    "ink-text-input": "^6.0.0",
    "ignore": "^5.3.0",
    "terser": "^5.31.0",
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8"
  }
}
```

* * *

### `tsconfig.json`

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

Create a

```
src
```

directory and put the following files inside.

* * *

### `src/types.ts`

```
ts

tsexport type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

export interface FileEntry {
  path: string; // relative to root
  absolutePath: string;
  sizeBytes: number;
  numLines: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  content: string;
}

export interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

export interface CombinedResult {
  output: string;
  totalBytes: number;
  totalLines: number;
  approxTokens: number;
}
```

* * *

### `src/fs-utils.ts`

```
ts

tsimport { promises as fs } from "fs";
import path from "path";
import ignore, { Ignore } from "ignore";
import { FileEntry, FileCategory } from "./types";

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".vercel"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

export function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

export type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

export const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

export async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ rootDir: string; files: FileEntry[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);
  const files: FileEntry[] = [];
  let processed = 0;

  async function walk(currentAbs: string, currentRel: string) {
    let dirEntries: import("fs").Dirent[];
    try {
      dirEntries = await fs.readdir(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      const relPath = currentRel ? path.posix.join(currentRel, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        let isText = isTextExtension(ext);
        let sizeBytes = 0;
        let numLines = 0;
        let content = "";

        try {
          const stat = await fs.stat(absPath);
          sizeBytes = stat.size;
          if (isText && sizeBytes < 5 * 1024 * 1024) {
            content = await fs.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } else if (isText) {
            // treat very large files as non-text for performance
            isText = false;
          }
        } catch {
          // ignore read errors
        }

        const category = getFileCategory(ext);
        files.push({
          path: relPath,
          absolutePath: absPath,
          sizeBytes,
          numLines,
          extension: ext.toLowerCase(),
          isText,
          category,
          content: isText ? content : ""
        });

        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, "");
  files.sort((a, b) => a.path.localeCompare(b.path));

  return { rootDir: resolvedRoot, files };
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES.map(d => `${d}/`));

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const gitignorePath = path.join(dirAbs, ".gitignore");
    try {
      const text = await fs.readFile(gitignorePath, "utf8");
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // no .gitignore
    }

    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix ? path.posix.join(relPrefix, entry.name) : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

export function filterFilesByQuickSelect(
  files: FileEntry[],
  key: QuickSelectKey
): FileEntry[] {
  switch (key) {
    case "allText":
      return files.filter(f => f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}
```

* * *

### `src/minify.ts`

```
ts

tsimport { Buffer } from "buffer";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { FileEntry, CombineOptions, CombinedResult } from "./types";

export function estimateTokens(charOrByteCount: number): number {
  if (!Number.isFinite(charOrByteCount) || charOrByteCount <= 0) return 0;
  return Math.round(charOrByteCount / 4);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

export async function transformFileContent(
  file: FileEntry,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  const ext = file.extension;
  if (!file.isText) return file.content;
  let text = file.content;

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fall through
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // fall through
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // fall through
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // fall through
      }
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    }
  }

  return text;
}

export async function buildCombinedOutput(
  selectedFiles: FileEntry[],
  options: CombineOptions
): Promise<CombinedResult> {
  const headers: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    headers.push("# Preamble", "", options.preambleText.trim(), "");
  }
  if (options.includeGoal && options.goalText.trim()) {
    headers.push("# Goal", "", options.goalText.trim(), "");
  }

  headers.push("# Project Structure Summary", "");
  for (const file of selectedFiles) {
    headers.push(
      `- ${file.path} (${file.numLines} lines, ${formatBytes(file.sizeBytes)})`
    );
  }

  const lines: string[] = [];
  lines.push(...headers, "", "# Files", "");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed || file.content;
    lines.push(
      `-------------------- FILE: ${file.path} (${file.numLines} lines) --------------------`,
      "",
      content.trimEnd(),
      ""
    );
  }

  const output = lines.join("\n");
  const totalBytes = Buffer.byteLength(output, "utf8");
  const totalLines = output.split(/\r?\n/).length;
  const approxTokens = estimateTokens(totalBytes);

  return {
    output,
    totalBytes,
    totalLines,
    approxTokens
  };
}
```

* * *

### `src/clipboard.ts`

```
ts

tsdeclare const Bun: any;

export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  try {
    if (platform === "darwin") {
      const proc = Bun.spawn(["pbcopy"], {
        stdin: "pipe",
        stdout: "ignore",
        stderr: "ignore"
      });
      proc.stdin.write(data);
      proc.stdin.end();
      await proc.exited;
      return proc.exitCode === 0;
    }

    if (platform === "linux") {
      const candidates: string[][] = [
        ["wl-copy"],
        ["xclip", "-selection", "clipboard"],
        ["xsel", "--clipboard", "--input"]
      ];
      for (const cmd of candidates) {
        try {
          const proc = Bun.spawn(cmd, {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "ignore"
          });
          proc.stdin.write(data);
          proc.stdin.end();
          await proc.exited;
          if (proc.exitCode === 0) return true;
        } catch {
          // try next
        }
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}
```

* * *

### `src/presets.ts`

```
ts

tsimport { promises as fs } from "fs";
import path from "path";
import os from "os";
import { CombineOptions } from "./types";

export interface Preset {
  name: string;
  rootDir: string;
  selectedPaths: string[];
  options: CombineOptions;
  createdAt: string;
}

export interface PresetStore {
  presets: Preset[];
}

const CONFIG_DIR = path.join(os.homedir(), ".your-source-to-prompt-tui");
const PRESET_FILE = path.join(CONFIG_DIR, "presets.json");

async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function loadPresetStore(): Promise<PresetStore> {
  try {
    const json = await fs.readFile(PRESET_FILE, "utf8");
    const parsed = JSON.parse(json) as PresetStore;
    if (!parsed || !Array.isArray(parsed.presets)) {
      return { presets: [] };
    }
    return parsed;
  } catch {
    return { presets: [] };
  }
}

export async function savePresetStore(store: PresetStore): Promise<void> {
  await ensureConfigDir();
  const json = JSON.stringify(store, null, 2);
  await fs.writeFile(PRESET_FILE, json, "utf8");
}

export function createPresetFromState(
  name: string,
  rootDir: string,
  selectedPaths: Set<string>,
  options: CombineOptions
): Preset {
  return {
    name,
    rootDir,
    selectedPaths: Array.from(selectedPaths).sort(),
    options,
    createdAt: new Date().toISOString()
  };
}

export async function exportPresetsToFile(
  store: PresetStore,
  targetPath: string
): Promise<void> {
  const json = JSON.stringify(store, null, 2);
  await fs.writeFile(targetPath, json, "utf8");
}

export async function importPresetsFromFile(
  sourcePath: string
): Promise<PresetStore> {
  const json = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(json) as PresetStore;
  if (!parsed || !Array.isArray(parsed.presets)) {
    throw new Error("Invalid presets JSON.");
  }
  return parsed;
}
```

* * *

### `src/app.tsx`

```
tsx

tsximport React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import path from "path";
import {
  scanProject,
  filterFilesByQuickSelect,
  QUICK_SELECT_LABELS,
  QuickSelectKey
} from "./fs-utils";
import { FileEntry, CombineOptions, CombinedResult } from "./types";
import { buildCombinedOutput, estimateTokens } from "./minify";
import { copyToClipboard } from "./clipboard";
import {
  loadPresetStore,
  savePresetStore,
  createPresetFromState,
  exportPresetsToFile,
  importPresetsFromFile,
  PresetStore
} from "./presets";

type FocusField =
  | "none"
  | "rootDir"
  | "filter"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath"
  | "importPath";

type Mode = "main" | "output";

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

interface AppProps {
  initialRootDir?: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

const App: React.FC<AppProps> = ({ initialRootDir }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [rootDir, setRootDir] = useState(() =>
    path.resolve(initialRootDir || process.cwd())
  );
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [focusField, setFocusField] = useState<FocusField>("rootDir");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preambleText, setPreambleText] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goalText, setGoalText] = useState("");

  const [removeComments, setRemoveComments] = useState(false);
  const [minify, setMinify] = useState(false);

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [combining, setCombining] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [presetStore, setPresetStore] = useState<PresetStore>({ presets: [] });
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [exportPathInput, setExportPathInput] = useState("combined-prompt.txt");
  const [importPathInput, setImportPathInput] = useState("presets.json");

  const listHeight = Math.max(8, (stdout.rows ?? 30) - 12);

  const filteredFiles = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => f.path.toLowerCase().includes(q));
  }, [files, filterText]);

  const selectedFiles = useMemo(
    () => files.filter(f => selectedPaths.has(f.path)),
    [files, selectedPaths]
  );

  const totalSelectedBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [selectedFiles]
  );
  const totalSelectedLines = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.numLines, 0),
    [selectedFiles]
  );
  const approxTokens = useMemo(
    () => estimateTokens(totalSelectedBytes),
    [totalSelectedBytes]
  );

  const contextWarning = useMemo(() => {
    if (approxTokens > 200_000) {
      return "Very large context (> 200k tokens). Consider selecting fewer files or enabling minification.";
    }
    if (approxTokens > 100_000) {
      return "Large context (> 100k tokens). Some models may truncate this.";
    }
    if (approxTokens > 60_000) {
      return "Medium context (~60k+ tokens). You should be fine with 200k+ context models.";
    }
    return null;
  }, [approxTokens]);

  useEffect(() => {
    if (cursorIndex >= filteredFiles.length) {
      const nextIndex = filteredFiles.length > 0 ? filteredFiles.length - 1 : 0;
      setCursorIndex(nextIndex);
      setScrollOffset(0);
    }
  }, [filteredFiles.length, cursorIndex]);

  useEffect(() => {
    if (cursorIndex < scrollOffset) {
      setScrollOffset(cursorIndex);
    } else if (cursorIndex >= scrollOffset + listHeight) {
      setScrollOffset(cursorIndex - listHeight + 1);
    }
  }, [cursorIndex, scrollOffset, listHeight]);

  const handleScan = async (dir: string): Promise<FileEntry[]> => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setScanning(true);
    setScanError(null);
    setStatusMessage(null);
    setProgressText(null);
    setFiles([]);
    setSelectedPaths(new Set());
    setCursorIndex(0);
    setScrollOffset(0);

    let scanned: FileEntry[] = [];
    try {
      const result = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      scanned = result.files;
      setFiles(scanned);
      setStatusMessage(`Scanned ${scanned.length} files from ${resolved}`);
    } catch (err: any) {
      setScanError(err?.message || String(err));
    } finally {
      setScanning(false);
      setProgressText(null);
    }
    return scanned;
  };

  useEffect(() => {
    (async () => {
      const store = await loadPresetStore();
      setPresetStore(store);
      await handleScan(rootDir);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveCursor = (delta: number) => {
    if (filteredFiles.length === 0) return;
    setCursorIndex(prev => {
      let next = prev + delta;
      if (next < 0) next = 0;
      if (next >= filteredFiles.length) next = filteredFiles.length - 1;
      return next;
    });
  };

  const toggleFile = (file: FileEntry | undefined) => {
    if (!file) return;
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else if (file.isText) {
        next.add(file.path);
      }
      return next;
    });
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!files.length) return;
    const matches = filterFilesByQuickSelect(files, key).filter(f => f.isText);
    const matchPaths = new Set(matches.map(f => f.path));
    if (!matches.length) return;

    setSelectedPaths(prev => {
      const next = new Set(prev);
      const allSelected = matches.every(f => next.has(f.path));
      if (allSelected) {
        for (const p of matchPaths) next.delete(p);
      } else {
        for (const p of matchPaths) next.add(p);
      }
      return next;
    });
    setStatusMessage(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filteredFiles.length) return;
    const filterSet = new Set(filteredFiles.map(f => f.path));
    setSelectedPaths(prev => {
      const next = new Set(prev);
      for (const p of filterSet) next.delete(p);
      return next;
    });
    setStatusMessage("Cleared selections for files matching current filter.");
  };

  const handleCombine = async () => {
    if (!selectedFiles.length) {
      setStatusMessage("No files selected. Select at least one text file first.");
      return;
    }
    setCombining(true);
    setMode("output");
    setCopyStatus(null);
    setStatusMessage("Combining selected files...");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText,
        includeGoal,
        goalText,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(selectedFiles, options);
      setCombined(result);
      setStatusMessage(
        `Combined ${selectedFiles.length} files into ${formatBytes(
          result.totalBytes
        )} (~${result.approxTokens} tokens).`
      );
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    } finally {
      setCombining(false);
    }
  };

  const handleCopyCombined = async () => {
    if (!combined) return;
    const ok = await copyToClipboard(combined.output);
    setCopyStatus(
      ok ? "Copied combined output to clipboard." : "Clipboard copy failed."
    );
  };

  const handleSaveCombinedToFile = async (targetPath: string) => {
    if (!combined) return;
    try {
      const resolved =
        path.isAbsolute(targetPath) || !rootDir
          ? path.resolve(targetPath)
          : path.resolve(rootDir, targetPath);
      const fs = await import("fs/promises");
      await fs.writeFile(resolved, combined.output, "utf8");
      setStatusMessage(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  const handleSavePreset = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setStatusMessage("Preset name cannot be empty.");
      return;
    }
    const options: CombineOptions = {
      includePreamble,
      preambleText,
      includeGoal,
      goalText,
      removeComments,
      minify
    };
    const preset = createPresetFromState(trimmed, rootDir, selectedPaths, options);
    setPresetStore(prev => {
      const others = prev.presets.filter(p => p.name !== trimmed);
      const updated: PresetStore = {
        presets: [...others, preset].sort((a, b) => a.name.localeCompare(b.name))
      };
      void savePresetStore(updated);
      return updated;
    });
    setStatusMessage(`Saved preset "${trimmed}".`);
  };

  const handleLoadPreset = async (index: number) => {
    const preset = presetStore.presets[index];
    if (!preset) return;
    setIncludePreamble(preset.options.includePreamble);
    setPreambleText(preset.options.preambleText);
    setIncludeGoal(preset.options.includeGoal);
    setGoalText(preset.options.goalText);
    setRemoveComments(preset.options.removeComments);
    setMinify(preset.options.minify);
    setStatusMessage(`Loading preset "${preset.name}"...`);
    const newFiles = await handleScan(preset.rootDir);
    const availablePaths = new Set(newFiles.map(f => f.path));
    const newSelected = new Set<string>();
    for (const p of preset.selectedPaths) {
      if (availablePaths.has(p)) newSelected.add(p);
    }
    setSelectedPaths(newSelected);
    setStatusMessage(
      `Loaded preset "${preset.name}" (${newSelected.size} files selected).`
    );
  };

  const handleDeletePreset = async (index: number) => {
    const preset = presetStore.presets[index];
    if (!preset) return;
    setPresetStore(prev => {
      const updated: PresetStore = {
        presets: prev.presets.filter((_, i) => i !== index)
      };
      void savePresetStore(updated);
      return updated;
    });
    setSelectedPresetIndex(prev =>
      prev >= presetStore.presets.length - 1 ? Math.max(0, prev - 1) : prev
    );
    setStatusMessage(`Deleted preset "${preset.name}".`);
  };

  const handleExportPresets = async (target: string) => {
    try {
      await exportPresetsToFile(presetStore, target);
      setStatusMessage(`Exported presets to ${path.resolve(target)}`);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  const handleImportPresets = async (source: string) => {
    try {
      const imported = await importPresetsFromFile(source);
      const merged: PresetStore = {
        presets: [...presetStore.presets, ...imported.presets].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      };
      setPresetStore(merged);
      await savePresetStore(merged);
      setStatusMessage(
        `Imported ${imported.presets.length} presets from ${path.resolve(source)}`
      );
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      if (key.escape) {
        if (mode === "output") {
          setMode("main");
          setCopyStatus(null);
          return;
        }
        if (focusField !== "none") {
          setFocusField("none");
          return;
        }
      }

      if (mode === "output") {
        if (input.toLowerCase() === "y") {
          void handleCopyCombined();
          return;
        }
        if (input.toLowerCase() === "w") {
          setFocusField("exportPath");
          return;
        }
        if (input.toLowerCase() === "s") {
          setMode("main");
          return;
        }
        return;
      }

      if (focusField === "rootDir") {
        if (key.return) {
          void handleScan(rootDir);
          setFocusField("none");
        }
        return;
      }
      if (focusField === "filter") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "preamble") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "goal") {
        if (key.return) setFocusField("none");
        return;
      }
      if (focusField === "presetName") {
        if (key.return) {
          void handleSavePreset(presetNameInput);
          setPresetNameInput("");
          setFocusField("none");
        }
        return;
      }
      if (focusField === "exportPath") {
        if (key.return) {
          if (mode === "output") {
            void handleSaveCombinedToFile(exportPathInput);
          } else {
            void handleExportPresets(exportPathInput);
          }
          setFocusField("none");
        }
        return;
      }
      if (focusField === "importPath") {
        if (key.return) {
          void handleImportPresets(importPathInput);
          setFocusField("none");
        }
        return;
      }

      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }
      if (key.pageUp) {
        moveCursor(-Math.max(5, listHeight - 2));
        return;
      }
      if (key.pageDown) {
        moveCursor(Math.max(5, listHeight - 2));
        return;
      }

      const lower = input.toLowerCase();

      if (input === " ") {
        toggleFile(filteredFiles[cursorIndex]);
        return;
      }

      if (key.return || lower === "c") {
        void handleCombine();
        return;
      }

      if (lower === "f") {
        setFocusField("filter");
        return;
      }
      if (lower === "d") {
        setFocusField("rootDir");
        return;
      }
      if (lower === "p" && !key.ctrl) {
        setFocusField("preamble");
        return;
      }
      if (lower === "g") {
        setFocusField("goal");
        return;
      }

      if (key.ctrl && lower === "p") {
        setIncludePreamble(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "g") {
        setIncludeGoal(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "m") {
        setMinify(prev => !prev);
        return;
      }
      if (key.ctrl && lower === "x") {
        setRemoveComments(prev => !prev);
        return;
      }

      if (key.ctrl && lower === "s") {
        setFocusField("presetName");
        return;
      }
      if (key.ctrl && lower === "l") {
        void handleLoadPreset(selectedPresetIndex);
        return;
      }
      if (key.ctrl && lower === "d") {
        void handleDeletePreset(selectedPresetIndex);
        return;
      }
      if (key.ctrl && lower === "e") {
        setFocusField("exportPath");
        return;
      }
      if (key.ctrl && lower === "i") {
        setFocusField("importPath");
        return;
      }

      if (lower === "[") {
        setSelectedPresetIndex(prev => (prev <= 0 ? 0 : prev - 1));
        return;
      }
      if (lower === "]") {
        setSelectedPresetIndex(prev =>
          prev >= presetStore.presets.length - 1
            ? Math.max(0, presetStore.presets.length - 1)
            : prev + 1
        );
        return;
      }

      // Quick selects & filter-based clear
      if (lower === "u") {
        clearSelectionInFilter();
        return;
      }
      if (lower === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (lower === "r") {
        toggleQuickSelect("rust");
        return;
      }
    },
    [
      mode,
      focusField,
      filteredFiles,
      cursorIndex,
      listHeight,
      presetStore,
      presetNameInput,
      exportPathInput,
      importPathInput,
      selectedPresetIndex,
      rootDir,
      includePreamble,
      preambleText,
      includeGoal,
      goalText,
      removeComments,
      minify,
      selectedFiles,
      combined
    ]
  );

  const visibleFiles = useMemo(
    () => filteredFiles.slice(scrollOffset, scrollOffset + listHeight),
    [filteredFiles, scrollOffset, listHeight]
  );

  if (mode === "output") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyanBright">
            Your Source to Prompt — Combined Output (press Esc to go back)
          </Text>
        </Box>
        {combined && (
          <Box marginTop={1}>
            <Text>
              Files: {selectedFiles.length} | Size: {formatBytes(combined.totalBytes)} | Lines:{" "}
              {combined.totalLines} | ~Tokens: {combined.approxTokens}
            </Text>
          </Box>
        )}
        {copyStatus && (
          <Box marginTop={1}>
            <Text color="green">{copyStatus}</Text>
          </Box>
        )}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={0}
          marginTop={1}
          flexGrow={1}
          width={stdout.columns ?? undefined}
        >
          <Text>{combined ? combined.output : "(nothing combined yet)"}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text>
            Keys: [Y] Copy to clipboard  [W] Save to file  [S] Back to file selection  [Esc] Close
          </Text>
          {focusField === "exportPath" && (
            <Box marginTop={1}>
              <Text>Save as: </Text>
              <TextInput
                value={exportPathInput}
                onChange={setExportPathInput}
                focus={true}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyanBright">Your Source to Prompt — TUI</Text>
        <Text>  (Ctrl+C to exit)</Text>
      </Box>

      <Box marginTop={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box marginTop={0}>
        <Text>Filter: </Text>
        <TextInput
          value={filterText}
          onChange={setFilterText}
          focus={focusField === "filter"}
          placeholder="substring to match file paths"
        />
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="space-between">
        <Box>
          {scanning && (
            <Text color="yellow">
              {progressText || "Scanning project..."}
            </Text>
          )}
          {scanError && <Text color="red">Error: {scanError}</Text>}
          {statusMessage && !scanning && !scanError && (
            <Text color="green">{statusMessage}</Text>
          )}
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text>
            Selected files: {selectedFiles.length} / {files.length}
          </Text>
          <Text>
            Size: {formatBytes(totalSelectedBytes)} | Lines: {totalSelectedLines} | ~Tokens:{" "}
            {approxTokens}
          </Text>
          {contextWarning && <Text color="yellow">{contextWarning}</Text>}
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={2} marginRight={2}>
          <Text>
            Files (↑/↓/PgUp/PgDn or j/k; Space to toggle; Enter/C to combine)
          </Text>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={0}
            height={listHeight + 2}
            width={Math.floor((stdout.columns ?? 120) * 0.65)}
          >
            {visibleFiles.length === 0 && (
              <Text color="gray">No files match the current filter.</Text>
            )}
            {visibleFiles.map((file, index) => {
              const globalIndex = scrollOffset + index;
              const isCursor = globalIndex === cursorIndex;
              const isSelected = selectedPaths.has(file.path);
              const marker = isCursor ? ">" : " ";
              const checkbox = isSelected ? "[x]" : "[ ]";
              const color: any = isCursor
                ? "cyanBright"
                : isSelected
                ? "green"
                : undefined;

              return (
                <Text key={file.path} color={color}>
                  {marker} {checkbox} {file.path}{" "}
                  {file.isText
                    ? `(${formatBytes(file.sizeBytes)}, ${file.numLines} lines)`
                    : "(binary/unreadable)"}
                </Text>
              );
            })}
          </Box>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column">
            <Text color="cyan">Options</Text>
            <Text>
              [Ctrl+P] Preamble: {includePreamble ? "ON" : "OFF"}
            </Text>
            {includePreamble && (
              <Box marginLeft={2}>
                <Text>Preamble text: </Text>
                <TextInput
                  value={preambleText}
                  onChange={setPreambleText}
                  focus={focusField === "preamble"}
                />
              </Box>
            )}
            <Text>
              [Ctrl+G] Goal: {includeGoal ? "ON" : "OFF"}
            </Text>
            {includeGoal && (
              <Box marginLeft={2}>
                <Text>Goal text: </Text>
                <TextInput
                  value={goalText}
                  onChange={setGoalText}
                  focus={focusField === "goal"}
                />
              </Box>
            )}
            <Text>
              [Ctrl+X] Remove code comments: {removeComments ? "ON" : "OFF"}
            </Text>
            <Text>
              [Ctrl+M] Minify output: {minify ? "ON" : "OFF"}
            </Text>
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text color="cyan">Quick File-Type Selects</Text>
            <Text>
              [T] All text | [1] JS | [2] React | [3] TS | [4] JSON | [5] MD
            </Text>
            <Text>
              [6] Py | [7] Go | [8] Java | [9] Ruby | [0] PHP | [R] Rust
            </Text>
            <Text>[U] Clear selections for files matching current filter</Text>
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text color="cyan">Presets</Text>
            {presetStore.presets.length === 0 && (
              <Text color="gray">No presets yet. Save one with Ctrl+S.</Text>
            )}
            {presetStore.presets.length > 0 && (
              <Box flexDirection="column">
                <Text>
                  Active preset:{" "}
                  {presetStore.presets[selectedPresetIndex]
                    ? presetStore.presets[selectedPresetIndex].name
                    : "(none)"}
                </Text>
                <Text>
                  Navigate with [ [ ] ], load with [Ctrl+L], delete with [Ctrl+D]
                </Text>
                <Box flexDirection="column" marginLeft={2}>
                  {presetStore.presets.map((p, index) => {
                    const isActive = index === selectedPresetIndex;
                    return (
                      <Text key={p.name} color={isActive ? "cyanBright" : undefined}>
                        {isActive ? "•" : " "} {p.name}
                      </Text>
                    );
                  })}
                </Box>
              </Box>
            )}
            <Text>
              [Ctrl+S] Save preset  [Ctrl+E] Export presets  [Ctrl+I] Import presets
            </Text>
            {focusField === "presetName" && (
              <Box marginTop={1}>
                <Text>Preset name: </Text>
                <TextInput
                  value={presetNameInput}
                  onChange={setPresetNameInput}
                  focus={true}
                />
              </Box>
            )}
            {focusField === "importPath" && (
              <Box marginTop={1}>
                <Text>Import from: </Text>
                <TextInput
                  value={importPathInput}
                  onChange={setImportPathInput}
                  focus={true}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>
          Keys: ↑/↓/PgUp/PgDn or j/k to move, Space to select, Enter/C to combine, F to edit
          filter, D to edit root, U to clear filtered selections, Ctrl+P/G/X/M for options,
          Ctrl+S/L/D/E/I for presets, Esc to clear focus
        </Text>
      </Box>
    </Box>
  );
};

export default App;
```

* * *

### `src/cli.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import App from "./app";

const args = process.argv.slice(2);
const rootDirArg = args[0];

render(<App initialRootDir={rootDirArg} />);
```

* * *

## How to run and build

From the project root:

```
bash

bashbun install
bun run src/cli.tsx           # dev: full-screen TUI
bun build src/cli.tsx --compile --outfile ystp
```

You can then run the compiled binary:

```
bash

bash./ystp                      # uses current directory as project root
./ystp /path/to/project     # explicit root
```

## Key mappings / UX summary

**Navigation & selection**

-   ```
    ↑ / ↓
    ```
    
    or
    
    ```
    j / k
    ```
    
    — move cursor in file list
    
-   ```
    PgUp / PgDn
    ```
    
    — scroll faster
    
-   ```
    Space
    ```
    
    — toggle selection for the focused file
    
-   ```
    F
    ```
    
    — focus the filter input
    
-   ```
    D
    ```
    
    — focus the root directory input
    
-   ```
    Enter
    ```
    
    or
    
    ```
    C
    ```
    
    — combine selected files and open the Combined Output view
    

**Quick selection**

-   ```
    T
    ```
    
    — toggle all text files
    
-   ```
    1
    ```
    
    JS,
    
    ```
    2
    ```
    
    React (
    
    ```
    .jsx
    ```
    
    /
    
    ```
    .tsx
    ```
    
    ),
    
    ```
    3
    ```
    
    TS,
    
    ```
    4
    ```
    
    JSON,
    
    ```
    5
    ```
    
    Markdown
    
-   ```
    6
    ```
    
    Python,
    
    ```
    7
    ```
    
    Go,
    
    ```
    8
    ```
    
    Java,
    
    ```
    9
    ```
    
    Ruby,
    
    ```
    0
    ```
    
    PHP,
    
    ```
    R
    ```
    
    Rust
    
-   ```
    U
    ```
    
    — clear all selections for files matching the current filter
    

**Options**

-   ```
    Ctrl+P
    ```
    
    — toggle preamble; edit text by focusing “Preamble text” (press
    
    ```
    P
    ```
    
    )
    
-   ```
    Ctrl+G
    ```
    
    — toggle goal; edit text by focusing “Goal text” (press
    
    ```
    G
    ```
    
    )
    
-   ```
    Ctrl+X
    ```
    
    — toggle “remove code comments”
    
-   ```
    Ctrl+M
    ```
    
    — toggle “minify output”
    

**Presets**

-   ```
    Ctrl+S
    ```
    
    — save preset (will prompt for name)
    
-   ```
    [
    ```
    
    /
    
    ```
    ]
    ```
    
    — move active preset selection up/down
    
-   ```
    Ctrl+L
    ```
    
    — load active preset (rescan + restore options + selections)
    
-   ```
    Ctrl+D
    ```
    
    — delete active preset
    
-   ```
    Ctrl+E
    ```
    
    — export presets (prompts for JSON path, default
    
    ```
    combined-prompt.txt
    ```
    
    in non-output mode)
    
-   ```
    Ctrl+I
    ```
    
    — import presets from a JSON file
    

**Combined output view**

-   ```
    Y
    ```
    
    — copy combined output to clipboard (macOS via
    
    ```
    pbcopy
    ```
    
    , Linux via
    
    ```
    wl-copy
    ```
    
    /
    
    ```
    xclip
    ```
    
    /
    
    ```
    xsel
    ```
    
    )
    
-   ```
    W
    ```
    
    — save combined output to a file (prompts for path)
    
-   ```
    S
    ```
    
    or
    
    ```
    Esc
    ```
    
    — return to main view
    

This setup mirrors the original HTML tool’s behavior but in a full-width, keyboard-driven TUI you can compile into a single Bun binary for Linux and macOS.

## Other

##### You said:

I asked a competing LLM to do the same thing and their response is presented below; please study it carefully and with an open mind and be intellectually honest about what they may have done that’s better or incremental/complementary to your own design, and then come up with a superior hybrid best of both worlds version of the complete code: This is a feature-complete, "World-Class" TUI implementation. It replicates every feature of the original web utility (Recursive Selection, Minification, Token Estimation, Preamble/Goal injection) and adds powerful TUI-specific enhancements like Vim-bindings, Live Syntax Highlighting, Search Filtering, and a Presets System (saved to ~/.source2prompt.json). It uses Bun for the runtime/compiler and Ink (the industry-standard React renderer for terminals) to achieve the "slick" UI you requested. 1. Project Setup Initialize a Bun project and install the high-fidelity UI components. mkdir source2prompt
cd source2prompt
bun init -y

# UI & Rendering
bun add ink react ink-text-input ink-spinner ink-gradient ink-big-text ink-progress-bar ink-syntax-highlight

# Logic & Utilities
bun add globby ignore clipboardy filesize js-tiktoken chalk lodash date-fns

# Dev Dependencies
bun add -d @types/react @types/node @types/lodash
 2. The Application Code Create src/index.tsx. This single file contains the Virtual Scroller, Git-Aware Scanner, Minifier, and Layout Engine. import React, { useState, useEffect, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useStdoutDimensions } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import ProgressBar from 'ink-progress-bar';
import SyntaxHighlight from 'ink-syntax-highlight';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { globby } from 'globby';
import ignore from 'ignore';
import clipboardy from 'clipboardy';
import { filesize } from 'filesize';
import { getEncoding } from 'js-tiktoken';
import \_ from 'lodash';

// --- CONFIGURATION ---
const PRESET\_FILE = path.join(os.homedir(), '.source2prompt.json');
const CONTEXT\_WINDOW = 128000; // GPT-4o / Claude 3.5 Context Limit
const COST\_PER\_1M\_TOKENS = 5.00; // Approx blended input cost

// --- TYPES ---
interface FileNode {
 path: string;
 relPath: string;
 name: string;
 isDirectory: boolean;
 size: number;
 depth: number;
 children?: FileNode\[\];
}

interface Preset {
 name: string;
 preamble: string;
 goal: string;
 minify: boolean;
 selectedPaths: string\[\];
}

type Pane = 'explorer' | 'config' | 'preview';
type ConfigTab = 'inputs' | 'presets';

// --- UTILS ---
const enc = getEncoding("cl100k\_base");
const countTokens = (text: string) => enc.encode(text).length;

const loadPresets = (): Preset\[\] => {
 try { return JSON.parse(fs.readFileSync(PRESET\_FILE, 'utf-8')); } catch { return \[\]; }
};

const savePresets = (presets: Preset\[\]) => {
 fs.writeFileSync(PRESET\_FILE, JSON.stringify(presets, null, 2));
};

// --- MAIN APPLICATION ---
const App = () => {
 const { exit } = useApp();
 const \[cols, rows\] = useStdoutDimensions();
 const \[cwd\] = useState(process.cwd());

 // --- STATE ---
 // Data
 const \[root, setRoot\] = useState<FileNode | null>(null);
 const \[flatFiles, setFlatFiles\] = useState<FileNode\[\]>(\[\]);
 const \[loading, setLoading\] = useState(true);
 
 // Selection & Nav
 const \[expanded, setExpanded\] = useState<Set<string>>(new Set());
 const \[selected, setSelected\] = useState<Set<string>>(new Set());
 const \[activePane, setActivePane\] = useState<Pane>('explorer');
 const \[configTab, setConfigTab\] = useState<ConfigTab>('inputs');
 const \[cursor, setCursor\] = useState(0);
 const \[scrollOffset, setScrollOffset\] = useState(0);
 const \[filter, setFilter\] = useState("");
 
 // Inputs
 const \[preamble, setPreamble\] = useState("");
 const \[goal, setGoal\] = useState("");
 const \[minify, setMinify\] = useState(false);
 const \[presetName, setPresetName\] = useState("");
 const \[presets, setPresets\] = useState<Preset\[\]>(\[\]);

 // Derived
 const \[status, setStatus\] = useState("Ready");
 const \[stats, setStats\] = useState({ count: 0, size: 0, tokens: 0, cost: 0 });
 const \[previewContent, setPreviewContent\] = useState<string>("");
 const \[previewLang, setPreviewLang\] = useState<string>("txt");

 // --- 1. SCANNING ENGINE ---
 useEffect(() => {
 const scan = async () => {
 const ig = ignore();
 try { ig.add(await Bun.file(path.join(cwd, '.gitignore')).text()); } catch {}
 ig.add(\['.git', 'node\_modules', '.DS\_Store', 'bun.lockb', '\*.lock', 'dist', 'build', '.next'\]);

 // Fast glob scan
 const paths = await globby(\['\*\*/\*'\], { cwd, markDirectories: true, dot: true, ignore: \['.git/\*\*'\] });
 
 const rootNode: FileNode = { path: cwd, relPath: '.', name: path.basename(cwd), isDirectory: true, size: 0, depth: 0, children: \[\] };
 const flat: FileNode\[\] = \[\];

 // Build Tree Structure
 for (const p of paths.sort()) {
 if (ig.ignores(p)) continue;
 const parts = p.split('/');
 let current = rootNode;
 let currentRel = "";
 
 for (let i = 0; i < parts.length; i++) {
 const part = parts\[i\];
 const isDir = i < parts.length - 1 || p.endsWith('/');
 const cleanName = part.replace(/\\/$/, '');
 if(!cleanName) continue;
 
 currentRel = currentRel ?

```
${currentRel}/${cleanName}
```

: cleanName;
 
 let child = current.children?.find(c => c.name === cleanName);
 if (!child) {
 let size = 0;
 if (!isDir) try { size = fs.statSync(path.join(cwd, currentRel)).size; } catch {}
 
 child = {
 path: path.join(cwd, currentRel),
 relPath: currentRel,
 name: cleanName,
 isDirectory: isDir,
 size,
 depth: current.depth + 1,
 children: isDir ? \[\] : undefined
 };
 current.children?.push(child);
 if (!isDir) flat.push(child);
 }
 current = child;
 }
 }
 
 // Sort: Folders first, then alphabetical
 const sortRecursive = (n: FileNode) => {
 n.children?.sort((a,b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
 n.children?.forEach(sortRecursive);
 };
 sortRecursive(rootNode);

 setRoot(rootNode);
 setFlatFiles(flat);
 setExpanded(new Set(\[rootNode.path\]));
 setPresets(loadPresets());
 setLoading(false);
 };
 scan();
 }, \[\]);

 // --- 2. VIRTUAL TREE & FILTERING ---
 const visibleNodes = useMemo(() => {
 if (!root) return \[\];
 const results: FileNode\[\] = \[\];
 
 const traverse = (node: FileNode) => {
 // If filtering, show match OR if it contains a match (heuristic simplification: show all if filter matches child? no, simple filter for files)
 const matches = !filter || node.name.toLowerCase().includes(filter.toLowerCase());
 
 // If filtering, we auto-expand everything to show matches. If not, check expanded set.
 const isExpanded = filter ? true : expanded.has(node.path);
 
 if (matches || (node.isDirectory && filter)) { 
 // If folder doesn't match but children might, we still need logic. 
 // For simple TUI, we just filter leaves and show path.
 if (!node.isDirectory && matches) results.push(node);
 else if (node.isDirectory) results.push(node);
 }

 if (node.isDirectory && isExpanded && node.children) {
 node.children.forEach(traverse);
 }
 };
 
 // To handle filtering properly in a tree, usually you prune. 
 // Here we use the standard "Visual Tree" approach.
 const flatten = (n: FileNode) => {
 results.push(n);
 if (n.isDirectory && expanded.has(n.path) && n.children) n.children.forEach(flatten);
 }
 
 // If filter is active, we search flatFiles instead to be faster and show flat list
 if (filter) {
 return flatFiles.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
 } else if (root) {
 if (root.children) root.children.forEach(flatten);
 }
 
 return results;
 }, \[root, expanded, filter, flatFiles\]);

 // --- 3. STATS & PREVIEW ---
 useEffect(() => {
 const debouncedCalc = \_.debounce(() => {
 const selectedFiles = flatFiles.filter(f => selected.has(f.path));
 const size = selectedFiles.reduce((acc, f) => acc + f.size, 0);
 const estimatedTokens = Math.ceil(size / 3.5) + countTokens(preamble) + countTokens(goal);
 
 setStats({
 count: selectedFiles.length,
 size,
 tokens: estimatedTokens,
 cost: (estimatedTokens / 1\_000\_000) \* COST\_PER\_1M\_TOKENS
 });
 }, 300);
 debouncedCalc();
 return () => debouncedCalc.cancel();
 }, \[selected, preamble, goal\]);

 useEffect(() => {
 const node = visibleNodes\[cursor\];
 if (node && !node.isDirectory) {
 setPreviewLang(path.extname(node.name).slice(1) || 'txt');
 if (node.size > 50000) setPreviewContent("// File too large to preview");
 else Bun.file(node.path).text().then(setPreviewContent).catch(() => setPreviewContent("Error reading file"));
 } else {
 setPreviewContent("");
 }
 }, \[cursor, visibleNodes\]);

 // --- ACTIONS ---
 const toggleSelect = (node: FileNode) => {
 const newSel = new Set(selected);
 const target = !newSel.has(node.path);
 const apply = (n: FileNode) => {
 if (target) newSel.add(n.path); else newSel.delete(n.path);
 n.children?.forEach(apply); // Recursive select/deselect
 };
 
 // If filtering, we just toggle the file. If tree, we recurse.
 if (filter) {
 if (target) newSel.add(node.path); else newSel.delete(node.path);
 } else {
 apply(node);
 }
 setSelected(newSel);
 };

 const generate = async () => {
 setStatus("Generating...");
 await new Promise(r => setTimeout(r, 50));

 let out = "";
 if (preamble) out +=

```
<preamble>\n${preamble}\n</preamble>\n\n
```

;
 if (goal) out +=

```
<goal>\n${goal}\n</goal>\n\n
```

;

 out +=

```
<project_tree>\n
```

;
 const printTree = (n: FileNode, prefix = "") => {
 const isSel = selected.has(n.path);
 const hasSelChild = n.children?.some(c => selected.has(c.path) || (c.isDirectory && c.children.some(g => selected.has(g.path))));
 
 if (isSel || hasSelChild) {
 out +=

```
${prefix}${n.isDirectory ? '📂' : '📄'} ${n.name}\n
```

;
 n.children?.forEach(c => printTree(c, prefix + " "));
 }
 };
 if (root) printTree(root);
 out +=

```
</project_tree>\n\n
```

;

 const files = flatFiles.filter(f => selected.has(f.path));
 for (const f of files) {
 try {
 let content = await Bun.file(f.path).text();
 if (minify && /\\.(js|ts|tsx|json)$/.test(f.name)) {
 const loader = f.name.endsWith('json') ? 'json' : 'tsx';
 const res = await Bun.transform(content, { loader, minify: true });
 content = res.code;
 }
 out +=

```
<file path="${f.relPath}">\n${content}\n</file>\n\n
```

;
 } catch {}
 }

 clipboardy.writeSync(out);
 setStatus(

```
✅ Copied ${files.length} files!
```

);
 setTimeout(() => setStatus("Ready"), 3000);
 };

 const savePreset = () => {
 if(!presetName) return;
 const newP = { name: presetName, preamble, goal, minify, selectedPaths: Array.from(selected).map(p => path.relative(cwd, p)) };
 const list = \[...presets.filter(p => p.name !== presetName), newP\];
 setPresets(list);
 savePresets(list);
 setPresetName("");
 setStatus(

```
Saved preset: ${newP.name}
```

);
 };

 const loadPreset = (p: Preset) => {
 setPreamble(p.preamble);
 setGoal(p.goal);
 setMinify(p.minify);
 const sel = new Set<string>();
 p.selectedPaths.forEach(r => sel.add(path.join(cwd, r)));
 setSelected(sel);
 setStatus(

```
Loaded: ${p.name}
```

);
 };

 // --- INPUT HANDLING ---
 useInput((input, key) => {
 if (key.ctrl && input === 'c') exit();
 if (key.ctrl && input === 'g') generate();
 
 // Global Tab Switching
 if (key.tab) {
 const panes: Pane\[\] = \['explorer', 'config', 'preview'\];
 setActivePane(panes\[(panes.indexOf(activePane) + 1) % panes.length\]);
 }

 // EXPLORER CONTROLS
 if (activePane === 'explorer') {
 if (key.upArrow || input === 'k') {
 const next = Math.max(0, cursor - 1);
 setCursor(next);
 if (next < scrollOffset) setScrollOffset(next);
 }
 if (key.downArrow || input === 'j') {
 const next = Math.min(visibleNodes.length - 1, cursor + 1);
 setCursor(next);
 if (next > scrollOffset + (rows - 10)) setScrollOffset(prev => prev + 1);
 }
 
 const node = visibleNodes\[cursor\];
 if (node) {
 // Space to Select
 if (input === ' ') toggleSelect(node);
 
 // Arrows/Enter to Expand
 if (node.isDirectory) {
 if (key.rightArrow || input === 'l' || key.return) setExpanded(prev => new Set(prev).add(node.path));
 if (key.leftArrow || input === 'h') setExpanded(prev => { const s = new Set(prev); s.delete(node.path); return s; });
 }
 }
 }

 // CONFIG CONTROLS
 if (activePane === 'config') {
 if (key.leftArrow || key.rightArrow) setConfigTab(t => t === 'inputs' ? 'presets' : 'inputs');
 if (configTab === 'inputs' && input === 'm' && !preamble && !goal) setMinify(!minify); 
 }
 });

 // --- RENDER LAYOUT ---
 if (loading) return <Box padding={2}><Spinner type="dots" /> <Text> Scanning Project...</Text></Box>;

 const LIST\_HEIGHT = rows - 9;
 const viewNodes = visibleNodes.slice(scrollOffset, scrollOffset + LIST\_HEIGHT);

 return (
 <Box flexDirection="column" paddingX={1} height={rows} width={cols}>
 
 {/\* 1. HEADER \*/}
 <Box justifyContent="center" height={3}>
 <Gradient name="pastel"><BigText text="Source2Prompt" font="tiny" /></Gradient>
 </Box>

 {/\* 2. MAIN DASHBOARD \*/}
 <Box flexDirection="row" flexGrow={1} borderStyle="round" borderColor="gray">
 
 {/\* LEFT: EXPLORER \*/}
 <Box width="35%" flexDirection="column" borderRight borderStyle="single" borderColor={activePane === 'explorer' ? "cyan" : "gray"}>
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
 <Text bold color={activePane === 'explorer' ? "cyan" : "white"}>EXPLORER</Text>
 <Text dimColor>{stats.count} sel</Text>
 </Box>
 
 {/\* Filter \*/}
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1}>
 <Text color="cyan">🔍 </Text>
 <TextInput value={filter} onChange={setFilter} focus={activePane === 'explorer'} placeholder="Filter..." />
 </Box>

 <Box flexDirection="column" paddingLeft={1}>
 {viewNodes.map((node, i) => {
 const isCursor = (scrollOffset + i) === cursor;
 const isSel = selected.has(node.path);
 return (
 <Box key={node.path}>
 <Text color={isCursor ? "cyan" : "black"}>{isCursor ? "›" : " "}</Text>
 <Text dimColor>{" ".repeat(filter ? 0 : node.depth)}</Text>
 <Text color={isSel ? "green" : (node.isDirectory ? "yellow" : "white")}>
 {node.isDirectory ? (expanded.has(node.path) ? "📂" : "📁") : (isSel ? "▣" : "📄")} {node.name}
 </Text>
 </Box>
 )
 })}
 {visibleNodes.length === 0 && <Text dimColor>No files match "{filter}"</Text>}
 </Box>
 </Box>

 {/\* CENTER: CONFIG \*/}
 <Box width="30%" flexDirection="column" borderRight borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"}>
 <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
 <Box paddingX={1} borderRight borderStyle="single" borderColor={configTab === 'inputs' ? "cyan" : "gray"}>
 <Text bold={configTab === 'inputs'}>Inputs</Text>
 </Box>
 <Box paddingX={1} borderColor={configTab === 'presets' ? "cyan" : "gray"}>
 <Text bold={configTab === 'presets'}>Presets</Text>
 </Box>
 </Box>

 {configTab === 'inputs' ? (
 <Box flexDirection="column" padding={1}>
 <Text bold>Preamble</Text>
 <Box borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"} height={4}>
 <TextInput value={preamble} onChange={setPreamble} focus={activePane === 'config'} placeholder="System Context..." />
 </Box>
 <Text bold>Goal</Text>
 <Box borderStyle="single" borderColor={activePane === 'config' ? "cyan" : "gray"} height={4}>
 <TextInput value={goal} onChange={setGoal} focus={activePane === 'config'} placeholder="Task..." />
 </Box>
 <Box marginTop={1}>
 <Text>Minify: {minify ? <Text color="green">ON</Text> : <Text color="red">OFF</Text>}</Text>
 <Text dimColor>(Press 'm' to toggle)</Text>
 </Box>
 </Box>
 ) : (
 <Box flexDirection="column" padding={1}>
 {presets.length === 0 && <Text dimColor>No saved presets.</Text>}
 {presets.map(p => (
 <Box key={p.name} marginBottom={1}>
 <Text color="cyan" bold onClick={() => loadPreset(p)}>▶ {p.name}</Text>
 </Box>
 ))}
 <Box borderTop borderStyle="single" borderColor="gray" paddingTop={1} flexDirection="column">
 <Text>Save Current:</Text>
 <TextInput value={presetName} onChange={setPresetName} focus={activePane === 'config' && configTab === 'presets'} onSubmit={savePreset} placeholder="Enter Name..." />
 </Box>
 </Box>
 )}
 </Box>

 {/\* RIGHT: PREVIEW & STATS \*/}
 <Box width="35%" flexDirection="column" borderColor={activePane === 'preview' ? "cyan" : "gray"}>
 <Box borderBottom borderStyle="single" borderColor="gray" paddingX={1}>
 <Text bold>PREVIEW</Text>
 </Box>
 <Box flexGrow={1} overflowY="hidden" paddingX={1}>
 <SyntaxHighlight language={previewLang} code={previewContent.slice(0, 1500) || "// No selection"} />
 </Box>
 
 {/\* Stats Footer \*/}
 <Box borderTop borderStyle="single" borderColor="gray" flexDirection="column" padding={1}>
 <Box justifyContent="space-between">
 <Text>Tokens: <Text color="magenta">{stats.tokens.toLocaleString()}</Text></Text>
 <Text color="green">${stats.cost.toFixed(4)}</Text>
 </Box>
 <ProgressBar percent={stats.tokens / CONTEXT\_WINDOW} color={stats.tokens > CONTEXT\_WINDOW ? "red" : "green"} />
 <Text dimColor>{(stats.tokens/CONTEXT\_WINDOW\*100).toFixed(1)}% of 128k</Text>
 </Box>
 </Box>
 </Box>

 {/\* 3. FOOTER \*/}
 <Box height={1} justifyContent="space-between" paddingX={1}>
 <Text dimColor>Nav: j/k | Select: Space | Pane: Tab | Gen: Ctrl+G</Text>
 <Text bold color={status === "Ready" ? "white" : "green"}>{status}</Text>
 </Box>
 </Box>
 );
};

render(<App />);
 3. Build the Single Binary To distribute this as a standalone tool that doesn't require Bun/Node on the target machine: 1 Add this build script to your package.json:
"scripts": {
 "build": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
}

 2 Run the build:
bun run build

 3 Run it: ./s2p How to Use • Navigation: Use Up/Down (or Vim keys j/k) to scroll. • Filtering: In the Explorer pane, just start typing to filter files by name. • Selection: Press Space to toggle a file. Pressing Space on a folder recursively selects/deselects all its children. • Tabs: Press Tab to switch between the File Explorer, Configuration, and Preview panes. • Settings: • Switch to the Config pane (Center). • Type your Preamble and Goal. • Press m (if inputs aren't focused) to toggle Minification. • Press Right Arrow to switch to the Presets tab to save your current configuration. • Generate: Press Ctrl+G. The tool will compile your prompt, minify the code (if enabled), and copy everything to your clipboard.

## Other

###### ChatGPT said:

Reasoned for 12m 47s

Here’s a genuinely fused “best of both worlds” implementation:

-   Uses **Bun + TypeScript + Ink** (React renderer for terminal apps).
    
-   Keeps your **comment-stripping / deep minification / structured output** from my first design.
    
-   Pulls in the competitor’s **tree explorer, Vim-style navigation, gradient header, live syntax-highlighted preview, token-estimation, cost + context bar, presets to `~/.source2prompt.json`, recursive folder selection, and clipboard auto-copy**.
    
-   Adds a **full-screen Combined Output view** (with save-to-file and copy-to-clipboard) that the competitor implementation didn’t have.
    
-   Uses a **git-aware recursive scanner with deep `.gitignore` support**.
    
-   Supports **quick file-type selects**, **minify vs comment-strip toggles**, **preamble/goal on/off and editing**, and **LLM-ish XML-ish section tags**:
    
    ```
    <preamble>
    ```
    
    ,
    
    ```
    <goal>
    ```
    
    ,
    
    ```
    <project_tree>
    ```
    
    ,
    
    ```
    <file ...>
    ```
    
    .
    

Everything below is complete and paste‑ready. No placeholders, no “rest of code” omissions.

* * *

## `package.json`

```
json

json{
  "name": "source2prompt-tui",
  "version": "0.2.0",
  "description": "Hybrid world-class TUI version of Your Source to Prompt (Bun + TypeScript + Ink).",
  "type": "module",
  "bin": {
    "s2p": "dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.tsx",
    "build": "tsc",
    "build:bin": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
  },
  "dependencies": {
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0",
    "ignore": "^5.3.0",
    "ink": "^5.0.1",
    "ink-big-text": "^2.0.0",
    "ink-gradient": "^3.0.0",
    "ink-progress-bar": "^4.0.0",
    "ink-spinner": "^5.0.0",
    "ink-syntax-highlight": "^1.0.2",
    "ink-text-input": "^6.0.0",
    "js-tiktoken": "^1.0.14",
    "clipboardy": "^4.0.0",
    "react": "^18.3.0",
    "terser": "^5.31.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8",
    "typescript": "^5.6.3"
  }
}
```

> Note: version ranges are reasonable; bump if you want absolutely latest.

* * *

## `tsconfig.json`

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

## `src/index.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import ProgressBar from "ink-progress-bar";
import SyntaxHighlight from "ink-syntax-highlight";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore, { Ignore } from "ignore";
import clipboardy from "clipboardy";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { encodingForModel, getEncoding, Tiktoken } from "js-tiktoken";

/* ---------- Types & constants ---------- */

type Pane = "explorer" | "config" | "preview";
type ConfigTab = "inputs" | "presets" | "options";
type Mode = "main" | "combined";

type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

interface FileNode {
  path: string; // absolute
  relPath: string; // relative to root
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  depth: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  numLines: number;
  content: string; // only for text files <= threshold; else ""
  children?: FileNode[];
}

interface Preset {
  name: string;
  rootDir: string;
  includePreamble: boolean;
  includeGoal: boolean;
  preamble: string;
  goal: string;
  minify: boolean;
  removeComments: boolean;
  selectedRelPaths: string[];
  createdAt: string;
}

interface CombinedResult {
  text: string;
  bytes: number;
  tokens: number;
  lines: number;
}

type FocusField =
  | "none"
  | "filter"
  | "rootDir"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath";

type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

/* ---------- Tokenizer setup ---------- */

let encoder: Tiktoken | null = null;
try {
  encoder = encodingForModel("gpt-4o-mini");
} catch {
  try {
    encoder = getEncoding("cl100k_base");
  } catch {
    encoder = null;
  }
}

function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoder) {
    const bytes = Buffer.byteLength(text, "utf8");
    return Math.ceil(bytes / 4);
  }
  return encoder.encode(text).length;
}

/* ---------- FS & scanning utilities ---------- */

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  ".hg/",
  ".svn/",
  ".idea/",
  ".vscode/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".turbo/",
  ".vercel/"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

const PRESET_FILE = path.join(os.homedir(), ".source2prompt.json");
const CONTEXT_WINDOW = 128000;
const COST_PER_1M_TOKENS = 5.0;
const MAX_PREVIEW_CHARS = 2000;
const MAX_READ_BYTES = 5 * 1024 * 1024; // 5MB

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const giPath = path.join(dirAbs, ".gitignore");
    try {
      const content = await fsp.readFile(giPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // ignore
    }

    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix
          ? path.posix.join(relPrefix, entry.name)
          : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ root: FileNode; flatFiles: FileNode[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);

  const root: FileNode = {
    path: resolvedRoot,
    relPath: ".",
    name: path.basename(resolvedRoot),
    isDirectory: true,
    sizeBytes: 0,
    depth: 0,
    extension: "",
    isText: false,
    category: "other",
    numLines: 0,
    content: "",
    children: []
  };

  const flatFiles: FileNode[] = [];
  let processed = 0;

  async function walk(dirAbs: string, parent: FileNode, relDir: string, depth: number) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const relPath = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(dirAbs, entry.name);

      if (entry.isDirectory()) {
        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: true,
          sizeBytes: 0,
          depth: depth + 1,
          extension: "",
          isText: false,
          category: "other",
          numLines: 0,
          content: "",
          children: []
        };
        parent.children!.push(node);
        await walk(absPath, node, relPath, depth + 1);
      } else if (entry.isFile()) {
        let sizeBytes = 0;
        try {
          const stat = await fsp.stat(absPath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }

        const extension = path.extname(entry.name).toLowerCase();
        let isText = isTextExtension(extension);
        let content = "";
        let numLines = 0;

        if (isText && sizeBytes <= MAX_READ_BYTES) {
          try {
            content = await fsp.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } catch {
            isText = false;
            content = "";
          }
        } else if (isText) {
          // treat very large files as non-text for safety
          isText = false;
        }

        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: false,
          sizeBytes,
          depth: depth + 1,
          extension,
          isText,
          category: getFileCategory(extension),
          numLines,
          content,
          children: undefined
        };

        parent.children!.push(node);
        flatFiles.push(node);
        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, root, "", 0);

  const sortRecursive = (n: FileNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      n.children.forEach(sortRecursive);
    }
  };
  sortRecursive(root);

  return { root, flatFiles };
}

/* ---------- Minification & transformation ---------- */

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

async function transformFileContent(
  file: FileNode,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  if (!file.isText) return file.content;
  let text = file.content || (await fsp.readFile(file.path, "utf8").catch(() => "")) || "";
  const ext = file.extension;

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fall through
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // fall through
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // fall through
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // fall through
      }
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    }
  }

  return text;
}

async function buildCombinedOutput(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<CombinedResult> {
  const selectedFiles = flatFiles.filter(f => !f.isDirectory && f.isText && selected.has(f.path));
  const lines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    lines.push("<preamble>", options.preambleText.trim(), "</preamble>", "");
  }

  if (options.includeGoal && options.goalText.trim()) {
    lines.push("<goal>", options.goalText.trim(), "</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines: string[] = [];
    treeLines.push("<project_tree>");

    const selectedSet = selected;

    const collectTree = (node: FileNode, prefix: string): boolean => {
      const isSel = !node.isDirectory && selectedSet.has(node.path);
      let hasSel = isSel;

      if (node.children && node.children.length > 0) {
        const beforeChildCount = treeLines.length;
        for (const child of node.children) {
          const childHas = collectTree(child, prefix + "  ");
          hasSel = hasSel || childHas;
        }
        if (hasSel) {
          const icon = node.isDirectory ? "📂" : "📄";
          const label =
            node.relPath === "." ? node.name : node.relPath;
          treeLines.splice(
            beforeChildCount,
            0,
            `${prefix}${icon} ${label}`
          );
        }
      } else if (isSel) {
        const icon = node.isDirectory ? "📂" : "📄";
        const label =
          node.relPath === "." ? node.name : node.relPath;
        treeLines.push(`${prefix}${icon} ${label}`);
      }

      return hasSel;
    };

    if (root.children) {
      for (const child of root.children) {
        collectTree(child, "  ");
      }
    }

    treeLines.push("</project_tree>", "");
    lines.push(...treeLines);
  }

  lines.push("<files>");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed.trimEnd();
    const numLines = content ? content.split(/\r?\n/).length : 0;
    lines.push(
      `<file path="${file.relPath}" lines="${numLines}" bytes="${file.sizeBytes}">`,
      content,
      "</file>",
      ""
    );
  }

  lines.push("</files>");

  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text, "utf8");
  const tokens = countTokens(text);
  const linesCount = text.split(/\r?\n/).length;

  return { text, bytes, tokens, lines: linesCount };
}

/* ---------- Presets & clipboard ---------- */

function loadPresets(): Preset[] {
  try {
    const raw = fs.readFileSync(PRESET_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.presets)) return parsed.presets;
    return [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    fs.writeFileSync(PRESET_FILE, JSON.stringify(presets, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await clipboardy.write(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Quick-select helpers ---------- */

const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

function filterFilesByQuickSelect(
  files: FileNode[],
  key: QuickSelectKey
): FileNode[] {
  switch (key) {
    case "allText":
      return files.filter(f => !f.isDirectory && f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}

/* ---------- Small debounce ---------- */

function debounce<F extends (...args: any[]) => void>(
  fn: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

/* ---------- Main App ---------- */

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rootDir, setRootDir] = useState(path.resolve(process.cwd()));

  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [flatFiles, setFlatFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [status, setStatus] = useState("Scanning project...");
  const [progressText, setProgressText] = useState<string | null>(null);

  const [activePane, setActivePane] = useState<Pane>("explorer");
  const [configTab, setConfigTab] = useState<ConfigTab>("inputs");
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [focusField, setFocusField] = useState<FocusField>("none");

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goal, setGoal] = useState("");
  const [minify, setMinify] = useState(false);
  const [removeComments, setRemoveComments] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  const [statsTokens, setStatsTokens] = useState(0);
  const [statsSizeBytes, setStatsSizeBytes] = useState(0);
  const [statsFileCount, setStatsFileCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLang, setPreviewLang] = useState("txt");

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [exportPath, setExportPath] = useState("combined-prompt.txt");

  const rows = stdout.rows ?? 30;
  const cols = stdout.columns ?? 120;
  const listHeight = Math.max(8, rows - 12);

  const handleScan = async (dir: string) => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setLoading(true);
    setScanError(null);
    setStatus("Scanning project...");
    setProgressText(null);
    setRootNode(null);
    setFlatFiles([]);
    setExpanded(new Set());
    setSelected(new Set());
    setCursor(0);
    setScrollOffset(0);

    try {
      const { root, flatFiles: files } = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      setRootNode(root);
      setFlatFiles(files);
      setExpanded(new Set([root.path]));
      setStatus(`Scanned ${files.length} files from ${resolved}`);
    } catch (err: any) {
      setScanError(err?.message || String(err));
      setStatus("Scan error");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  useEffect(() => {
    (async () => {
      const loaded = loadPresets();
      setPresets(loaded);
      await handleScan(rootDir);
      setStatus("Ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNodes = useMemo(() => {
    if (!rootNode) return [];
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      return flatFiles.filter(f =>
        f.relPath.toLowerCase().includes(q)
      );
    }

    const out: FileNode[] = [];
    const traverse = (n: FileNode) => {
      out.push(n);
      if (n.isDirectory && expanded.has(n.path) && n.children) {
        for (const child of n.children) traverse(child);
      }
    };
    traverse(rootNode);
    return out;
  }, [rootNode, flatFiles, expanded, filter]);

  useEffect(() => {
    if (cursor >= visibleNodes.length) {
      setCursor(visibleNodes.length > 0 ? visibleNodes.length - 1 : 0);
      setScrollOffset(0);
    }
  }, [visibleNodes.length, cursor]);

  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + listHeight) {
      setScrollOffset(cursor - listHeight + 1);
    }
  }, [cursor, scrollOffset, listHeight]);

  const viewNodes = useMemo(
    () => visibleNodes.slice(scrollOffset, scrollOffset + listHeight),
    [visibleNodes, scrollOffset, listHeight]
  );

  const debouncedStats = useMemo(
    () =>
      debounce(
        (
          files: FileNode[],
          selected: Set<string>,
          includePreamble: boolean,
          preamble: string,
          includeGoal: boolean,
          goal: string
        ) => {
          const selectedFiles = files.filter(
            f => !f.isDirectory && f.isText && selected.has(f.path)
          );
          const size = selectedFiles.reduce(
            (acc, f) => acc + f.sizeBytes,
            0
          );

          const approxFromSize = Math.ceil(size / 3.5);
          const paramTokens =
            (includePreamble ? countTokens(preamble) : 0) +
            (includeGoal ? countTokens(goal) : 0);
          const totalTokens = approxFromSize + paramTokens;

          setStatsFileCount(selectedFiles.length);
          setStatsSizeBytes(size);
          setStatsTokens(totalTokens);
        },
        200
      ),
    []
  );

  useEffect(() => {
    debouncedStats(
      flatFiles,
      selected,
      includePreamble,
      preamble,
      includeGoal,
      goal
    );
  }, [flatFiles, selected, includePreamble, preamble, includeGoal, goal, debouncedStats]);

  useEffect(() => {
    const node = visibleNodes[cursor];
    if (!node || node.isDirectory || !node.isText) {
      setPreviewContent("");
      setPreviewLang("txt");
      return;
    }
    const ext = node.extension.toLowerCase();
    const lang =
      ext === ".ts" || ext === ".tsx"
        ? "ts"
        : ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs"
        ? "js"
        : ext === ".json"
        ? "json"
        : ext === ".md" || ext === ".markdown" || ext === ".mdx"
        ? "md"
        : ext === ".py"
        ? "py"
        : ext === ".java"
        ? "java"
        : ext === ".go"
        ? "go"
        : ext === ".rb"
        ? "rb"
        : ext === ".php"
        ? "php"
        : ext === ".rs"
        ? "rs"
        : ext === ".html" || ext === ".htm"
        ? "html"
        : ext === ".css" || ext === ".scss" || ext === ".sass" || ext === ".less"
        ? "css"
        : "txt";
    setPreviewLang(lang);

    if (node.content) {
      setPreviewContent(
        node.content.length > MAX_PREVIEW_CHARS
          ? node.content.slice(0, MAX_PREVIEW_CHARS)
          : node.content
      );
    } else if (node.isText) {
      fsp
        .readFile(node.path, "utf8")
        .then(content =>
          setPreviewContent(
            content.length > MAX_PREVIEW_CHARS
              ? content.slice(0, MAX_PREVIEW_CHARS)
              : content
          )
        )
        .catch(() => setPreviewContent("// Error reading file"));
    }
  }, [visibleNodes, cursor]);

  const toggleSelectNode = (node: FileNode) => {
    if (node.isDirectory && !filter.trim()) {
      const newSel = new Set(selected);
      const collectFiles = (n: FileNode) => {
        if (!n.isDirectory && n.isText) {
          if (newSel.has(n.path)) {
            // will be decided later
          }
        }
        if (n.children) {
          for (const child of n.children) collectFiles(child);
        }
      };
      const descendants: FileNode[] = [];
      const collectDesc = (n: FileNode) => {
        if (!n.isDirectory && n.isText) descendants.push(n);
        if (n.children) for (const c of n.children) collectDesc(c);
      };
      collectDesc(node);
      const allSelected = descendants.every(d => newSel.has(d.path));
      if (allSelected) {
        for (const d of descendants) newSel.delete(d.path);
      } else {
        for (const d of descendants) newSel.add(d.path);
      }
      setSelected(newSel);
      setStatus(
        `${allSelected ? "Deselected" : "Selected"} ${descendants.length} files in "${node.relPath}"`
      );
      return;
    }

    if (!node.isDirectory) {
      if (!node.isText) {
        setStatus("File is binary or too large to include.");
        return;
      }
      const newSel = new Set(selected);
      if (newSel.has(node.path)) newSel.delete(node.path);
      else newSel.add(node.path);
      setSelected(newSel);
    }
  };

  const moveCursor = (delta: number) => {
    if (!visibleNodes.length) return;
    const maxIndex = visibleNodes.length - 1;
    let next = cursor + delta;
    if (next < 0) next = 0;
    if (next > maxIndex) next = maxIndex;
    setCursor(next);
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!flatFiles.length) return;
    const matches = filterFilesByQuickSelect(flatFiles, key).filter(
      f => f.isText
    );
    if (!matches.length) {
      setStatus("No matching files for this quick select.");
      return;
    }

    const newSel = new Set(selected);
    const allSelected = matches.every(m => newSel.has(m.path));
    if (allSelected) {
      for (const m of matches) newSel.delete(m.path);
    } else {
      for (const m of matches) newSel.add(m.path);
    }
    setSelected(newSel);
    setStatus(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filter.trim()) return;
    const q = filter.trim().toLowerCase();
    const inFilter = flatFiles.filter(f =>
      f.relPath.toLowerCase().includes(q)
    );
    if (!inFilter.length) return;
    const newSel = new Set(selected);
    for (const f of inFilter) newSel.delete(f.path);
    setSelected(newSel);
    setStatus("Cleared selections for files matching current filter.");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setStatus("Preset name cannot be empty.");
      return;
    }
    const selectedRelPaths = flatFiles
      .filter(f => selected.has(f.path))
      .map(f => f.relPath)
      .sort();

    const preset: Preset = {
      name,
      rootDir,
      includePreamble,
      includeGoal,
      preamble,
      goal,
      minify,
      removeComments,
      selectedRelPaths,
      createdAt: new Date().toISOString()
    };

    const filtered = presets.filter(p => p.name !== name);
    const next = [...filtered, preset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setStatus(`Saved preset "${name}".`);
  };

  const handleLoadPreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    setIncludePreamble(preset.includePreamble);
    setIncludeGoal(preset.includeGoal);
    setPreamble(preset.preamble);
    setGoal(preset.goal);
    setMinify(preset.minify);
    setRemoveComments(preset.removeComments);
    setStatus(`Loading preset "${preset.name}"...`);

    if (path.resolve(preset.rootDir) !== path.resolve(rootDir)) {
      (async () => {
        await handleScan(preset.rootDir);
        const newSel = new Set<string>();
        for (const p of preset.selectedRelPaths) {
          const abs = path.join(path.resolve(preset.rootDir), p);
          const node = flatFiles.find(f => f.path === abs);
          if (node && node.isText) newSel.add(abs);
        }
        setSelected(newSel);
        setStatus(
          `Loaded preset "${preset.name}" (${newSel.size} files selected).`
        );
      })();
    } else {
      const newSel = new Set<string>();
      for (const p of preset.selectedRelPaths) {
        const abs = path.join(rootDir, p);
        const node = flatFiles.find(f => f.path === abs);
        if (node && node.isText) newSel.add(abs);
      }
      setSelected(newSel);
      setStatus(
        `Loaded preset "${preset.name}" (${newSel.size} files selected).`
      );
    }
  };

  const handleDeletePreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    const next = presets.filter((_, i) => i !== index);
    setPresets(next);
    savePresets(next);
    setSelectedPresetIndex(prev =>
      prev >= next.length ? Math.max(0, next.length - 1) : prev
    );
    setStatus(`Deleted preset "${preset.name}".`);
  };

  const handleGenerate = async () => {
    if (!rootNode) return;
    const selectedFiles = flatFiles.filter(
      f => !f.isDirectory && f.isText && selected.has(f.path)
    );
    if (!selectedFiles.length) {
      setStatus("No files selected. Select at least one text file first.");
      return;
    }

    setStatus("Generating combined prompt...");
    setMode("main");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText: preamble,
        includeGoal,
        goalText: goal,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(
        rootNode,
        flatFiles,
        selected,
        options
      );
      setCombined(result);
      const copied = await copyToClipboard(result.text);
      setMode("combined");
      setStatus(
        `${copied ? "Copied to clipboard" : "Generated"}: ${formatBytes(
          result.bytes
        )}, ~${result.tokens.toLocaleString()} tokens.`
      );
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  const handleSaveCombinedToFile = async () => {
    if (!combined) return;
    const target = exportPath.trim() || "combined-prompt.txt";
    const resolved = path.isAbsolute(target)
      ? target
      : path.resolve(rootDir, target);
    try {
      await fsp.writeFile(resolved, combined.text, "utf8");
      setStatus(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "combined") {
      if (focusField === "exportPath") {
        if (key.escape) {
          setFocusField("none");
          return;
        }
        if (key.return) {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
        return;
      }

      const lower = input.toLowerCase();
      if (key.escape || lower === "q") {
        setMode("main");
        setStatus("Back to main view.");
        return;
      }
      if (lower === "y") {
        if (combined) {
          void copyToClipboard(combined.text).then(ok =>
            setStatus(
              ok
                ? "Copied combined output to clipboard."
                : "Clipboard copy failed."
            )
          );
        }
        return;
      }
      if (lower === "w") {
        setFocusField("exportPath");
        return;
      }
      return;
    }

    if (focusField !== "none") {
      if (key.escape) {
        setFocusField("none");
        return;
      }
      if (key.return) {
        if (focusField === "rootDir") {
          void handleScan(rootDir);
          setFocusField("none");
          return;
        }
        if (focusField === "filter") {
          setFocusField("none");
          return;
        }
        if (focusField === "preamble") {
          setFocusField("none");
          return;
        }
        if (focusField === "goal") {
          setFocusField("none");
          return;
        }
        if (focusField === "presetName") {
          handleSavePreset();
          setFocusField("none");
          return;
        }
        if (focusField === "exportPath") {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === "g") {
      void handleGenerate();
      return;
    }

    if (key.tab) {
      const panes: Pane[] = ["explorer", "config", "preview"];
      const idx = panes.indexOf(activePane);
      const next = panes[(idx + 1) % panes.length];
      setActivePane(next);
      return;
    }

    if (activePane === "explorer") {
      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }

      const node = visibleNodes[cursor];

      if (key.leftArrow || input === "h") {
        if (node && node.isDirectory && expanded.has(node.path)) {
          const next = new Set(expanded);
          next.delete(node.path);
          setExpanded(next);
        }
        return;
      }

      if (key.rightArrow || input === "l") {
        if (node && node.isDirectory && !expanded.has(node.path)) {
          const next = new Set(expanded);
          next.add(node.path);
          setExpanded(next);
        }
        return;
      }

      if (input === " ") {
        if (node) toggleSelectNode(node);
        return;
      }

      if (key.return) {
        if (node) {
          if (node.isDirectory) {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          } else {
            toggleSelectNode(node);
          }
        }
        return;
      }

      if (input === "/" || input.toLowerCase() === "f") {
        setFocusField("filter");
        setActivePane("explorer");
        return;
      }

      if (input.toLowerCase() === "d") {
        setFocusField("rootDir");
        return;
      }

      if (input.toLowerCase() === "u") {
        clearSelectionInFilter();
        return;
      }

      if (input === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (input.toLowerCase() === "r") {
        toggleQuickSelect("rust");
        return;
      }
    }

    if (activePane === "config") {
      if (key.leftArrow || key.rightArrow) {
        setConfigTab(prev =>
          prev === "inputs"
            ? "presets"
            : prev === "presets"
            ? "options"
            : "inputs"
        );
        return;
      }

      if (configTab === "inputs") {
        if (input.toLowerCase() === "p") {
          setFocusField("preamble");
          return;
        }
        if (input.toLowerCase() === "g") {
          setFocusField("goal");
          return;
        }
      }

      if (configTab === "options") {
        if (input.toLowerCase() === "i") {
          setIncludePreamble(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "o") {
          setIncludeGoal(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "m") {
          setMinify(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "x") {
          setRemoveComments(prev => !prev);
          return;
        }
      }

      if (configTab === "presets") {
        if (key.upArrow || input === "k") {
          setSelectedPresetIndex(prev =>
            prev <= 0 ? 0 : prev - 1
          );
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedPresetIndex(prev =>
            prev >= presets.length - 1
              ? Math.max(0, presets.length - 1)
              : prev + 1
          );
          return;
        }
        if (input.toLowerCase() === "l") {
          if (presets.length) handleLoadPreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "d") {
          if (presets.length) handleDeletePreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "s") {
          setFocusField("presetName");
          return;
        }
      }
    }
  });

  const cost = (statsTokens / 1_000_000) * COST_PER_1M_TOKENS;
  const contextPercent = Math.min(
    1,
    statsTokens / CONTEXT_WINDOW
  );
  const contextWarning =
    statsTokens > CONTEXT_WINDOW
      ? "⚠️ Estimated tokens exceed context window; model may truncate."
      : statsTokens > 100_000
      ? "Large prompt; ensure you're using a 128k+ context model."
      : "";

  if (loading && !rootNode) {
    return (
      <Box padding={2} flexDirection="column">
        <Box>
          <Spinner type="dots" />
          <Text> Scanning project...</Text>
        </Box>
        {progressText && (
          <Box marginTop={1}>
            <Text>{progressText}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === "combined") {
    return (
      <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
        <Box justifyContent="center" height={3}>
          <Gradient name="pastel">
            <BigText text="Combined Prompt" font="tiny" />
          </Gradient>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={1}
          flexGrow={1}
          overflow="hidden"
        >
          <Text>
            {combined ? combined.text : "(nothing generated yet)"}
          </Text>
        </Box>
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          paddingTop={1}
          justifyContent="space-between"
        >
          <Text dimColor>
            [Y] Copy  [W] Save to file  [Esc/Q] Back
          </Text>
          {combined && (
            <Text>
              {formatBytes(combined.bytes)} | Lines: {combined.lines} | Tokens:{" "}
              {combined.tokens.toLocaleString()}
            </Text>
          )}
        </Box>
        {focusField === "exportPath" && (
          <Box marginTop={1}>
            <Text>Save as: </Text>
            <TextInput
              value={exportPath}
              onChange={setExportPath}
              focus={true}
            />
          </Box>
        )}
        <Box marginTop={1}>
          <Text color="green">{status}</Text>
        </Box>
      </Box>
    );
  }

  const explorerWidth = Math.floor(cols * 0.4);
  const configWidth = Math.floor(cols * 0.3);
  const previewWidth = cols - explorerWidth - configWidth - 4;

  return (
    <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
      <Box justifyContent="center" height={3}>
        <Gradient name="morning">
          <BigText text="Source2Prompt" font="tiny" />
        </Gradient>
      </Box>

      <Box marginBottom={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box
        flexDirection="row"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
      >
        {/* Explorer */}
        <Box
          width={explorerWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "explorer" ? "cyan" : "gray"}
        >
          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            justifyContent="space-between"
          >
            <Text bold color={activePane === "explorer" ? "cyan" : "white"}>
              EXPLORER
            </Text>
            <Text dimColor>
              {statsFileCount} sel / {flatFiles.length} files
            </Text>
          </Box>

          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <Text color="cyan">🔍 </Text>
            <TextInput
              value={filter}
              onChange={setFilter}
              focus={focusField === "filter" && activePane === "explorer"}
              placeholder="Filter by path..."
            />
          </Box>

          <Box flexDirection="column" paddingLeft={1}>
            {viewNodes.length === 0 && (
              <Text dimColor>No files match current filter.</Text>
            )}
            {viewNodes.map((node, idx) => {
              const isCursor = scrollOffset + idx === cursor;
              const isSel = selected.has(node.path);
              const marker = isCursor ? "›" : " ";
              const indent = filter.trim() ? 0 : node.depth;
              const icon = node.isDirectory
                ? expanded.has(node.path)
                  ? "📂"
                  : "📁"
                : isSel
                ? "▣"
                : node.isText
                ? "📄"
                : "⛔";

              let color: any = node.isDirectory
                ? "yellow"
                : node.isText
                ? isSel
                  ? "green"
                  : "white"
                : "red";

              if (isCursor) color = "cyan";

              return (
                <Box key={node.path}>
                  <Text color={isCursor ? "cyan" : "black"}>{marker}</Text>
                  <Text dimColor>{" ".repeat(indent)}</Text>
                  <Text color={color}>
                    {icon} {node.relPath === "." ? node.name : node.relPath}{" "}
                    {!node.isDirectory &&
                      `(${formatBytes(node.sizeBytes)}${node.isText ? "" : ", binary"})`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Config */}
        <Box
          width={configWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "config" ? "cyan" : "gray"}
        >
          <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
            <Box
              paddingX={1}
              borderRight
              borderStyle="single"
              borderColor={configTab === "inputs" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "inputs"}>Inputs</Text>
            </Box>
            <Box
              paddingX={1}
              borderRight
              borderStyle="single"
              borderColor={configTab === "presets" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "presets"}>Presets</Text>
            </Box>
            <Box
              paddingX={1}
              borderColor={configTab === "options" ? "cyan" : "gray"}
            >
              <Text bold={configTab === "options"}>Options</Text>
            </Box>
          </Box>

          {configTab === "inputs" && (
            <Box flexDirection="column" padding={1}>
              <Text bold>
                Preamble{" "}
                <Text color={includePreamble ? "green" : "red"}>
                  [{includePreamble ? "ON" : "OFF"}]
                </Text>
              </Text>
              <Box
                borderStyle="single"
                borderColor={focusField === "preamble" ? "cyan" : "gray"}
                paddingX={1}
                marginBottom={1}
              >
                <TextInput
                  value={preamble}
                  onChange={setPreamble}
                  focus={focusField === "preamble"}
                  placeholder="System / context instructions..."
                />
              </Box>

              <Text bold>
                Goal{" "}
                <Text color={includeGoal ? "green" : "red"}>
                  [{includeGoal ? "ON" : "OFF"}]
                </Text>
              </Text>
              <Box
                borderStyle="single"
                borderColor={focusField === "goal" ? "cyan" : "gray"}
                paddingX={1}
              >
                <TextInput
                  value={goal}
                  onChange={setGoal}
                  focus={focusField === "goal"}
                  placeholder="High-level task / objective..."
                />
              </Box>

              <Box marginTop={1}>
                <Text dimColor>
                  [P] Edit preamble  [G] Edit goal (while in Inputs tab)
                </Text>
              </Box>
            </Box>
          )}

          {configTab === "presets" && (
            <Box flexDirection="column" padding={1}>
              {presets.length === 0 && (
                <Text dimColor>No presets yet. Press 'S' to save one.</Text>
              )}
              {presets.map((p, idx) => {
                const active = idx === selectedPresetIndex;
                return (
                  <Box key={p.name}>
                    <Text color={active ? "cyanBright" : "white"}>
                      {active ? "•" : " "} {p.name}
                    </Text>
                  </Box>
                );
              })}
              <Box
                borderTop
                borderStyle="single"
                borderColor="gray"
                paddingTop={1}
                flexDirection="column"
              >
                <Text>Save current selection as preset:</Text>
                <Box>
                  <Text>Name: </Text>
                  <TextInput
                    value={presetName}
                    onChange={setPresetName}
                    focus={focusField === "presetName"}
                    placeholder="Preset name..."
                  />
                </Box>
                <Box marginTop={1} flexDirection="column">
                  <Text dimColor>
                    [J/K] Move  [L] Load  [D] Delete  [S] Focus name + save
                  </Text>
                </Box>
              </Box>
            </Box>
          )}

          {configTab === "options" && (
            <Box flexDirection="column" padding={1}>
              <Text>
                Include preamble:{" "}
                <Text color={includePreamble ? "green" : "red"}>
                  {includePreamble ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [I])
              </Text>
              <Text>
                Include goal:{" "}
                <Text color={includeGoal ? "green" : "red"}>
                  {includeGoal ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [O])
              </Text>
              <Text>
                Remove comments:{" "}
                <Text color={removeComments ? "green" : "red"}>
                  {removeComments ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [X])
              </Text>
              <Text>
                Minify:{" "}
                <Text color={minify ? "green" : "red"}>
                  {minify ? "ON" : "OFF"}
                </Text>{" "}
                (toggle with [M])
              </Text>
              <Box marginTop={1}>
                <Text dimColor>
                  Options tab shortcuts: [I] preamble, [O] goal, [X] comments, [M] minify
                </Text>
              </Box>
            </Box>
          )}
        </Box>

        {/* Preview & stats */}
        <Box
          width={previewWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={activePane === "preview" ? "cyan" : "gray"}
        >
          <Box
            borderBottom
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            <Text bold>PREVIEW</Text>
          </Box>
          <Box flexGrow={1} paddingX={1}>
            <SyntaxHighlight
              language={previewLang}
              code={
                previewContent ||
                "// Select a text file to preview (or press Ctrl+G to generate)."
              }
            />
          </Box>
          <Box
            borderTop
            borderStyle="single"
            borderColor="gray"
            flexDirection="column"
            padding={1}
          >
            <Box justifyContent="space-between">
              <Text>
                Tokens:{" "}
                <Text color="magenta">
                  {statsTokens.toLocaleString()}
                </Text>
              </Text>
              <Text color="green">${cost.toFixed(4)}</Text>
            </Box>
            <ProgressBar
              percent={contextPercent}
              color={statsTokens > CONTEXT_WINDOW ? "red" : "green"}
            />
            <Text dimColor>
              {Math.round(contextPercent * 1000) / 10}% of {CONTEXT_WINDOW.toLocaleString()}-token
              context
            </Text>
            {contextWarning && (
              <Text color="yellow">{contextWarning}</Text>
            )}
            <Box marginTop={1} flexDirection="column">
              <Text>
                Selected size: {formatBytes(statsSizeBytes)} | Files:{" "}
                {statsFileCount}
              </Text>
              <Text dimColor>
                Generation: press Ctrl+G to build combined prompt and open Combined view.
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        height={2}
        justifyContent="space-between"
        paddingX={1}
        borderTop
        borderStyle="single"
        borderColor="gray"
      >
        <Box flexDirection="column">
          <Text dimColor>
            Panes: Tab | Explorer: j/k, h/l, Space/Enter, / or F filter, D root, T/1-9/0/R quick
            select, U clear filter selection
          </Text>
          <Text dimColor>
            Config: arrows to tab, P/G (inputs), S/L/D (presets), I/O/X/M (options) | Generate:
            Ctrl+G | Combined view: see hints in that screen
          </Text>
        </Box>
        <Box alignItems="flex-end">
          {scanError ? (
            <Text color="red">Error: {scanError}</Text>
          ) : (
            <Text color={status.startsWith("Ready") ? "white" : "green"}>
              {status}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

render(<App />);
```

* * *

## Build & Run

From the project root:

```
bash

bashbun install

# Dev
bun run src/index.tsx          # or: bun run dev

# Type-check & JS build
bun run build

# Single-file native binary (Linux/macOS)
bun run build:bin              # outputs ./s2p

# Usage
./s2p                          # root = current directory
./s2p /path/to/project         # (if you wire args yourself later)
```

(If you want CLI args handled inside the app, you can wrap

```
App
```

in a tiny arg-parsing shim and pass an

```
initialRootDir
```

prop, but I kept

```
index.tsx
```

self-contained as requested.)

* * *

If you want, next step we can iterate specifically on:

-   prompt format (tags, headings, etc.),
    
-   tuning minification/comment-stripping defaults for different languages,
    
-   or adding a 4th pane that shows a live _partial_ combined prompt sample while still in main mode.

## Other

##### You said:

Yes iterate on ALL those things and make it all WAY better

## Other

###### ChatGPT said:

Reasoned for 9m 8s

Alright, here’s a **much more refined “v2”** that:

-   Upgrades the **prompt format** to a clean, machine‑friendly, LLM‑centric structure with metadata and rich per‑file annotations.
    
-   Smartens **token estimation** (per file, using real tokenizer where possible).
    
-   Deepens **minification/comment stripping** behavior per language, and uses **Bun.transform** when available for JS/TS for better minification.
    
-   Adds a **4th live “Prompt Sample” pane** so you can see an always‑up‑to‑date snippet of the combined prompt while you’re still in the main UI.
    
-   Keeps/extends the **world‑class TUI UX**: Vim keys, multi‑pane layout, live syntax highlighting, presets, quick selects, tree explorer, combined output view with copy & save.
    

Everything below is complete, paste‑ready code. No ellipses, no stubs.

* * *

## `package.json`

You can keep your existing one, but here’s an updated, consistent version:

```
json

json{
  "name": "source2prompt-tui",
  "version": "0.3.0",
  "description": "Hybrid world-class TUI version of Your Source to Prompt (Bun + TypeScript + Ink).",
  "type": "module",
  "bin": {
    "s2p": "dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.tsx",
    "build": "tsc",
    "build:bin": "bun build ./src/index.tsx --compile --minify --sourcemap --outfile s2p"
  },
  "dependencies": {
    "csso": "^5.0.5",
    "html-minifier-terser": "^7.2.0",
    "ignore": "^5.3.0",
    "ink": "^5.0.1",
    "ink-big-text": "^2.0.0",
    "ink-gradient": "^3.0.0",
    "ink-progress-bar": "^4.0.0",
    "ink-spinner": "^5.0.0",
    "ink-syntax-highlight": "^1.0.2",
    "ink-text-input": "^6.0.0",
    "js-tiktoken": "^1.0.14",
    "clipboardy": "^4.0.0",
    "react": "^18.3.0",
    "terser": "^5.31.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.8",
    "typescript": "^5.6.3"
  }
}
```

* * *

## `tsconfig.json`

If you already have this from the previous iteration, you can reuse it:

```
json

json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* * *

## `src/index.tsx`

```
tsx

tsx#!/usr/bin/env bun
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import ProgressBar from "ink-progress-bar";
import SyntaxHighlight from "ink-syntax-highlight";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore, { Ignore } from "ignore";
import clipboardy from "clipboardy";
import { minify as terserMinify } from "terser";
import csso from "csso";
import { minify as htmlMinify } from "html-minifier-terser";
import { encodingForModel, getEncoding, Tiktoken } from "js-tiktoken";

declare const Bun: any;

/* ---------- Types & constants ---------- */

type Pane = "explorer" | "config" | "preview";
type ConfigTab = "inputs" | "presets" | "options";
type Mode = "main" | "combined";

type FileCategory =
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust"
  | "other";

interface FileNode {
  path: string; // absolute
  relPath: string; // relative to root
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  depth: number;
  extension: string;
  isText: boolean;
  category: FileCategory;
  numLines: number;
  content: string; // only for small text files; else ""
  children?: FileNode[];
}

interface Preset {
  name: string;
  rootDir: string;
  includePreamble: boolean;
  includeGoal: boolean;
  preamble: string;
  goal: string;
  minify: boolean;
  removeComments: boolean;
  selectedRelPaths: string[];
  createdAt: string;
}

interface CombinedResult {
  text: string;
  bytes: number;
  tokens: number;
  lines: number;
}

type FocusField =
  | "none"
  | "filter"
  | "rootDir"
  | "preamble"
  | "goal"
  | "presetName"
  | "exportPath";

type QuickSelectKey =
  | "allText"
  | "javascript"
  | "react"
  | "typescript"
  | "json"
  | "markdown"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "rust";

interface CombineOptions {
  includePreamble: boolean;
  preambleText: string;
  includeGoal: boolean;
  goalText: string;
  removeComments: boolean;
  minify: boolean;
}

/* ---------- Tokenizer setup ---------- */

let encoder: Tiktoken | null = null;
try {
  encoder = encodingForModel("gpt-4o-mini");
} catch {
  try {
    encoder = getEncoding("cl100k_base");
  } catch {
    encoder = null;
  }
}

function countTokens(text: string): number {
  if (!text) return 0;
  if (!encoder) {
    const bytes = Buffer.byteLength(text, "utf8");
    return Math.ceil(bytes / 4);
  }
  return encoder.encode(text).length;
}

/* ---------- FS & scanning utilities ---------- */

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  ".hg/",
  ".svn/",
  ".idea/",
  ".vscode/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".turbo/",
  ".vercel/"
];

const TEXT_EXTENSIONS = new Set<string>([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".yml",
  ".yaml",
  ".xml",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".hh",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".env",
  ".gitignore",
  ".gitattributes"
]);

const PRESET_FILE = path.join(os.homedir(), ".source2prompt.json");
const CONTEXT_WINDOW = 128000;
const COST_PER_1M_TOKENS = 5.0;
const MAX_PREVIEW_CHARS = 2000;
const MAX_READ_BYTES = 5 * 1024 * 1024; // 5MB

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const decimals = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  switch (e) {
    case ".jsx":
    case ".tsx":
      return "react";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".json":
      return "json";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".rs":
      return "rust";
    default:
      return "other";
  }
}

function isTextExtension(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

function languageFromExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".ts" || e === ".tsx") return "ts";
  if (e === ".js" || e === ".jsx" || e === ".mjs" || e === ".cjs") return "js";
  if (e === ".json") return "json";
  if (e === ".md" || e === ".markdown" || e === ".mdx") return "md";
  if (e === ".py") return "py";
  if (e === ".java") return "java";
  if (e === ".go") return "go";
  if (e === ".rb") return "rb";
  if (e === ".php") return "php";
  if (e === ".rs") return "rs";
  if (e === ".html" || e === ".htm") return "html";
  if (e === ".css" || e === ".scss" || e === ".sass" || e === ".less") return "css";
  if (e === ".yml" || e === ".yaml") return "yaml";
  if (e === ".xml") return "xml";
  return "txt";
}

async function buildIgnore(rootDir: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);

  async function addGitignore(dirAbs: string, relPrefix: string) {
    const giPath = path.join(dirAbs, ".gitignore");
    try {
      const content = await fsp.readFile(giPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const pattern = relPrefix ? path.posix.join(relPrefix, trimmed) : trimmed;
        ig.add(pattern);
      }
    } catch {
      // ignore
    }

    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== ".git") {
        const childAbs = path.join(dirAbs, entry.name);
        const childRel = relPrefix
          ? path.posix.join(relPrefix, entry.name)
          : entry.name;
        await addGitignore(childAbs, childRel);
      }
    }
  }

  await addGitignore(rootDir, "");
  return ig;
}

async function scanProject(
  rootDir: string,
  onProgress?: (info: { processedFiles: number; currentPath?: string }) => void
): Promise<{ root: FileNode; flatFiles: FileNode[] }> {
  const resolvedRoot = path.resolve(rootDir);
  const ig = await buildIgnore(resolvedRoot);

  const root: FileNode = {
    path: resolvedRoot,
    relPath: ".",
    name: path.basename(resolvedRoot),
    isDirectory: true,
    sizeBytes: 0,
    depth: 0,
    extension: "",
    isText: false,
    category: "other",
    numLines: 0,
    content: "",
    children: []
  };

  const flatFiles: FileNode[] = [];
  let processed = 0;

  async function walk(dirAbs: string, parent: FileNode, relDir: string, depth: number) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const relPath = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (ig.ignores(relPath)) continue;

      const absPath = path.join(dirAbs, entry.name);

      if (entry.isDirectory()) {
        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: true,
          sizeBytes: 0,
          depth: depth + 1,
          extension: "",
          isText: false,
          category: "other",
          numLines: 0,
          content: "",
          children: []
        };
        parent.children!.push(node);
        await walk(absPath, node, relPath, depth + 1);
      } else if (entry.isFile()) {
        let sizeBytes = 0;
        try {
          const stat = await fsp.stat(absPath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }

        const extension = path.extname(entry.name).toLowerCase();
        let isText = isTextExtension(extension);
        let content = "";
        let numLines = 0;

        if (isText && sizeBytes <= MAX_READ_BYTES) {
          try {
            content = await fsp.readFile(absPath, "utf8");
            numLines = content.split(/\r?\n/).length;
          } catch {
            isText = false;
            content = "";
          }
        } else if (isText) {
          isText = false;
        }

        const node: FileNode = {
          path: absPath,
          relPath,
          name: entry.name,
          isDirectory: false,
          sizeBytes,
          depth: depth + 1,
          extension,
          isText,
          category: getFileCategory(extension),
          numLines,
          content,
          children: undefined
        };

        parent.children!.push(node);
        flatFiles.push(node);
        processed++;
        onProgress?.({ processedFiles: processed, currentPath: relPath });
      }
    }
  }

  await walk(resolvedRoot, root, "", 0);

  const sortRecursive = (n: FileNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      n.children.forEach(sortRecursive);
    }
  };
  sortRecursive(root);

  return { root, flatFiles };
}

/* ---------- Minification & transformation ---------- */

function stripCommentsGeneric(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripHashComments(content: string): string {
  return content.replace(/(^|\s)#.*$/gm, "$1");
}

function stripHtmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "");
}

async function transformFileContent(
  file: FileNode,
  options: { removeComments: boolean; minify: boolean }
): Promise<string> {
  if (!file.isText) return file.content;
  let text =
    file.content || (await fsp.readFile(file.path, "utf8").catch(() => "")) || "";
  const ext = file.extension.toLowerCase();

  if (options.minify) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs"
    ) {
      const loader =
        ext === ".ts" || ext === ".tsx"
          ? "tsx"
          : ext === ".jsx"
          ? "jsx"
          : "js";

      if (typeof Bun !== "undefined" && Bun?.transform) {
        try {
          const res = await Bun.transform(text, { loader, minify: true });
          text = res.code;
          return text;
        } catch {
          // fallback to Terser below
        }
      }

      try {
        const result = await terserMinify(text, {
          ecma: 2020,
          module:
            ext === ".mjs" ||
            ext === ".js" ||
            ext === ".ts" ||
            ext === ".tsx",
          compress: true,
          mangle: true,
          format: { comments: false }
        });
        if (result.code) text = result.code;
      } catch {
        // fallback to raw
      }
    } else if (
      ext === ".css" ||
      ext === ".scss" ||
      ext === ".sass" ||
      ext === ".less"
    ) {
      try {
        const result = csso.minify(text);
        text = result.css;
      } catch {
        // ignore
      }
    } else if (ext === ".html" || ext === ".htm") {
      try {
        text = await htmlMinify(text, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          minifyCSS: true,
          minifyJS: true
        });
      } catch {
        // ignore
      }
    } else if (ext === ".json") {
      try {
        text = JSON.stringify(JSON.parse(text));
      } catch {
        // ignore
      }
    } else if (
      ext === ".md" ||
      ext === ".mdx" ||
      ext === ".markdown"
    ) {
      text = stripHtmlComments(text)
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    } else {
      text = text
        .split(/\r?\n/)
        .map(l => l.trimEnd())
        .join("\n");
    }
  } else if (options.removeComments) {
    if (
      ext === ".js" ||
      ext === ".jsx" ||
      ext === ".ts" ||
      ext === ".tsx" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".java" ||
      ext === ".go" ||
      ext === ".rs" ||
      ext === ".php" ||
      ext === ".c" ||
      ext === ".cpp" ||
      ext === ".h" ||
      ext === ".hpp"
    ) {
      text = stripCommentsGeneric(text);
    } else if (
      ext === ".py" ||
      ext === ".rb" ||
      ext === ".sh" ||
      ext === ".bash"
    ) {
      text = stripHashComments(text);
    } else if (
      ext === ".md" ||
      ext === ".mdx" ||
      ext === ".markdown" ||
      ext === ".html" ||
      ext === ".htm"
    ) {
      text = stripHtmlComments(text);
    }
  }

  return text;
}

/* ---------- Project tree section ---------- */

function buildProjectTreeLines(
  root: FileNode | null,
  selected: Set<string>
): string[] {
  if (!root) return [];
  const lines: string[] = [];

  const cache = new Map<string, boolean>();
  const hasSelected = (node: FileNode): boolean => {
    if (cache.has(node.path)) return cache.get(node.path)!;
    let has =
      !node.isDirectory && selected.has(node.path);
    if (node.children) {
      for (const child of node.children) {
        if (hasSelected(child)) {
          has = true;
          break;
        }
      }
    }
    cache.set(node.path, has);
    return has;
  };

  if (!hasSelected(root)) {
    return [];
  }

  lines.push("<project_tree>");

  const printNode = (node: FileNode, prefix: string) => {
    if (!hasSelected(node)) return;
    const isRoot = node.relPath === ".";
    const label = isRoot ? node.name : node.relPath;
    const icon = node.isDirectory ? "📂" : "📄";
    lines.push(`${prefix}${icon} ${label}`);
    if (node.children && node.children.length) {
      for (const child of node.children) {
        printNode(child, prefix + "  ");
      }
    }
  };

  printNode(root, "");
  lines.push("</project_tree>");

  return lines;
}

/* ---------- Combined output & preview snippet ---------- */

async function buildCombinedOutput(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<CombinedResult> {
  const selectedFiles = flatFiles
    .filter(f => !f.isDirectory && f.isText && selected.has(f.path))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  const bodyLines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    bodyLines.push(
      "<preamble>",
      options.preambleText.trim(),
      "</preamble>",
      ""
    );
  }

  if (options.includeGoal && options.goalText.trim()) {
    bodyLines.push("<goal>", options.goalText.trim(), "</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines = buildProjectTreeLines(root, selected);
    if (treeLines.length > 0) {
      bodyLines.push(...treeLines, "");
    }
  }

  bodyLines.push("<files>");

  for (const file of selectedFiles) {
    const transformed = await transformFileContent(file, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    const content = transformed.trimEnd();
    const numLines =
      content.length === 0 ? 0 : content.split(/\r?\n/).length;
    const lang = languageFromExtension(file.extension);
    const fileTokens = countTokens(content);

    bodyLines.push(
      `<file path="${file.relPath}" lang="${lang}" lines="${numLines}" bytes="${file.sizeBytes}" tokens="${fileTokens}">`,
      content,
      "</file>",
      ""
    );
  }

  bodyLines.push("</files>");

  const bodyText = bodyLines.join("\n");
  const bodyBytes = Buffer.byteLength(bodyText, "utf8");
  const bodyTokens = countTokens(bodyText);
  const bodyLinesCount = bodyText.split(/\r?\n/).length;

  const headerLines = [
    "===== SOURCE2PROMPT v2 =====",
    "",
    "[meta]",
    `project_root: ${root?.path ?? "unknown"}`,
    `generated_at: ${new Date().toISOString()}`,
    `files_selected: ${selectedFiles.length}`,
    `body_bytes: ${bodyBytes}`,
    `body_lines: ${bodyLinesCount}`,
    `body_tokens_est: ${bodyTokens}`,
    `options: include_preamble=${options.includePreamble}, include_goal=${options.includeGoal}, remove_comments=${options.removeComments}, minify=${options.minify}`,
    "[/meta]",
    ""
  ];

  const text = [...headerLines, ...bodyLines].join("\n");
  const bytes = Buffer.byteLength(text, "utf8");
  const tokens = countTokens(text);
  const lines = text.split(/\r?\n/).length;

  return { text, bytes, tokens, lines };
}

async function buildPromptPreviewSnippet(
  root: FileNode | null,
  flatFiles: FileNode[],
  selected: Set<string>,
  options: CombineOptions
): Promise<string> {
  const selectedFiles = flatFiles
    .filter(f => !f.isDirectory && f.isText && selected.has(f.path))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  if (!selectedFiles.length && !options.preambleText.trim() && !options.goalText.trim()) {
    return "// Adjust preamble/goal and select some files to see a live sample of the combined prompt.";
  }

  const lines: string[] = [];

  if (options.includePreamble && options.preambleText.trim()) {
    const pre = options.preambleText.trim();
    lines.push("<preamble>");
    lines.push(pre.length > 600 ? pre.slice(0, 600) + " …" : pre);
    lines.push("</preamble>", "");
  }

  if (options.includeGoal && options.goalText.trim()) {
    const g = options.goalText.trim();
    lines.push("<goal>");
    lines.push(g.length > 600 ? g.slice(0, 600) + " …" : g);
    lines.push("</goal>", "");
  }

  if (root && selectedFiles.length > 0) {
    const treeLines = buildProjectTreeLines(root, selected);
    if (treeLines.length > 0) {
      lines.push(...treeLines, "");
    }
  }

  lines.push("<files_preview>");

  const previewFiles = selectedFiles.slice(0, 3);
  for (const f of previewFiles) {
    const transformed = await transformFileContent(f, {
      removeComments: options.removeComments,
      minify: options.minify
    });
    let snippet = transformed || f.content;
    const maxLines = 40;
    const maxChars = 1200;
    const parts = snippet.split(/\r?\n/).slice(0, maxLines);
    snippet = parts.join("\n");
    if (snippet.length > maxChars) {
      snippet = snippet.slice(0, maxChars) + "\n…";
    }
    lines.push(
      `--- file: ${f.relPath} (${f.extension || "txt"}) ---`,
      snippet,
      ""
    );
  }

  if (selectedFiles.length > previewFiles.length) {
    lines.push(
      `… + ${selectedFiles.length - previewFiles.length} more file(s) in full prompt.`
    );
  }

  lines.push("</files_preview>");

  const text = lines.join("\n");
  return text.length > 4000 ? text.slice(0, 4000) + "\n…" : text;
}

/* ---------- Presets & clipboard ---------- */

function loadPresets(): Preset[] {
  try {
    const raw = fs.readFileSync(PRESET_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.presets)) return parsed.presets;
    return [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    fs.writeFileSync(PRESET_FILE, JSON.stringify(presets, null, 2), "utf8");
  } catch {
    // ignore
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await clipboardy.write(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Quick-select helpers ---------- */

const QUICK_SELECT_LABELS: Record<QuickSelectKey, string> = {
  allText: "Toggled all text files",
  javascript: "Toggled all JavaScript files",
  react: "Toggled all React components",
  typescript: "Toggled all TypeScript files",
  json: "Toggled all JSON files",
  markdown: "Toggled all Markdown files",
  python: "Toggled all Python files",
  go: "Toggled all Go files",
  java: "Toggled all Java files",
  ruby: "Toggled all Ruby files",
  php: "Toggled all PHP files",
  rust: "Toggled all Rust files"
};

function filterFilesByQuickSelect(
  files: FileNode[],
  key: QuickSelectKey
): FileNode[] {
  switch (key) {
    case "allText":
      return files.filter(f => !f.isDirectory && f.isText);
    case "javascript":
      return files.filter(f => f.category === "javascript");
    case "react":
      return files.filter(f => f.category === "react");
    case "typescript":
      return files.filter(f => f.category === "typescript");
    case "json":
      return files.filter(f => f.category === "json");
    case "markdown":
      return files.filter(f => f.category === "markdown");
    case "python":
      return files.filter(f => f.category === "python");
    case "go":
      return files.filter(f => f.category === "go");
    case "java":
      return files.filter(f => f.category === "java");
    case "ruby":
      return files.filter(f => f.category === "ruby");
    case "php":
      return files.filter(f => f.category === "php");
    case "rust":
      return files.filter(f => f.category === "rust");
    default:
      return [];
  }
}

/* ---------- Small debounce ---------- */

function debounce<F extends (...args: any[]) => void>(
  fn: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

/* ---------- Main App ---------- */

const DEFAULT_PREAMBLE =
  "The following are the complete project code files for my app. Below is a comprehensive collection of the project's source files.";

const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [rootDir, setRootDir] = useState(path.resolve(process.cwd()));

  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [flatFiles, setFlatFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [status, setStatus] = useState("Scanning project...");
  const [progressText, setProgressText] = useState<string | null>(null);

  const [activePane, setActivePane] = useState<Pane>("explorer");
  const [configTab, setConfigTab] = useState<ConfigTab>("inputs");
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [focusField, setFocusField] = useState<FocusField>("none");

  const [includePreamble, setIncludePreamble] = useState(true);
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [includeGoal, setIncludeGoal] = useState(false);
  const [goal, setGoal] = useState("");
  const [minify, setMinify] = useState(false);
  const [removeComments, setRemoveComments] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  const [statsTokens, setStatsTokens] = useState(0);
  const [statsSizeBytes, setStatsSizeBytes] = useState(0);
  const [statsFileCount, setStatsFileCount] = useState(0);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLang, setPreviewLang] = useState("txt");

  const [mode, setMode] = useState<Mode>("main");
  const [combined, setCombined] = useState<CombinedResult | null>(null);
  const [exportPath, setExportPath] = useState("combined-prompt.txt");

  const [promptPreview, setPromptPreview] = useState("");

  const rows = stdout.rows ?? 30;
  const cols = stdout.columns ?? 120;
  const listHeight = Math.max(8, rows - 16);

  const handleScan = async (
    dir: string
  ): Promise<{ root: FileNode | null; files: FileNode[] }> => {
    const resolved = path.resolve(dir);
    setRootDir(resolved);
    setLoading(true);
    setScanError(null);
    setStatus("Scanning project...");
    setProgressText(null);
    setRootNode(null);
    setFlatFiles([]);
    setExpanded(new Set());
    setSelected(new Set());
    setCursor(0);
    setScrollOffset(0);

    try {
      const result = await scanProject(resolved, info => {
        setProgressText(
          info.currentPath
            ? `Scanning ${info.currentPath} (${info.processedFiles} files)...`
            : `Scanning... (${info.processedFiles} files)`
        );
      });
      setRootNode(result.root);
      setFlatFiles(result.flatFiles);
      setExpanded(new Set([result.root.path]));
      setStatus(`Scanned ${result.flatFiles.length} files from ${resolved}`);
      setLoading(false);
      setProgressText(null);
      return { root: result.root, files: result.flatFiles };
    } catch (err: any) {
      setScanError(err?.message || String(err));
      setStatus("Scan error");
      setLoading(false);
      setProgressText(null);
      return { root: null, files: [] };
    }
  };

  useEffect(() => {
    (async () => {
      const loaded = loadPresets();
      setPresets(loaded);
      await handleScan(rootDir);
      setStatus("Ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNodes = useMemo(() => {
    if (!rootNode) return [];
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      return flatFiles.filter(f =>
        f.relPath.toLowerCase().includes(q)
      );
    }

    const out: FileNode[] = [];
    const traverse = (n: FileNode) => {
      out.push(n);
      if (n.isDirectory && expanded.has(n.path) && n.children) {
        for (const child of n.children) traverse(child);
      }
    };
    traverse(rootNode);
    return out;
  }, [rootNode, flatFiles, expanded, filter]);

  useEffect(() => {
    if (cursor >= visibleNodes.length) {
      setCursor(visibleNodes.length > 0 ? visibleNodes.length - 1 : 0);
      setScrollOffset(0);
    }
  }, [visibleNodes.length, cursor]);

  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + listHeight) {
      setScrollOffset(cursor - listHeight + 1);
    }
  }, [cursor, scrollOffset, listHeight]);

  const viewNodes = useMemo(
    () => visibleNodes.slice(scrollOffset, scrollOffset + listHeight),
    [visibleNodes, scrollOffset, listHeight]
  );

  const debouncedStats = useMemo(
    () =>
      debounce(
        (
          files: FileNode[],
          selectedSet: Set<string>,
          includePreamble: boolean,
          preambleText: string,
          includeGoal: boolean,
          goalText: string
        ) => {
          const selectedFiles = files.filter(
            f => !f.isDirectory && f.isText && selectedSet.has(f.path)
          );
          const size = selectedFiles.reduce(
            (acc, f) => acc + f.sizeBytes,
            0
          );

          const tokensFromFiles = selectedFiles.reduce((acc, f) => {
            if (f.content) return acc + countTokens(f.content);
            const approx = Math.ceil(f.sizeBytes / 4);
            return acc + approx;
          }, 0);

          const paramTokens =
            (includePreamble ? countTokens(preambleText) : 0) +
            (includeGoal ? countTokens(goalText) : 0);

          const totalTokens = tokensFromFiles + paramTokens;

          setStatsFileCount(selectedFiles.length);
          setStatsSizeBytes(size);
          setStatsTokens(totalTokens);
        },
        200
      ),
    []
  );

  useEffect(() => {
    debouncedStats(
      flatFiles,
      selected,
      includePreamble,
      preamble,
      includeGoal,
      goal
    );
  }, [flatFiles, selected, includePreamble, preamble, includeGoal, goal, debouncedStats]);

  useEffect(() => {
    const node = visibleNodes[cursor];
    if (!node || node.isDirectory || !node.isText) {
      setPreviewContent("");
      setPreviewLang("txt");
      return;
    }
    const lang = languageFromExtension(node.extension);
    setPreviewLang(lang);

    if (node.content) {
      setPreviewContent(
        node.content.length > MAX_PREVIEW_CHARS
          ? node.content.slice(0, MAX_PREVIEW_CHARS)
          : node.content
      );
    } else if (node.isText) {
      fsp
        .readFile(node.path, "utf8")
        .then(content =>
          setPreviewContent(
            content.length > MAX_PREVIEW_CHARS
              ? content.slice(0, MAX_PREVIEW_CHARS)
              : content
          )
        )
        .catch(() => setPreviewContent("// Error reading file"));
    }
  }, [visibleNodes, cursor]);

  useEffect(() => {
    if (!rootNode) {
      setPromptPreview("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        const options: CombineOptions = {
          includePreamble,
          preambleText: preamble,
          includeGoal,
          goalText: goal,
          removeComments,
          minify
        };
        const snippet = await buildPromptPreviewSnippet(
          rootNode,
          flatFiles,
          selected,
          options
        );
        if (!cancelled) setPromptPreview(snippet);
      })().catch(err => {
        if (!cancelled) {
          setPromptPreview(
            "// Error building preview: " + (err?.message || String(err))
          );
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rootNode, flatFiles, selected, includePreamble, preamble, includeGoal, goal, removeComments, minify]);

  const toggleSelectNode = (node: FileNode) => {
    if (node.isDirectory && !filter.trim()) {
      const descendants: FileNode[] = [];
      const collectDesc = (n: FileNode) => {
        if (!n.isDirectory && n.isText) descendants.push(n);
        if (n.children) for (const c of n.children) collectDesc(c);
      };
      collectDesc(node);
      const newSel = new Set(selected);
      const allSelected = descendants.every(d => newSel.has(d.path));
      if (allSelected) {
        for (const d of descendants) newSel.delete(d.path);
      } else {
        for (const d of descendants) newSel.add(d.path);
      }
      setSelected(newSel);
      setStatus(
        `${allSelected ? "Deselected" : "Selected"} ${descendants.length} files in "${node.relPath}"`
      );
      return;
    }

    if (!node.isDirectory) {
      if (!node.isText) {
        setStatus("File is binary or too large to include.");
        return;
      }
      const newSel = new Set(selected);
      if (newSel.has(node.path)) newSel.delete(node.path);
      else newSel.add(node.path);
      setSelected(newSel);
    }
  };

  const moveCursor = (delta: number) => {
    if (!visibleNodes.length) return;
    const maxIndex = visibleNodes.length - 1;
    let next = cursor + delta;
    if (next < 0) next = 0;
    if (next > maxIndex) next = maxIndex;
    setCursor(next);
  };

  const toggleQuickSelect = (key: QuickSelectKey) => {
    if (!flatFiles.length) return;
    const matches = filterFilesByQuickSelect(flatFiles, key).filter(
      f => f.isText
    );
    if (!matches.length) {
      setStatus("No matching files for this quick select.");
      return;
    }

    const newSel = new Set(selected);
    const allSelected = matches.every(m => newSel.has(m.path));
    if (allSelected) {
      for (const m of matches) newSel.delete(m.path);
    } else {
      for (const m of matches) newSel.add(m.path);
    }
    setSelected(newSel);
    setStatus(QUICK_SELECT_LABELS[key]);
  };

  const clearSelectionInFilter = () => {
    if (!filter.trim()) return;
    const q = filter.trim().toLowerCase();
    const inFilter = flatFiles.filter(f =>
      f.relPath.toLowerCase().includes(q)
    );
    if (!inFilter.length) return;
    const newSel = new Set(selected);
    for (const f of inFilter) newSel.delete(f.path);
    setSelected(newSel);
    setStatus("Cleared selections for files matching current filter.");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setStatus("Preset name cannot be empty.");
      return;
    }
    const selectedRelPaths = flatFiles
      .filter(f => selected.has(f.path))
      .map(f => f.relPath)
      .sort();

    const preset: Preset = {
      name,
      rootDir,
      includePreamble,
      includeGoal,
      preamble,
      goal,
      minify,
      removeComments,
      selectedRelPaths,
      createdAt: new Date().toISOString()
    };

    const filtered = presets.filter(p => p.name !== name);
    const next = [...filtered, preset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setStatus(`Saved preset "${name}".`);
  };

  const handleLoadPreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    setIncludePreamble(preset.includePreamble);
    setIncludeGoal(preset.includeGoal);
    setPreamble(preset.preamble);
    setGoal(preset.goal);
    setMinify(preset.minify);
    setRemoveComments(preset.removeComments);
    setStatus(`Loading preset "${preset.name}"...`);

    const presetRootResolved = path.resolve(preset.rootDir);
    const currentRootResolved = path.resolve(rootDir);

    if (presetRootResolved !== currentRootResolved) {
      (async () => {
        const result = await handleScan(preset.rootDir);
        const files = result.files;
        const base = presetRootResolved;
        const newSel = new Set<string>();
        for (const rel of preset.selectedRelPaths) {
          const abs = path.join(base, rel);
          const node = files.find(f => f.path === abs);
          if (node && node.isText) newSel.add(abs);
        }
        setSelected(newSel);
        setStatus(
          `Loaded preset "${preset.name}" (${newSel.size} files selected).`
        );
      })();
    } else {
      const base = currentRootResolved;
      const newSel = new Set<string>();
      for (const rel of preset.selectedRelPaths) {
        const abs = path.join(base, rel);
        const node = flatFiles.find(f => f.path === abs);
        if (node && node.isText) newSel.add(abs);
      }
      setSelected(newSel);
      setStatus(
        `Loaded preset "${preset.name}" (${newSel.size} files selected).`
      );
    }
  };

  const handleDeletePreset = (index: number) => {
    const preset = presets[index];
    if (!preset) return;
    const next = presets.filter((_, i) => i !== index);
    setPresets(next);
    savePresets(next);
    setSelectedPresetIndex(prev =>
      prev >= next.length ? Math.max(0, next.length - 1) : prev
    );
    setStatus(`Deleted preset "${preset.name}".`);
  };

  const handleGenerate = async () => {
    if (!rootNode) return;
    const selectedFiles = flatFiles.filter(
      f => !f.isDirectory && f.isText && selected.has(f.path)
    );
    if (!selectedFiles.length) {
      setStatus("No files selected. Select at least one text file first.");
      return;
    }

    setStatus("Generating combined prompt...");
    setMode("main");
    try {
      const options: CombineOptions = {
        includePreamble,
        preambleText: preamble,
        includeGoal,
        goalText: goal,
        removeComments,
        minify
      };
      const result = await buildCombinedOutput(
        rootNode,
        flatFiles,
        selected,
        options
      );
      setCombined(result);
      const copied = await copyToClipboard(result.text);
      setMode("combined");
      setStatus(
        `${copied ? "Copied to clipboard" : "Generated"}: ${formatBytes(
          result.bytes
        )}, ~${result.tokens.toLocaleString()} tokens.`
      );
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  const handleSaveCombinedToFile = async () => {
    if (!combined) return;
    const target = exportPath.trim() || "combined-prompt.txt";
    const resolved = path.isAbsolute(target)
      ? target
      : path.resolve(rootDir, target);
    try {
      await fsp.writeFile(resolved, combined.text, "utf8");
      setStatus(`Saved combined output to ${resolved}`);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (mode === "combined") {
      if (focusField === "exportPath") {
        if (key.escape) {
          setFocusField("none");
          return;
        }
        if (key.return) {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
        return;
      }

      const lower = input.toLowerCase();
      if (key.escape || lower === "q") {
        setMode("main");
        setStatus("Back to main view.");
        return;
      }
      if (lower === "y") {
        if (combined) {
          void copyToClipboard(combined.text).then(ok =>
            setStatus(
              ok
                ? "Copied combined output to clipboard."
                : "Clipboard copy failed."
            )
          );
        }
        return;
      }
      if (lower === "w") {
        setFocusField("exportPath");
        return;
      }
      return;
    }

    if (focusField !== "none") {
      if (key.escape) {
        setFocusField("none");
        return;
      }
      if (key.return) {
        if (focusField === "rootDir") {
          void handleScan(rootDir);
          setFocusField("none");
          return;
        }
        if (focusField === "filter") {
          setFocusField("none");
          return;
        }
        if (focusField === "preamble") {
          setFocusField("none");
          return;
        }
        if (focusField === "goal") {
          setFocusField("none");
          return;
        }
        if (focusField === "presetName") {
          handleSavePreset();
          setFocusField("none");
          return;
        }
        if (focusField === "exportPath") {
          void handleSaveCombinedToFile();
          setFocusField("none");
          return;
        }
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === "g") {
      void handleGenerate();
      return;
    }

    if (key.tab) {
      const panes: Pane[] = ["explorer", "config", "preview"];
      const idx = panes.indexOf(activePane);
      const next = panes[(idx + 1) % panes.length];
      setActivePane(next);
      return;
    }

    if (activePane === "explorer") {
      if (key.upArrow || input === "k") {
        moveCursor(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        moveCursor(1);
        return;
      }

      const node = visibleNodes[cursor];

      if (key.leftArrow || input === "h") {
        if (node && node.isDirectory && expanded.has(node.path)) {
          const next = new Set(expanded);
          next.delete(node.path);
          setExpanded(next);
        }
        return;
      }

      if (key.rightArrow || input === "l") {
        if (node && node.isDirectory && !expanded.has(node.path)) {
          const next = new Set(expanded);
          next.add(node.path);
          setExpanded(next);
        }
        return;
      }

      if (input === " ") {
        if (node) toggleSelectNode(node);
        return;
      }

      if (key.return) {
        if (node) {
          if (node.isDirectory) {
            const next = new Set(expanded);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpanded(next);
          } else {
            toggleSelectNode(node);
          }
        }
        return;
      }

      if (input === "/" || input.toLowerCase() === "f") {
        setFocusField("filter");
        setActivePane("explorer");
        return;
      }

      if (input.toLowerCase() === "d") {
        setFocusField("rootDir");
        return;
      }

      if (input.toLowerCase() === "u") {
        clearSelectionInFilter();
        return;
      }

      if (input === "t") {
        toggleQuickSelect("allText");
        return;
      }
      if (input === "1") {
        toggleQuickSelect("javascript");
        return;
      }
      if (input === "2") {
        toggleQuickSelect("react");
        return;
      }
      if (input === "3") {
        toggleQuickSelect("typescript");
        return;
      }
      if (input === "4") {
        toggleQuickSelect("json");
        return;
      }
      if (input === "5") {
        toggleQuickSelect("markdown");
        return;
      }
      if (input === "6") {
        toggleQuickSelect("python");
        return;
      }
      if (input === "7") {
        toggleQuickSelect("go");
        return;
      }
      if (input === "8") {
        toggleQuickSelect("java");
        return;
      }
      if (input === "9") {
        toggleQuickSelect("ruby");
        return;
      }
      if (input === "0") {
        toggleQuickSelect("php");
        return;
      }
      if (input.toLowerCase() === "r") {
        toggleQuickSelect("rust");
        return;
      }
    }

    if (activePane === "config") {
      if (key.leftArrow || key.rightArrow) {
        setConfigTab(prev =>
          prev === "inputs"
            ? "presets"
            : prev === "presets"
            ? "options"
            : "inputs"
        );
        return;
      }

      if (configTab === "inputs") {
        if (input.toLowerCase() === "p") {
          setFocusField("preamble");
          return;
        }
        if (input.toLowerCase() === "g") {
          setFocusField("goal");
          return;
        }
      }

      if (configTab === "options") {
        if (input.toLowerCase() === "i") {
          setIncludePreamble(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "o") {
          setIncludeGoal(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "m") {
          setMinify(prev => !prev);
          return;
        }
        if (input.toLowerCase() === "x") {
          setRemoveComments(prev => !prev);
          return;
        }
      }

      if (configTab === "presets") {
        if (key.upArrow || input === "k") {
          setSelectedPresetIndex(prev =>
            prev <= 0 ? 0 : prev - 1
          );
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedPresetIndex(prev =>
            prev >= presets.length - 1
              ? Math.max(0, presets.length - 1)
              : prev + 1
          );
          return;
        }
        if (input.toLowerCase() === "l") {
          if (presets.length) handleLoadPreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "d") {
          if (presets.length) handleDeletePreset(selectedPresetIndex);
          return;
        }
        if (input.toLowerCase() === "s") {
          setFocusField("presetName");
          return;
        }
      }
    }
  });

  const cost = (statsTokens / 1_000_000) * COST_PER_1M_TOKENS;
  const contextPercent = Math.min(
    1,
    statsTokens / CONTEXT_WINDOW
  );
  const contextWarning =
    statsTokens > CONTEXT_WINDOW
      ? "⚠️ Estimated tokens exceed context window; model may truncate."
      : statsTokens > 100_000
      ? "Large prompt; ensure you're using a 128k+ context model."
      : "";

  if (loading && !rootNode) {
    return (
      <Box padding={2} flexDirection="column">
        <Box>
          <Spinner type="dots" />
          <Text> Scanning project...</Text>
        </Box>
        {progressText && (
          <Box marginTop={1}>
            <Text>{progressText}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === "combined") {
    return (
      <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
        <Box justifyContent="center" height={3}>
          <Gradient name="pastel">
            <BigText text="Combined Prompt" font="tiny" />
          </Gradient>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={1}
          flexGrow={1}
        >
          <Text>
            {combined ? combined.text : "(nothing generated yet)"}
          </Text>
        </Box>
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          paddingTop={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Text dimColor>
              [Y] Copy  [W] Save to file  [Esc/Q] Back
            </Text>
            {combined && (
              <Text>
                {formatBytes(combined.bytes)} | Lines: {combined.lines} | Tokens:{" "}
                {combined.tokens.toLocaleString()}
              </Text>
            )}
          </Box>
          {combined && (
            <Box marginTop={1} flexDirection="column">
              <ProgressBar
                percent={Math.min(
                  1,
                  combined.tokens / CONTEXT_WINDOW
                )}
                color={
                  combined.tokens > CONTEXT_WINDOW ? "red" : "green"
                }
              />
              <Text dimColor>
                {Math.round(
                  (combined.tokens / CONTEXT_WINDOW) * 1000
                ) / 10}
                % of {CONTEXT_WINDOW.toLocaleString()}-token context
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="green">{status}</Text>
          </Box>
          {focusField === "exportPath" && (
            <Box marginTop={1}>
              <Text>Save as: </Text>
              <TextInput
                value={exportPath}
                onChange={setExportPath}
                focus={true}
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  const explorerWidth = Math.floor(cols * 0.4);
  const configWidth = Math.floor(cols * 0.3);
  const previewWidth = cols - explorerWidth - configWidth - 4;

  return (
    <Box flexDirection="column" height={rows} width={cols} paddingX={1}>
      <Box justifyContent="center" height={3}>
        <Gradient name="morning">
          <BigText text="Source2Prompt" font="tiny" />
        </Gradient>
      </Box>

      <Box marginBottom={1}>
        <Text>Root: </Text>
        <TextInput
          value={rootDir}
          onChange={setRootDir}
          focus={focusField === "rootDir"}
        />
      </Box>

      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
      >
        <Box flexDirection="row" flexGrow={1}>
          {/* Explorer */}
          <Box
            width={explorerWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "explorer" ? "cyan" : "gray"}
          >
            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
              justifyContent="space-between"
            >
              <Text bold color={activePane === "explorer" ? "cyan" : "white"}>
                EXPLORER
              </Text>
              <Text dimColor>
                {statsFileCount} sel / {flatFiles.length} files
              </Text>
            </Box>

            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
            >
              <Text color="cyan">🔍 </Text>
              <TextInput
                value={filter}
                onChange={setFilter}
                focus={focusField === "filter" && activePane === "explorer"}
                placeholder="Filter by path..."
              />
            </Box>

            <Box flexDirection="column" paddingLeft={1}>
              {viewNodes.length === 0 && (
                <Text dimColor>No files match current filter.</Text>
              )}
              {viewNodes.map((node, idx) => {
                const isCursor = scrollOffset + idx === cursor;
                const isSel = selected.has(node.path);
                const marker = isCursor ? "›" : " ";
                const indent = filter.trim() ? 0 : node.depth;
                const icon = node.isDirectory
                  ? expanded.has(node.path)
                    ? "📂"
                    : "📁"
                  : isSel
                  ? "▣"
                  : node.isText
                  ? "📄"
                  : "⛔";

                let color: any = node.isDirectory
                  ? "yellow"
                  : node.isText
                  ? isSel
                    ? "green"
                    : "white"
                  : "red";

                if (isCursor) color = "cyan";

                return (
                  <Box key={node.path}>
                    <Text color={isCursor ? "cyan" : "black"}>{marker}</Text>
                    <Text dimColor>{" ".repeat(indent)}</Text>
                    <Text color={color}>
                      {icon}{" "}
                      {node.relPath === "." ? node.name : node.relPath}{" "}
                      {!node.isDirectory &&
                        `(${formatBytes(node.sizeBytes)}${
                          node.isText ? "" : ", binary"
                        })`}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Config */}
          <Box
            width={configWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "config" ? "cyan" : "gray"}
          >
            <Box flexDirection="row" borderBottom borderStyle="single" borderColor="gray">
              <Box
                paddingX={1}
                borderRight
                borderStyle="single"
                borderColor={configTab === "inputs" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "inputs"}>Inputs</Text>
              </Box>
              <Box
                paddingX={1}
                borderRight
                borderStyle="single"
                borderColor={configTab === "presets" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "presets"}>Presets</Text>
              </Box>
              <Box
                paddingX={1}
                borderColor={configTab === "options" ? "cyan" : "gray"}
              >
                <Text bold={configTab === "options"}>Options</Text>
              </Box>
            </Box>

            {configTab === "inputs" && (
              <Box flexDirection="column" padding={1}>
                <Text bold>
                  Preamble{" "}
                  <Text color={includePreamble ? "green" : "red"}>
                    [{includePreamble ? "ON" : "OFF"}]
                  </Text>
                </Text>
                <Box
                  borderStyle="single"
                  borderColor={focusField === "preamble" ? "cyan" : "gray"}
                  paddingX={1}
                  marginBottom={1}
                >
                  <TextInput
                    value={preamble}
                    onChange={setPreamble}
                    focus={focusField === "preamble"}
                    placeholder="System / context instructions..."
                  />
                </Box>

                <Text bold>
                  Goal{" "}
                  <Text color={includeGoal ? "green" : "red"}>
                    [{includeGoal ? "ON" : "OFF"}]
                  </Text>
                </Text>
                <Box
                  borderStyle="single"
                  borderColor={focusField === "goal" ? "cyan" : "gray"}
                  paddingX={1}
                >
                  <TextInput
                    value={goal}
                    onChange={setGoal}
                    focus={focusField === "goal"}
                    placeholder="High-level task / objective..."
                  />
                </Box>

                <Box marginTop={1}>
                  <Text dimColor>
                    [P] Edit preamble  [G] Edit goal (while in Inputs tab)
                  </Text>
                </Box>
              </Box>
            )}

            {configTab === "presets" && (
              <Box flexDirection="column" padding={1}>
                {presets.length === 0 && (
                  <Text dimColor>No presets yet. Press 'S' to save one.</Text>
                )}
                {presets.map((p, idx) => {
                  const active = idx === selectedPresetIndex;
                  return (
                    <Box key={p.name}>
                      <Text color={active ? "cyanBright" : "white"}>
                        {active ? "•" : " "} {p.name}
                      </Text>
                    </Box>
                  );
                })}
                <Box
                  borderTop
                  borderStyle="single"
                  borderColor="gray"
                  paddingTop={1}
                  flexDirection="column"
                >
                  <Text>Save current selection as preset:</Text>
                  <Box>
                    <Text>Name: </Text>
                    <TextInput
                      value={presetName}
                      onChange={setPresetName}
                      focus={focusField === "presetName"}
                      placeholder="Preset name..."
                    />
                  </Box>
                  <Box marginTop={1} flexDirection="column">
                    <Text dimColor>
                      [J/K] Move  [L] Load  [D] Delete  [S] Focus name + save
                    </Text>
                  </Box>
                </Box>
              </Box>
            )}

            {configTab === "options" && (
              <Box flexDirection="column" padding={1}>
                <Text>
                  Include preamble:{" "}
                  <Text color={includePreamble ? "green" : "red"}>
                    {includePreamble ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [I])
                </Text>
                <Text>
                  Include goal:{" "}
                  <Text color={includeGoal ? "green" : "red"}>
                    {includeGoal ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [O])
                </Text>
                <Text>
                  Remove comments:{" "}
                  <Text color={removeComments ? "green" : "red"}>
                    {removeComments ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [X])
                </Text>
                <Text>
                  Minify:{" "}
                  <Text color={minify ? "green" : "red"}>
                    {minify ? "ON" : "OFF"}
                  </Text>{" "}
                  (toggle with [M])
                </Text>
                <Box marginTop={1}>
                  <Text dimColor>
                    Options tab shortcuts: [I] preamble, [O] goal, [X] comments, [M] minify
                  </Text>
                </Box>
              </Box>
            )}
          </Box>

          {/* Preview & stats */}
          <Box
            width={previewWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={activePane === "preview" ? "cyan" : "gray"}
          >
            <Box
              borderBottom
              borderStyle="single"
              borderColor="gray"
              paddingX={1}
            >
              <Text bold>FILE PREVIEW</Text>
            </Box>
            <Box flexGrow={1} paddingX={1}>
              <SyntaxHighlight
                language={previewLang}
                code={
                  previewContent ||
                  "// Select a text file to preview (or press Ctrl+G to generate)."
                }
              />
            </Box>
            <Box
              borderTop
              borderStyle="single"
              borderColor="gray"
              flexDirection="column"
              padding={1}
            >
              <Box justifyContent="space-between">
                <Text>
                  Tokens:{" "}
                  <Text color="magenta">
                    {statsTokens.toLocaleString()}
                  </Text>
                </Text>
                <Text color="green">${cost.toFixed(4)}</Text>
              </Box>
              <ProgressBar
                percent={contextPercent}
                color={statsTokens > CONTEXT_WINDOW ? "red" : "green"}
              />
              <Text dimColor>
                {Math.round(contextPercent * 1000) / 10}% of{" "}
                {CONTEXT_WINDOW.toLocaleString()}-token context
              </Text>
              {contextWarning && (
                <Text color="yellow">{contextWarning}</Text>
              )}
              <Box marginTop={1} flexDirection="column">
                <Text>
                  Selected size: {formatBytes(statsSizeBytes)} | Files:{" "}
                  {statsFileCount}
                </Text>
                <Text dimColor>
                  Generation: press Ctrl+G to build combined prompt and open Combined view.
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Prompt sample pane (4th pane) */}
        <Box
          borderTop
          borderStyle="single"
          borderColor="gray"
          flexDirection="column"
          padding={1}
        >
          <Text bold>PROMPT SAMPLE</Text>
          <Text dimColor>
            Live preview of the first part of the combined prompt, based on your current
            selections and options.
          </Text>
          <Box marginTop={1}>
            <SyntaxHighlight language="txt" code={promptPreview} />
          </Box>
        </Box>
      </Box>

      <Box
        height={2}
        justifyContent="space-between"
        paddingX={1}
        borderTop
        borderStyle="single"
        borderColor="gray"
      >
        <Box flexDirection="column">
          <Text dimColor>
            Panes: Tab | Explorer: j/k, h/l, Space/Enter, / or F filter, D root, T/1-9/0/R quick
            select, U clear filter selection
          </Text>
          <Text dimColor>
            Config: arrows to tab, P/G (inputs), S/L/D (presets), I/O/X/M (options) | Generate:
            Ctrl+G | Combined view: [Y] copy, [W] save, [Esc/Q] back
          </Text>
        </Box>
        <Box alignItems="flex-end">
          {scanError ? (
            <Text color="red">Error: {scanError}</Text>
          ) : (
            <Text color={status.startsWith("Ready") ? "white" : "green"}>
              {status}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

render(<App />);
```

* * *

## Build & Run

```
bash

bashbun install

# dev TUI
bun run src/index.tsx

# TS build
bun run build

# single-file binary (Linux/macOS)
bun run build:bin          # produces ./s2p

./s2p                      # run in current project
```

This version:

-   Gives you a **structured, self-describing prompt** (
    
    ```
    [meta]
    ```
    
    ,
    
    ```
    <preamble>
    ```
    
    ,
    
    ```
    <goal>
    ```
    
    ,
    
    ```
    <project_tree>
    ```
    
    ,
    
    ```
    <file ...>
    ```
    
    ).
    
-   Uses a **more accurate token model** for both stats and final output.
    
-   Uses **language-aware minification** (JS/TS via Bun.transform + Terser fallback, CSS/HTML/JSON/Markdown tuned) and **language-aware comment stripping** (C/Java/Go/Rust/JS, Python/Ruby/shell, Markdown/HTML).
    
-   Adds a **dedicated prompt sample pane** so you see exactly what kind of prompt will be produced before you hit Ctrl+G.
    
-   Keeps all the UX goodies: tree explorer, Vim keys, search/filter, quick selects, live syntax highlighting, presets, clipboard copy, and combined output view with context‑window bar.
    

If you want, next iteration we can specialize the

```
<files>
```

section further for a specific provider (e.g., tag it for OpenAI vs Anthropic vs local tooling) or add a wholly different output profile selectable from the TUI (e.g., “Claude‑style prompt mode” vs “OpenAI‑style prompt mode”).
