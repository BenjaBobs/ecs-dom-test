// @minimap summary: Builds and queries the local SQLite minimap index for TypeScript and MDX files using curated metadata by default and optional deep-text search.
// @minimap tags: minimap search index sqlite metadata docs tooling deep-search

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Command = 'help' | 'index' | 'search' | 'validate';
type FileKind = 'build' | 'component' | 'doc' | 'source' | 'system' | 'test';
type SearchField =
  | 'path'
  | 'workspace'
  | 'kind'
  | 'summary'
  | 'tags'
  | 'exports'
  | 'title'
  | 'excerpt'
  | 'lineCount'
  | 'score';
type SearchRow = {
  workspace: string;
  path: string;
  kind: string;
  summary: string;
  tags: string;
  exports: string;
  title: string;
  excerpt: string;
  lineCount: string;
  score: string;
};
type SearchOptions = {
  query: string;
  select: SearchField[];
  limit: number;
  excludeKinds: Set<FileKind>;
  includeText: boolean;
};

type MinimapComment = {
  summary: string;
  tags: string[];
};

type MinimapFrontmatter = {
  title: string;
  description: string;
  minimapSummary: string;
  minimapTags: string[];
};

type MinimapEntry = {
  path: string;
  workspace: string;
  kind: FileKind;
  summary: string;
  tags: string[];
  exports: string[];
  title: string;
  text: string;
  lineCount: number;
  mtimeMs: number;
  validationMode: 'strict' | 'derived';
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const MINIMAP_DIR = join(ROOT, '.minimap');
const DB_PATH = join(MINIMAP_DIR, 'minimap.sqlite');
const SOURCE_DIRS = ['apps', 'packages'];
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.vite',
  '.idea',
  '.git',
  '.next',
  'coverage',
]);
const EXCLUDED_FILES = new Set(['vite.config.ts', 'vitest.config.ts']);
const SUMMARY_PREFIX = '// @minimap summary:';
const TAGS_PREFIX = '// @minimap tags:';
const MDX_SUMMARY_KEY = 'minimapSummary';
const MDX_TAGS_KEY = 'minimapTags';
const MDX_TITLE_KEY = 'title';
const MDX_DESCRIPTION_KEY = 'description';
const DEFAULT_SELECT: SearchField[] = ['path', 'summary', 'tags', 'exports'];
const ALL_SELECT_FIELDS: SearchField[] = [
  'path',
  'workspace',
  'kind',
  'summary',
  'tags',
  'exports',
  'title',
  'excerpt',
  'lineCount',
  'score',
];

const [, , rawCommand, ...rawArgs] = process.argv;
const command = normalizeCommand(rawCommand);

if (!command) {
  printHelp();
  process.exit(1);
}

switch (command) {
  case 'help':
    printHelp();
    break;
  case 'index':
    runIndex();
    break;
  case 'search':
    runSearch(rawArgs);
    break;
  case 'validate':
    runValidate();
    break;
}

function normalizeCommand(value: string | undefined): Command | undefined {
  if (!value) return 'help';
  if (value === 'help' || value === '--help' || value === '-h') return 'help';
  if (value === 'index' || value === 'search' || value === 'validate') return value;
  return undefined;
}

function printHelp() {
  console.log('Usage: node --experimental-strip-types scripts/minimap.ts <command> [args]');
  console.log('');
  console.log('Commands:');
  console.log('  index                 Scan source/docs files and write .minimap/minimap.sqlite');
  console.log('  search <query...>     Search minimap metadata by default');
  console.log(
    '                        Flags: --select path,summary,tags --limit 5 --include-kind test --include-text',
  );
  console.log('  validate              Fail if required minimap metadata is missing');
}

function runIndex() {
  const entries = buildEntries();
  writeSqliteIndex(entries);
  console.log(`Indexed ${entries.length} file(s) into ${relative(ROOT, DB_PATH)}`);
}

