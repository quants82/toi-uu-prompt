import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from "docx";
import { zipSync, strToU8 } from "fflate";
import { NextRequest } from "next/server";
import { emptyDraft, type Draft } from "../lib/config";
import { chooseTemplate, inferTemplateTask, inferTags, templateContextKey, readTemplatePreferences, cleanTemplates } from "../lib/templates";
import { type TemplateRecord } from "../lib/template-types";
import { extractTemplate, TemplateError, MAX_FILE_BYTES } from "../lib/form-extract";
import { readDriveTemplate } from "../lib/drive-server";
import { POST } from "../app/api/drive/template/route";
import { buildInput, finalizePrompt, requestSchema, systemInstruction } from "../lib/optimizer";
import { optimizeWithProvider } from "../lib/providers";
import { serializeHistory, deserializeHistory } from "../lib/storage";
const draft:Draft={...emptyDraft,originalPrompt:"Tạo prompt kế hoạch bài dạy",fields:{subject:"Toán",level:"THCS",learningRequirements:"  – Nhận biết phân số.\n– So sánh phân số có cùng mẫu số.\nGiữ công thức $$a/b$$.  "}};
const record:TemplateRecord={id:"form-1",name:"KHBD Toán THCS.docx",url:"https://drive.google.com/file/d/form-1/view",content:"I. MỤC TIÊU\nII. THIẾT BỊ\nHoạt động | Nội dung | Sản phẩm",source:"drive",task:"lesson",subject:"Toán",level:"THCS",updatedAt:"2026-10-10T01:00:00.000Z"};
test("automatic template selection matches task, subject, school level and respects remembered choices",()=>{
  const generic={...record,id:"generic",subject:"",level:""};const wrong={...record,id:"wrong",level:"THPT"};
  assert.equal(chooseTemplate([wrong,generic,record],draft,{})?.id,record.id);
  assert.equal(chooseTemplate([record],{...draft,fields:{subject:"Vật lí",level:"THCS"}},{ }),null);
  assert.equal(chooseTemplate([record],emptyDraft,{}),null);
  assert.equal(chooseTemplate([record,generic],draft,{[templateContextKey(draft)]:"generic"})?.id,"generic");
  assert.equal(chooseTemplate([record],draft,{[templateContextKey(draft)]:"none"}),null);
  assert.equal(chooseTemplate([record],draft,{[templateContextKey(draft)]:"deleted"})?.id,"form-1");
  assert.equal(chooseTemplate([record],{...draft,task:"worksheet"},{}),null);
  assert.equal(inferTemplateTask("MẪU PHIẾU HỌC TẬP.docx"),"worksheet");assert.equal(inferTemplateTask("Ma trận đề kiểm tra"),"assessment");
  assert.deepEqual(inferTags(record.name),{subject:"Toán",level:"THCS"});assert.equal(inferTemplateTask("mẫu số 01"),null);
});
test("cache validation excludes corrupted records and unwanted credential properties",()=>{
  assert.deepEqual(readTemplatePreferences("{broken"),{});assert.deepEqual(readTemplatePreferences('[]'),{});
  assert.deepEqual(readTemplatePreferences('{"lesson::toan::thcs":"none","bad":123}'),{"lesson::toan::thcs":"none"});
  const safe=cleanTemplates([{...record,accessToken:"SECRET",apiKey:"SECRET"},{...record,id:"invalid",content:""}]);
  assert.equal(safe.length,1);assert.equal(JSON.stringify(safe).includes("SECRET"),false);
  const d={...draft,formTemplate:{...record,accessToken:"SECRET"}};
  const entry={id:"history-1",createdAt:record.updatedAt,provider:"openai" as const,model:"gpt-4.1-mini",draft:d,result:{status:"ready" as const,summary:"",questions:[],optimizedPrompt:"test",improvements:[]}};
  const raw=serializeHistory([entry]);assert.ok(!raw.includes("SECRET"));assert.equal(deserializeHistory(raw)[0].draft.formTemplate?.content,record.content);
});
test("the final prompt includes real form text and preserves learning requirements byte for byte, even with math enabled",()=>{
  const d={...draft,math:true,formTemplate:{...record,content:record.content+"\nCông thức $$x^2$$."}};
  const text=finalizePrompt("Nhiệm vụ: Tạo kế hoạch theo mẫu.",d);
  const requirements=text.split("--- BẮT ĐẦU NGUYÊN VĂN YÊU CẦU CẦN ĐẠT ---\n")[1].split("\n--- KẾT THÚC NGUYÊN VĂN YÊU CẦU CẦN ĐẠT ---")[0];
  assert.equal(requirements,d.fields.learningRequirements);assert.ok(text.includes("Công thức $x^2$."));assert.ok(text.includes("Hoạt động | Nội dung | Sản phẩm"));assert.ok(text.includes("Không sửa, rút gọn, diễn đạt lại"));
  const data=JSON.parse(buildInput({provider:"openai",model:"gpt-4.1-mini",draft:d,answers:[]}));assert.equal(data.formMauDaDoc.content,d.formTemplate.content);assert.equal(data.nguyenVanYeuCauCanDat,d.fields.learningRequirements);
  assert.ok(systemInstruction.includes("PROMPT CHI TIẾT, CHUẨN GIAO TIẾP CHO AI"));
  assert.equal(requestSchema.safeParse({provider:"openai",model:"gpt-4.1-mini",draft:{...d,formTemplate:{...record,url:"https://evil.example/form"}},answers:[]}).success,false);
});
test("missing requirements are clarified before contacting AI and the clarified original is used unchanged",async()=>{
  let calls=0;const missing={...draft,fields:{subject:"Toán"}};
  const fetcher:typeof fetch=async(_url,options)=>{calls++;const body=JSON.parse(String(options?.body));assert.equal(JSON.parse(body.input).nguyenVanYeuCauCanDat,draft.fields.learningRequirements);return Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify({status:"ready",summary:"",questions:[],optimizedPrompt:"Thực hiện theo chuẩn gốc.",improvements:[]})}]}]});};
  const input={provider:"openai" as const,model:"gpt-4.1-mini",draft:missing,answers:[]};
  assert.equal((await optimizeWithProvider(input,"TEST-KEY",fetcher)).questions[0].id,"learningRequirements");assert.equal(calls,0);
  assert.equal((await optimizeWithProvider({...input,answers:[{id:"learningRequirements",question:"Chuẩn?",answer:"không yêu cầu"}]},"TEST-KEY",fetcher)).status,"questions");assert.equal(calls,0);
  const clarified=requestSchema.parse({...input,answers:[{id:"learningRequirements",question:"Chuẩn?",answer:draft.fields.learningRequirements}]});
  assert.equal(clarified.answers[0].answer,draft.fields.learningRequirements);
  const result=await optimizeWithProvider(clarified,"TEST-KEY",fetcher);
  assert.equal(calls,1);assert.ok(result.optimizedPrompt.includes(draft.fields.learningRequirements));
});
test("DOCX text extraction retains Vietnamese headings, paragraphs, table cells and their order",async()=>{
  const doc=new Document({sections:[{children:[new Paragraph("I. YÊU CẦU CẦN ĐẠT"),new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph("Hoạt động")]}),new TableCell({children:[new Paragraph("Sản phẩm") ]})]}),new TableRow({children:[new TableCell({children:[new Paragraph("Khởi động")]}),new TableCell({children:[new Paragraph("Câu trả lời") ]})]})]}),new Paragraph("III. ĐÁNH GIÁ")]}]});
  const text=await extractTemplate(Uint8Array.from(await Packer.toBuffer(doc)),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.ok(text.includes("Hoạt động | Sản phẩm"));assert.ok(text.includes("Khởi động | Câu trả lời"));assert.ok(text.indexOf("YÊU CẦU CẦN ĐẠT")<text.indexOf("Hoạt động"));assert.ok(text.indexOf("Khởi động")<text.indexOf("ĐÁNH GIÁ"));
  await assert.rejects(()=>extractTemplate(zipSync({"word/document.xml":strToU8('<!DOCTYPE x><w:p><w:t>bad</w:t></w:p>')}),"application/vnd.openxmlformats-officedocument.wordprocessingml.document"),TemplateError);
});
function pdfFixture(){
  const stream="BT /F1 18 Tf 50 750 Td (FORM: LEARNING OBJECTIVES) Tj ET";
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  let content="%PDF-1.4\n";const offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(content));content+=(i+1)+" 0 obj\n"+object+"\nendobj\n";});const xref=Buffer.byteLength(content);content+="xref\n0 6\n0000000000 65535 f \n"+offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";return Uint8Array.from(Buffer.from(content));
}
test("PDF extraction reads actual document text and rejects empty or excessive input",async()=>{
  const text=await extractTemplate(pdfFixture(),"application/pdf");assert.ok(text.includes("FORM: LEARNING OBJECTIVES"));
  await assert.rejects(()=>extractTemplate(new Uint8Array(MAX_FILE_BYTES+1),"text/plain"),(e:unknown)=>e instanceof TemplateError&&e.status===413);
  await assert.rejects(()=>extractTemplate(new Uint8Array(),"text/plain"),(e:unknown)=>e instanceof TemplateError&&e.status===422);
});
test("Drive reads metadata then fixed export URL, with transient header token and no secret in URL",async()=>{
  let calls=0;const fetcher:typeof fetch=async(url,options)=>{calls++;assert.ok(String(url).startsWith("https://www.googleapis.com/drive/v3/files/form-1"));assert.ok(!String(url).includes("TEST-TOKEN"));assert.equal((options?.headers as Record<string,string>).Authorization,"Bearer TEST-TOKEN");assert.equal(options?.redirect,"error");
    if(calls===1)return Response.json({id:"form-1",name:record.name,mimeType:"application/vnd.google-apps.document",capabilities:{canDownload:true}});
    assert.ok(String(url).endsWith("/export?mimeType=text%2Fplain"));return new Response(record.content);};
  const template=await readDriveTemplate({id:"form-1"},"TEST-TOKEN",fetcher);assert.equal(template.content,record.content);assert.equal(template.task,"lesson");assert.equal(calls,2);assert.ok(!JSON.stringify(template).includes("TEST-TOKEN"));
});
test("Drive honors revoked access and download restrictions, bounds streamed file bytes and sanitizes errors",async()=>{
  await assert.rejects(()=>readDriveTemplate({id:"../bad"},"TEST-TOKEN",async()=>{throw Error("must not fetch");}));
  await assert.rejects(()=>readDriveTemplate({id:"form-1"},"TEST-TOKEN",async()=>Response.json({error:{message:"SECRET"}},{status:403})),(e:unknown)=>e instanceof TemplateError&&e.status===403&&!e.message.includes("SECRET"));
  let calls=0;await assert.rejects(()=>readDriveTemplate({id:"form-1"},"TEST-TOKEN",async()=>{calls++;return Response.json({id:"form-1",name:"form",mimeType:"text/plain",capabilities:{canDownload:false}});}),TemplateError);assert.equal(calls,1);
  calls=0;await assert.rejects(()=>readDriveTemplate({id:"form-1"},"TEST-TOKEN",async()=>++calls===1?Response.json({id:"form-1",name:"form",mimeType:"text/plain"}):new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_FILE_BYTES+1));c.close();}}))),(e:unknown)=>e instanceof TemplateError&&e.status===413);
});
test("Drive route rejects invalid origins and inputs before provider calls",async()=>{
  const url="https://example.com/api/drive/template";assert.equal((await POST(new NextRequest(url,{method:"POST",body:"{}"}))).status,401);
  const headers={"x-drive-token":"TEST-TOKEN-EXAMPLE-ONLY"};assert.equal((await POST(new NextRequest(url,{method:"POST",headers:{...headers,origin:"https://other.example"},body:'{"id":"form-1"}'}))).status,403);
  assert.equal((await POST(new NextRequest(url,{method:"POST",headers,body:'{"id":"https://evil.example/"}'}))).status,400);
});


import { isSameOrigin } from "../lib/request-origin";
test("origin validation uses the browser-facing host while rejecting unrelated origins and forwarded-host tricks",()=>{
  assert.equal(isSameOrigin(new NextRequest("http://localhost:3000/api/optimize",{headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"}})),true);
  assert.equal(isSameOrigin(new NextRequest("http://localhost:3000/api/optimize",{headers:{host:"127.0.0.1:3000",origin:"http://evil.example","x-forwarded-host":"evil.example"}})),false);
});
