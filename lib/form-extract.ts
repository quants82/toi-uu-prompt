import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { MAX_TEMPLATE_TEXT } from "./template-types";
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export class TemplateError extends Error { constructor(public status: number, message: string) { super(message); } }
type XmlNode = Record<string, unknown>;
function nodes(value: unknown): XmlNode[] { return Array.isArray(value) ? value as XmlNode[] : []; }
function inline(value: unknown): string {
  return nodes(value).map(node => Object.entries(node).map(([key,child]) => key === "#text" ? String(child) : key === "w:tab" ? "\t" : key === "w:br" || key === "w:cr" ? "\n" : key === ":@" ? "" : inline(child)).join("")).join("");
}
function blocks(value: unknown): string {
  return nodes(value).map(node => Object.entries(node).map(([key,child]) => {
    if (key === "w:p") return inline(child) + "\n";
    if (key === "w:tr") return nodes(child).flatMap(cell => "w:tc" in cell ? [blocks(cell["w:tc"]).trim()] : []).join(" | ") + "\n";
    if (key === ":@") return "";
    return blocks(child);
  }).join("")).join("");
}
export function validateTemplateText(text: string): string {
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) throw new TemplateError(422,"Không đọc được văn bản. Với PDF quét ảnh, hãy chuyển sang Google Docs hoặc Word có văn bản.");
  if (clean.length > MAX_TEMPLATE_TEXT) throw new TemplateError(413,"Form quá dài (tối đa 30.000 ký tự). Hãy dùng bản mẫu rút gọn.");
  return clean;
}
export async function extractTemplate(bytes: Uint8Array, mime: string): Promise<string> {
  if (bytes.length > MAX_FILE_BYTES) throw new TemplateError(413,"Form vượt quá 3 MB. Hãy dùng bản mẫu gọn hơn.");
  try {
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const files = unzipSync(bytes, {filter: file => {
        if (file.name !== "word/document.xml") return false;
        if (file.originalSize > 2 * 1024 * 1024) throw new TemplateError(413,"Nội dung Word quá lớn.");
        return true;
      }});
      if (!files["word/document.xml"]) throw new TemplateError(422,"Tệp Word không có nội dung hợp lệ.");
      const xml = new TextDecoder("utf-8",{fatal:true}).decode(files["word/document.xml"]);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new TemplateError(422,"Tệp Word chứa cấu trúc XML không được hỗ trợ.");
      return validateTemplateText(blocks(new XMLParser({preserveOrder:true,ignoreAttributes:false,trimValues:false,parseTagValue:false}).parse(xml)));
    }
    if (mime === "application/pdf") {
      const { getData } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      PDFParse.setWorker(getData());
      const parser = new PDFParse({ data: Uint8Array.from(bytes), isEvalSupported:false });
      try {
        const data = await parser.getText({first:20});
        if (data.total > 20) throw new TemplateError(413,"Form PDF vượt quá 20 trang. Hãy dùng bản mẫu rút gọn.");
        return validateTemplateText(data.pages.map(page => page.text).join("\n\n"));
      } finally { await parser.destroy(); }
    }
    if (mime === "text/plain") return validateTemplateText(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    throw new TemplateError(422,"Hỗ trợ Google Docs, Word .docx, PDF có văn bản và .txt. Hãy chuyển tệp .doc sang .docx.");
  } catch (error) {
    if (error instanceof TemplateError) throw error;
    throw new TemplateError(422,"Không đọc được form này. Hãy kiểm tra tệp hoặc chuyển sang Google Docs/Word có văn bản.");
  }
}
