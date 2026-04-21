import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { ExportBundle } from "@/lib/export-body";
import { depthOf } from "@/lib/outline-order";

export function buildPdfBuffer(bundle: ExportBundle, fontPath: string | null): Promise<Buffer> {
  const hasFont = Boolean(fontPath && fs.existsSync(fontPath));

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      margin: 56,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: bundle.storyTitle,
        Author: bundle.authorName,
      },
    });

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    try {
      const fontName = hasFont ? "StoryForgeCN" : "Helvetica";
      if (hasFont && fontPath) {
        doc.registerFont(fontName, fontPath);
      }
      doc.font(fontName);

      doc.fontSize(22).fillColor("#1f2a44").text(bundle.storyTitle, { align: "center" });
      doc.moveDown(1.2);
      doc.fontSize(11).fillColor("#333333").text(`作者：${bundle.authorName}`, { align: "center" });
      doc.moveDown();
      if (bundle.summary.trim()) {
        doc.fontSize(10).text(bundle.summary.trim(), { align: "left" });
        doc.moveDown();
      }

      const ordered =
        bundle.ordered.length > 0
          ? bundle.ordered
          : [
              {
                id: "_ph",
                parent_id: null,
                title: "正文",
                type: "chapter",
                sort_order: 0,
                content: bundle.summary.trim() || "（暂无大纲节点）",
              },
            ];

      for (const n of ordered) {
        doc.addPage();
        const depth = bundle.flatNodes.some((x) => x.id === n.id) ? depthOf(bundle.flatNodes, n.id) : 0;
        const titleSize = Math.max(13, 17 - depth);
        doc.font(fontName).fontSize(titleSize).fillColor("#1f2a44").text(n.title, { underline: true });
        if (n.type !== "chapter") {
          doc.moveDown(0.35);
          doc.fontSize(9).fillColor("#5b6b8c").text(`[${n.type}]`);
        }
        doc.moveDown(0.65);
        doc.fontSize(11).fillColor("#222222").text((n.content ?? "").trim() || "（暂无正文）", {
          align: "left",
          paragraphGap: 4,
        });
      }

      if (bundle.branches?.length) {
        doc.addPage();
        doc.font(fontName).fontSize(16).fillColor("#1f2a44").text("分支记录", { underline: true });
        doc.moveDown(0.8);
        doc.fontSize(11).fillColor("#222222");
        for (const b of bundle.branches) {
          const tag = b.branchStatus === "archived" ? "（已归档）" : "";
          doc.text(`[分支: ${b.branchTitle}]${tag} 大纲锚点：「${b.forkNodeTitle}」`, {
            paragraphGap: 4,
          });
          doc.moveDown(0.4);
        }
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.save();
        doc.font(fontName).fontSize(12).fillColor("#1f2a44").text(bundle.storyTitle, 56, 32, {
          width: doc.page.width - 112,
          align: "left",
        });
        doc.font(fontName).fontSize(10).fillColor("#333333").text(`— ${i + 1} —`, 0, doc.page.height - 46, {
          align: "center",
          width: doc.page.width,
        });
        doc.restore();
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
