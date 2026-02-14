/**
 * CodeTabsSystem — adds synced JSX/non-JSX tabs for marked code example groups.
 */

import { getDOMElement } from '@ecs-test/dom';
import { defineReactiveSystem, Entities } from '@ecs-test/ecs';
import {
  DOCS_CODE_MODE_EVENT,
  DOCS_CODE_MODE_STORAGE_KEY,
  type DocsCodeMode,
} from '../code-mode.ts';
import { HtmlContent } from '../components.ts';

type CodeMode = DocsCodeMode;

function resolveInitialMode(doc: Document): CodeMode {
  const win = doc.defaultView;
  const stored = win?.localStorage.getItem(DOCS_CODE_MODE_STORAGE_KEY);
  if (stored === 'jsx' || stored === 'nonjsx') {
    return stored;
  }
  return 'jsx';
}

function persistMode(doc: Document, mode: CodeMode): void {
  const win = doc.defaultView;
  try {
    win?.localStorage.setItem(DOCS_CODE_MODE_STORAGE_KEY, mode);
    win?.dispatchEvent(
      new CustomEvent(DOCS_CODE_MODE_EVENT, {
        detail: { mode },
      }),
    );
  } catch {
    // ignore storage failures
  }
}

function detectModeForFigure(figure: Element): CodeMode | null {
  const code = figure.querySelector('code[data-language]');
  const language = code?.getAttribute('data-language')?.toLowerCase() ?? '';

  if (language === 'tsx' || language === 'jsx') {
    return 'jsx';
  }

  if (
    language === 'ts' ||
    language === 'js' ||
    language === 'javascript' ||
    language === 'typescript'
  ) {
    return 'nonjsx';
  }

  return null;
}

function applyMode(doc: Document, mode: CodeMode): void {
  doc.documentElement.dataset.codeMode = mode;

  for (const group of Array.from(doc.querySelectorAll('[data-code-tabs]'))) {
    const figures = Array.from(group.querySelectorAll('figure[data-rehype-pretty-code-figure]'));

    for (const figure of figures) {
      const figureMode = detectModeForFigure(figure);
      if (!figureMode) continue;
      (figure as HTMLElement).style.display = figureMode === mode ? '' : 'none';
    }

    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-code-tab-mode]'));
    for (const button of buttons) {
      const active = button.dataset.codeTabMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  persistMode(doc, mode);
}

function initGroup(group: Element, doc: Document): void {
  if (group.getAttribute('data-code-tabs-init') === 'true') {
    return;
  }

  const bar = doc.createElement('div');
  bar.className = 'code-tabs-bar';

  const jsxBtn = doc.createElement('button');
  jsxBtn.type = 'button';
  jsxBtn.className = 'code-tab-btn';
  jsxBtn.textContent = 'JSX';
  jsxBtn.dataset.codeTabMode = 'jsx';

  const nonJsxBtn = doc.createElement('button');
  nonJsxBtn.type = 'button';
  nonJsxBtn.className = 'code-tab-btn';
  nonJsxBtn.textContent = 'Non-JSX';
  nonJsxBtn.dataset.codeTabMode = 'nonjsx';

  const onClick = (mode: CodeMode) => () => applyMode(doc, mode);
  jsxBtn.addEventListener('click', onClick('jsx'));
  nonJsxBtn.addEventListener('click', onClick('nonjsx'));

  bar.append(jsxBtn, nonJsxBtn);
  group.prepend(bar);
  group.setAttribute('data-code-tabs-init', 'true');
}

function hydrateCodeTabs(root: Element): void {
  const doc = root.ownerDocument;
  const groups = Array.from(root.querySelectorAll('[data-code-tabs]'));

  for (const group of groups) {
    initGroup(group, doc);
  }

  applyMode(doc, resolveInitialMode(doc));
}

export const CodeTabsSystem = defineReactiveSystem({
  name: 'CodeTabsSystem',
  query: Entities.with([HtmlContent]),
  onEnter(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydrateCodeTabs(el);
    }
  },
  onUpdate(world, entities) {
    for (const entity of entities) {
      const el = getDOMElement(world, entity);
      if (!el) continue;
      hydrateCodeTabs(el);
    }
  },
});
