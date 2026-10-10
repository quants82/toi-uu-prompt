import { Document, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph, TextRun, AlignmentType } from "docx";
import { tasks, type Draft } from "./config";

export function createPromptDocument(draft: Draft, prompt: string): Document {
  const task = tasks.find(item => item.id === draft.task)!.label;
  const context = [draft.fields.subject, draft.fields.level, draft.fields.grade, draft.fields.topic].filter(Boolean).join(" · ");
  return new Document({
    creator: "Prompt Giáo Viên", title: "Prompt đã tối ưu — " + task, description: "Prompt dành cho giáo viên",
    styles: { default: { document: { run: { font: "Arial", size: 23, color: "253858" }, paragraph: { spacing: { after: 120, line: 288 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "PROMPT GIÁO VIÊN", size: 18, color: "64748B" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prompt Giáo Viên · Trang ", size: 18, color: "64748B" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "64748B" })] })] }) },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 160 }, children: [new TextRun({ text: "Prompt đã tối ưu", font: "Arial", size: 40, bold: true, color: "2563EB" })] }),
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: task, bold: true, size: 25 })] }),
        ...(context ? [new Paragraph({ spacing: { after: 280 }, children: [new TextRun({ text: context, size: 21, color: "64748B" })] })] : []),
        ...prompt.replace(/\r\n/g, "\n").split("\n").map(line => new Paragraph({ spacing: { after: line ? 100 : 30, line: 288 }, children: [new TextRun({ text: line })] }))
      ]
    }]
  });
}
export async function promptWordBlob(draft: Draft, prompt: string): Promise<Blob> {
  return Packer.toBlob(createPromptDocument(draft, prompt));
}
