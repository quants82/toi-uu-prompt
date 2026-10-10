import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { POST } from "../app/api/models/route";
import { emptyDraft } from "../lib/config";
import { teacherRole } from "../lib/roles";
import { buildInput, finalizePrompt } from "../lib/optimizer";
import { KEY_STORAGE_PREFIX, readSavedKey, storeSavedKey } from "../lib/credentials";
import { listProviderModels } from "../lib/models";
import { ProviderError } from "../lib/providers";
import { promptWordBlob } from "../lib/word";

const draft = { ...emptyDraft, originalPrompt: "Tối ưu prompt phiếu học tập", fields: { subject: "Toán", level: "THCS", grade: "Lớp 6" } };
test("teacher role follows the subject and supports an explicit custom role without removing prompt content", () => {
  assert.ok(teacherRole(draft).includes("giáo viên giỏi bộ môn Toán ở cấp THCS"));
  const custom = { ...draft, fields: { ...draft.fields, roleMode: "custom", role: "Bạn là chuyên gia giáo dục hòa nhập" } };
  assert.equal(teacherRole(custom), "Bạn là chuyên gia giáo dục hòa nhập");
  const payload = JSON.parse(buildInput({ provider: "openai", model: "gpt-4.1-mini", draft: custom, answers: [] }));
  assert.equal(payload.vaiTroAI, custom.fields.role);
  const original = "Vai trò: Giáo viên Toán. Nhiệm vụ: Tạo prompt cho 12 câu hỏi.";
  const finalized = finalizePrompt(original, draft);
  assert.ok(finalized.includes(original));
  assert.equal(finalizePrompt(finalized, draft).split("Vai trò: Bạn là giáo viên giỏi").length - 1, 1);
});
test("remembered keys stay separate per provider and removal does not touch prompt history", () => {
  const data = new Map<string,string>([["prompt-giao-vien.history.v1", "history"]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key,value); }, removeItem: (key: string) => { data.delete(key); } };
  assert.equal(readSavedKey(storage,"openai"), "");
  storeSavedKey(storage,"openai"," OPENAI-TEST-KEY "); storeSavedKey(storage,"gemini","GEMINI-TEST-KEY");
  assert.equal(readSavedKey(storage,"openai"),"OPENAI-TEST-KEY");
  storeSavedKey(storage,"gemini","");
  assert.equal(readSavedKey(storage,"gemini"),"");
  assert.equal(readSavedKey(storage,"openai"),"OPENAI-TEST-KEY");
  assert.equal(data.get("prompt-giao-vien.history.v1"),"history");
  assert.throws(() => storeSavedKey(storage,"openai","bad\nkey"));
  data.set(KEY_STORAGE_PREFIX + "openai", "bad\nkey"); assert.equal(readSavedKey(storage,"openai"), "");
});
test("OpenAI model listing uses header credentials and filters unrelated modalities", async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/models");
    assert.equal((options?.headers as Record<string,string>).Authorization, "Bearer TEST-ONLY-KEY");
    assert.equal(options?.cache, "no-store");
    return Response.json({ data: [{id:"gpt-6.1-sol"},{id:"gpt-4.1-mini"},{id:"gpt-image-2"},{id:"gpt-6-realtime"},{id:"text-embedding-3-small"},{id:"../unsafe"},{id:"gpt-4.1-mini"}] });
  };
  assert.deepEqual(await listProviderModels("openai","TEST-ONLY-KEY",fetcher),["gpt-4.1-mini","gpt-6.1-sol"]);
});
test("Gemini model listing follows pagination and only includes text generation", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    const target = new URL(String(url));
    assert.equal(target.origin,"https://generativelanguage.googleapis.com");
    assert.equal(target.searchParams.get("pageSize"), "1000");
    assert.equal(target.searchParams.has("key"), false);
    assert.equal((options?.headers as Record<string,string>)["x-goog-api-key"],"TEST-ONLY-KEY");
    calls++;
    if (calls === 1) return Response.json({ models:[{name:"models/gemini-3.8-flash",supportedGenerationMethods:["generateContent"]},{name:"models/gemini-embedding",supportedGenerationMethods:["embedContent"]},{name:"models/gemini-3.8-flash-tts",supportedGenerationMethods:["generateContent"]}],nextPageToken:"page/2" });
    assert.equal(target.searchParams.get("pageToken"), "page/2");
    return Response.json({ models:[{name:"models/gemini-3.5-flash-lite",supportedGenerationMethods:["generateContent"]}] });
  };
  assert.deepEqual(await listProviderModels("gemini","TEST-ONLY-KEY",fetcher),["gemini-3.5-flash-lite","gemini-3.8-flash"]);
  assert.equal(calls,2);
});
test("model list errors do not disclose upstream secrets", async () => {
  const fetcher: typeof fetch = async () => Response.json({error:{message:"SECRET-KEY"}}, {status:401});
  await assert.rejects(() => listProviderModels("openai","TEST-ONLY-KEY",fetcher), (error: unknown) => error instanceof ProviderError && !error.message.includes("SECRET"));
});
test("models route rejects bad credentials, origins and provider values without contacting a provider", async () => {
  const url = "https://example.com/api/models";
  assert.equal((await POST(new NextRequest(url,{method:"POST",body:"{}"}))).status,400);
  assert.equal((await POST(new NextRequest(url,{method:"POST",headers:{origin:"https://other.com","x-provider-key":"TEST-ONLY-KEY"},body:'{"provider":"openai"}'}))).status,403);
  assert.equal((await POST(new NextRequest(url,{method:"POST",headers:{"x-provider-key":"TEST-ONLY-KEY"},body:'{"provider":"other"}'}))).status,400);
  assert.equal((await POST(new NextRequest(url,{method:"POST",headers:{"x-provider-key":"TEST-ONLY-KEY"},body:"{broken"}))).status,400);
});
test("Word export is a real docx and preserves Vietnamese, complete prompt and LaTeX", async () => {
  const prompt = String.raw`Vai trò: Bạn là giáo viên giỏi bộ môn Toán.

Nhiệm vụ: Tạo phiếu học tập.
Công thức $\frac{a}{b}$ và $x^2$.
Dòng cuối: Hỏi lại trước khi thực hiện <nếu thiếu> & bám tài liệu.`;
  const blob = await promptWordBlob(draft,prompt);
  assert.equal(blob.type,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(xml.includes("Prompt đã tối ưu"));
  assert.ok(xml.includes("giáo viên giỏi bộ môn Toán"));
  assert.ok(xml.includes(String.raw`$\frac{a}{b}$`));
  assert.ok(xml.includes("&lt;nếu thiếu&gt; &amp; bám tài liệu."));
  assert.ok(xml.includes('w:w="11906"'));
  assert.ok(zip.file("[Content_Types].xml"));
});