import { isSameOrigin } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { driveSelectionSchema, readDriveTemplate } from "@/lib/drive-server";
import { TemplateError } from "@/lib/form-extract";
export const runtime="nodejs";
export const maxDuration=45;
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function POST(request:NextRequest){
  if(!isSameOrigin(request))return reply({error:"Yêu cầu không cùng nguồn với website."},403);
  const token=request.headers.get("x-drive-token")?.trim();if(!token||token.length<20||token.length>4096||/[\r\n]/.test(token))return reply({error:"Hãy kết nối Google Drive trước khi đọc form."},401);
  try{
    const raw=await request.text();if(raw.length>1000)return reply({error:"Thông tin tệp quá dài."},413);
    let value:unknown;try{value=JSON.parse(raw);}catch{return reply({error:"Thông tin tệp không hợp lệ."},400);}
    const selection=driveSelectionSchema.safeParse(value);if(!selection.success)return reply({error:"Mã tệp Drive không hợp lệ."},400);
    return reply({template:await readDriveTemplate(selection.data,token)});
  }catch(error){
    if(error instanceof TemplateError)return reply({error:error.message},error.status);
    if(error instanceof Error&&(error.name==="TimeoutError"||error.name==="AbortError"))return reply({error:"Drive phản hồi quá lâu. Hãy thử lại."},504);
    return reply({error:"Chưa thể đọc form từ Drive. Hãy kiểm tra kết nối và thử lại."},502);
  }
}
