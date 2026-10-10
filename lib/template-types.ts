import { z } from "zod";
export const MAX_TEMPLATE_TEXT = 30000;
export const MAX_TEMPLATES = 30;
export const formTemplateSchema = z.object({
  id: z.string().min(1).max(160), name: z.string().min(1).max(255),
  url: z.string().max(600).refine(value => !value || /^https:\/\/(drive|docs)\.google\.com\//.test(value)),
  content: z.string().trim().min(1).max(MAX_TEMPLATE_TEXT)
});
export type FormTemplate = z.infer<typeof formTemplateSchema>;
export const templateRecordSchema = formTemplateSchema.extend({
  source: z.enum(["drive", "manual"]), task: z.enum(["lesson", "worksheet", "exercises", "assessment", "rubric", "activities"]).nullable(),
  subject: z.string().max(100), level: z.string().max(100), updatedAt: z.string().datetime(), modifiedTime: z.string().max(100).optional()
});
export type TemplateRecord = z.infer<typeof templateRecordSchema>;
export type TemplatePreferences = Record<string,string>;
