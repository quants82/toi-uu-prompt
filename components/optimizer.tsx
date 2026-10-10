"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, CircleHelp, Clipboard, FileText, History, KeyRound, LoaderCircle, MessageCircle, Plus, ShieldCheck, Sparkles, Trash2, Upload, X, Eye, EyeOff } from "lucide-react";
import { tasks, providers, emptyDraft, type Draft, type Provider, type TaskId, type TaskField, type OptimizerResult, type Answer, type HistoryEntry } from "@/lib/config";
import { HISTORY_KEY, serializeHistory, deserializeHistory } from "@/lib/storage";
import { readSavedKey, storeSavedKey } from "@/lib/credentials";
import { teacherRole } from "@/lib/roles";
import TemplateLibrary from "./template-library";
import AiWorking from "./ai-working";
import type { FormTemplate } from "@/lib/template-types";
import { learningRequirementsText } from "@/lib/learning-requirements";

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
  const [modelChoices, setModelChoices] = useState<Record<Provider, { value: string; custom: boolean }>>({ openai: { value: providers.openai.defaultModel, custom: false }, gemini: { value: providers.gemini.defaultModel, custom: false } });
  const [availableModels, setAvailableModels] = useState<Record<Provider, string[]>>({ openai: [], gemini: [] });
  const [modelMessages, setModelMessages] = useState<Record<Provider, string>>({ openai: "", gemini: "" });
  const [modelBusy, setModelBusy] = useState<Provider | null>(null);
  const [rememberKeys, setRememberKeys] = useState<Record<Provider, boolean>>({ openai: false, gemini: false });
  const [exportingWord, setExportingWord] = useState(false);
  const model = modelChoices[provider].value;
  function setModel(value: string, custom = modelChoices[provider].custom) { setModelChoices(previous => ({ ...previous, [provider]: { value, custom } })); }
  const [keys, setKeys] = useState<Record<Provider, string>>({ openai: "", gemini: "" });
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [libraryBusy,setLibraryBusy]=useState(true);
  const [selectedTemplate,setSelectedTemplate]=useState<FormTemplate|null>(null);
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
    try {
      const saved = { openai: readSavedKey(localStorage, "openai"), gemini: readSavedKey(localStorage, "gemini") };
      setKeys(saved); setRememberKeys({ openai: Boolean(saved.openai), gemini: Boolean(saved.gemini) });
    } catch { setNotice("Trình duyệt đang chặn lưu khóa API. Thầy cô vẫn có thể nhập khóa để sử dụng trong phiên."); }
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
  const changeTemplate=useCallback(()=>{setResult(null);setAnswers([]);setCurrentAnswers({});setError("");setCopied(false);},[]);
  function setField(key: string, value: string) { changeDraft({ fields: { ...draft.fields, [key]: value } }); }
  function changeProvider(value: Provider) {
    setProvider(value); setShowKey(false); setError("");
  }
  function updateKey(value: string) {
    setKeys(previous => ({ ...previous, [provider]: value }));
    if (rememberKeys[provider]) {
      try { storeSavedKey(localStorage, provider, value); }
      catch { setNotice("Không cập nhật được khóa đã lưu. Hãy kiểm tra quyền lưu dữ liệu trình duyệt hoặc xóa khóa đã lưu trước khi rời máy."); }
    }
  }
  function toggleRemember(enabled: boolean) {
    try {
      storeSavedKey(localStorage, provider, enabled ? keys[provider] : "");
      setRememberKeys(previous => ({ ...previous, [provider]: enabled }));
      setNotice(enabled ? "Đã bật nhớ khóa " + providers[provider].label + " trên trình duyệt này." : "Đã bỏ lưu khóa " + providers[provider].label + ". Khóa chỉ còn trong phiên hiện tại.");
    } catch { setNotice("Không thay đổi được việc lưu khóa. Vui lòng kiểm tra quyền lưu dữ liệu của trình duyệt."); }
  }
  function forgetKey() {
    setKeys(previous => ({ ...previous, [provider]: "" })); setShowKey(false);
    try { storeSavedKey(localStorage, provider, ""); setRememberKeys(previous => ({ ...previous, [provider]: false })); setNotice("Đã xóa khóa " + providers[provider].label + " trong phiên và trên trình duyệt."); }
    catch { setNotice("Đã xóa khóa trong phiên. Trình duyệt đang chặn thao tác xóa khóa đã lưu; hãy xóa dữ liệu website trong cài đặt trình duyệt."); }
  }
  async function refreshModels() {
    if (!keys[provider].trim()) { setError("Nhập khóa API trước khi tải danh sách mô hình."); document.getElementById("api-key")?.focus(); return; }
    const selectedProvider = provider; setModelBusy(provider); setError("");
    try {
      const response = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json", "x-provider-key": keys[provider].trim() }, body: JSON.stringify({ provider }), signal: AbortSignal.timeout(18000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa tải được danh sách mô hình.");
      if (!Array.isArray(data.models) || data.models.some((id: unknown) => typeof id !== "string" || !/^[a-zA-Z0-9._-]{1,100}$/.test(id))) throw new Error("Danh sách mô hình chưa hợp lệ.");
      setAvailableModels(previous => ({ ...previous, [selectedProvider]: data.models }));
      setModelMessages(previous => ({ ...previous, [selectedProvider]: data.models.length ? "Đã tải " + data.models.length + " mô hình văn bản từ API. Quyền gọi từng mô hình phụ thuộc tài khoản." : "API chưa trả mô hình văn bản phù hợp. Thầy cô có thể chọn mô hình gợi ý hoặc nhập mã khác." }));
    } catch (e) { setModelMessages(previous => ({ ...previous, [selectedProvider]: e instanceof Error && e.name !== "TimeoutError" ? e.message : "Chưa tải được mô hình. Thầy cô có thể dùng danh sách gợi ý hoặc thử lại." })); }
    finally { setModelBusy(null); }
  }
  function newPrompt() {
    setDraft(emptyDraft); setResult(null); setAnswers([]); setCurrentAnswers({}); setError(""); setNotice(""); setCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function optimize(continueQuestions = false) {
    setError(""); setNotice(""); setCopied(false);
    if (!draft.originalPrompt.trim()) { setError("Thầy cô hãy dán hoặc viết yêu cầu ban đầu trước khi tối ưu."); document.getElementById("original-prompt")?.focus(); return; }
    if (!keys[provider].trim()) { setError("Thầy cô hãy nhập khóa API của " + providers[provider].label + " để sử dụng AI."); document.getElementById("api-key")?.focus(); return; }
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model.trim())) { setError("Vui lòng chọn hoặc nhập mã mô hình hợp lệ."); document.getElementById("custom-model")?.focus(); return; }
    let nextAnswers = answers;
    if (continueQuestions && result?.status === "questions") {
      const missing = result.questions.find(q => !currentAnswers[q.id]?.trim());
      if (missing) { setError("Vui lòng trả lời đầy đủ các câu hỏi bổ sung. Có thể ghi “không yêu cầu” nếu không áp dụng."); document.getElementById("answer-" + missing.id)?.focus(); return; }
      const additions = result.questions.map(q => ({ id: q.id, question: q.question, answer: currentAnswers[q.id].trim() }));
      const map = new Map([...answers, ...additions].map(a => [a.id, a]));
      nextAnswers = Array.from(map.values());
    }
    const requirements=learningRequirementsText(draft,nextAnswers);
    const requestDraft:Draft={...draft,fields:{...draft.fields,...(requirements?{learningRequirements:requirements}:{})},formTemplate:selectedTemplate||undefined};
    const requestController = new AbortController();
    controller.current = requestController;
    const timeout = window.setTimeout(() => requestController.abort(), 58000);
    setBusy(true);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST", headers: { "Content-Type": "application/json", "x-provider-key": keys[provider].trim() },
        body: JSON.stringify({ provider, model: model.trim(), draft:requestDraft, answers: nextAnswers }),
        signal: requestController.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa thể tối ưu prompt. Vui lòng thử lại.");
      if(requirements)setDraft(requestDraft);
      setResult(data); setAnswers(nextAnswers); setCurrentAnswers({});
      if (data.status === "ready") {
        const entry: HistoryEntry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), draft:requestDraft, provider, model, result: data };
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
  async function downloadWord() {
    if (result?.status !== "ready") return;
    setExportingWord(true);
    try {
      const { promptWordBlob } = await import("@/lib/word");
      const blob = await promptWordBlob(draft, result.optimizedPrompt);
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "prompt-" + draft.task + ".docx";
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setNotice("Chưa xuất được file Word. Thầy cô có thể thử lại hoặc tải TXT/Markdown."); }
    finally { setExportingWord(false); }
  }
  function load(entry: HistoryEntry) {
    setDraft(entry.draft); setProvider(entry.provider); setShowKey(false); setModelChoices(previous => ({ ...previous, [entry.provider]: { value: entry.model, custom: ![...providers[entry.provider].models, ...availableModels[entry.provider]].includes(entry.model) } })); setResult(entry.result);
    setAnswers([]); setCurrentAnswers({}); setError(""); setNotice(""); setCopied(false); setModal(null);
  }

  return <div className="site-shell">
    <a className="skip-link" href="#workspace">Đến trình tối ưu</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="/" aria-label="Prompt Giáo Viên — Trang chủ"><span className="brand-icon"><BookOpen size={23} /></span><span>Prompt<span className="brand-light"> Giáo Viên</span><small>Ý tưởng tốt, câu lệnh rõ</small></span></a>
      <nav aria-label="Điều hướng chính"><a className="nav-active" href="#workspace">Trình tối ưu</a><button onClick={() => setModal("history")} disabled={busy||libraryBusy}><History size={17} />Lịch sử{history.length > 0 && <span className="count">{history.length}</span>}</button><button className="help-button" aria-label="Hướng dẫn" onClick={() => setModal("help")}><CircleHelp size={18} /><span>Hướng dẫn</span></button></nav>
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
            <section className="card input-card" aria-labelledby="input-title"><div className="card-heading"><div><span className="section-eyebrow">BẮT ĐẦU TỪ Ý TƯỞNG CỦA THẦY CÔ</span><h2 id="input-title">Thầy cô muốn làm gì?</h2></div><button className="icon-button" onClick={newPrompt} disabled={busy||libraryBusy} aria-label="Tạo prompt mới" title="Tạo prompt mới"><Plus size={20} /></button></div>
              <fieldset disabled={busy||libraryBusy}>
                <label className="field task-field" htmlFor="task"><span>Loại công việc</span><select id="task" aria-label="Loại công việc" value={draft.task} onChange={e => {
                  const common = Object.fromEntries(Object.entries(draft.fields).filter(([k]) => ["level", "grade", "subject", "topic", "duration", "audience", "objectives", "learningRequirements", "curriculum", "equipment", "methods", "extra", "roleMode", "role"].includes(k)));
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
                <label className="field locked-requirements" htmlFor="learning-requirements"><span>Yêu cầu cần đạt — giữ nguyên văn <ShieldCheck size={15}/></span><textarea id="learning-requirements" rows={4} maxLength={6000} value={draft.fields.learningRequirements||""} onChange={e=>setField("learningRequirements",e.target.value)} placeholder="Dán nguyên văn yêu cầu cần đạt của đúng môn, bài/chủ đề từ chương trình hoặc tài liệu thầy cô dùng…"/><small>Không sửa câu chữ, thứ tự, mức độ hay công thức. Nếu còn thiếu, website hỏi lại trước khi sinh prompt. Mục tiêu hoạt động riêng không thay thế yêu cầu cần đạt.</small></label>
                <label className="field" htmlFor="objectives"><span>Mục tiêu thiết kế / mong muốn bổ sung</span><textarea id="objectives" rows={2} maxLength={6000} value={draft.fields.objectives || ""} onChange={e => setField("objectives", e.target.value)} placeholder="Kiến thức, kỹ năng, năng lực hoặc sản phẩm học tập cần đạt…" /></label>
                <div className="role-panel"><label className="field" htmlFor="role-mode"><span>Vai trò của AI khi thực hiện prompt</span><select id="role-mode" value={draft.fields.roleMode || "subject"} onChange={e => setField("roleMode", e.target.value)}><option value="subject">Giáo viên giỏi bộ môn đã chọn</option><option value="custom">Tự viết vai trò</option></select></label>{draft.fields.roleMode === "custom" ? <Field name="ai-role" label="Vai trò tùy chỉnh" value={draft.fields.role || ""} onChange={v => setField("role", v)} placeholder="Ví dụ: Bạn là giáo viên giỏi bộ môn Vật lí…" /> : <p className="role-preview">{teacherRole(draft)}.</p>}</div>
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
            <TemplateLibrary draft={draft} disabled={busy||modelBusy!==null} onSelection={setSelectedTemplate} onChange={changeTemplate} onBusy={setLibraryBusy}/>
            <section className="card connection-card" aria-labelledby="connection-title">
              <div className="connection-heading"><span className="small-icon"><KeyRound size={18} /></span><div><h2 id="connection-title">Kết nối AI của thầy cô</h2><p>Chọn nhà cung cấp và mô hình phù hợp.</p></div><span className="session-badge">{rememberKeys[provider] ? "Nhớ trên trình duyệt" : "Chỉ trong phiên"}</span></div>
              <fieldset disabled={busy||libraryBusy || modelBusy !== null}>
                <div className="provider-tabs" role="group" aria-label="Nhà cung cấp AI">{(["openai", "gemini"] as const).map(p => <button key={p} type="button" className={provider === p ? "provider-tab selected" : "provider-tab"} onClick={() => changeProvider(p)} aria-pressed={provider === p}><Sparkles size={16} />{providers[p].label}{provider === p && <Check size={15} />}</button>)}</div>
                <label className="field" htmlFor="api-key"><span>Khóa API <a href={providers[provider].keyUrl} target="_blank" rel="noopener noreferrer">Lấy khóa API <ArrowRight size={12} /></a></span><div className="password-input"><input id="api-key" aria-label="Khóa API" type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} value={keys[provider]} maxLength={512} onChange={e => updateKey(e.target.value)} placeholder={provider === "openai" ? "Nhập khóa API OpenAI…" : "Nhập khóa API Gemini…"} /><button type="button" aria-label={showKey ? "Ẩn khóa API" : "Hiện khóa API"} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button><button type="button" aria-label="Xóa khóa API" onClick={forgetKey}><X size={17} /></button></div></label>
                <label className="remember-key"><input type="checkbox" checked={rememberKeys[provider]} onChange={e => toggleRemember(e.target.checked)} /><span>Nhớ khóa API {providers[provider].label} trên trình duyệt này</span></label>
                <p className="key-storage-note">Mặc định chỉ giữ khóa trong phiên. Nếu bật nhớ, khóa được lưu dạng văn bản trong trình duyệt; chỉ dùng trên máy cá nhân. Bỏ chọn để xóa bản lưu, hoặc nhấn nút × để xóa cả khóa trong phiên.</p>
                <label className="field" htmlFor="model"><span>Mô hình {providers[provider].label}</span><select id="model" aria-label="Mô hình" value={modelChoices[provider].custom ? "custom" : model} onChange={e => setModel(e.target.value === "custom" ? "" : e.target.value, e.target.value === "custom")}><optgroup label="Mô hình gợi ý">{providers[provider].models.map(m => <option key={m} value={m}>{m}</option>)}</optgroup>{availableModels[provider].filter(id => !(providers[provider].models as readonly string[]).includes(id)).length > 0 && <optgroup label="Mô hình lấy từ API">{availableModels[provider].filter(id => !(providers[provider].models as readonly string[]).includes(id)).map(id => <option key={id} value={id}>{id}</option>)}</optgroup>}<option value="custom">Mô hình khác — nhập mã</option></select></label>
                {modelChoices[provider].custom && <label className="field" htmlFor="custom-model"><span>Mã mô hình khác</span><input id="custom-model" value={model} maxLength={100} onChange={e => setModel(e.target.value, true)} placeholder={providers[provider].defaultModel} autoComplete="off" spellCheck={false} /></label>}
                <button className="text-button model-load" type="button" onClick={refreshModels}>{modelBusy ? <LoaderCircle size={15} className="spin" /> : <ArrowDownToLine size={15} />}{modelBusy ? "Đang tải mô hình…" : "Tải danh sách mô hình từ API"}</button>
                <p className="model-note" role="status">{modelMessages[provider] || "Chọn mô hình hỗ trợ văn bản và JSON có cấu trúc. Danh sách gợi ý có thể gồm mô hình cần quyền riêng; thầy cô có thể tải danh sách hiện tại từ API."}</p>
              </fieldset>
              <p className="privacy-note"><ShieldCheck size={15} />Khóa API không được lưu vào lịch sử prompt hoặc file tải về. Chi phí theo tài khoản API của thầy cô.</p>
            </section>
            <div className="feedback" aria-live="polite">{error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="notice-message">{notice}</p>}</div>
            {result?.status === "questions" && <section className="card question-card" ref={questionBox} aria-labelledby="question-title"><div className="question-heading"><MessageCircle size={22} /><div><span className="section-eyebrow">THÊM MỘT CHÚT THÔNG TIN</span><h2 id="question-title">AI cần thầy cô làm rõ</h2></div></div><p className="question-summary">{result.summary}</p><fieldset disabled={busy||libraryBusy}>{result.questions.map((q, i) => <label className="field question-field" key={q.id} htmlFor={"answer-" + q.id}><span>{i + 1}. {q.question}</span>{q.hint && <small>{q.hint}</small>}<textarea id={"answer-" + q.id} rows={2} maxLength={6000} value={currentAnswers[q.id] || ""} onChange={e => setCurrentAnswers(previous => ({ ...previous, [q.id]: e.target.value }))} placeholder={q.id==="learningRequirements"?"Dán nguyên văn yêu cầu cần đạt…":"Trả lời tại đây; ghi “không yêu cầu” nếu không áp dụng…"} /></label>)}</fieldset></section>}
            <div className="action-area"><button className="primary-button optimize-button" onClick={() => optimize(result?.status === "questions")} disabled={busy||libraryBusy || modelBusy !== null}>{busy ? <><LoaderCircle size={19} className="spin" />AI đang xem xét yêu cầu…</> : <><Sparkles size={19} />{result?.status === "questions" ? "Gửi bổ sung & tối ưu prompt" : "Tối ưu prompt với AI"}<ArrowRight size={18} /></>}</button>{busy ? <button className="text-button" onClick={() => controller.current?.abort()}>Dừng yêu cầu</button> : <p><ShieldCheck size={13} />AI hỏi lại khi thiếu thông tin quan trọng.</p>}</div>
          </div>
          <aside className="output-column"><section className="card output-card" ref={outputBox} aria-labelledby="output-title"><div className="card-heading"><div><span className="section-eyebrow">TỪ Ý TƯỞNG ĐẾN CÂU LỆNH</span><h2 id="output-title">Prompt đã tối ưu</h2></div><span className={"output-state " + (result?.status === "ready" ? "ready" : "")}>{busy?"Đang sinh prompt":result?.status === "ready" ? "Hoàn tất" : "Chờ yêu cầu"}</span></div>
            {busy ? <AiWorking subject={draft.fields.subject} formName={selectedTemplate?.name}/> : result?.status === "ready" ? <><p className="result-summary">{result.summary}</p><div className="output-toolbar"><button className="copy-button" onClick={copy}>{copied ? <CheckCheck size={16} /> : <Clipboard size={16} />}{copied ? "Đã sao chép" : "Sao chép"}</button><button className="download-button" onClick={() => download("txt")}><ArrowDownToLine size={15} />TXT</button><button className="download-button" onClick={() => download("md")}><ArrowDownToLine size={15} />MD</button><button className="download-button word-button" onClick={downloadWord} disabled={exportingWord} title="Tải prompt đã tối ưu dưới dạng Word (.docx)">{exportingWord ? <LoaderCircle size={15} className="spin" /> : <FileText size={15} />}{exportingWord ? "Đang xuất…" : "Word"}</button></div><pre className="prompt-output" tabIndex={0}>{result.optimizedPrompt}</pre>{result.improvements.length > 0 && <div className="improvements"><h3><CheckCheck size={16} />Điểm đã cải thiện</h3><ul>{result.improvements.map((v, i) => <li key={i}><Check size={14} />{v}</li>)}</ul></div>}<div className="next-use"><strong>Bước tiếp theo của thầy cô</strong><p>Sao chép prompt sang công cụ AI. Văn bản form đã chọn được chèn sẵn; đính kèm các tài liệu còn thiếu và kiểm tra sản phẩm, đặc biệt nguyên văn yêu cầu cần đạt.</p></div></> : <div className="empty-output"><div className={"empty-art " + (busy ? "working" : "")}><span className="art-back" /><span className="art-sheet"><FileText size={38} /></span><span className="art-spark"><Sparkles size={23} /></span></div><h3>{busy ? "AI đang tối ưu yêu cầu" : result?.status === "questions" ? "Chờ thông tin bổ sung" : "Prompt tốt đang chờ thầy cô"}</h3><p>{busy ? "AI kiểm tra bối cảnh, mục tiêu và những thông tin cần làm rõ." : result?.status === "questions" ? "Trả lời các câu hỏi của AI để nhận prompt đầy đủ và phù hợp hơn." : "Nhập ý tưởng, thêm thông tin dạy học và để AI giúp câu lệnh rõ ràng hơn."}</p><div className="empty-checks"><span><Check size={15} />Mục tiêu và bối cảnh rõ ràng</span><span><Check size={15} />Yêu cầu bám tài liệu, đúng mẫu</span><span><Check size={15} />Định dạng đầu ra cụ thể</span></div></div>}
          </section><div className="teacher-note"><span><BookOpen size={18} /></span><p><strong>Thầy cô giữ quyền quyết định.</strong> AI hỗ trợ diễn đạt yêu cầu; thầy cô kiểm tra prompt và điều chỉnh theo lớp học thực tế.</p></div></aside>
        </div>
      </section>
    </main>
    <footer className="site-footer"><span><BookOpen size={16} />Prompt Giáo Viên</span><p>Câu lệnh rõ hơn · Dạy học theo cách của thầy cô</p><button className="text-button" onClick={() => setModal("help")}>Hướng dẫn & quyền riêng tư</button></footer>
    {modal && <dialog ref={dialog} className="modal" onCancel={() => setModal(null)} onClick={e => { if (e.target === dialog.current) setModal(null); }} aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{modal === "history" ? "Lịch sử prompt" : "Sử dụng Prompt Giáo Viên"}</h2><button className="icon-button" onClick={() => setModal(null)} aria-label="Đóng"><X size={20} /></button></div>{modal === "history" ? <div className="modal-body"><p className="muted-note">Tối đa 20 prompt gần nhất, chỉ lưu trên trình duyệt này. Xóa dữ liệu trình duyệt sẽ xóa lịch sử.</p>{history.length ? <><div className="history-list">{history.map(entry => <div className="history-item" key={entry.id}><button onClick={() => load(entry)}><span className="history-task">{tasks.find(t => t.id === entry.draft.task)?.label}</span><strong>{entry.draft.fields.topic || entry.draft.originalPrompt.slice(0, 100)}</strong><small>{new Date(entry.createdAt).toLocaleString("vi-VN")} · {providers[entry.provider].label}</small></button><button className="icon-button" onClick={() => persist(history.filter(h => h.id !== entry.id))} aria-label={"Xóa prompt " + entry.draft.originalPrompt.slice(0, 40)}><Trash2 size={17} /></button></div>)}</div><button className="danger-button" onClick={() => { if (window.confirm("Xóa toàn bộ lịch sử prompt trên trình duyệt này?")) persist([]); }}><Trash2 size={16} />Xóa toàn bộ lịch sử</button></> : <div className="modal-empty"><History size={36} /><h3>Chưa có prompt được lưu</h3><p>Prompt hoàn chỉnh sẽ tự xuất hiện ở đây sau khi tối ưu.</p></div>}</div> : <div className="modal-body help-content"><ol><li><strong>Chọn công việc và dán prompt ban đầu.</strong> Thêm thông tin lớp học; những mục đã có trong prompt không cần nhập lại.</li><li><strong>Chọn OpenAI hoặc Gemini và nhập khóa API.</strong> Khóa cá nhân có thể tạo tại <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI</a> hoặc <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>. Khả năng sử dụng phụ thuộc quyền và hạn mức tài khoản.</li><li><strong>Trả lời câu hỏi bổ sung.</strong> AI hỏi điều cần thiết trước khi tạo prompt hoàn chỉnh. Có thể ghi “không yêu cầu” khi mục đó không áp dụng.</li><li><strong>Sao chép hoặc tải Word/TXT/Markdown.</strong> Dùng prompt ở công cụ AI; form trong thư viện đã được chèn văn bản vào prompt. Chỉ đính kèm các tài liệu còn thiếu.</li></ol><div className="help-privacy"><h3><ShieldCheck size={18} />Thông tin của thầy cô</h3><p>Khóa API chỉ giữ trong bộ nhớ của tab đang mở theo mặc định. Nếu bật “Nhớ khóa API”, khóa được lưu dạng văn bản trên trình duyệt hiện tại và nạp lại khi mở website; chỉ bật trên máy cá nhân. Bỏ chọn để xóa bản lưu hoặc nhấn × để xóa cả khóa trong phiên. Khóa đi qua máy chủ website để gọi nhà cung cấp đã chọn, không được ghi vào lịch sử prompt hay file Word/TXT/Markdown.</p><p>Prompt, thông tin đã nhập, mô tả và tên tài liệu được gửi đến nhà cung cấp AI. Các tệp trong mục tên tài liệu chỉ được ghi tên. Form trong thư viện được đọc văn bản, lưu trên trình duyệt và gửi đến AI khi tối ưu. Phiên Drive chỉ giữ trong bộ nhớ tab; quyền áp dụng cho các tệp đã chọn. Lịch sử prompt lưu trong trình duyệt và có thể xóa ở mục Lịch sử.</p><p>Khi bật “Có công thức toán”, prompt yêu cầu viết LaTeX trong <code>$...$</code>, ví dụ <code>{"$\\frac{a}{b}$"}</code>.</p></div></div>}</dialog>}
  </div>;
}
