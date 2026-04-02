// @minimap summary: Renders the static HTML shell for each docs page, embedding page data and wiring the client app entrypoint.
// @minimap tags: docs template html shell page-data render
import type { NavItem, FlatNavItem } from './generate-nav.ts';

type PageData = {
  title: string;
  description?: string;
  slug: string;
  html: string;
  navTree: NavItem[];
  flatNav: FlatNavItem[];
  pathToRoot: string;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPage(data: PageData): string {
  const pageDataJson = JSON.stringify({
    title: data.title,
    slug: data.slug,
    description: data.description ?? '',
    contentHtml: data.html,
    navTree: data.navTree,
    flatNav: data.flatNav,
    pathToRoot: data.pathToRoot,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.title)} — ECS UI Framework</title>
  ${data.description ? `<meta name="description" content="${escapeHtml(data.description)}" />` : ''}
  <link rel="stylesheet" href="${data.pathToRoot}base.css" />
</head>
<body>
  <div id="root"></div>
  <script type="application/json" id="page-data">${pageDataJson}</script>
  <script type="module" src="${data.pathToRoot}app.js"></script>
</body>
</html>`;
}
