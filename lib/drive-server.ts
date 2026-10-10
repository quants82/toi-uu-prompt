import { z } from "zod";
import { extractTemplate, MAX_FILE_BYTES, TemplateError } from "./form-extract";
import { inferTags, inferTemplateTask } from "./templates";
import type { TemplateRecord } from "./template-types";
export const driveSelectionSchema = z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/),resourceKey:z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/).optional()});
const metadataSchema = z.object({id:z.string(),name:z.string().min(1).max(255),mimeType:z.string(),size:z.string().optional(),modifiedTime:z.string().optional(),capabilities:z.object({canDownload:z.boolean().optional()}).optional()});
async function check(response: Response) {
  if (response.ok) return;
  const code = response.status;
  if (code === 401) throw new TemplateError(401,"Phiên Drive đã hết hạn. Hãy kết nối lại để đọc form.");
  if (code === 403) throw new TemplateError(403,"Drive chưa cho phép đọc tệp này. Hãy chọn lại tệp hoặc kiểm tra quyền tải xuống.");
  if (code === 404) throw new TemplateError(404,"Không tìm thấy form hoặc quyền truy cập đã thay đổi.");
  if (code === 429) throw new TemplateError(429,"Drive đang giới hạn lượt đọc. Hãy thử lại sau.");
  throw new TemplateError(502,"Chưa đọc được dữ liệu từ Google Drive.");
}
async function boundedBytes(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > MAX_FILE_BYTES) throw new TemplateError(413,"Form vượt quá 3 MB.");
  const reader = response.body?.getReader();
  if (!reader) throw new TemplateError(422,"Drive trả về tệp trống.");
  const parts:Uint8Array[]=[]; let size=0;
  try { while (true) { const part=await reader.read(); if (part.done) break; size+=part.value.byteLength; if(size>MAX_FILE_BYTES){await reader.cancel();throw new TemplateError(413,"Form vượt quá 3 MB.");} parts.push(part.value); } }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export async function readDriveTemplate(selection: z.infer<typeof driveSelectionSchema>, token: string, fetcher: typeof fetch=fetch): Promise<TemplateRecord> {
  const safe=driveSelectionSchema.parse(selection);
  const headers:Record<string,string>={Authorization:"Bearer "+token};
  if(safe.resourceKey) headers["X-Goog-Drive-Resource-Keys"]=safe.id+"/"+safe.resourceKey;
  const base="https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(safe.id);
  const options={headers,cache:"no-store" as const,redirect:"error" as const,signal:AbortSignal.timeout(35000)};
  const response=await fetcher(base+"?fields=id,name,mimeType,size,modifiedTime,capabilities%2FcanDownload&supportsAllDrives=true",options);
  await check(response);const meta=metadataSchema.parse(await response.json());
  if(meta.capabilities?.canDownload===false) throw new TemplateError(403,"Chủ sở hữu không cho phép tải hoặc sao chép form này.");
  if(Number(meta.size)>MAX_FILE_BYTES) throw new TemplateError(413,"Form vượt quá 3 MB.");
  const googleDoc=meta.mimeType==="application/vnd.google-apps.document";
  const supported=["application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/pdf","text/plain"];
  if(!googleDoc&&!supported.includes(meta.mimeType)) throw new TemplateError(422,"Hãy chọn Google Docs, .docx, PDF có văn bản hoặc .txt.");
  const file=await fetcher(googleDoc?base+"/export?mimeType=text%2Fplain":base+"?alt=media&supportsAllDrives=true",options);await check(file);
  const content=await extractTemplate(await boundedBytes(file),googleDoc?"text/plain":meta.mimeType);
  return {id:safe.id,name:meta.name,url:"https://drive.google.com/file/d/"+safe.id+"/view",content,source:"drive",task:inferTemplateTask(meta.name),...inferTags(meta.name),updatedAt:new Date().toISOString(),modifiedTime:meta.modifiedTime};
}
