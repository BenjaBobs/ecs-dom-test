import { resolve, relative, dirname, join } from 'node:path';
import { rm, cp, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Glob } from 'bun';
import { compileMdxFile, type CompiledPage } from './compile-mdx.ts';
import { generateAPIDocs } from './generate-api-docs.ts';
import { buildNavTree, flattenNav } from './generate-nav.ts';
import { renderPage } from './template.ts';

export const DOCS_ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(DOCS_ROOT, '../..');
export const CONTENT_DIR = resolve(DOCS_ROOT, 'content');
export const PUBLIC_DIR = resolve(DOCS_ROOT, 'public');
export const DIST_DIR = resolve(DOCS_ROOT, 'dist');

export type BuildOptions = {
  generateApiDocs?: boolean;
};

function fileToSlug(filePath: string): string {
  const rel = relative(CONTENT_DIR, filePath);
  return rel.replace(/\.mdx?$/, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

type LinkIssue = {
  fromSlug: string;
  href: string;
  resolvedCandidates: string[];
};

function extractHrefValues(html: string): string[] {
  const hrefs: string[] = [];
  const hrefRegex = /<a\b[^>]*\bhref=(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null = null;
  while (true) {
    match = hrefRegex.exec(html);
    if (!match) break;
    hrefs.push(match[2]);
  }
  return hrefs;
}

function shouldSkipHref(href: string): boolean {
  return (
    href.length === 0 ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('//')
  );
}

function resolveInternalHrefCandidates(href: string, fromSlug: string): string[] {
  const base = new URL(`https://docs.local/${fromSlug}.html`);
  const resolved = new URL(href, base);
  const path = resolved.pathname;
  const candidates = new Set<string>();

  candidates.add(path === '/' ? '/index.html' : path);

  if (path.endsWith('/')) {
    candidates.add(`${path}index.html`);
  }

  if (!/\.[a-z0-9]+$/i.test(path)) {
    candidates.add(`${path}.html`);
  }

  return Array.from(candidates);
}

function buildKnownRouteSet(pages: CompiledPage[]): Set<string> {
  const known = new Set<string>();

  for (const page of pages) {
    const route = `/${page.slug}.html`;
    known.add(route);

    const noExt = route.replace(/\.html$/, '');
    known.add(noExt);

    if (route.endsWith('/index.html')) {
      known.add(route.slice(0, -'index.html'.length));
    }
  }

  known.add('/index.html');
  known.add('/');

  return known;
}

function validateInternalLinks(pages: CompiledPage[]): LinkIssue[] {
  const knownRoutes = buildKnownRouteSet(pages);
  const issues: LinkIssue[] = [];

  for (const page of pages) {
    const hrefs = extractHrefValues(page.html);
    for (const href of hrefs) {
      if (shouldSkipHref(href)) continue;

      const candidates = resolveInternalHrefCandidates(href, page.slug);
      const hasMatch = candidates.some((candidate) => knownRoutes.has(candidate));
      if (!hasMatch) {
        issues.push({
          fromSlug: page.slug,
          href,
          resolvedCandidates: candidates,
        });
      }
    }
  }

  return issues;
}

async function bundleClientApp(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [resolve(DOCS_ROOT, 'src/main.tsx')],
    outdir: DIST_DIR,
    naming: 'app.js',
    target: 'browser',
    format: 'esm',
    sourcemap: 'external',
    minify: false,
    write: true,
  });

  if (!result.success) {
    throw new AggregateError(result.logs, 'Failed to bundle docs client app');
  }
}

async function bundlePlaygroundModules(): Promise<void> {
  const modulesDist = resolve(DIST_DIR, 'playground/modules');
  await mkdir(modulesDist, { recursive: true });

  const moduleSpecs = [
    { entry: resolve(REPO_ROOT, 'packages/ecs/src/index.ts'), outputName: 'ecs.js' },
    { entry: resolve(REPO_ROOT, 'packages/dom/src/index.ts'), outputName: 'dom.js' },
    { entry: resolve(REPO_ROOT, 'packages/forms/src/index.ts'), outputName: 'forms.js' },
    { entry: resolve(REPO_ROOT, 'packages/forms-ui/src/index.ts'), outputName: 'forms-ui.js' },
  ];

  for (const spec of moduleSpecs) {
    const result = await Bun.build({
      entrypoints: [spec.entry],
      outdir: modulesDist,
      naming: spec.outputName,
      target: 'browser',
      format: 'esm',
      sourcemap: 'external',
      minify: false,
      write: true,
    });

    if (!result.success) {
      throw new AggregateError(result.logs, `Failed to bundle module ${spec.outputName}`);
    }
  }

  // Keep JSX runtime symbols identity-compatible with Entity imported from ecs.js.
  // If jsx-runtime is bundled as a separate entrypoint it can produce distinct function
  // instances, causing JSX trees to materialize without children.
  const jsxRuntimeDist = resolve(modulesDist, 'ecs/jsx-runtime.js');
  await mkdir(dirname(jsxRuntimeDist), { recursive: true });
  await Bun.write(
    jsxRuntimeDist,
    `export { Fragment, jsx, jsxs, jsxDEV } from '/playground/modules/ecs.js';\n`,
  );
}

async function bundlePlaygroundTypes(): Promise<void> {
  const typesDist = resolve(DIST_DIR, 'playground/types');
  await mkdir(typesDist, { recursive: true });

  const tempDir = await mkdtemp(join(tmpdir(), 'ecs-docs-live-types-'));
  const tempTsconfig = resolve(tempDir, 'tsconfig.live-types.json');

  const tsconfig = {
    extends: resolve(REPO_ROOT, 'tsconfig.json'),
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      outDir: typesDist,
      rootDir: REPO_ROOT,
    },
    include: [
      resolve(REPO_ROOT, 'packages/ecs/src/**/*'),
      resolve(REPO_ROOT, 'packages/dom/src/**/*'),
      resolve(REPO_ROOT, 'packages/forms/src/**/*'),
      resolve(REPO_ROOT, 'packages/forms-ui/src/**/*'),
    ],
    exclude: [
      resolve(REPO_ROOT, 'packages/**/*.test.ts'),
      resolve(REPO_ROOT, 'packages/**/*.test.tsx'),
      resolve(REPO_ROOT, 'packages/**/*.spec.ts'),
      resolve(REPO_ROOT, 'packages/**/*.spec.tsx'),
    ],
  };

  await Bun.write(tempTsconfig, JSON.stringify(tsconfig, null, 2));

  try {
    const tscBin = resolve(REPO_ROOT, 'node_modules/.bin/tsc');
    const proc = Bun.spawn([tscBin, '-p', tempTsconfig], {
      cwd: REPO_ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Type declarations generation failed with exit code ${exitCode}`);
    }

    // Include source .d.ts files (module augmentations, ambient declarations) that
    // tsc does not re-emit during declaration-only builds.
    const sourceDtsGlob = new Glob('packages/{ecs,dom,forms,forms-ui}/src/**/*.d.ts');
    for await (const relPath of sourceDtsGlob.scan(REPO_ROOT)) {
      const srcPath = resolve(REPO_ROOT, relPath);
      const outPath = resolve(typesDist, relPath);
      await mkdir(dirname(outPath), { recursive: true });
      await cp(srcPath, outPath);
    }

    const files: string[] = [];
    const glob = new Glob('**/*.d.ts');
    for await (const relPath of glob.scan(typesDist)) {
      files.push(relPath.replaceAll('\\', '/'));
    }
    files.sort();

    await Bun.write(
      resolve(typesDist, 'manifest.json'),
      JSON.stringify({ files }, null, 2),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function build(options: BuildOptions = {}) {
  const start = performance.now();
  console.log('Building docs...\n');
  const generateApiDocsEnabled = options.generateApiDocs ?? true;

  // 1. Clean dist/
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  // 2. Generate API docs
  if (generateApiDocsEnabled) {
    await generateAPIDocs();
    console.log('Generated API docs');
  } else {
    console.log('Skipped API docs generation (dev fast path)');
  }

  // 3. Discover content files
  const glob = new Glob('**/*.{mdx,md}');
  const contentFiles: string[] = [];
  for await (const path of glob.scan(CONTENT_DIR)) {
    contentFiles.push(resolve(CONTENT_DIR, path));
  }

  if (contentFiles.length === 0) {
    console.error('No content files found in', CONTENT_DIR);
    process.exit(1);
  }

  console.log(`Found ${contentFiles.length} content files`);

  // 4. Compile all pages in parallel
  const pages: CompiledPage[] = await Promise.all(
    contentFiles.map((f) => compileMdxFile(f, fileToSlug(f))),
  );

  console.log(`Compiled ${pages.length} pages`);

  // 5.5 Validate internal content links
  const linkIssues = validateInternalLinks(pages);
  if (linkIssues.length > 0) {
    console.error(`Found ${linkIssues.length} broken internal link(s):`);
    for (const issue of linkIssues.slice(0, 50)) {
      console.error(
        `- [${issue.fromSlug}] "${issue.href}" -> ${issue.resolvedCandidates.join(', ')}`,
      );
    }

    if (linkIssues.length > 50) {
      console.error(`...and ${linkIssues.length - 50} more`);
    }

    throw new Error('Docs link validation failed');
  }
  console.log('Validated internal links');

  // 5. Build nav tree
  const navTree = buildNavTree(pages);
  const flatNav = flattenNav(navTree);

  // 6. Bundle client-side ECS app
  await bundleClientApp();
  console.log('Bundled client app');

  // 7. Bundle playground modules used by live editors
  await bundlePlaygroundModules();
  console.log('Bundled playground modules');

  // 8. Emit declaration files for Monaco-powered live editor typings
  await bundlePlaygroundTypes();
  console.log('Bundled playground type declarations');

  // 9. Render HTML pages
  for (const page of pages) {
    const html = renderPage({
      title: page.frontmatter.title,
      description: page.frontmatter.description,
      slug: page.slug,
      html: page.html,
      navTree,
      flatNav,
    });

    const outPath = resolve(DIST_DIR, `${page.slug}.html`);
    await mkdir(dirname(outPath), { recursive: true });
    await Bun.write(outPath, html);
  }

  console.log(`Wrote ${pages.length} HTML pages`);

  // 10. Copy public/ → dist/
  await cp(PUBLIC_DIR, DIST_DIR, { recursive: true });
  console.log('Copied public assets');

  // 11. Generate search index
  const searchIndex = pages.map((p) => ({
    title: p.frontmatter.title,
    slug: p.slug,
    description: p.frontmatter.description ?? '',
    text: stripHtml(p.html).slice(0, 1000),
  }));

  await Bun.write(
    resolve(DIST_DIR, 'search-index.json'),
    JSON.stringify(searchIndex, null, 2),
  );
  console.log('Generated search index');

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`\nDone in ${elapsed}ms`);
}

// Run directly
if (import.meta.main) {
  build().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
