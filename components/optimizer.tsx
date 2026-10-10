"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, CircleHelp, Clipboard, FileText, History, KeyRound, LoaderCircle, MessageCircle, Plus, ShieldCheck, Sparkles, Trash2, Upload, X, Eye, EyeOff } from "lucide-react";
import { tasks, providers, emptyDraft, type Draft, type Provider, type TaskId, type TaskField, type OptimizerResult, type Answer, type HistoryEntry } from "@/lib/config";
import { HISTORY_KEY, serializeHistory, deserializeHistory } from "@/lib/storage";

function Field({ label, name, value, onChange, placeholder, options, list }: {
  label: string; name: string; value: string; onChange: (value: string) => void;
  placeholder?: string; options?: readonly string[]; list?: string[];
}) {
  return <label className="field" htmlFor={name}><span id={name + "-label"}>{label}</span>
    {options ? <select id={name} aria-labelledby={name + "-label"} value={value} onChange={e => onChange(e.target.value)}><option value="">Chọn thông tin</option>{options.map(o => <option key={o}>{o}</option>)}</select> :
      <><input id={name} aria-labelledby={name + "-label"} value={value} maxLength={6000} onChange={e => onChange(e.target.value)} placeholder={placeholder} list={list ? name + "-options" : undefined} />
      {list && <datalist id={name + "-options"}>{list.map(o => <option key={o} value={o} />)}</datalist>}</>}
  </label>;
}
export default function Optimizer() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState<string>(providers.openai.defaultModel);
  const [keys, setKeys] = useState<Record<Provider, string>>({ openai: "", gemini: "" });
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [modal, setModal] = useState<"history" | "help" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const questionBox = useRef<HTMLDivElement>(null);
  const outputBox = useRef<HTMLDivElement>(null);
  const selectedTask = tasks.find(t => t.id === draft.task)!;
  const step = result?.status === "ready" ? 3 : result?.status === "questions" ? 2 : 1;

  useEffect(() => {
    try { setHistory(deserializeHistory(localStorage.getItem(HISTORY_KEY))); } catch { setNotice("Trình duyệt đang chặn lưu lịch sử. Bạn vẫn có thể tối ưu và tải prompt."); }
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [modal]);
  useEffect(() => {
    if (result?.status === "questions") questionBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (result?.status === "ready") outputBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);
  function persist(next: HistoryEntry[]) {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, serializeHistory(next)); }
    catch { setNotice("Không lưu được lịch sử trên trình duyệt. Hãy sao chép hoặc tải prompt để giữ lại."); }
  }
  function changeDraft(patch: Partial<Draft>) {
    setDraft(previous => ({ ...previous, ...patch }));
    setResult(null); setAnswers([]); setCurrentAnswers({}); setError(""); setCopied(false);
  }
  function setField(key: string, value: string) { changeDraft({ fields: { ...draft.fields, [key]: value } }); }
  function changeProvider(value: Provider) {
    setProvider(value); setModel(providers[value].defaultModel); setShowKey(false); setError("");
  }
  function newPrompt() {
    setDraft(emptyDraft); setResult(null); setAnswers([]); setCurrentAnswers({}); setError(""); setNotice(""); setCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function optimize(continueQuestions = false) {
    setError(""); setNotice(""); setCopied(false);
    if (!draft.originalPrompt.trim()) { setError("Thầy cô hãy dán hoặc viết yêu cầu ban đầu trước khi tối ưu."); document.getElementById("original-prompt")?.focus(); return; }
    if (!keys[provider].trim()) { setError("Thầy cô hãy nhập khóa API của " + providers[provider].label + " để sử dụng AI."); document.getElementById("api-key")?.focus(); return; }
    let nextAnswers = answers;
    if (continueQuestions && result?.status === "questions") {
      const missing = result.questions.find(q => !currentAnswers[q.id]?.trim());
      if (missing) { setError("Vui lòng trả lời đầy đủ các câu hỏi bổ sung. Có thể ghi “không yêu cầu” nếu không áp dụng."); document.getElementById("answer-" + missing.id)?.focus(); return; }
      const additions = result.questions.map(q => ({ id: q.id, question: q.question, answer: currentAnswers[q.id].trim() }));
      const map = new Map([...answers, ...additions].map(a => [a.id, a]));
      nextAnswers = Array.from(map.values());
    }
    const requestController = new AbortController();
    controller.current = requestController;
    const timeout = window.setTimeout(() => requestController.abort(), 58000);
    setBusy(true);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST", headers: { "Content-Type": "application/json", "x-provider-key": keys[provider].trim() },
        body: JSON.stringify({ provider, model, draft, answers: nextAnswers }),
        signal: requestController.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa thể tối ưu prompt. Vui lòng thử lại.");
      setResult(data); setAnswers(nextAnswers); setCurrentAnswers({});
      if (data.status === "ready") {
        const entry: HistoryEntry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), draft, provider, model, result: data };
        persist([entry, ...history].slice(0, 20));
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setNotice("Yêu cầu đã dừng hoặc hết thời gian chờ. Thông tin của thầy cô vẫn được giữ.");
      else setError(e instanceof Error ? e.message : "Chưa thể kết nối với AI. Vui lòng thử lại.");
    } finally { window.clearTimeout(timeout); setBusy(false); controller.current = null; }
  }
  async function copy() {
    if (!result?.optimizedPrompt) return;
    try { await navigator.clipboard.writeText(result.optimizedPrompt); setCopied(true); }
    catch { setNotice("Trình duyệt chưa cho phép sao chép. Thầy cô có thể chọn nội dung prompt hoặc tải TXT."); }
  }
  function download(format: "txt" | "md") {
    if (!result?.optimizedPrompt) return;
    const url = URL.createObjectURL(new Blob([result.optimizedPrompt], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "prompt-" + draft.task + "." + format;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  function load(entry: HistoryEntry) {
    setDraft(entry.draft); setProvider(entry.provider); setModel(entry.model); setResult(entry.result);
    setAnswers([]); setCurrentAnswers({}); setError(""); setNotice(""); setCopied(false); setModal(null);
  }

  return <div className="site-shell">
    <a className="skip-link" href="#workspace">Đến trình tối ưu</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="Prompt Giáo Viên — Trang chủ"><span className="brand-icon"><BookOpen size={23} /></span><span>Prompt<span className="brand-light"> Giáo Viên</span><small>Ý tưởng tốt, câu lệnh rõ</small></span></a>
      <nav aria-label="Điều hướng chính"><a className="nav-active" href="#workspace">Trình tối ưu</a><button onClick={() => setModal("history")} disabled={busy}><History size={17} />Lịch sử{history.length > 0 && <span className="count">{history.length}</span>}</button><button className="help-button" aria-label="Hướng dẫn" onClick={() => setModal("help")}><CircleHelp size={18} /><span>Hướng dẫn</span></button></nav>
    </div></header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span />DÀNH CHO GIÁO VIÊN MỌI CẤP HỌC</div><h1>Ý tưởng của thầy cô.<br /><span>Prompt rõ ràng hơn.</span></h1><p>Biến yêu cầu ban đầu thành câu lệnh đầy đủ, đúng mục tiêu,<br className="desktop-break" /> bám tài liệu và form mẫu — với sự hỗ trợ của AI.</p><div className="hero-tags"><span><Check size={14} />6 nhóm công việc</span><span><Check size={14} />OpenAI & Gemini</span><span><Check size={14} />Không cần đăng nhập</span></div></div>
        <div className="hero-visual" aria-hidden="true"><div className="visual-orbit" /><div className="prompt-preview"><div className="preview-top"><span className="preview-icon"><Sparkles size={20} /></span><div><strong>Một prompt tốt bắt đầu</strong><small>từ thông tin rõ ràng</small></div><span className="preview-status"><CheckCheck size={18} /></span></div><div className="preview-lines"><i /><i /><i /></div><div className="preview-pills"><span>Mục tiêu</span><span>Bối cảnh</span><span>Đầu ra</span></div><div className="preview-footer"><ShieldCheck size={15} /> Bám tài liệu · Đúng form mẫu</div></div><div className="float-badge"><MessageCircle size={17} />AI hỏi lại khi cần</div></div>
      </section>
      <section className="workspace" id="workspace">
        <div className="steps" aria-label="Tiến trình tối ưu">{["Nhập yêu cầu", "Bổ sung thông tin", "Nhận prompt tối ưu"].map((label, i) => <div key={label} className={step === i + 1 ? "step current" : step > i + 1 ? "step completed" : "step"} aria-current={step === i + 1 ? "step" : undefined}><span className="step-number">{step > i + 1 ? <Check size={16} /> : "0" + (i + 1)}</span><span>{label}</span>{i < 2 && <ChevronRight size={16} className="step-chevron" />}</div>)}</div>
        <div className="workspace-grid">
          <div className="input-column">
            <section className="card input-card" aria-labelledby="input-title"><div className="card-heading"><div><span className="section-eyebrow">BẮT ĐẦU TỪ Ý TƯỞNG CỦA THẦY CÔ</span><h2 id="input-title">Thầy cô muốn làm gì?</h2></div><button className="icon-button" onClick={newPrompt} disabled={busy} aria-label="Tạo prompt mới" title="Tạo prompt mới"><Plus size={20} /></button></div>
              <fieldset disabled={busy}>
                <label className="field task-field" htmlFor="task"><span>Loại công việc</span><select id="task" aria-label="Loại công việc" value={draft.task} onChange={e => {
                  const common = Object.fromEntries(Object.entries(draft.fields).filter(([k]) => ["level", "grade", "subject", "topic", "duration", "audience", "objectives", "curriculum", "equipment", "methods", "extra"].includes(k)));
                  changeDraft({ task: e.target.value as TaskId, fields: common });
                }}>{tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select><small>{selectedTask.description}</small></label>
                <label className="field prompt-field" htmlFor="original-prompt"><span>Prompt / yêu cầu ban đầu <span className="required">*</span></span><textarea id="original-prompt" maxLength={20000} rows={5} value={draft.originalPrompt} onChange={e => changeDraft({ originalPrompt: e.target.value })} placeholder="Dán prompt đã có hoặc viết điều thầy cô muốn AI thực hiện…" /><div className="textarea-meta"><button className="text-button" type="button" onClick={() => changeDraft({ originalPrompt: selectedTask.example })}><Sparkles size={13} />Dùng ví dụ</button><span>{draft.originalPrompt.length.toLocaleString("vi-VN")} / 20.000</span></div></label>
                <div className="section-divider"><span>Thông tin dạy học</span><small>AI sẽ hỏi thêm nếu còn thiếu</small></div>
                <div className="form-grid">
                  <Field name="level" label="Cấp học" value={draft.fields.level || ""} onChange={v => setField("level", v)} options={["Mầm non", "Tiểu học", "THCS", "THPT", "Giáo dục thường xuyên", "Cao đẳng / Đại học", "Giáo dục nghề nghiệp", "Khác"]} />
                  <Field name="grade" label="Lớp / nhóm tuổi" value={draft.fields.grade || ""} onChange={v => setField("grade", v)} placeholder="Ví dụ: Lớp 6" list={Array.from({ length: 12 }, (_, i) => "Lớp " + (i + 1))} />
                  <Field name="subject" label="Môn học / lĩnh vực" value={draft.fields.subject || ""} onChange={v => setField("subject", v)} placeholder="Chọn hoặc nhập môn học" list={["Toán", "Ngữ văn", "Tiếng Việt", "Tiếng Anh", "Khoa học tự nhiên", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tin học", "Công nghệ", "Giáo dục công dân", "Âm nhạc", "Mĩ thuật", "Giáo dục thể chất", "Hoạt động trải nghiệm"]} />
                  <Field name="duration" label="Thời lượng" value={draft.fields.duration || ""} onChange={v => setField("duration", v)} placeholder="Ví dụ: 2 tiết × 45 phút" list={["35 phút", "45 phút", "60 phút", "2 tiết × 45 phút", "3 tiết × 45 phút"]} />
                  <Field name="topic" label="Bài / chủ đề" value={draft.fields.topic || ""} onChange={v => setField("topic", v)} placeholder="Tên bài hoặc chủ đề cần thực hiện" />
                  <Field name="audience" label="Đối tượng học sinh" value={draft.fields.audience || ""} onChange={v => setField("audience", v)} placeholder="Trình độ, sĩ số, nhu cầu hỗ trợ…" list={["Năng lực hỗn hợp", "Cần hỗ trợ kiến thức cơ bản", "Mức độ trung bình", "Khá / giỏi"]} />
                </div>
                <label className="field" htmlFor="objectives"><span>Mục tiêu mong muốn</span><textarea id="objectives" rows={2} maxLength={6000} value={draft.fields.objectives || ""} onChange={e => setField("objectives", e.target.value)} placeholder="Kiến thức, kỹ năng, năng lực hoặc sản phẩm học tập cần đạt…" /></label>
                <label className="math-toggle"><input type="checkbox" aria-label="Có công thức toán" checked={draft.math} onChange={e => changeDraft({ math: e.target.checked })} /><span><strong>Có công thức toán</strong><small>Yêu cầu viết LaTeX trong cặp dấu <code>$...$</code></small></span><span className="math-symbol" aria-hidden="true">ƒ(x)</span></label>
                <details className="expandable"><summary>Yêu cầu riêng cho {selectedTask.label.toLowerCase()}<span className="optional">Tùy chọn</span></summary><div className="details-body form-grid">{(selectedTask.fields as readonly TaskField[]).map(f => <Field key={f.key} name={f.key} label={f.label} value={draft.fields[f.key] || ""} onChange={v => setField(f.key, v)} placeholder={f.placeholder} options={f.options} />)}</div></details>
                <details className="expandable"><summary>Tài liệu & form mẫu<span className="optional">Tùy chọn</span></summary><div className="details-body"><p className="muted-note">Ghi mô tả hoặc chọn tên tệp để prompt nhắc đính kèm. Nội dung tệp vẫn ở thiết bị; thầy cô đính kèm lại khi dùng prompt với công cụ AI.</p><label className="field" htmlFor="sources"><span>Tài liệu cần bám sát</span><textarea id="sources" maxLength={12000} rows={3} value={draft.sourceNotes} onChange={e => changeDraft({ sourceNotes: e.target.value })} placeholder="Tên SGK, bài/trang, tài liệu tham khảo và yêu cầu sử dụng…" /></label><label className="field" htmlFor="template"><span>Form mẫu / cấu trúc đầu ra</span><textarea id="template" maxLength={12000} rows={3} value={draft.templateNotes} onChange={e => changeDraft({ templateNotes: e.target.value })} placeholder="Dán cấu trúc mẫu, các đề mục hoặc mô tả form bắt buộc…" /></label><label className="upload-button" htmlFor="attachments"><Upload size={17} />Chọn tên tệp tài liệu / mẫu<input id="attachments" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={e => {
                    const names = Array.from(e.target.files || []).map(f => f.name);
                    const combined = Array.from(new Set([...draft.fileNames, ...names]));
                    if (combined.length > 15) setNotice("Đã giữ tối đa 15 tên tệp.");
                    changeDraft({ fileNames: combined.slice(0, 15) }); e.target.value = "";
                  }} /></label><small className="file-hint">PDF, Word, ảnh · tối đa 15 tên tệp · nội dung tệp không được gửi lên</small>{draft.fileNames.length > 0 && <div className="file-chips">{draft.fileNames.map(name => <span key={name}><FileText size={13} /><span>{name}</span><button type="button" aria-label={"Bỏ tệp " + name} onClick={() => changeDraft({ fileNames: draft.fileNames.filter(n => n !== name) })}><X size={13} /></button></span>)}</div>}</div></details>
                <details className="expandable"><summary>Chương trình & điều kiện dạy học<span className="optional">Tùy chọn</span></summary><div className="details-body form-grid">{[
                  { key: "curriculum", label: "Chương trình / bộ sách", placeholder: "Chương trình và bộ sách đang sử dụng" },
                  { key: "equipment", label: "Thiết bị / điều kiện", placeholder: "Máy chiếu, phòng thí nghiệm, học ngoại tuyến…" },
                  { key: "methods", label: "Phương pháp mong muốn", placeholder: "Dạy học nhóm, dự án, trạm, trò chơi…" },
                  { key: "extra", label: "Yêu cầu khác", placeholder: "Phân hóa, năng lực số, quy định riêng…" }
                ].map(f => <Field key={f.key} name={f.key} label={f.label} value={draft.fields[f.key] || ""} onChange={v => setField(f.key, v)} placeholder={f.placeholder} />)}</div></details>
              </fieldset>
            </section>
            <section className="card connection-card" aria-labelledby="connection-title"><div className="connection-heading"><span className="small-icon"><KeyRound size={18} /></span><div><h2 id="connection-title">Kết nối AI của thầy cô</h2><p>Chọn nhà cung cấp và nhập khóa API cá nhân.</p></div><span className="session-badge">Chỉ trong phiên</span></div><fieldset disabled={busy}><div className="provider-tabs" role="group" aria-label="Nhà cung cấp AI">{(["openai", "gemini"] as const).map(p => <button key={p} type="button" className={provider === p ? "provider-tab selected" : "provider-tab"} onClick={() => changeProvider(p)} aria-pressed={provider === p}><Sparkles size={16} />{providers[p].label}{provider === p && <Check size={15} />}</button>)}</div><label className="field" htmlFor="api-key"><span>Khóa API <a href={providers[provider].keyUrl} target="_blank" rel="noopener noreferrer">Lấy khóa API <ArrowRight size={12} /></a></span><div className="password-input"><input id="api-key" aria-label="Khóa API" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} value={keys[provider]} maxLength={512} onChange={e => setKeys(previous => ({ ...previous, [provider]: e.target.value }))} placeholder={provider === "openai" ? "Nhập khóa API OpenAI…" : "Nhập khóa API Gemini…"} /><button type="button" aria-label={showKey ? "Ẩn khóa API" : "Hiện khóa API"} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button><button type="button" aria-label="Xóa khóa API trong phiên" onClick={() => setKeys(previous => ({ ...previous, [provider]: "" }))}><X size={17} /></button></div></label><label className="field" htmlFor="model"><span>Mô hình</span><select id="model" value={model} onChange={e => setModel(e.target.value)}>{providers[provider].models.map(m => <option key={m}>{m}</option>)}</select></label></fieldset><p className="privacy-note"><ShieldCheck size={15} />Khóa API không được lưu vào lịch sử. Chi phí theo tài khoản API của thầy cô.</p></section>
            <div className="feedback" aria-live="polite">{error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="notice-message">{notice}</p>}</div>
            {result?.status === "questions" && <section className="card question-card" ref={questionBox} aria-labelledby="question-title"><div className="question-heading"><MessageCircle size={22} /><div><span className="section-eyebrow">THÊM MỘT CHÚT THÔNG TIN</span><h2 id="question-title">AI cần thầy cô làm rõ</h2></div></div><p className="question-summary">{result.summary}</p><fieldset disabled={busy}>{result.questions.map((q, i) => <label className="field question-field" key={q.id} htmlFor={"answer-" + q.id}><span>{i + 1}. {q.question}</span>{q.hint && <small>{q.hint}</small>}<textarea id={"answer-" + q.id} rows={2} maxLength={6000} value={currentAnswers[q.id] || ""} onChange={e => setCurrentAnswers(previous => ({ ...previous, [q.id]: e.target.value }))} placeholder="Trả lời tại đây; ghi “không yêu cầu” nếu không áp dụng…" /></label>)}</fieldset></section>}
            <div className="action-area"><button className="primary-button optimize-button" onClick={() => optimize(result?.status === "questions")} disabled={busy}>{busy ? <><LoaderCircle size={19} className="spin" />AI đang xem xét yêu cầu…</> : <><Sparkles size={19} />{result?.status === "questions" ? "Gửi bổ sung & tối ưu prompt" : "Tối ưu prompt với AI"}<ArrowRight size={18} /></>}</button>{busy ? <button className="text-button" onClick={() => controller.current?.abort()}>Dừng yêu cầu</button> : <p><ShieldCheck size={13} />AI hỏi lại khi thiếu thông tin quan trọng.</p>}</div>
          </div>
          <aside className="output-column"><section className="card output-card" ref={outputBox} aria-labelledby="output-title"><div className="card-heading"><div><span className="section-eyebrow">TỪ Ý TƯỞNG ĐẾN CÂU LỆNH</span><h2 id="output-title">Prompt đã tối ưu</h2></div><span className={"output-state " + (result?.status === "ready" ? "ready" : "")}>{result?.status === "ready" ? "Hoàn tất" : "Chờ yêu cầu"}</span></div>
            {result?.status === "ready" ? <><p className="result-summary">{result.summary}</p><div className="output-toolbar"><button className="copy-button" onClick={copy}>{copied ? <CheckCheck size={16} /> : <Clipboard size={16} />}{copied ? "Đã sao chép" : "Sao chép"}</button><button className="download-button" onClick={() => download("txt")}><ArrowDownToLine size={15} />TXT</button><button className="download-button" onClick={() => download("md")}><ArrowDownToLine size={15} />MD</button></div><pre className="prompt-output" tabIndex={0}>{result.optimizedPrompt}</pre>{result.improvements.length > 0 && <div className="improvements"><h3><CheckCheck size={16} />Điểm đã cải thiện</h3><ul>{result.improvements.map((v, i) => <li key={i}><Check size={14} />{v}</li>)}</ul></div>}<div className="next-use"><strong>Bước tiếp theo của thầy cô</strong><p>Sao chép prompt sang công cụ AI, đính kèm tài liệu và form mẫu được yêu cầu, rồi kiểm tra sản phẩm trước khi sử dụng.</p></div></> : <div className="empty-output"><div className={"empty-art " + (busy ? "working" : "")}><span className="art-back" /><span className="art-sheet"><FileText size={38} /></span><span className="art-spark"><Sparkles size={23} /></span></div><h3>{busy ? "AI đang tối ưu yêu cầu" : result?.status === "questions" ? "Chờ thông tin bổ sung" : "Prompt tốt đang chờ thầy cô"}</h3><p>{busy ? "AI kiểm tra bối cảnh, mục tiêu và những thông tin cần làm rõ." : result?.status === "questions" ? "Trả lời các câu hỏi của AI để nhận prompt đầy đủ và phù hợp hơn." : "Nhập ý tưởng, thêm thông tin dạy học và để AI giúp câu lệnh rõ ràng hơn."}</p><div className="empty-checks"><span><Check size={15} />Mục tiêu và bối cảnh rõ ràng</span><span><Check size={15} />Yêu cầu bám tài liệu, đúng mẫu</span><span><Check size={15} />Định dạng đầu ra cụ thể</span></div></div>}
          </section><div className="teacher-note"><span><BookOpen size={18} /></span><p><strong>Thầy cô giữ quyền quyết định.</strong> AI hỗ trợ diễn đạt yêu cầu; thầy cô kiểm tra prompt và điều chỉnh theo lớp học thực tế.</p></div></aside>
        </div>
      </section>
    </main>
    <footer className="site-footer"><span><BookOpen size={16} />Prompt Giáo Viên</span><p>Câu lệnh rõ hơn · Dạy học theo cách của thầy cô</p><button className="text-button" onClick={() => setModal("help")}>Hướng dẫn & quyền riêng tư</button></footer>
    {modal && <dialog ref={dialog} className="modal" onCancel={() => setModal(null)} onClick={e => { if (e.target === dialog.current) setModal(null); }} aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{modal === "history" ? "Lịch sử prompt" : "Sử dụng Prompt Giáo Viên"}</h2><button className="icon-button" onClick={() => setModal(null)} aria-label="Đóng"><X size={20} /></button></div>{modal === "history" ? <div className="modal-body"><p className="muted-note">Tối đa 20 prompt gần nhất, chỉ lưu trên trình duyệt này. Xóa dữ liệu trình duyệt sẽ xóa lịch sử.</p>{history.length ? <><div className="history-list">{history.map(entry => <div className="history-item" key={entry.id}><button onClick={() => load(entry)}><span className="history-task">{tasks.find(t => t.id === entry.draft.task)?.label}</span><strong>{entry.draft.fields.topic || entry.draft.originalPrompt.slice(0, 100)}</strong><small>{new Date(entry.createdAt).toLocaleString("vi-VN")} · {providers[entry.provider].label}</small></button><button className="icon-button" onClick={() => persist(history.filter(h => h.id !== entry.id))} aria-label={"Xóa prompt " + entry.draft.originalPrompt.slice(0, 40)}><Trash2 size={17} /></button></div>)}</div><button className="danger-button" onClick={() => { if (window.confirm("Xóa toàn bộ lịch sử prompt trên trình duyệt này?")) persist([]); }}><Trash2 size={16} />Xóa toàn bộ lịch sử</button></> : <div className="modal-empty"><History size={36} /><h3>Chưa có prompt được lưu</h3><p>Prompt hoàn chỉnh sẽ tự xuất hiện ở đây sau khi tối ưu.</p></div>}</div> : <div className="modal-body help-content"><ol><li><strong>Chọn công việc và dán prompt ban đầu.</strong> Thêm thông tin lớp học; những mục đã có trong prompt không cần nhập lại.</li><li><strong>Chọn OpenAI hoặc Gemini và nhập khóa API.</strong> Khóa cá nhân có thể tạo tại <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI</a> hoặc <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>. Khả năng sử dụng phụ thuộc quyền và hạn mức tài khoản.</li><li><strong>Trả lời câu hỏi bổ sung.</strong> AI hỏi điều cần thiết trước khi tạo prompt hoàn chỉnh. Có thể ghi “không yêu cầu” khi mục đó không áp dụng.</li><li><strong>Sao chép hoặc tải TXT/Markdown.</strong> Dùng prompt ở công cụ AI và đính kèm lại tài liệu/form mẫu.</li></ol><div className="help-privacy"><h3><ShieldCheck size={18} />Thông tin của thầy cô</h3><p>Khóa API chỉ giữ trong bộ nhớ của tab đang mở. Khóa đi qua máy chủ website để gọi nhà cung cấp đã chọn, không được lưu vào lịch sử; tải lại trang sẽ cần nhập lại.</p><p>Prompt, thông tin đã nhập, mô tả và tên tài liệu được gửi đến nhà cung cấp AI. Nội dung tệp được chọn không được đọc hoặc tải lên. Lịch sử prompt lưu trong trình duyệt và có thể xóa ở mục Lịch sử.</p><p>Khi bật “Có công thức toán”, prompt yêu cầu viết LaTeX trong <code>$...$</code>, ví dụ <code>{"$\\frac{a}{b}$"}</code>.</p></div></div>}</dialog>}
  </div>;
}
