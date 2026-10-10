"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Cloud, RefreshCw, Trash2, LoaderCircle, Plus, X } from "lucide-react";
import { tasks, type Draft, type TaskId } from "@/lib/config";
import { chooseTemplate, templateContextKey, readTemplatePreferences, TEMPLATE_PREFERENCES_KEY } from "@/lib/templates";
import { loadTemplates, saveTemplates } from "@/lib/template-db";
import { MAX_TEMPLATES, MAX_TEMPLATE_TEXT, templateRecordSchema, type TemplateRecord, type TemplatePreferences, type FormTemplate } from "@/lib/template-types";
import { driveConfig, prepareGoogleDrive, authorizeDrive, pickDriveForms, revokeDrive, type DriveToken, type DriveFile } from "@/lib/google-drive";
export default function TemplateLibrary({draft,disabled,onSelection,onChange,onBusy}:{draft:Draft;disabled:boolean;onSelection:(form:FormTemplate|null)=>void;onChange:()=>void;onBusy:(value:boolean)=>void}){
  const [records,setRecords]=useState<TemplateRecord[]>([]);
  const [preferences,setPreferences]=useState<TemplatePreferences>({});
  const [loaded,setLoaded]=useState(false);const [working,setWorking]=useState(false);const [connected,setConnected]=useState(false);
  const [sdkReady,setSdkReady]=useState(false);const [preparing,setPreparing]=useState(false);
  const [message,setMessage]=useState("");const [error,setError]=useState("");const [progress,setProgress]=useState("");
  const [manual,setManual]=useState(false);const [name,setName]=useState("");const [content,setContent]=useState("");
  const [editing,setEditing]=useState<TemplateRecord|null>(null);
  const token=useRef<DriveToken|null>(null);const abort=useRef<AbortController|null>(null);
  const config=driveConfig();const configured=Boolean(config);
  const key=templateContextKey(draft);
  const selected=useMemo(()=>chooseTemplate(records,draft,preferences),[records,draft,preferences]);
  useEffect(()=>{onSelection(selected?{id:selected.id,name:selected.name,url:selected.url,content:selected.content}:null);},[selected,onSelection]);
  useEffect(()=>{onBusy(working||!loaded);},[working,loaded,onBusy]);
  useEffect(()=>{
    let active=true;
    loadTemplates().then(values=>{if(active)setRecords(values);}).catch(()=>{if(active)setError("Chưa mở được thư viện lưu trên trình duyệt. Hãy kiểm tra quyền lưu dữ liệu website.");}).finally(()=>{if(active)setLoaded(true);});
    try{setPreferences(readTemplatePreferences(localStorage.getItem(TEMPLATE_PREFERENCES_KEY)));}catch{/* Session choices still work. */}
    if(configured){setPreparing(true);prepareGoogleDrive().then(()=>{if(active)setSdkReady(true);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setPreparing(false);});}
    return()=>{active=false;abort.current?.abort();token.current=null;};
  },[configured]);
  async function commit(next:TemplateRecord[]){await saveTemplates(next);setRecords(next);onChange();}
  function prefer(value:string){
    const next={...preferences,[key]:value};setPreferences(next);onChange();
    try{localStorage.setItem(TEMPLATE_PREFERENCES_KEY,JSON.stringify(next));}catch{setError("Lựa chọn chỉ được giữ trong phiên này vì trình duyệt đang chặn lưu dữ liệu.");}
  }
  async function prepare(){setPreparing(true);setError("");try{await prepareGoogleDrive();setSdkReady(true);setMessage("Đã sẵn sàng. Nhấn Kết nối Google Drive để chọn form.");}catch(e){setError(e instanceof Error?e.message:"Chưa tải được kết nối Google.");}finally{setPreparing(false);}}
  async function readFiles(files:DriveFile[],access:DriveToken){
    if(files.length>MAX_TEMPLATES)throw new Error("Mỗi lần chọn tối đa 30 form.");
    const unique=[...new Map(files.map(file=>[file.id,file])).values()];
    if(new Set([...records.map(r=>r.id),...unique.map(f=>f.id)]).size>MAX_TEMPLATES)throw new Error("Thư viện tối đa 30 form. Hãy xóa mẫu không dùng trước khi nhập thêm.");
    const controller=new AbortController();abort.current=controller;
    const imported:TemplateRecord[]=[];const failures:string[]=[];
    for(let index=0;index<unique.length;index++){
      if(controller.signal.aborted)break;
      const file=unique[index];setProgress("Đang đọc form "+(index+1)+" / "+unique.length+": "+file.name);
      try{
        const response=await fetch("/api/drive/template",{method:"POST",headers:{"Content-Type":"application/json","x-drive-token":access.accessToken},body:JSON.stringify({id:file.id,...(file.resourceKey?{resourceKey:file.resourceKey}:{})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});
        const data=await response.json();if(!response.ok)throw new Error(data.error||"Chưa đọc được form.");
        const parsed=templateRecordSchema.parse(data.template);const old=records.find(r=>r.id===parsed.id);
        imported.push(old?{...parsed,task:old.task,subject:old.subject,level:old.level}:parsed);
      }catch(e){if(controller.signal.aborted)break;failures.push(file.name+": "+(e instanceof Error?e.message:"Chưa đọc được form."));}
    }
    if(imported.length){const merged=new Map(records.map(r=>[r.id,r]));imported.forEach(r=>merged.set(r.id,r));await commit([...merged.values()]);}
    setMessage((controller.signal.aborted?"Đã dừng. ":"")+"Đã lưu "+imported.length+" form. Các lần sau dùng bản đã lưu trên trình duyệt.");
    if(failures.length)setError(failures.join("\n"));
    abort.current=null;
  }
  async function connect(refresh=false){
    if(!config)return;if(!sdkReady){await prepare();return;}
    setError("");setMessage("");setWorking(true);
    try{
      // This authorization call is before the first await, so popup permission comes from the click.
      const access=token.current&&token.current.expiresAt>Date.now()?token.current:await authorizeDrive(config);
      token.current=access;setConnected(true);
      const files=refresh?records.filter(r=>r.source==="drive").map(r=>({id:r.id,name:r.name})):await pickDriveForms(access,config);
      if(files.length)await readFiles(files,access);else setMessage("Chưa chọn thêm form. Thư viện đã lưu vẫn được giữ.");
    }catch(e){setError(e instanceof Error?e.message:"Chưa kết nối được Drive.");}
    finally{setWorking(false);setProgress("");}
  }
  async function disconnect(){const current=token.current;token.current=null;setConnected(false);setWorking(true);try{if(current)await revokeDrive(current);setMessage("Đã ngắt quyền Drive của ứng dụng. Bản form đã lưu vẫn dùng được; thầy cô có thể xóa riêng trong thư viện.");}catch{setError("Đã xóa phiên Drive trên tab. Có thể thu hồi quyền ở cài đặt tài khoản Google.");}finally{setWorking(false);}}
  async function addManual(){
    setError("");if(!name.trim()||!content.trim()){setError("Hãy nhập tên và nội dung form.");return;}
    setWorking(true);try{await commit([...records,{id:"manual-"+crypto.randomUUID(),name:name.trim(),content:content.trim(),url:"",source:"manual",task:draft.task,subject:draft.fields.subject||"",level:draft.fields.level||"",updatedAt:new Date().toISOString()}]);setManual(false);setName("");setContent("");setMessage("Đã lưu form để dùng lại.");}catch{setError("Chưa lưu được form. Thư viện hỗ trợ tối đa 30 mẫu và cần quyền lưu dữ liệu trình duyệt.");}finally{setWorking(false);}
  }
  async function saveEdit(){if(!editing)return;setWorking(true);setError("");try{await commit(records.map(r=>r.id===editing.id?editing:r));setEditing(null);setMessage("Đã nhớ phân loại form.");}catch{setError("Chưa lưu được phân loại form.");}finally{setWorking(false);}}
  async function remove(record:TemplateRecord){if(!window.confirm("Xóa bản lưu của form “"+record.name+"” trên trình duyệt? Tệp gốc trên Drive vẫn được giữ."))return;setWorking(true);setError("");try{await commit(records.filter(r=>r.id!==record.id));}catch{setError("Chưa xóa được form trên trình duyệt.");}finally{setWorking(false);}}
  const locked=disabled||working||!loaded;
  const remembered=preferences[key]||"auto";
  return <section className="card template-library" aria-labelledby="library-title">
    <div className="connection-heading"><span className="small-icon"><Cloud size={20}/></span><div><h2 id="library-title">Thư viện form dùng lại</h2><p>Chọn một lần · Tự ghép theo công việc, môn và cấp học</p></div><span className="session-badge">{records.length} / 30 mẫu</span></div>
    <p className="muted-note">Chọn nhiều form trên Drive trong một lần. Website đọc văn bản và lưu bản mẫu trên trình duyệt này để dùng cho các prompt tiếp theo.</p>
    <div className="library-actions">
      <button className="secondary-button" onClick={()=>connect()} disabled={locked||!configured||preparing}><Cloud size={16}/>{preparing?"Đang chuẩn bị Google…":sdkReady?"Kết nối Google Drive & chọn form":"Chuẩn bị kết nối Drive"}</button>
      {records.some(r=>r.source==="drive")&&<button className="text-button" onClick={()=>connect(true)} disabled={locked||!configured||preparing}><RefreshCw size={15}/>Cập nhật từ Drive</button>}
      {connected&&<button className="text-button" onClick={disconnect} disabled={locked}><X size={15}/>Ngắt kết nối</button>}
    </div>
    {!configured&&<p className="library-config">Kết nối Drive chưa được kích hoạt cho website. <a href="/drive-setup" target="_blank" rel="noopener noreferrer">Hướng dẫn dành cho chủ website</a>. Thầy cô có thể lưu form bằng văn bản bên dưới.</p>}
    <p className="file-hint">Google Docs · Word .docx · PDF có văn bản · TXT. Tối đa 3 MB, 20 trang PDF, 30.000 ký tự mỗi mẫu. Chỉ đọc tệp được chọn; không quét toàn bộ Drive.</p>
    <label className="field" htmlFor="template-choice"><span>Form dùng cho prompt này</span><select id="template-choice" disabled={locked} value={records.some(r=>r.id===remembered)||["auto","none"].includes(remembered)?remembered:"auto"} onChange={e=>prefer(e.target.value)}><option value="auto">Tự chọn form phù hợp</option><option value="none">Không dùng form</option>{records.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {selected?<div className="selected-template"><span><BookOpen size={16}/>Form đang dùng</span><strong>{selected.name}</strong><small>{selected.source==="drive"?"Bản đã đọc từ Google Drive":"Form văn bản đã lưu"} · {selected.content.length.toLocaleString("vi-VN")} ký tự</small><details><summary>Xem nội dung form</summary><pre>{selected.content}</pre>{selected.url&&<a href={selected.url} target="_blank" rel="noopener noreferrer">Mở tệp gốc trên Drive</a>}</details></div>:<p className="muted-note">{remembered==="none"?"Đã nhớ lựa chọn không dùng form cho nhóm công việc này.":records.length?"Chưa có mẫu khớp. Hãy chọn form hoặc sửa phân loại trong thư viện.":"Chưa có form đã lưu. Nhập form để website tự chọn ở lần sau."}</p>}
    <details className="expandable"><summary>Quản lý form đã lưu<span className="optional">{records.length} mẫu</span></summary><div className="template-list">{records.map(r=><div className="template-row" key={r.id}><div><strong>{r.name}</strong><small>{tasks.find(t=>t.id===r.task)?.label||"Chưa phân loại"} · {r.subject||"Mọi môn"} · {r.level||"Mọi cấp"}</small></div><button className="text-button" onClick={()=>setEditing(r)} disabled={locked} aria-label={"Phân loại "+r.name}>Phân loại</button><button className="icon-button" disabled={locked} onClick={()=>remove(r)} aria-label={"Xóa form "+r.name}><Trash2 size={15}/></button></div>)}</div></details>
    {editing&&<fieldset disabled={locked} className="template-editor"><h3>Phân loại: {editing.name}</h3><label className="field"><span>Loại công việc của form</span><select value={editing.task||""} onChange={e=>setEditing({...editing,task:(e.target.value||null) as TaskId|null})}><option value="">Chưa phân loại</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label className="field"><span>Môn học của form (để trống: mọi môn)</span><input maxLength={100} value={editing.subject} onChange={e=>setEditing({...editing,subject:e.target.value})}/></label><label className="field"><span>Cấp học của form (để trống: mọi cấp)</span><input maxLength={100} value={editing.level} onChange={e=>setEditing({...editing,level:e.target.value})}/></label><div className="library-actions"><button className="secondary-button" onClick={saveEdit}>Lưu phân loại</button><button className="text-button" onClick={()=>setEditing(null)}>Hủy</button></div></fieldset>}
    <button className="text-button" disabled={locked} onClick={()=>setManual(!manual)}><Plus size={15}/>{manual?"Đóng nhập form":"Lưu form bằng văn bản"}</button>
    {manual&&<fieldset disabled={locked} className="template-editor"><label className="field" htmlFor="manual-form-name"><span>Tên form</span><input id="manual-form-name" value={name} maxLength={255} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: KHBD Toán THCS"/></label><label className="field" htmlFor="manual-form-content"><span>Nội dung form</span><textarea id="manual-form-content" rows={7} maxLength={MAX_TEMPLATE_TEXT} value={content} onChange={e=>setContent(e.target.value)} placeholder="Dán các đề mục, cột, cấu trúc bắt buộc…"/></label><p className="file-hint">Phân loại theo công việc, môn và cấp học đang chọn. Có thể sửa lại trong Quản lý form.</p><button className="secondary-button" onClick={addManual}>Lưu vào thư viện</button></fieldset>}
    {working&&<div className="library-progress" role="status"><LoaderCircle size={16} className="spin"/><span>{progress||"Đang xử lý thư viện…"}</span>{abort.current&&<button className="text-button" onClick={()=>abort.current?.abort()}>Dừng nhập</button>}</div>}
    {error&&<p className="error-message" role="alert">{error}</p>}{message&&<p className="notice-message" role="status">{message}</p>}
    <p className="privacy-note">Văn bản của form đang dùng được gửi đến AI khi tối ưu và chèn vào prompt cuối. Form và lựa chọn lưu trên trình duyệt này; phiên cấp quyền Google chỉ giữ trong bộ nhớ tab. Bản trích xuất không giữ hình ảnh hay bố cục Word. <a href="/privacy">Quyền riêng tư</a></p>
  </section>;
}
