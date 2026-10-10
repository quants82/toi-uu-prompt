import type { Provider } from "./config";
import { friendlyError, ProviderError } from "./providers";

const safeId = /^[a-zA-Z0-9._-]{1,100}$/;
function textModel(id: string, provider: Provider): boolean {
  if (!safeId.test(id) || /audio|image|realtime|tts|transcrib|embedding|live|omni|banana|codex|deep-research|search|cyber|daybreak/.test(id)) return false;
  return provider === "openai" ? /^gpt-(?:[56]|4\.1|4o)(?:[.-]|$)/.test(id) : /^gemini-/.test(id);
}
export async function listProviderModels(provider: Provider, key: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const found = new Set<string>();
  let pageToken: string | undefined;
  const signal = AbortSignal.timeout(15000);
  for (let page = 0; page < 5; page++) {
    const url = new URL(provider === "openai" ? "https://api.openai.com/v1/models" : "https://generativelanguage.googleapis.com/v1beta/models");
    if (provider === "gemini") { url.searchParams.set("pageSize", "1000"); if (pageToken) url.searchParams.set("pageToken", pageToken); }
    const headers: Record<string, string> = provider === "openai" ? { Authorization: "Bearer " + key } : { "x-goog-api-key": key };
    const response = await fetcher(url.toString(), { headers, signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw friendlyError(response.status, data?.error?.code);
    const entries = provider === "openai" ? data.data : data.models;
    if (!Array.isArray(entries)) throw new ProviderError(502, "Danh sách mô hình chưa đúng cấu trúc. Thầy cô vẫn có thể chọn mô hình gợi ý.");
    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const raw = provider === "openai" ? item.id : item.name;
      if (typeof raw !== "string") continue;
      const id = raw.replace(/^models\//, "");
      if (provider === "gemini" && (!Array.isArray(item.supportedGenerationMethods) || !item.supportedGenerationMethods.includes("generateContent"))) continue;
      if (textModel(id, provider)) found.add(id);
    }
    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : undefined;
    if (provider === "openai" || !pageToken) break;
  }
  return Array.from(found).sort();
}
