import crypto from "node:crypto";
import JSZip from "jszip";
import type { ExportBundle } from "@/lib/export-body";
import { escapeXml } from "@/lib/export-shared";

export async function buildEpubBuffer(bundle: ExportBundle): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const title = escapeXml(bundle.storyTitle);
  const author = escapeXml(bundle.authorName);
  const uid = crypto.randomUUID();

  const oebps = zip.folder("OEBPS")!;

  const chapters: { id: string; href: string; title: string }[] = [];
  const ordered =
    bundle.ordered.length > 0
      ? bundle.ordered
      : [
          {
            id: "_placeholder",
            parent_id: null,
            title: "正文",
            type: "chapter",
            sort_order: 0,
            content: bundle.summary.trim() || "（请在创作工作台维护章节大纲与正文要点。）",
          },
        ];

  ordered.forEach((n, i) => {
    const href = `chapter-${String(i + 1).padStart(4, "0")}.xhtml`;
    const id = `chap${i + 1}`;
    chapters.push({ id, href, title: n.title });
    const raw = (n.content ?? "").trim() || "（暂无正文）";
    const paras = raw.split(/\n\s*\n/).flatMap((block) => {
      const lines = block.split(/\n/).filter(Boolean);
      return lines.length ? [`<p>${escapeXml(lines.join(""))}</p>`] : [];
    });
    const bodyParas = paras.length ? paras.join("") : `<p>${escapeXml(raw)}</p>`;
    const typeNote =
      n.type !== "chapter" ? `<p class="meta"><em>[${escapeXml(n.type)}]</em></p>` : "";
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><meta charset="UTF-8"/><title>${escapeXml(n.title)}</title></head>
<body><section epub:type="chapter"><h2>${escapeXml(n.title)}</h2>${typeNote}${bodyParas}</section></body></html>`;
    oebps.file(href, xhtml);
  });

  if (bundle.branches?.length) {
    const href = "branch-appendix.xhtml";
    const id = "branchapp";
    const branchParas = bundle.branches
      .map((b) => {
        const tag = b.branchStatus === "archived" ? "（已归档）" : "";
        return `<p><strong>[分支: ${escapeXml(b.branchTitle)}]</strong>${escapeXml(tag)} 大纲锚点：「${escapeXml(b.forkNodeTitle)}」</p>`;
      })
      .join("");
    const bx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head><meta charset="UTF-8"/><title>分支记录</title></head>
<body><section epub:type="appendix"><h2>分支记录</h2>${branchParas}</section></body></html>`;
    oebps.file(href, bx);
    chapters.push({ id, href, title: "分支记录" });
  }

  const coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><meta charset="UTF-8"/><title>Cover</title>
<style type="text/css">
 html,body{height:100%;margin:0;background:#eef6ff;}
 main{display:flex;height:100%;flex-direction:column;justify-content:center;align-items:center;font-family:serif;}
 h1{color:#1f2a44;font-size:1.75rem;margin:0 1.5rem;text-align:center;}
 p{color:#5b6b8c;margin-top:1rem;font-size:1rem;}
</style></head><body><main><h1>${title}</h1><p>${author}</p></main></body></html>`;
  oebps.file("cover.xhtml", coverHtml);

  const navLinks = chapters
    .map((c) => `<li><a href="${c.href}">${escapeXml(c.title)}</a></li>`)
    .join("");
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><meta charset="UTF-8"/><title>目录</title></head>
<body><nav epub:type="toc" id="toc"><h1>目录</h1><ol>${navLinks}</ol></nav></body></html>`;
  oebps.file("nav.xhtml", nav);

  const manifestItems = [
    `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...chapters.map(
      (c) =>
        `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`,
    ),
  ].join("\n    ");

  const spineRefs = [`<itemref idref="cover"/>`, ...chapters.map((c) => `<itemref idref="${c.id}"/>`)].join(
    "\n    ",
  );

  const packageOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uid}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineRefs}
  </spine>
</package>`;
  oebps.file("package.opf", packageOpf);

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return Buffer.from(buf);
}
