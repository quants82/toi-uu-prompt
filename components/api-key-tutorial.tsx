"use client";
import { useRef, useState } from "react";
import { PlayCircle, ArrowDownToLine } from "lucide-react";
const chapters=[{time:0,label:"Mở website và kết nối AI"},{time:16,label:"Lấy khóa OpenAI"},{time:61,label:"Nhớ khóa và chọn mô hình"},{time:82,label:"Lấy khóa Gemini"},{time:99,label:"Tạo project và khóa Gemini"},{time:139,label:"Dán khóa Gemini vào website"}];
function timeLabel(seconds:number){return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");}
export default function ApiKeyTutorial(){
  const video=useRef<HTMLVideoElement>(null);const [notice,setNotice]=useState("");const [failed,setFailed]=useState(false);
  function jump(seconds:number){
    const player=video.current;if(!player)return;setNotice("");
    const seek=()=>{player.currentTime=seconds;};
    if(player.readyState>=1)seek();else{player.addEventListener("loadedmetadata",seek,{once:true});player.load();}
    void player.play().catch(error=>{if(error instanceof DOMException&&error.name==="AbortError")return;setNotice("Nhấn nút phát trên video để xem phần đã chọn.");});
    player.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  }
  return <section className="api-video-guide" id="video-api-key" aria-labelledby="api-video-title">
    <div className="video-guide-heading"><span><PlayCircle size={21}/></span><div><h2 id="api-video-title">Video lấy khóa API OpenAI & Gemini</h2><p>Xem thao tác trực tiếp · 2 phút 28 giây</p></div></div>
    <video ref={video} className="tutorial-video" aria-label="Video hướng dẫn lấy khóa API OpenAI và Google Gemini" controls playsInline preload="metadata" poster="/videos/lay-api-key-poster.webp" width={1920} height={1080} onPlaying={()=>setNotice("")} onError={()=>setFailed(true)}>
      <source src="/videos/lay-api-key.mp4" type="video/mp4"/>
      <track src="/videos/lay-api-key.vi.vtt" kind="subtitles" srcLang="vi" label="Chỉ dẫn thao tác (Tiếng Việt)"/>
      Trình duyệt chưa hỗ trợ phát video. <a href="/videos/lay-api-key.mp4">Mở video hướng dẫn</a>.
    </video>
    <div className="video-chapters" aria-label="Các phần trong video">{chapters.map(chapter=><button key={chapter.time} onClick={()=>jump(chapter.time)} disabled={failed}><time>{timeLabel(chapter.time)}</time><span>{chapter.label}</span></button>)}</div>
    {failed&&<p className="notice-message" role="status">Chưa tải được video. Hãy thử tải lại trang hoặc dùng liên kết tải video bên dưới.</p>}
    {notice&&<p className="video-note" role="status">{notice}</p>}
    <div className="video-guide-footer"><p>Khóa API và thông tin tài khoản trong đoạn minh họa đã được che. Thầy cô dùng khóa riêng của mình.</p><a href="/videos/lay-api-key.mp4" download="huong-dan-lay-api-key.mp4"><ArrowDownToLine size={15}/>Tải video</a></div>
    <p className="video-note">Video minh họa thao tác lấy khóa AI. Phần kết nối Google Drive có <a href="/drive-setup">hướng dẫn cấu hình riêng</a>.</p>
  </section>;
}