function runSearch(args: string[]) {
  const options = parseSearchArgs(args);
  if (!options.query) {
    console.error('Usage: node --experimental-strip-types scripts/minimap.ts search <query...>');
    process.exit(1);
  }

  ensureFreshIndex();
  const sqlQuery = toFtsQuery(options.query);
  const rows = runSqliteSearch(sqlQuery, options);

  if (rows.length === 0) {
    console.log('No matches found.');
    return;
  }

  for (const row of rows) {
    printSearchRow(row, options.select);
  }
}

function runValidate() {
  const entries = buildEntries();
  const issues = entries.flatMap(entry => {
    const missing = [
      entry.summary.trim() === '' ? 'summary' : undefined,
      entry.tags.length === 0 ? 'tags' : undefined,
    ].filter(Boolean);

    if (missing.length === 0) {
      return [];
    }

    if (entry.validationMode === 'derived') {
      return [];
    }

    return [`${entry.workspace}/${entry.path}: missing ${missing.join(', ')}`];
  });

  if (issues.length === 0) {
    console.log(`Validated ${entries.length} file(s): OK`);
    return;
  }

  console.error(`Found ${issues.length} minimap issue(s):`);
  for (const issue of issues) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}

function buildEntries(): MinimapEntry[] {
  const entries = SOURCE_DIRS.flatMap(dir => collectEntries(join(ROOT, dir)));
  entries.sort((left, right) => {
    const workspaceCompare = left.workspace.localeCompare(right.workspace);
    if (workspaceCompare !== 0) return workspaceCompare;
    return left.path.localeCompare(right.path);
  });
  return entries;
}

function collectEntries(sourceDir: string): MinimapEntry[] {
  if (!existsSync(sourceDir)) {
    return [];
  }

  const entries: MinimapEntry[] = [];
  for (const fullPath of walkFiles(sourceDir)) {
    if (!isIndexedFile(fullPath)) continue;
    const workspace = getWorkspaceName(fullPath);
    if (!workspace) continue;
    entries.push(buildEntry(fullPath, workspace));
  }
  return entries;
}

function* walkFiles(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        yield* walkFiles(fullPath);
      }
      continue;
    }

    if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function isIndexedFile(filePath: string): boolean {
  const relativePath = relative(ROOT, filePath);
  const name = filePath.split('/').pop() ?? '';
  if (EXCLUDED_FILES.has(name)) return false;
  if (name.endsWith('.d.ts')) return false;
  if (relativePath.startsWith('apps/docs/content/api/')) return false;
  return name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.mdx');
}

function getWorkspaceName(fullPath: string): string | undefined {
  const relativePath = relative(ROOT, fullPath);
  const [scope, name] = relativePath.split('/');
  if (!scope || !name) return undefined;
  return `${scope}/${name}`;
}

function buildEntry(fullPath: string, workspace: string): MinimapEntry {
  const workspaceRoot = join(ROOT, workspace);
  const relativePath = relative(workspaceRoot, fullPath);
  const content = readFileSync(fullPath, 'utf8');
  const stats = statSync(fullPath);
  const kind = inferKind(relativePath);

  if (fullPath.endsWith('.mdx')) {
    const frontmatter = readMdxFrontmatter(content);
    const summary = frontmatter.minimapSummary || frontmatter.description;
    const tags = frontmatter.minimapTags;
    return {
      path: relativePath,
      workspace,
      kind,
      summary,
      tags,
      exports: [],
      title: frontmatter.title,
      text: normalizeWhitespace(stripMdxFrontmatter(content)),
      lineCount: content.split('\n').length,
      mtimeMs: stats.mtimeMs,
      validationMode: 'strict',
    };
  }

  const minimap = readMinimapComment(content);
  return {
    path: relativePath,
    workspace,
    kind,
    summary: minimap?.summary ?? '',
    tags: minimap?.tags ?? [],
    exports: getExports(relativePath, content),
    title: '',
    text: normalizeWhitespace(stripTopMinimapComment(content)),
    lineCount: content.split('\n').length,
    mtimeMs: stats.mtimeMs,
    validationMode: 'strict',
  };
}

