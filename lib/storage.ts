import { requestSchema, resultSchema } from "./optimizer";
import type { HistoryEntry } from "./config";
export const HISTORY_KEY = "prompt-giao-vien.history.v1";
export function serializeHistory(entries: HistoryEntry[]): string {
  return JSON.stringify(entries.slice(0, 20).map(({ id, createdAt, draft, provider, model, result }) => ({
    id, createdAt, draft: {
      task: draft.task, originalPrompt: draft.originalPrompt, fields: draft.fields, math: draft.math,
      sourceNotes: draft.sourceNotes, templateNotes: draft.templateNotes, fileNames: draft.fileNames,
      ...(draft.formTemplate ? { formTemplate: { id: draft.formTemplate.id, name: draft.formTemplate.name, url: draft.formTemplate.url, content: draft.formTemplate.content } } : {})
    }, provider, model, result
  })));
}
export function deserializeHistory(raw: string | null): HistoryEntry[] {
  try {
    const list: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(list)) return [];
    return list.slice(0, 20).flatMap(entry => {
      if (!entry || typeof entry.id !== "string" || typeof entry.createdAt !== "string" || Number.isNaN(Date.parse(entry.createdAt))) return [];
      const input = requestSchema.safeParse({ provider: entry.provider, model: entry.model, draft: entry.draft, answers: [] });
      const output = resultSchema.safeParse(entry.result);
      if (!input.success || !output.success || output.data.status !== "ready") return [];
      return [{ id: entry.id, createdAt: entry.createdAt, draft: input.data.draft, provider: input.data.provider, model: input.data.model, result: output.data }];
    });
  } catch { return []; }
}
