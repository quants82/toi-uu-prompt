import { NextRequest, NextResponse } from "next/server";
import { listProviderModels } from "@/lib/models";
import { ProviderError } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 20;
function reply(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reply({ error: "Yêu cầu không cùng nguồn với website." }, 403);
  const key = request.headers.get("x-provider-key")?.trim();
  if (!key || key.length < 10 || key.length > 512 || /[\r\n]/.test(key)) return reply({ error: "Vui lòng nhập khóa API hợp lệ để tải danh sách mô hình." }, 400);
  try {
    const raw = await request.text();
    if (raw.length > 200) return reply({ error: "Yêu cầu không hợp lệ." }, 400);
    const data = JSON.parse(raw);
    if (data?.provider !== "openai" && data?.provider !== "gemini") return reply({ error: "Nhà cung cấp không hợp lệ." }, 400);
    return reply({ models: await listProviderModels(data.provider, key) });
  } catch (error) {
    if (error instanceof ProviderError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: "Yêu cầu không hợp lệ." }, 400);
    return reply({ error: "Chưa tải được danh sách mô hình. Thầy cô có thể dùng mô hình gợi ý hoặc thử lại." }, 502);
  }
}
