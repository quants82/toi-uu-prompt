import { NextRequest, NextResponse } from "next/server";
import { requestSchema } from "@/lib/optimizer";
import { optimizeWithProvider, ProviderError } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reply({ error: "Yêu cầu không cùng nguồn với website." }, 403);
  const apiKey = request.headers.get("x-provider-key")?.trim();
  if (!apiKey || apiKey.length < 10 || apiKey.length > 512 || /[\r\n]/.test(apiKey)) return reply({ error: "Vui lòng nhập khóa API hợp lệ của nhà cung cấp đã chọn." }, 400);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 150000) return reply({ error: "Nội dung quá dài. Vui lòng rút gọn yêu cầu." }, 413);
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return reply({ error: "Nội dung yêu cầu không hợp lệ." }, 400); }
    const input = requestSchema.safeParse(json);
    if (!input.success) return reply({ error: "Vui lòng kiểm tra prompt, các thông tin nhập và độ dài nội dung." }, 400);
    return reply(await optimizeWithProvider(input.data, apiKey));
  } catch (error) {
    if (error instanceof ProviderError) return reply({ error: error.message }, error.status);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return reply({ error: "AI phản hồi quá lâu. Vui lòng thử lại; thông tin bạn nhập vẫn được giữ." }, 504);
    return reply({ error: "Chưa thể kết nối với AI. Vui lòng kiểm tra kết nối rồi thử lại." }, 502);
  }
}
