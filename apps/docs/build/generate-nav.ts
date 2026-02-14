import type { CompiledPage } from "./compile-mdx.ts";

export type NavItem = {
  title: string;
  slug: string;
  order: number;
  group?: string;
  children?: NavItem[];
};

export type FlatNavItem = {
  title: string;
  slug: string;
  group?: string;
};

const GROUP_ORDER: Record<string, number> = {
  root: 0,
  overview: 1,
  guides: 2,
  repo: 3,
  examples: 4,
  api: 5,
};

const GROUP_LABELS: Record<string, string> = {
  overview: "Overview",
  guides: "Guides",
  repo: "Repository",
  examples: "Examples",
  api: "API Reference",
};

export function buildNavTree(pages: CompiledPage[]): NavItem[] {
  const groups = new Map<string, NavItem[]>();

  for (const page of pages) {
    if (page.frontmatter.nav === false) {
      continue;
    }

    const parts = page.slug.split("/");
    const group = parts.length > 1 ? parts[0]! : "root";
    const item: NavItem = {
      title: page.frontmatter.title,
      slug: page.slug,
      order: page.frontmatter.order ?? 999,
      group,
    };

    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }

  // Sort items within each group by order
  for (const items of groups.values()) {
    items.sort((a, b) => a.order - b.order);
  }

  // Build tree: root items first, then grouped items
  const tree: NavItem[] = [];

  // Add root items directly
  const rootItems = groups.get("root") ?? [];
  tree.push(...rootItems);

  // Add groups as parent nodes
  const sortedGroups = [...groups.entries()]
    .filter(([g]) => g !== "root")
    .sort(([a], [b]) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99));

  for (const [group, children] of sortedGroups) {
    tree.push({
      title: GROUP_LABELS[group] ?? group,
      slug: "",
      order: GROUP_ORDER[group] ?? 99,
      group,
      children,
    });
  }

  return tree;
}

export function flattenNav(tree: NavItem[]): FlatNavItem[] {
  const flat: FlatNavItem[] = [];

  for (const item of tree) {
    if (item.children) {
      for (const child of item.children) {
        flat.push({ title: child.title, slug: child.slug, group: item.group });
      }
    } else if (item.slug) {
      flat.push({ title: item.title, slug: item.slug });
    }
  }

  return flat;
}
