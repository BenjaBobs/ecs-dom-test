// @minimap summary: Defines the shared docs code-mode keys and union type used to synchronize JSX versus non-JSX examples across the docs UI.
// @minimap tags: docs code-mode storage event jsx nonjsx examples
export const DOCS_CODE_MODE_STORAGE_KEY = 'docs-code-mode';
export const DOCS_CODE_MODE_EVENT = 'docs:code-mode-changed';

export type DocsCodeMode = 'jsx' | 'nonjsx';
