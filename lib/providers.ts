import { buildInput, parseResult, responseSchema, systemInstruction, type OptimizerRequest } from "./optimizer";
import type { OptimizerResult } from "./config";

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function friendlyError(status: number, code?: string): ProviderError {
  if (status === 401 || status === 403) return new ProviderError(status, "Khóa API chưa đúng, chưa được cấp quyền hoặc không được phép dùng mô hình này. Hãy kiểm tra khóa và mô hình.");
  if (status === 429) return new ProviderError(429, code === "insufficient_quota" ? "Tài khoản API đã hết hạn mức hoặc chưa có số dư. Hãy kiểm tra thanh toán của nhà cung cấp." : "Đã chạm giới hạn sử dụng API. Vui lòng chờ một chút rồi thử lại hoặc kiểm tra hạn mức.");
  if (status === 404) return new ProviderError(400, "Không tìm thấy mô hình hoặc tài khoản của bạn chưa có quyền sử dụng. Hãy chọn mô hình khác.");
  if (status === 400) return new ProviderError(400, "Nhà cung cấp không chấp nhận cấu hình này. Hãy chọn một mô hình trong danh sách và kiểm tra yêu cầu.");
  return new ProviderError(502, "Nhà cung cấp AI đang gặp sự cố. Vui lòng thử lại sau.");
}

export async function optimizeWithProvider(input: OptimizerRequest, apiKey: string, fetcher: typeof fetch = fetch): Promise<OptimizerResult> {
  const content = buildInput(input);
  let url: string;
  let body: unknown;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = "Bearer " + apiKey;
    body = {
      model: input.model, store: false, instructions: systemInstruction, input: content,
      max_output_tokens: 6000,
      text: { format: { type: "json_schema", name: "teacher_prompt_optimizer", strict: true, schema: responseSchema } }
    };
  } else {
    url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(input.model) + ":generateContent";
    headers["x-goog-api-key"] = apiKey;
    body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: content }] }],
      generationConfig: { maxOutputTokens: 12000, responseFormat: { text: { mimeType: "application/json", schema: responseSchema } } }
    };
  }
  const response = await fetcher(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(50000) });
  const data = await response.json();
  if (!response.ok) throw friendlyError(response.status, data?.error?.code);
  let output: string;
  if (input.provider === "openai") {
    if (data.status === "incomplete" || data.status === "failed") throw new ProviderError(502, "AI chưa hoàn tất phản hồi. Hãy rút gọn yêu cầu hoặc thử lại.");
    const parts = (data.output || []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []);
    if (parts.some((p: { type: string }) => p.type === "refusal")) throw new ProviderError(422, "AI không thể xử lý yêu cầu này. Hãy điều chỉnh nội dung prompt.");
    output = parts.filter((p: { type: string }) => p.type === "output_text").map((p: { text: string }) => p.text).join("");
  } else {
    const candidate = data.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== "STOP")) throw new ProviderError(422, "AI chưa thể hoàn tất phản hồi. Hãy rút gọn hoặc điều chỉnh nội dung.");
    output = (candidate.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("");
  }
  if (!output) throw new ProviderError(502, "AI trả về phản hồi trống. Vui lòng thử lại.");
  try { return parseResult(output, input.draft); }
  catch { throw new ProviderError(502, "Phản hồi AI chưa đúng cấu trúc. Vui lòng thử lại; nội dung bạn nhập vẫn được giữ."); }
}