function inferKind(filePath: string): FileKind {
  if (filePath.endsWith('.test.ts')) return 'test';
  if (filePath.endsWith('.mdx')) return 'doc';
  if (filePath.includes('/systems')) return 'system';
  if (filePath.includes('/components')) return 'component';
  if (filePath.includes('/build/')) return 'build';
  return 'source';
}

function readMinimapComment(content: string): MinimapComment | undefined {
  const lines = content.split('\n');
  let summary = '';
  let tags: string[] = [];
  let found = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith(SUMMARY_PREFIX)) {
      summary = trimmed.slice(SUMMARY_PREFIX.length).trim();
      found = true;
      continue;
    }
    if (trimmed.startsWith(TAGS_PREFIX)) {
      tags = trimmed.slice(TAGS_PREFIX.length).trim().split(/\s+/).filter(Boolean);
      found = true;
      continue;
    }
    break;
  }

  return found ? { summary, tags } : undefined;
}

function stripTopMinimapComment(content: string): string {
  const lines = content.split('\n');
  let index = 0;
  while (index < lines.length) {
    const trimmed = (lines[index] ?? '').trim();
    if (trimmed === '') {
      index += 1;
      continue;
    }
    if (trimmed.startsWith('// @minimap ')) {
      index += 1;
      continue;
    }
    break;
  }
  return lines.slice(index).join('\n');
}

function readMdxFrontmatter(content: string): MinimapFrontmatter {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return {
      title: '',
      description: '',
      minimapSummary: '',
      minimapTags: [],
    };
  }

  const frontmatterLines: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line === '---') break;
    frontmatterLines.push(line);
  }

  const values = new Map<string, string>();
  for (const line of frontmatterLines) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1] ?? '';
    const rawValue = match[2] ?? '';
    values.set(key, stripQuotedValue(rawValue));
  }

  return {
    title: values.get(MDX_TITLE_KEY) ?? '',
    description: values.get(MDX_DESCRIPTION_KEY) ?? '',
    minimapSummary: values.get(MDX_SUMMARY_KEY) ?? '',
    minimapTags: splitTags(values.get(MDX_TAGS_KEY) ?? ''),
  };
}

function stripMdxFrontmatter(content: string): string {
  const lines = content.split('\n');
  if (lines[0] !== '---') return content;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return content;
  return lines.slice(endIndex + 1).join('\n');
}

function stripQuotedValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTags(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function getExports(filePath: string, content: string): string[] {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return [];
  }

  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    false,
    scriptKind,
  );
  const exports: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exports.push(element.name.text);
      }
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      if (statement.name) {
        exports.push(statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exports.push(declaration.name.text);
        }
      }
    }
  }

  return exports;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function ensureFreshIndex() {
  const entries = buildEntries();
  if (!existsSync(DB_PATH)) {
    writeSqliteIndex(entries);
    return;
  }

  const dbMtime = statSync(DB_PATH).mtimeMs;
  const stale = entries.some(entry => entry.mtimeMs > dbMtime);
  if (stale) {
    writeSqliteIndex(entries);
  }
}

