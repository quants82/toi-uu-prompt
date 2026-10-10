import type { Draft } from "./config";

export function teacherRole(draft: Draft): string {
  if (draft.fields.roleMode === "custom" && draft.fields.role?.trim()) return draft.fields.role.trim();
  const subject = draft.fields.subject?.trim() || "môn học được yêu cầu";
  const level = draft.fields.level?.trim();
  return "Bạn là giáo viên giỏi bộ môn " + subject + (level ? " ở cấp " + level : "") + ", có kinh nghiệm thiết kế hoạt động học tập, phân hóa học sinh và đánh giá năng lực; diễn đạt chính xác, phù hợp với đối tượng học sinh và bám sát tài liệu được cung cấp";
}
