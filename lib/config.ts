export const tasks = [
  { id: "lesson", label: "Kế hoạch bài dạy", description: "Mục tiêu rõ ràng, hoạt động khả thi, đúng form.", example: "Tối ưu giúp tôi prompt soạn kế hoạch bài dạy về phân số, có hoạt động nhóm và đánh giá cuối tiết.", fields: [{ key: "sequence", label: "Tiến trình / hoạt động mong muốn", placeholder: "Khởi động, khám phá, luyện tập, vận dụng…" }] },
  { id: "worksheet", label: "Phiếu học tập", description: "Nhiệm vụ dễ hiểu, có sản phẩm và hướng dẫn.", example: "Tối ưu prompt tạo phiếu học tập nhóm về bảo vệ môi trường, có hướng dẫn và tiêu chí đánh giá.", fields: [{ key: "organization", label: "Hình thức thực hiện", options: ["Cá nhân", "Cặp đôi", "Nhóm", "Kết hợp"] }, { key: "count", label: "Số nhiệm vụ", placeholder: "Ví dụ: 4 nhiệm vụ" }] },
  { id: "exercises", label: "Bài tập theo mức độ", description: "Phân hóa phù hợp với từng nhóm học sinh.", example: "Tối ưu prompt tạo bài tập phương trình bậc hai theo mức độ, có đáp án và lời giải.", fields: [{ key: "levels", label: "Cách phân mức", options: ["Nhận biết – Thông hiểu – Vận dụng – Vận dụng cao", "Cơ bản – Trung bình – Nâng cao", "Theo nhóm năng lực học sinh"] }, { key: "count", label: "Số câu / phân bố từng mức", placeholder: "Ví dụ: 10 câu, phân bố 3–3–3–1" }, { key: "solutions", label: "Đáp án / lời giải", options: ["Đáp án và lời giải chi tiết", "Chỉ đáp án", "Không cần đáp án"] }] },
  { id: "assessment", label: "Đề kiểm tra & ma trận", description: "Cấu trúc đề, đáp án, thang điểm thống nhất.", example: "Tối ưu prompt tạo đề kiểm tra cuối chủ đề, có ma trận, đáp án và thang điểm 10.", fields: [{ key: "structure", label: "Cấu trúc đề", placeholder: "Trắc nghiệm, tự luận, số câu, tỉ lệ điểm…" }, { key: "levels", label: "Mức độ / tỉ lệ", placeholder: "Ghi mức độ và phân bố mong muốn" }, { key: "matrix", label: "Ma trận / đặc tả", options: ["Có ma trận và bảng đặc tả", "Chỉ ma trận", "Không cần"] }] },
  { id: "rubric", label: "Rubric & tiêu chí đánh giá", description: "Tiêu chí quan sát được, mô tả từng mức.", example: "Tối ưu prompt tạo rubric đánh giá bài thuyết trình nhóm với 4 mức đạt.", fields: [{ key: "product", label: "Sản phẩm / hoạt động cần đánh giá", placeholder: "Bài thuyết trình, dự án, sản phẩm thực hành…" }, { key: "criteria", label: "Tiêu chí và số mức", placeholder: "Nội dung, hợp tác, trình bày; 4 mức đạt…" }] },
  { id: "activities", label: "Hoạt động & dàn ý slide", description: "Chuỗi hoạt động sinh động, nội dung cô đọng.", example: "Tối ưu prompt thiết kế hoạt động khám phá và dàn ý 12 slide về hệ Mặt Trời.", fields: [{ key: "output", label: "Sản phẩm mong muốn", options: ["Hoạt động dạy học", "Dàn ý slide", "Cả hoạt động và dàn ý slide"] }, { key: "count", label: "Số hoạt động / số slide", placeholder: "Ví dụ: 3 hoạt động và 12 slide" }] }
] as const;
export type TaskId = typeof tasks[number]["id"];
export type Provider = "openai" | "gemini";
export type TaskField = { key: string; label: string; placeholder?: string; options?: readonly string[] };
export const providers = {
  openai: { label: "OpenAI", defaultModel: "gpt-4.1-mini", models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "gpt-5-mini", "gpt-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"], keyUrl: "https://platform.openai.com/api-keys" },
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.8-flash", models: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"], keyUrl: "https://aistudio.google.com/apikey" }
} as const;
export const fieldLabels: Record<string, string> = {
  roleMode: "Cách chọn vai trò AI", role: "Vai trò AI tùy chỉnh", level: "Cấp học", grade: "Lớp / nhóm tuổi", subject: "Môn học", topic: "Bài / chủ đề",
  duration: "Thời lượng", audience: "Đối tượng học sinh", objectives: "Mục tiêu",
  curriculum: "Chương trình / bộ sách", equipment: "Điều kiện dạy học",
  methods: "Phương pháp", extra: "Yêu cầu khác", sequence: "Tiến trình",
  organization: "Hình thức thực hiện", count: "Số lượng / phân bố", levels: "Mức độ",
  solutions: "Đáp án / lời giải", structure: "Cấu trúc đề", matrix: "Ma trận",
  product: "Sản phẩm đánh giá", criteria: "Tiêu chí / số mức", output: "Sản phẩm mong muốn"
};
export type Draft = {
  task: TaskId; originalPrompt: string; fields: Record<string, string>;
  math: boolean; sourceNotes: string; templateNotes: string; fileNames: string[];
};
export const emptyDraft: Draft = {
  task: "lesson", originalPrompt: "", fields: {}, math: false,
  sourceNotes: "", templateNotes: "", fileNames: []
};
export type Question = { id: string; question: string; hint: string };
export type Answer = { id: string; question: string; answer: string };
export type OptimizerResult = {
  status: "questions" | "ready"; summary: string; questions: Question[];
  optimizedPrompt: string; improvements: string[];
};
export type HistoryEntry = {
  id: string; createdAt: string; draft: Draft; provider: Provider; model: string; result: OptimizerResult;
};