function writeSqliteIndex(entries: MinimapEntry[]) {
  mkdirSync(MINIMAP_DIR, { recursive: true });
  const tmpDbPath = join(MINIMAP_DIR, `minimap.sqlite.${process.pid}.${Date.now()}.next`);
  rmSync(tmpDbPath, { force: true });

  const statements = [
    `
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    BEGIN;
    CREATE TABLE files (
      path TEXT NOT NULL,
      workspace TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags TEXT NOT NULL,
      exports TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      line_count INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      PRIMARY KEY (workspace, path)
    );
    CREATE VIRTUAL TABLE files_fts USING fts5(
      workspace,
      path,
      kind,
      summary,
      tags,
      exports,
      title,
      content='files',
      content_rowid='rowid',
      tokenize='unicode61'
    );
    CREATE VIRTUAL TABLE files_text_fts USING fts5(
      text,
      content='files',
      content_rowid='rowid',
      tokenize='unicode61'
    );
  `,
  ];

  for (const entry of entries) {
    statements.push(`
        INSERT INTO files (
          path,
          workspace,
          kind,
          summary,
          tags,
          exports,
          title,
          text,
          line_count,
          mtime_ms
        ) VALUES (
          ${sqlValue(entry.path)},
          ${sqlValue(entry.workspace)},
          ${sqlValue(entry.kind)},
          ${sqlValue(entry.summary)},
          ${sqlValue(entry.tags.join(' '))},
          ${sqlValue(entry.exports.join(' '))},
          ${sqlValue(entry.title)},
          ${sqlValue(entry.text)},
          ${entry.lineCount},
          ${Math.trunc(entry.mtimeMs)}
        );
        INSERT INTO files_fts (
          rowid,
          workspace,
          path,
          kind,
          summary,
          tags,
          exports,
          title
        )
        SELECT
          rowid,
          workspace,
          path,
          kind,
          summary,
          tags,
          exports,
          title
        FROM files
        WHERE workspace = ${sqlValue(entry.workspace)} AND path = ${sqlValue(entry.path)};
        INSERT INTO files_text_fts (
          rowid,
          text
        )
        SELECT
          rowid,
          text
        FROM files
        WHERE workspace = ${sqlValue(entry.workspace)} AND path = ${sqlValue(entry.path)};
    `);
  }

  statements.push('COMMIT;');
  execSqlInput(tmpDbPath, statements.join('\n'));

  const integrity = execSql(tmpDbPath, 'PRAGMA integrity_check;').trim();
  if (integrity !== 'ok') {
    rmSync(tmpDbPath, { force: true });
    throw new Error(`Minimap SQLite integrity check failed: ${integrity}`);
  }

  rmSync(DB_PATH, { force: true });
  renameSync(tmpDbPath, DB_PATH);
}

function runSqliteSearch(
  query: string,
  options: SearchOptions,
): Array<{
  workspace: string;
  path: string;
  kind: string;
  summary: string;
  tags: string;
  exports: string;
  title: string;
  excerpt: string;
  lineCount: string;
  score: string;
}> {
  const limit = Math.max(1, options.limit);
  const kindClauses = [...options.excludeKinds].map(kind => `files.kind != ${sqlValue(kind)}`);
  const kindRankSql = `
    CASE files.kind
      WHEN 'source' THEN 0
      WHEN 'component' THEN 1
      WHEN 'system' THEN 2
      WHEN 'doc' THEN 3
      WHEN 'build' THEN 4
      WHEN 'test' THEN 5
      ELSE 6
    END
  `;
  const baseWhereClauses = [...kindClauses];
  const fromTable = options.includeText ? 'files_text_fts' : 'files_fts';
  const matchClause = `${fromTable} MATCH ${sqlValue(query)}`;
  const whereClauses = [matchClause, ...baseWhereClauses];
  const snippetSql = options.includeText
    ? `snippet(files_text_fts, 0, '[', ']', '...', 16)`
    : `snippet(files_fts, 3, '[', ']', '...', 16)`;
  const bm25Sql = options.includeText
    ? `bm25(files_text_fts, 0.2)`
    : `bm25(files_fts, 1.5, 1.2, 1.0, 5.0, 4.5, 2.5, 2.0)`;
  const sql = `
    SELECT
      files.workspace,
      files.path,
      files.kind,
      files.summary,
      files.tags,
      files.exports,
      files.title,
      ${snippetSql} AS excerpt,
      files.line_count,
      printf('%.3f', ${bm25Sql}) AS score
    FROM ${fromTable}
    JOIN files ON files.rowid = ${fromTable}.rowid
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${kindRankSql}, ${bm25Sql}
    LIMIT ${limit};
  `;

  const output = execSql(DB_PATH, sql, ['-separator', '\t']).trim();
  if (output === '') {
    return [];
  }

  return output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const values = line.split('\t');
      return {
        workspace: values[0] ?? '',
        path: values[1] ?? '',
        kind: values[2] ?? '',
        summary: values[3] ?? '',
        tags: values[4] ?? '',
        exports: values[5] ?? '',
        title: values[6] ?? '',
        excerpt: values[7] ?? '',
        lineCount: values[8] ?? '',
        score: values[9] ?? '',
      };
    });
}

