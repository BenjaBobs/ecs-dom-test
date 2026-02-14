import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import matter from "gray-matter";

export type PageFrontmatter = {
  title: string;
  description?: string;
  order?: number;
  group?: string;
  nav?: boolean;
};

export type CompiledPage = {
  slug: string;
  frontmatter: PageFrontmatter;
  html: string;
};

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypePrettyCode, { theme: "github-dark" })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function compileMdxFile(
  filePath: string,
  slug: string,
): Promise<CompiledPage> {
  const raw = await Bun.file(filePath).text();
  const { data, content } = matter(raw);
  const result = await processor.process(content);

  return {
    slug,
    frontmatter: data as PageFrontmatter,
    html: String(result),
  };
}
