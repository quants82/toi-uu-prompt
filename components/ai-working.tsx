"use client";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
export default function AiWorking({subject,formName}:{subject?:string;formName?:string}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{const timer=window.setInterval(()=>setSeconds(v=>v+1),1000);return()=>window.clearInterval(timer);},[]);
  return <div className="ai-working" role="status" aria-label="AI đang sinh prompt" aria-live="polite">
    <div className="ai-starfield" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="ai-orb" aria-hidden="true"><span className="ai-ring ring-one"/><span className="ai-ring ring-two"/><span className="ai-ring ring-three"/><span className="ai-core"><Sparkles size={31}/></span><span className="ai-scan"/></div>
    <span className="ai-eyebrow">KẾT NỐI Ý TƯỞNG · ĐỊNH HÌNH CÂU LỆNH</span>
    <h3>AI đang sinh prompt<span className="ai-dots" aria-hidden="true">…</span></h3>
    <p>Đang chờ phản hồi từ mô hình đã chọn.<br/>Yêu cầu càng đầy đủ, prompt càng sát lớp học.</p>
    <div className="ai-inputs"><span>{subject||"Thông tin dạy học"}</span><span>{formName?"Form: "+formName:"Cấu trúc đầu ra"}</span></div>
    <div className="ai-lock"><ShieldCheck size={15}/><span>Yêu cầu cần đạt được giữ nguyên văn</span></div>
    <div className="ai-wait" aria-live="off">Đã chờ {seconds} giây · Có thể dừng yêu cầu bất cứ lúc nào</div>
  </div>;
}