function parseSearchArgs(args: string[]): SearchOptions {
  const select = [...DEFAULT_SELECT];
  let limit = 20;
  const excludeKinds = new Set<FileKind>(['test']);
  let includeText = false;
  const queryParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--select') {
      const rawValue = args[index + 1] ?? '';
      if (rawValue) {
        const parsed = rawValue
          .split(',')
          .map(field => field.trim())
          .filter(isSearchField);
        if (parsed.length > 0) {
          select.splice(0, select.length, ...parsed);
        }
        index += 1;
      }
      continue;
    }

    if (arg === '--limit') {
      const rawValue = args[index + 1] ?? '';
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === '--include-kind') {
      const rawValue = args[index + 1] ?? '';
      const kinds = rawValue
        .split(',')
        .map(kind => kind.trim())
        .filter(isFileKind);
      for (const kind of kinds) {
        excludeKinds.delete(kind);
      }
      index += 1;
      continue;
    }

    if (arg === '--exclude-kind') {
      const rawValue = args[index + 1] ?? '';
      const kinds = rawValue
        .split(',')
        .map(kind => kind.trim())
        .filter(isFileKind);
      for (const kind of kinds) {
        excludeKinds.add(kind);
      }
      index += 1;
      continue;
    }

    if (arg === '--include-text') {
      includeText = true;
      continue;
    }

    queryParts.push(arg);
  }

  return {
    query: queryParts.join(' ').trim(),
    select,
    limit,
    excludeKinds,
    includeText,
  };
}

function isSearchField(value: string): value is SearchField {
  return ALL_SELECT_FIELDS.includes(value as SearchField);
}

function isFileKind(value: string): value is FileKind {
  return ['build', 'component', 'doc', 'source', 'system', 'test'].includes(value);
}

function printSearchRow(row: SearchRow, fields: SearchField[]) {
  const header = row.workspace ? `${row.workspace}/${row.path}` : row.path;
  console.log(header);

  for (const field of fields) {
    if (field === 'path') continue;

    const value = formatSearchField(field, row);
    if (value === '') continue;
    console.log(`  ${labelForField(field)}: ${value}`);
  }

  console.log();
}

function formatSearchField(field: SearchField, row: SearchRow): string {
  switch (field) {
    case 'path':
      return `${row.workspace}/${row.path}`;
    case 'workspace':
      return row.workspace;
    case 'kind':
      return row.kind;
    case 'summary':
      return row.summary || '(missing)';
    case 'tags':
      return row.tags || '(missing)';
    case 'exports':
      return row.exports;
    case 'title':
      return row.title;
    case 'excerpt':
      return row.excerpt;
    case 'lineCount':
      return row.lineCount;
    case 'score':
      return row.score;
  }
}

function labelForField(field: SearchField): string {
  switch (field) {
    case 'path':
      return 'Path';
    case 'workspace':
      return 'Workspace';
    case 'kind':
      return 'Kind';
    case 'summary':
      return 'Summary';
    case 'tags':
      return 'Tags';
    case 'exports':
      return 'Exports';
    case 'title':
      return 'Title';
    case 'excerpt':
      return 'Excerpt';
    case 'lineCount':
      return 'Lines';
    case 'score':
      return 'Score';
  }
}

function toFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(token => `${escapeFtsToken(token)}*`)
    .join(' ');
}

function escapeFtsToken(token: string): string {
  return token.replace(/"/g, '""');
}

function sqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function execSql(dbPath: string, sql: string, extraArgs: string[] = []): string {
  return execFileSync('sqlite3', [dbPath, ...extraArgs, sql], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function execSqlInput(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', [dbPath], {
    cwd: ROOT,
    encoding: 'utf8',
    input: sql,
  });
}
