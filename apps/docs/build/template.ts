import type { NavItem, FlatNavItem } from './generate-nav.ts';

type PageData = {
  title: string;
  description?: string;
  slug: string;
  html: string;
  navTree: NavItem[];
  flatNav: FlatNavItem[];
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
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.title)} — ECS UI Framework</title>
  ${data.description ? `<meta name="description" content="${escapeHtml(data.description)}" />` : ''}
  <link rel="stylesheet" href="/base.css" />
</head>
<body>
  <div id="root"></div>
  <script type="application/json" id="page-data">${pageDataJson}</script>
  <script type="module" src="/app.js"></script>
</body>
</html>`;
}
