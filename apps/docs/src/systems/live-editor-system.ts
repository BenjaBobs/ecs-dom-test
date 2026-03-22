/**
 * LiveEditorSystem — hydrates editable code blocks with isolated iframe previews.
 */

import { getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import * as ts from 'typescript';
import {
  DOCS_CODE_MODE_EVENT,
  DOCS_CODE_MODE_STORAGE_KEY,
  type DocsCodeMode,
} from '../code-mode.ts';
import { HtmlContent } from '../components.ts';
import { LIVE_EXAMPLES, type LiveExample } from '../live-examples.ts';
import { pathToRoot } from '../site-root.ts';

type EditorEngine = 'monaco' | 'textarea';

type EditorHandle = {
  engine: EditorEngine;
  element: HTMLElement;
  getValue: () => string;
  setValue: (value: string) => void;
  setMode?: (mode: DocsCodeMode) => void;
  setTheme?: (theme: 'light' | 'dark') => void;
  onDidChange: (cb: () => void) => void;
};

type MonacoRequire = {
  config: (cfg: Record<string, unknown>) => void;
  (deps: string[], onLoad: () => void, onError?: (err: unknown) => void): void;
};

type MonacoModel = {
  dispose: () => void;
};

type MonacoEditor = {
  getValue: () => string;
  setValue: (value: string) => void;
  setModel: (model: MonacoModel) => void;
  updateOptions: (opts: Record<string, unknown>) => void;
  onDidChangeModelContent: (cb: () => void) => void;
};

type MonacoApi = {
  Uri: {
    parse: (value: string) => unknown;
  };
  editor: {
    createModel: (value: string, language: string, uri: unknown) => MonacoModel;
    create: (
      host: HTMLElement,
      options: Record<string, unknown> & {
        model: MonacoModel;
      },
    ) => MonacoEditor;
  };
  languages: {
    typescript: {
      ScriptTarget: {
        ES2022: unknown;
      };
      ModuleKind: {
        ESNext: unknown;
      };
      ModuleResolutionKind: {
        NodeJs: unknown;
      };
      JsxEmit: {
        ReactJSX: unknown;
      };
      typescriptDefaults: {
        setCompilerOptions: (opts: Record<string, unknown>) => void;
        setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
        setEagerModelSync: (value: boolean) => void;
        addExtraLib: (content: string, filePath?: string) => void;
      };
    };
  };
};

const MONACO_VS_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs';
let monacoLoaderPromise: Promise<MonacoApi | null> | null = null;
let monacoTypesRegistered = false;
let monacoTypeLibsPromise: Promise<void> | null = null;

const MONACO_MODULE_ALIASES = `declare module "@ecs-test/ecs" { export * from "file:///playground-types/packages/ecs/src/index.ts"; }
declare module "@ecs-test/dom" { export * from "file:///playground-types/packages/dom/src/index.ts"; }
declare module "@ecs-test/forms" { export * from "file:///playground-types/packages/forms/src/index.ts"; }
declare module "@ecs-test/forms-ui" { export * from "file:///playground-types/packages/forms-ui/src/index.ts"; }

declare module "/playground/modules/ecs.js" { export * from "@ecs-test/ecs"; }
declare module "/playground/modules/ecs" { export * from "@ecs-test/ecs"; }
declare module "playground/modules/ecs.js" { export * from "@ecs-test/ecs"; }
declare module "playground/modules/ecs" { export * from "@ecs-test/ecs"; }
declare module "file:///playground/modules/ecs.js" { export * from "@ecs-test/ecs"; }
declare module "file:///playground/modules/ecs" { export * from "@ecs-test/ecs"; }
declare module "*/playground/modules/ecs.js" { export * from "@ecs-test/ecs"; }
declare module "*/playground/modules/ecs" { export * from "@ecs-test/ecs"; }

declare module "/playground/modules/ecs/jsx-runtime" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "/playground/modules/ecs/jsx-runtime.js" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "playground/modules/ecs/jsx-runtime" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "playground/modules/ecs/jsx-runtime.js" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "file:///playground/modules/ecs/jsx-runtime" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "file:///playground/modules/ecs/jsx-runtime.js" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "*/playground/modules/ecs/jsx-runtime" { export * from "@ecs-test/ecs/jsx-runtime"; }
declare module "*/playground/modules/ecs/jsx-runtime.js" { export * from "@ecs-test/ecs/jsx-runtime"; }

declare module "/playground/modules/dom.js" { export * from "@ecs-test/dom"; }
declare module "/playground/modules/dom" { export * from "@ecs-test/dom"; }
declare module "playground/modules/dom.js" { export * from "@ecs-test/dom"; }
declare module "playground/modules/dom" { export * from "@ecs-test/dom"; }
declare module "file:///playground/modules/dom.js" { export * from "@ecs-test/dom"; }
declare module "file:///playground/modules/dom" { export * from "@ecs-test/dom"; }
declare module "*/playground/modules/dom.js" { export * from "@ecs-test/dom"; }
declare module "*/playground/modules/dom" { export * from "@ecs-test/dom"; }

declare module "/playground/modules/forms.js" { export * from "@ecs-test/forms"; }
declare module "/playground/modules/forms" { export * from "@ecs-test/forms"; }
declare module "/playground/modules/forms-ui.js" { export * from "@ecs-test/forms-ui"; }
declare module "/playground/modules/forms-ui" { export * from "@ecs-test/forms-ui"; }`;

async function registerGeneratedTypeLibs(monaco: MonacoApi, doc: Document): Promise<void> {
  if (monacoTypeLibsPromise) {
    return monacoTypeLibsPromise;
  }

  monacoTypeLibsPromise = (async () => {
    const fetchFn = doc.defaultView?.fetch?.bind(doc.defaultView);
    if (!fetchFn) return;

    const defaults = monaco.languages.typescript.typescriptDefaults;
    const manifestRes = await fetchFn(`${pathToRoot}playground/types/manifest.json`);
    if (!manifestRes.ok) return;

    const manifest = (await manifestRes.json()) as { files?: unknown };
    const files = Array.isArray(manifest.files)
      ? manifest.files.filter((v): v is string => typeof v === 'string')
      : [];

    for (const relPath of files) {
      const response = await fetchFn(`${pathToRoot}playground/types/${relPath}`);
      if (!response.ok) continue;
      const content = await response.text();

      const uriDts = `file:///playground-types/${relPath}`;
      defaults.addExtraLib(content, uriDts);

      const uriTs = uriDts.replace(/\.d\.ts$/, '.ts');
      if (uriTs !== uriDts) {
        defaults.addExtraLib(content, uriTs);
      }
    }
  })();

  return monacoTypeLibsPromise;
}

function loadScript(doc: Document, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    doc.head.append(script);
  });
}

