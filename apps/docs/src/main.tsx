import {
  Classes,
  Clickable,
  createDebugUI,
  DOMElement,
  registerDebugUISystems,
  registerDOMSystems,
  TextContent,
} from '@ecs-test/dom';
import { Entity, materialize, World } from '@ecs-test/ecs';
import type { FlatNavItem, NavItem } from '../build/generate-nav.ts';
import {
  BottomNavData,
  HtmlContent,
  NavItemData,
  type SearchEntry,
  SearchIndex,
  SearchInput,
  SearchQuery,
  SearchResults,
  ThemeState,
  ThemeToggle,
} from './components.ts';
import { BottomNavSystem } from './systems/bottom-nav-system.ts';
import { ContentSystem } from './systems/content-system.ts';
import {
  SearchFilterSystem,
  SearchInputSystem,
  SearchResultRenderSystem,
} from './systems/search-system.ts';
import { SidebarSystem } from './systems/sidebar-system.ts';
import { ThemeApplySystem, ThemeToggleClickSystem } from './systems/theme-system.ts';

type PageData = {
  title: string;
  description: string;
  slug: string;
  contentHtml: string;
  navTree: NavItem[];
  flatNav: FlatNavItem[];
};

type DocsDeps = {
  doc: Document;
};

function parsePageData(doc: Document): PageData {
  const el = doc.getElementById('page-data');
  if (!el?.textContent) {
    throw new Error('Missing #page-data JSON script. Run docs build first.');
  }

  return JSON.parse(el.textContent) as PageData;
}

function resolveThemeMode(win: Window): 'light' | 'dark' {
  const storageValue = win.localStorage.getItem('docs-theme');
  if (storageValue === 'light' || storageValue === 'dark') {
    return storageValue;
  }

  return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getPrevNext(
  flatNav: FlatNavItem[],
  activeSlug: string,
): { prev?: { title: string; slug: string }; next?: { title: string; slug: string } } {
  const idx = flatNav.findIndex(item => item.slug === activeSlug);
  if (idx < 0) return {};

  const prevItem = idx > 0 ? flatNav[idx - 1] : undefined;
  const nextItem = idx < flatNav.length - 1 ? flatNav[idx + 1] : undefined;

  return {
    prev: prevItem ? { title: prevItem.title, slug: prevItem.slug } : undefined,
    next: nextItem ? { title: nextItem.title, slug: nextItem.slug } : undefined,
  };
}

function navItemEntities(navTree: NavItem[], activeSlug: string) {
  return navTree.map(item => {
    if (item.children?.length) {
      return (
        <Entity>
          <DOMElement tag="li" />
          <Classes list={['sidebar-group']} />

          <Entity>
            <DOMElement tag="span" />
            <Classes list={['sidebar-group-title']} />
            <TextContent value={item.title} />
          </Entity>

          <Entity>
            <DOMElement tag="ul" />
            {item.children.map(child => (
              <Entity>
                <DOMElement tag="li" />
                <Entity>
                  <DOMElement tag="a" />
                  <NavItemData
                    title={child.title}
                    slug={child.slug}
                    isActive={child.slug === activeSlug}
                  />
                </Entity>
              </Entity>
            ))}
          </Entity>
        </Entity>
      );
    }

    return (
      <Entity>
        <DOMElement tag="li" />
        <Entity>
          <DOMElement tag="a" />
          <NavItemData title={item.title} slug={item.slug} isActive={item.slug === activeSlug} />
        </Entity>
      </Entity>
    );
  });
}

export async function startDocsApp({ doc }: DocsDeps): Promise<void> {
  const pageData = parsePageData(doc);

  const container = doc.getElementById('root');
  if (!container) {
    throw new Error('Failed to mount docs app: missing #root container');
  }

  const win = doc.defaultView;
  if (!win) {
    throw new Error('Failed to mount docs app: missing window');
  }

  const world = new World({
    externals: {
      createElement: doc.createElement.bind(doc),
      rootContainer: container,
      window: win,
      console,
    },
  });

  registerDOMSystems(world);
  registerDebugUISystems(world);

  world.registerSystem(ContentSystem);
  world.registerSystem(SidebarSystem);
  world.registerSystem(BottomNavSystem);
  world.registerSystem(ThemeApplySystem);
  world.registerSystem(ThemeToggleClickSystem);
  world.registerSystem(SearchInputSystem);
  world.registerSystem(SearchFilterSystem);
  world.registerSystem(SearchResultRenderSystem);

  const nav = getPrevNext(pageData.flatNav, pageData.slug);
  const mode = resolveThemeMode(win);

  const ui = (
    <Entity>
      <DOMElement tag="div" />
      <Classes list={['layout']} />

      <Entity>
        <DOMElement tag="nav" />
        <Classes list={['sidebar']} />

        <Entity>
          <DOMElement tag="div" />
          <Classes list={['sidebar-header']} />

          <Entity>
            <DOMElement tag="span" />
            <Classes list={['sidebar-logo']} />
            <TextContent value="ECS UI Framework" />
          </Entity>
        </Entity>

        <Entity>
          <DOMElement tag="ul" />
          <Classes list={['sidebar-nav']} />
          {navItemEntities(pageData.navTree, pageData.slug)}
        </Entity>
      </Entity>

      <Entity>
        <DOMElement tag="main" />
        <Classes list={['content']} />

        <Entity>
          <DOMElement tag="header" />
          <Classes list={['topbar']} />

          <Entity>
            <DOMElement tag="h1" />
            <Classes list={['page-title']} />
            <TextContent value={pageData.title} />
          </Entity>

          <Entity>
            <DOMElement tag="div" />
            <Classes list={['topbar-controls']} />

            <Entity>
              <DOMElement tag="input" />
              <Classes list={['search-input']} />
              <SearchInput />
              <SearchQuery value="" />
            </Entity>

            <Entity>
              <DOMElement tag="button" />
              <Classes list={['theme-toggle']} />
              <ThemeToggle />
              <Clickable />
              <TextContent value={mode === 'dark' ? 'Light Mode' : 'Dark Mode'} />
            </Entity>
          </Entity>
        </Entity>

        <Entity>
          <DOMElement tag="div" />
          <Classes list={['search-results']} />
          <SearchResults />
        </Entity>

        <Entity>
          <DOMElement tag="article" />
          <Classes list={['prose']} />
          <HtmlContent html={pageData.contentHtml} />
        </Entity>

        <Entity>
          <DOMElement tag="nav" />
          <Classes list={['bottom-nav']} />
          <BottomNavData prev={nav.prev} next={nav.next} />
        </Entity>
      </Entity>

      <Entity>
        <ThemeState mode={mode} />
      </Entity>

      <Entity>
        <SearchIndex entries={[]} />
      </Entity>
    </Entity>
  );

  materialize(world, ui);
  createDebugUI(world);
  world.flush();

  try {
    const response = await win.fetch('/search-index.json');
    if (!response.ok) {
      return;
    }

    const entries = (await response.json()) as SearchEntry[];
    const indexEntities = world.query(SearchIndex);
    if (indexEntities.length === 0) {
      return;
    }

    const indexEntity = indexEntities[0];
    if (!indexEntity) {
      return;
    }

    world.set(indexEntity, SearchIndex({ entries }));
    world.flush();
  } catch {
    // Keep the page usable even if search index fetch fails.
  }
}

// biome-ignore lint/style/noRestrictedGlobals: browser entrypoint
void startDocsApp({ doc: document });
