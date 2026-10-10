import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/optimize/route";
import { emptyDraft } from "../lib/config";
import { requestSchema, parseResult, buildInput, type OptimizerRequest } from "../lib/optimizer";
import { optimizeWithProvider, ProviderError } from "../lib/providers";
import { serializeHistory, deserializeHistory } from "../lib/storage";

const draft = { ...emptyDraft, originalPrompt: "Tạo prompt kế hoạch bài dạy về phân số", fields: { subject: "Toán", grade: "Lớp 6", learningRequirements: "Nhận biết và so sánh phân số." }, math: true, fileNames: ["SGK.pdf", "Mau.docx"] };
const input: OptimizerRequest = { provider: "openai", model: "gpt-4.1-mini", draft, answers: [] };
const ready = { status: "ready", summary: "Đã tối ưu", questions: [], optimizedPrompt: "Hãy tạo kế hoạch theo tài liệu.", improvements: ["Làm rõ mục tiêu"] };

test("clarification state requires questions and no finished prompt", () => {
  const questions = { status: "questions", summary: "Cần mục tiêu", questions: [{ id: "goal", question: "Mục tiêu nào?", hint: "Kiến thức cần đạt" }], optimizedPrompt: "", improvements: [] };
  assert.equal(parseResult(JSON.stringify(questions), draft).status, "questions");
  assert.throws(() => parseResult(JSON.stringify({ ...questions, optimizedPrompt: "Làm ngay" }), draft));
  assert.throws(() => parseResult(JSON.stringify({ ...questions, questions: [] }), draft));
  assert.throws(() => parseResult(JSON.stringify({ ...questions, questions: [...questions.questions, ...questions.questions] }), draft));
});
test("ready state rejects unfinished responses", () => {
  assert.throws(() => parseResult(JSON.stringify({ ...ready, optimizedPrompt: "" }), draft));
  assert.throws(() => parseResult(JSON.stringify({ ...ready, questions: [{ id: "x", question: "Còn thiếu gì?", hint: "" }] }), draft));
});
test("math formats normalize to a single dollar pair and preserve LaTeX", () => {
  const result = parseResult(JSON.stringify({ ...ready, optimizedPrompt: String.raw`Công thức $$x^2$$, \(a+b\), \[\frac{a}{b}\].` }), draft);
  assert.ok(result.optimizedPrompt.includes("$x^2$"));
  assert.ok(result.optimizedPrompt.includes("$a+b$"));
  assert.ok(result.optimizedPrompt.includes(String.raw`$\frac{a}{b}$`));
  assert.ok(!result.optimizedPrompt.includes("$$"));
  assert.ok(result.optimizedPrompt.includes("SGK.pdf; Mau.docx"));
  assert.ok(result.optimizedPrompt.includes("hỏi lại giáo viên"));
});
test("selected context and previous answers travel together, without file bytes", () => {
  const body = JSON.parse(buildInput({ ...input, answers: [{ id: "goal", question: "Mục tiêu?", answer: "So sánh phân số" }] }));
  assert.equal(body.thongTin["Môn học"], "Toán");
  assert.equal(body.traLoiBoSung[0].answer, "So sánh phân số");
  assert.deepEqual(body.tenTepSeDinhKemKhiSuDung, ["SGK.pdf", "Mau.docx"]);
  assert.equal(body.apiKey, undefined);
});
test("model paths, blank prompts and oversized file lists are rejected", () => {
  assert.equal(requestSchema.safeParse({ ...input, model: "../other?key=x" }).success, false);
  assert.equal(requestSchema.safeParse({ ...input, draft: { ...draft, originalPrompt: "  " } }).success, false);
  assert.equal(requestSchema.safeParse({ ...input, draft: { ...draft, fileNames: Array(16).fill("x.pdf") } }).success, false);
});
test("history serializes only the allowed properties and handles corrupted data", () => {
  const entry = { id: "entry1", createdAt: new Date().toISOString(), draft, provider: "openai" as const, model: "gpt-4.1-mini", result: parseResult(JSON.stringify(ready), draft), apiKey: "DO-NOT-PERSIST" };
  const raw = serializeHistory([entry]);
  assert.ok(!raw.includes("DO-NOT-PERSIST"));
  assert.equal(deserializeHistory(raw).length, 1);
  assert.equal(deserializeHistory("{broken").length, 0);
  assert.equal(deserializeHistory(JSON.stringify([{ ...entry, provider: "unknown" }])).length, 0);
});
test("OpenAI uses Responses schema, transient credentials and disabled response storage", async () => {
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer TEST-ONLY-KEY");
    const body = JSON.parse(options?.body as string);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.ok(!JSON.stringify(body).includes("TEST-ONLY-KEY"));
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(ready) }] }] });
  };
  assert.equal((await optimizeWithProvider(input, "TEST-ONLY-KEY", fakeFetch)).status, "ready");
});
test("Gemini sends the key in a header and requests structured JSON", async () => {
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    assert.equal((options?.headers as Record<string, string>)["x-goog-api-key"], "TEST-ONLY-KEY");
    const body = JSON.parse(options?.body as string);
    assert.equal(body.generationConfig.responseFormat.text.mimeType, "application/json");
    assert.ok(!String(url).includes("TEST-ONLY-KEY"));
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(ready) }] } }] });
  };
  assert.equal((await optimizeWithProvider({ ...input, provider: "gemini", model: "gemini-3.8-flash" }, "TEST-ONLY-KEY", fakeFetch)).status, "ready");
});
test("provider errors do not echo sensitive upstream messages", async () => {
  const fakeFetch: typeof fetch = async () => Response.json({ error: { message: "SECRET leaked", code: "insufficient_quota" } }, { status: 429 });
  await assert.rejects(() => optimizeWithProvider(input, "TEST-ONLY-KEY", fakeFetch), (e: unknown) => e instanceof ProviderError && e.status === 429 && !e.message.includes("SECRET"));
});
test("API rejects missing keys, other origins and malformed JSON without contacting AI", async () => {
  assert.equal((await POST(new NextRequest("https://example.com/api/optimize", { method: "POST", body: "{}" }))).status, 400);
  assert.equal((await POST(new NextRequest("https://example.com/api/optimize", { method: "POST", headers: { origin: "https://other.example", "x-provider-key": "TEST-ONLY-KEY" }, body: "{}" }))).status, 403);
  assert.equal((await POST(new NextRequest("https://example.com/api/optimize", { method: "POST", headers: { "x-provider-key": "TEST-ONLY-KEY" }, body: "{broken" }))).status, 400);
});