async function loadMonaco(doc: Document): Promise<MonacoApi | null> {
  if (monacoLoaderPromise) {
    return monacoLoaderPromise;
  }

  monacoLoaderPromise = (async () => {
    try {
      const win = doc.defaultView as (Window & Record<string, unknown>) | null;
      if (!win) return null;

      if (!win.require) {
        await loadScript(doc, `${MONACO_VS_BASE}/loader.js`);
      }

      const requireJs = win.require as MonacoRequire | undefined;

      if (!requireJs) {
        return null;
      }

      requireJs.config({
        paths: {
          vs: MONACO_VS_BASE,
        },
      });

      await new Promise<void>((resolve, reject) => {
        requireJs(
          ['vs/editor/editor.main'],
          () => resolve(),
          err => reject(err),
        );
      });

      return ((win as { monaco?: unknown }).monaco ?? null) as MonacoApi | null;
    } catch {
      return null;
    }
  })();

  return monacoLoaderPromise;
}

async function ensureMonacoTypes(monaco: MonacoApi, doc: Document): Promise<void> {
  if (monacoTypesRegistered) return;

  const defaults = monaco.languages.typescript.typescriptDefaults;
  defaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    allowNonTsExtensions: true,
    baseUrl: '/',
    paths: {
      '/playground/modules/*': ['/playground/modules/*'],
      'playground/modules/*': ['/playground/modules/*'],
      'file:///playground/modules/*': ['/playground/modules/*'],
      '@ecs-test/ecs': ['file:///playground-types/packages/ecs/src/index.ts'],
      '@ecs-test/ecs/*': ['file:///playground-types/packages/ecs/src/*'],
      '@ecs-test/dom': ['file:///playground-types/packages/dom/src/index.ts'],
      '@ecs-test/dom/*': ['file:///playground-types/packages/dom/src/*'],
      '@ecs-test/forms': ['file:///playground-types/packages/forms/src/index.ts'],
      '@ecs-test/forms/*': ['file:///playground-types/packages/forms/src/*'],
      '@ecs-test/forms-ui': ['file:///playground-types/packages/forms-ui/src/index.ts'],
      '@ecs-test/forms-ui/*': ['file:///playground-types/packages/forms-ui/src/*'],
    },
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    jsxImportSource: '/playground/modules/ecs',
    allowJs: true,
    strict: false,
  });
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  defaults.setEagerModelSync(true);
  await registerGeneratedTypeLibs(monaco, doc);
  defaults.addExtraLib(MONACO_MODULE_ALIASES, 'file:///live-editor/module-aliases.d.ts');

  monacoTypesRegistered = true;
}

