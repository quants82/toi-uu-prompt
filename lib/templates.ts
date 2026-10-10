import type { Draft, TaskId } from "./config";
import { templateRecordSchema, MAX_TEMPLATES, type TemplateRecord, type TemplatePreferences } from "./template-types";
export const TEMPLATE_PREFERENCES_KEY = "prompt-giao-vien.templates.preferences.v1";
export function normalizeLabel(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
export function inferTemplateTask(name: string): TaskId | null {
  const value = " " + normalizeLabel(name) + " ";
  if (/rubric|tieu chi danh gia/.test(value)) return "rubric";
  if (/ma tran|dac ta|de kiem tra|de thi/.test(value)) return "assessment";
  if (/phieu hoc tap| pht |phieu bai tap/.test(value)) return "worksheet";
  if (/bai tap|phan hoa/.test(value)) return "exercises";
  if (/ke hoach bai day|giao an| khbd |khbd/.test(value)) return "lesson";
  if (/slide|hoat dong|powerpoint|trinh chieu/.test(value)) return "activities";
  return null;
}
export function inferTags(name: string): { subject: string; level: string } {
  const value = " " + normalizeLabel(name) + " ";
  const subjects = ["Khoa học tự nhiên", "Hoạt động trải nghiệm", "Giáo dục công dân", "Giáo dục thể chất", "Tiếng Việt", "Tiếng Anh", "Ngữ văn", "Tin học", "Công nghệ", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Âm nhạc", "Mĩ thuật", "Toán"];
  const levels = ["Mầm non", "Tiểu học", "THCS", "THPT"];
  return { subject: subjects.find(subject => value.includes(" " + normalizeLabel(subject) + " ")) || "", level: levels.find(level => value.includes(" " + normalizeLabel(level) + " ")) || "" };
}
export function templateContextKey(draft: Pick<Draft,"task"|"fields">): string { return [draft.task, normalizeLabel(draft.fields.subject || ""), normalizeLabel(draft.fields.level || "")].join("::"); }
export function chooseTemplate(records: TemplateRecord[], draft: Pick<Draft,"task"|"fields">, preferences: TemplatePreferences): TemplateRecord | null {
  const preferred = preferences[templateContextKey(draft)];
  if (preferred === "none") return null;
  if (preferred && preferred !== "auto") { const selected = records.find(record => record.id === preferred); if (selected) return selected; }
  const candidates = records.filter(record => record.task === draft.task).map(record => {
    let score = 100;
    for (const key of ["subject", "level"] as const) {
      const tag = normalizeLabel(record[key]); const context = normalizeLabel(draft.fields[key] || "");
      if (tag && (!context || tag !== context)) return { record, score: -1 };
      if (tag && context) score += 30;
      else if (tag) score -= 8;
    }
    return { record, score };
  }).filter(candidate => candidate.score >= 0).sort((a,b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt) || a.record.id.localeCompare(b.record.id));
  return candidates[0]?.record || null;
}
export function readTemplatePreferences(raw: string | null): TemplatePreferences {
  try { const value: unknown = JSON.parse(raw || "{}"); if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key,val]) => key.length <= 300 && typeof val === "string" && val.length <= 160).slice(0,200));
  } catch { return {}; }
}
export function cleanTemplates(value: unknown): TemplateRecord[] { return Array.isArray(value) ? value.slice(0,MAX_TEMPLATES).flatMap(record => { const parsed = templateRecordSchema.safeParse(record); return parsed.success ? [parsed.data] : []; }) : []; }
