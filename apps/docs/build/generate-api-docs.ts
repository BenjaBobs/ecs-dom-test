import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const DOCS_CONTENT_DIR = resolve(import.meta.dir, '../content');
const API_CONTENT_DIR = resolve(DOCS_CONTENT_DIR, 'api');

const VISIBLE_API_PAGES: Record<
  string,
  { title: string; description: string; order: number; nav: boolean }
> = {
  'README.md': {
    title: 'API Reference',
    description: 'Auto-generated API reference from TypeDoc.',
    order: 1,
    nav: true,
  },
  '@ecs-test/ecs/README.md': {
    title: '@ecs-test/ecs',
    description: 'Core ECS engine API reference.',
    order: 10,
    nav: true,
  },
  '@ecs-test/dom/README.md': {
    title: '@ecs-test/dom',
    description: 'DOM renderer API reference.',
    order: 20,
    nav: true,
  },
  '@ecs-test/forms/README.md': {
    title: '@ecs-test/forms',
    description: 'Form state package API reference.',
    order: 30,
    nav: true,
  },
  '@ecs-test/forms-ui/README.md': {
    title: '@ecs-test/forms-ui',
    description: 'ECS bindings for forms API reference.',
    order: 40,
    nav: true,
  },
  '@ecs-test/ui/README.md': {
    title: '@ecs-test/ui',
    description: 'UI package API reference.',
    order: 50,
    nav: true,
  },
};

function toTitle(relPath: string): string {
  const stem = basename(relPath, '.md');
  if (stem === 'README') {
    const parent = basename(dirname(relPath));
    return parent === '.' ? 'API Reference' : parent;
  }
  return stem.replace(/[-_]/g, ' ');
}

function toFrontmatter(relPath: string): string {
  const meta = VISIBLE_API_PAGES[relPath];
  const title = JSON.stringify(meta?.title ?? toTitle(relPath));
  const description = JSON.stringify(meta?.description ?? `API reference page for ${relPath}.`);
  const order = meta?.order ?? 999;
  const nav = meta?.nav ?? false;

  return `---\ntitle: ${title}\ndescription: ${description}\norder: ${order}\nnav: ${nav}\n---\n\n`;
}

function normalizeHeadingPrefix(markdown: string): string {
  return markdown.replace(/^\*\*Documentation\*\*[\s\S]*?\n#\s+/m, '# ');
}

function normalizeLinks(markdown: string): string {
  return markdown.replace(/\]\(([^)]+\.md(?:#[^)]+)?)\)/g, (_full, rawTarget: string) => {
    const [pathPart, hashPart] = rawTarget.split('#');
    const normalizedMarkdownPath = pathPart.replace(/README\.md$/, 'index.md');
    const htmlTarget = `${normalizedMarkdownPath.replace(/\.md$/, '.html')}${hashPart ? `#${hashPart}` : ''}`;
    return `](${htmlTarget})`;
  });
}

function normalizeMediaMdxLinks(markdown: string): string {
  return markdown.replace(/\]\(_media\/([^)]+)\.mdx\)/g, (_full, name: string) => {
    if (name === 'design-choices') {
      return '](/overview/design-choices.html)';
    }

    if (name === 'roadmap' || name === 'working-set' || name === 'friction-log') {
      return `](/repo/${name}.html)`;
    }

    return `](/repo/${name}.html)`;
  });
}

function normalizeMarkdown(markdown: string): string {
  return normalizeMediaMdxLinks(normalizeLinks(normalizeHeadingPrefix(markdown)));
}

async function listMarkdownFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        files.push(relative(rootDir, full));
      }
    }
  }

  await walk(rootDir);
  return files.sort();
}

function toTargetPath(relPath: string): string {
  if (basename(relPath) === 'README.md') {
    const parentDir = dirname(relPath);
    if (parentDir === '.') {
      return 'index.mdx';
    }
    return `${parentDir}/index.mdx`;
  }
  return relPath.replace(/\.md$/, '.mdx');
}

export async function generateAPIDocs(): Promise<void> {
  const typedocBin = resolve(REPO_ROOT, 'node_modules/.bin/typedoc');

  const tmpOutputDir = await mkdtemp(join(tmpdir(), 'ecs-docs-typedoc-'));
  try {
    const proc = Bun.spawn(
      [
        typedocBin,
        '--plugin',
        'typedoc-plugin-markdown',
        '--entryPointStrategy',
        'packages',
        '--entryPoints',
        'packages/*',
        '--out',
        tmpOutputDir,
      ],
      {
        cwd: REPO_ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
      },
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`TypeDoc generation failed with exit code ${exitCode}`);
    }

    await rm(API_CONTENT_DIR, { recursive: true, force: true });
    await mkdir(API_CONTENT_DIR, { recursive: true });

    const markdownFiles = await listMarkdownFiles(tmpOutputDir);

    for (const relPath of markdownFiles) {
      if (relPath.startsWith('_media/')) {
        continue;
      }

      const sourceFile = resolve(tmpOutputDir, relPath);
      const targetFile = resolve(API_CONTENT_DIR, toTargetPath(relPath));
      const targetDir = dirname(targetFile);

      await mkdir(targetDir, { recursive: true });

      const source = await readFile(sourceFile, 'utf8');
      const body = normalizeMarkdown(source);
      await writeFile(targetFile, `${toFrontmatter(relPath)}${body}`, 'utf8');
    }
  } finally {
    await rm(tmpOutputDir, { recursive: true, force: true });
  }
}