function createTextareaEditor(doc: Document, initialValue: string): EditorHandle {
  const editor = doc.createElement('textarea');
  editor.className = 'live-editor-textarea';
  editor.spellcheck = false;
  editor.value = initialValue;

  return {
    engine: 'textarea',
    element: editor,
    getValue: () => editor.value,
    setValue: (value: string) => {
      editor.value = value;
    },
    onDidChange: (cb: () => void) => {
      editor.addEventListener('input', cb);
    },
  };
}

async function createMonacoEditor(
  doc: Document,
  initialValue: string,
  mode: DocsCodeMode,
): Promise<EditorHandle | null> {
  const monaco = await loadMonaco(doc);
  if (!monaco) {
    return null;
  }

  await ensureMonacoTypes(monaco, doc);

  const host = doc.createElement('div');
  host.className = 'live-editor-textarea';
  host.setAttribute('data-live-editor-engine', 'monaco');

  const mkUri = (m: DocsCodeMode) =>
    monaco.Uri.parse(`inmemory://live-editor/${crypto.randomUUID()}.${m === 'jsx' ? 'tsx' : 'ts'}`);

  let currentMode: DocsCodeMode = mode;
  let model = monaco.editor.createModel(initialValue, 'typescript', mkUri(mode));
  const currentTheme = resolveTheme(doc);
  const editor = monaco.editor.create(host, {
    model,
    theme: monacoTheme(currentTheme),
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
  });

  return {
    engine: 'monaco',
    element: host,
    getValue: () => editor.getValue(),
    setValue: (value: string) => {
      editor.setValue(value);
    },
    setMode: (nextMode: DocsCodeMode) => {
      if (nextMode === currentMode) return;
      const value = editor.getValue();
      const prev = model;
      model = monaco.editor.createModel(value, 'typescript', mkUri(nextMode));
      editor.setModel(model);
      prev.dispose();
      currentMode = nextMode;
    },
    setTheme: (theme: 'light' | 'dark') => {
      editor.updateOptions({ theme: monacoTheme(theme) });
    },
    onDidChange: (cb: () => void) => {
      editor.onDidChangeModelContent(() => cb());
    },
  };
}

function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

type PreviewTheme = {
  bg: string;
  text: string;
  border: string;
  muted: string;
  error: string;
};

const PREVIEW_THEMES: Record<'light' | 'dark', PreviewTheme> = {
  light: { bg: '#ffffff', text: '#111827', border: '#d1d5db', muted: '#4b5563', error: '#b91c1c' },
  dark: { bg: '#1a1a2e', text: '#e5e7eb', border: '#374151', muted: '#9ca3af', error: '#f87171' },
};

