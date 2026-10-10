import type { Draft, Answer, OptimizerResult } from "./config";
export function learningRequirementsText(draft:Draft,answers:Answer[]=[]):string|null{
  const direct=draft.fields.learningRequirements;
  const answer=answers.filter(a=>a.id==="learningRequirements").at(-1)?.answer;
  const embedded=draft.originalPrompt.match(/<yeu_cau_can_dat>([\s\S]*?)<\/yeu_cau_can_dat>/i)?.[1];
  const text=direct?.trim()?direct:answer?.trim()?answer:embedded;
  if(!text?.trim()||/^(không yêu cầu|không áp dụng|không có|tự đề xuất|tự chọn)[.!\s]*$/i.test(text.trim()))return null;
  return text;
}
export function requirementsQuestion():OptimizerResult{return {
  status:"questions",summary:"Cần nguyên văn yêu cầu cần đạt để khóa nội dung chuẩn và bám sát môn học.",
  questions:[{id:"learningRequirements",question:"Thầy cô dán nguyên văn yêu cầu cần đạt của bài/chủ đề, từ chương trình hoặc tài liệu đang sử dụng.",hint:"Giữ đầy đủ câu chữ, thứ tự và công thức. Nếu đã ghi trong prompt ban đầu, sao chép phần đó vào đây để khóa nguyên văn. Không dùng “không yêu cầu” cho mục này."}],optimizedPrompt:"",improvements:[]
};}
