import { resolve, relative, dirname } from 'node:path';
import { rm, cp, mkdir } from 'node:fs/promises';
import { Glob } from 'bun';
import { compileMdxFile, type CompiledPage } from './compile-mdx.ts';
import { generateAPIDocs } from './generate-api-docs.ts';
import { buildNavTree, flattenNav } from './generate-nav.ts';
import { renderPage } from './template.ts';

export const DOCS_ROOT = resolve(import.meta.dir, '..');
export const CONTENT_DIR = resolve(DOCS_ROOT, 'content');
export const PUBLIC_DIR = resolve(DOCS_ROOT, 'public');
export const DIST_DIR = resolve(DOCS_ROOT, 'dist');

function fileToSlug(filePath: string): string {
  const rel = relative(CONTENT_DIR, filePath);
  return rel.replace(/\.mdx?$/, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

export async function build() {
  const start = performance.now();
  console.log('Building docs...\n');

  // 1. Clean dist/
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  // 2. Generate API docs
  await generateAPIDocs();
  console.log('Generated API docs');

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

  // 5. Build nav tree
  const navTree = buildNavTree(pages);
  const flatNav = flattenNav(navTree);

  // 6. Bundle client-side ECS app
  await bundleClientApp();
  console.log('Bundled client app');

  // 7. Render HTML pages
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

  // 8. Copy public/ → dist/
  await cp(PUBLIC_DIR, DIST_DIR, { recursive: true });
  console.log('Copied public assets');

  // 9. Generate search index
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