function buildSrcdoc(
  jsCode: string,
  moduleBaseUrl: string,
  theme: 'light' | 'dark',
  compileError?: string,
): string {
  const encoded = encodeBase64(jsCode);
  const moduleBaseLiteral = JSON.stringify(moduleBaseUrl);
  const compileErrorLiteral = JSON.stringify(compileError ?? '');
  const t = PREVIEW_THEMES[theme];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { font-family: system-ui, sans-serif; }
      body { margin: 0; padding: 12px; background: ${t.bg}; color: ${t.text}; }
      #root { min-height: 120px; }
      .live-card { border: 1px solid ${t.border}; border-radius: 8px; padding: 12px; max-width: 420px; }
      .live-card h3 { margin: 0 0 8px; font-size: 1rem; }
      .live-card p { margin: 0; color: ${t.muted}; }
      .controls { display: flex; gap: 8px; margin-top: 8px; }
      button { padding: 4px 12px; border: 1px solid ${t.border}; border-radius: 4px; background: ${t.bg}; color: ${t.text}; cursor: pointer; font: inherit; }
      button:hover { opacity: 0.8; }
      button:disabled { opacity: 0.4; cursor: not-allowed; }
      #error { margin-top: 10px; color: ${t.error}; white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <div id="error"></div>
    <script type="module">
      const errorEl = document.getElementById('error');
      const showError = (err) => {
        const text = err instanceof Error ? err.stack ?? err.message : String(err);
        errorEl.textContent = text;
      };

      window.addEventListener('error', (event) => {
        showError(event.error ?? event.message);
      });

      window.addEventListener('unhandledrejection', (event) => {
        showError(event.reason);
      });

      try {
        const compileError = ${compileErrorLiteral};
        if (compileError) {
          showError(compileError);
          throw new Error('Compilation failed');
        }

        const bytes = Uint8Array.from(atob('${encoded}'), (c) => c.charCodeAt(0));
        const code = new TextDecoder().decode(bytes);
        const rootBase = ${moduleBaseLiteral};
        const resolvedCode = code
          .replaceAll(/from\\s+(['"])[/](?![/])/g, (_, quote) => 'from ' + quote + rootBase + '/')
          .replaceAll(/import\\s*\\(\\s*(['"])[/](?![/])/g, (_, quote) => 'import(' + quote + rootBase + '/');
        const finalizedCode = resolvedCode.replaceAll('/jsx-runtime"', '/jsx-runtime.js"').replaceAll("/jsx-runtime'", "/jsx-runtime.js'");
        const blob = new Blob([finalizedCode], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        await import(url);
        URL.revokeObjectURL(url);
      } catch (err) {
        if (!${compileErrorLiteral}) {
          showError(err);
        }
      }
    </script>
  </body>
</html>`;
}

function formatDiagnostic(diag: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
  if (!diag.file || diag.start == null) {
    return message;
  }

  const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
  return `${diag.file.fileName}:${pos.line + 1}:${pos.character + 1} ${message}`;
}

function transpileEditorCode(
  sourceCode: string,
  mode: DocsCodeMode,
): { outputText: string; compileError?: string } {
  const fileName = mode === 'jsx' ? 'live-example.tsx' : 'live-example.ts';
  const result = ts.transpileModule(sourceCode, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: '/playground/modules/ecs',
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noResolve: true,
      isolatedModules: true,
      allowJs: true,
      noImplicitAny: false,
    },
  });

  const ignoredCodes = new Set<number>([
    2307, // Cannot find module
    2792, // Cannot find module (modern resolver wording)
    7016, // Could not find declaration file for module
  ]);

  const errors = (result.diagnostics ?? []).filter(
    d => d.category === ts.DiagnosticCategory.Error && !ignoredCodes.has(d.code),
  );
  if (errors.length > 0) {
    return {
      outputText: '',
      compileError: errors.map(formatDiagnostic).join('\n'),
    };
  }

  return { outputText: result.outputText };
}

function resolveTheme(doc: Document): 'light' | 'dark' {
  return doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function monacoTheme(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? 'vs-dark' : 'vs';
}

function resolveCurrentMode(win: Window | null): DocsCodeMode {
  const stored = win?.localStorage.getItem(DOCS_CODE_MODE_STORAGE_KEY);
  if (stored === 'jsx' || stored === 'nonjsx') {
    return stored;
  }
  return 'jsx';
}

function resolveExampleCode(example: LiveExample, mode: DocsCodeMode): string {
  if (mode === 'jsx' && example.codeByMode.jsx) {
    return example.codeByMode.jsx;
  }

  if (mode === 'nonjsx' && example.codeByMode.nonjsx) {
    return example.codeByMode.nonjsx;
  }

  return example.codeByMode.nonjsx ?? example.codeByMode.jsx ?? '';
}

function mountLiveEditor(placeholder: HTMLElement, example: LiveExample): void {
  const doc = placeholder.ownerDocument;
  const win = doc.defaultView;
  const moduleBaseUrl = win ? new URL(pathToRoot, win.location.href).href.replace(/\/$/, '') : '';

  const wrapper = doc.createElement('section');
  wrapper.className = 'live-editor';

  const header = doc.createElement('div');
  header.className = 'live-editor-header';

  const title = doc.createElement('strong');
  title.textContent = example.title;

  const modePill = doc.createElement('span');
  modePill.className = 'live-editor-mode';

  const resetButton = doc.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'live-editor-btn live-editor-reset';
  resetButton.textContent = 'Reset';

  const fullscreenButton = doc.createElement('button');
  fullscreenButton.type = 'button';
  fullscreenButton.className = 'live-editor-btn';
  fullscreenButton.textContent = 'Fullscreen';

  header.append(title, modePill, resetButton, fullscreenButton);

  const frame = doc.createElement('iframe');
  frame.className = 'live-editor-frame';
  frame.loading = 'lazy';
  frame.title = `${example.title} preview`;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.referrerPolicy = 'no-referrer';

  const heightRaw = placeholder.dataset.height;
  const height = Number.parseInt(heightRaw ?? '260', 10);
  frame.style.height = `${Number.isFinite(height) ? height : 260}px`;

  let mode = resolveCurrentMode(win);
  let currentTemplate = resolveExampleCode(example, mode);
  let dirty = false;
  modePill.textContent = mode === 'jsx' ? 'Mode: JSX' : 'Mode: Non-JSX';

  const preferredEngineRaw = (placeholder.dataset.editor ?? 'monaco').toLowerCase();
  const preferredEngine: EditorEngine = preferredEngineRaw === 'textarea' ? 'textarea' : 'monaco';

  const enginePill = doc.createElement('span');
  enginePill.className = 'live-editor-mode';
  enginePill.textContent = preferredEngine === 'monaco' ? 'Editor: Monaco' : 'Editor: Textarea';
  header.insertBefore(enginePill, resetButton);

  const body = doc.createElement('div');
  body.className = 'live-editor-body';

  const editorHost = doc.createElement('div');
  editorHost.className = 'live-editor-editor-host';

  const splitter = doc.createElement('div');
  splitter.className = 'live-editor-splitter';

  // Drag-to-resize splitter (vertical in normal mode, horizontal in fullscreen)
  if (win) {
    let dragging = false;
    let startPos = 0;
    let startEditorSize = 0;
    let startFrameSize = 0;

    splitter.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      dragging = true;
      splitter.classList.add('active');
      // Block the iframe from stealing mouse events during drag
      frame.style.pointerEvents = 'none';
      if (isFullscreen) {
        startPos = e.clientX;
        startEditorSize = editorHost.offsetWidth;
        startFrameSize = frame.offsetWidth;
      } else {
        startPos = e.clientY;
        startEditorSize = editorHost.offsetHeight;
        startFrameSize = frame.offsetHeight;
      }
    });

    win.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      e.preventDefault();
      if (isFullscreen) {
        const dx = e.clientX - startPos;
        const newEditor = Math.max(200, startEditorSize + dx);
        const newFrame = Math.max(200, startFrameSize - dx);
        editorHost.style.width = `${newEditor}px`;
        editorHost.style.flex = 'none';
        frame.style.width = `${newFrame}px`;
        frame.style.flex = 'none';
      } else {
        const dy = e.clientY - startPos;
        const newEditorH = Math.max(80, startEditorSize + dy);
        const newFrameH = Math.max(60, startFrameSize - dy);
        editorHost.style.height = `${newEditorH}px`;
        frame.style.height = `${newFrameH}px`;
      }
    });

    win.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('active');
      frame.style.pointerEvents = '';
    });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let editorHandle: EditorHandle | null = null;
  let currentTheme = resolveTheme(doc);

  const render = () => {
    if (!editorHandle) return;
    const transpiled = transpileEditorCode(editorHandle.getValue(), mode);
    frame.srcdoc = buildSrcdoc(
      transpiled.outputText,
      moduleBaseUrl,
      currentTheme,
      transpiled.compileError,
    );
  };

  // Watch for theme changes on <html data-theme>
  const observer = new MutationObserver(() => {
    const newTheme = resolveTheme(doc);
    if (newTheme === currentTheme) return;
    currentTheme = newTheme;
    editorHandle?.setTheme?.(newTheme);
    render();
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const scheduleRender = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(render, 120);
  };

  const bindEditorListeners = () => {
    if (!editorHandle) return;
    editorHandle.onDidChange(() => {
      dirty = editorHandle ? editorHandle.getValue() !== currentTemplate : false;
      scheduleRender();
    });
  };

  const applyMode = (nextMode: DocsCodeMode) => {
    const nextTemplate = resolveExampleCode(example, nextMode);
    if (!nextTemplate) return;

    const shouldReplace = !dirty || editorHandle?.getValue() === currentTemplate;
    mode = nextMode;
    currentTemplate = nextTemplate;
    modePill.textContent = mode === 'jsx' ? 'Mode: JSX' : 'Mode: Non-JSX';
    editorHandle?.setMode?.(mode);

    if (shouldReplace) {
      editorHandle?.setValue(currentTemplate);
      dirty = false;
      render();
    }
  };

  resetButton.addEventListener('click', () => {
    editorHandle?.setValue(currentTemplate);
    dirty = false;
    render();
  });

  let isFullscreen = false;
  let savedEditorH = '';
  let savedFrameH = '';

  fullscreenButton.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    wrapper.classList.toggle('live-editor-fullscreen', isFullscreen);
    fullscreenButton.textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';

    if (isFullscreen) {
      // Save current sizes and clear inline styles so flex takes over
      savedEditorH = editorHost.style.height;
      savedFrameH = frame.style.height;
      editorHost.style.height = '';
      editorHost.style.width = '';
      editorHost.style.flex = '';
      frame.style.height = '';
      frame.style.width = '';
      frame.style.flex = '';
    } else {
      // Restore saved sizes and clear fullscreen inline styles
      editorHost.style.height = savedEditorH || '';
      editorHost.style.width = '';
      editorHost.style.flex = '';
      frame.style.height = savedFrameH || '';
      frame.style.width = '';
      frame.style.flex = '';
    }
  });

  if (win) {
    win.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        fullscreenButton.click();
      }
    });
  }

  if (win) {
    win.addEventListener('storage', event => {
      if (event.key !== DOCS_CODE_MODE_STORAGE_KEY) return;
      if (event.newValue === 'jsx' || event.newValue === 'nonjsx') {
        applyMode(event.newValue);
      }
    });

    win.addEventListener(DOCS_CODE_MODE_EVENT, event => {
      const detail = (event as CustomEvent<{ mode?: DocsCodeMode }>).detail;
      const nextMode = detail?.mode;
      if (nextMode === 'jsx' || nextMode === 'nonjsx') {
        applyMode(nextMode);
      }
    });
  }

  const mountEditor = async () => {
    if (preferredEngine === 'monaco') {
      editorHandle = await createMonacoEditor(doc, currentTemplate, mode);
    }

    if (!editorHandle) {
      editorHandle = createTextareaEditor(doc, currentTemplate);
      enginePill.textContent = 'Editor: Textarea';
    }

    editorHost.append(editorHandle.element);
    bindEditorListeners();
    render();
  };

  body.append(editorHost, splitter, frame);
  wrapper.append(header, body);
  placeholder.append(wrapper);
  placeholder.dataset.hydrated = 'true';
  void mountEditor();
}

function hydrateLiveEditors(root: Element): void {
  const placeholders = root.querySelectorAll<HTMLElement>(
    '[data-live-editor]:not([data-hydrated])',
  );

  for (const placeholder of Array.from(placeholders)) {
    const key = placeholder.dataset.example ?? 'manual-button';
    const example = LIVE_EXAMPLES[key];
    if (!example) continue;
    mountLiveEditor(placeholder, example);
  }
}

export const LiveEditorSystem = defineReactiveSystem({
  name: 'LiveEditorSystem',
  query: Entities.with([HtmlContent]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydrateLiveEditors(el);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydrateLiveEditors(el);
    }
  },
});
