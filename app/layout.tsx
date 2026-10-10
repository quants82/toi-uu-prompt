import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Prompt Giáo Viên — Tối ưu yêu cầu, nâng chất lượng dạy học",
  description: "Tối ưu prompt cho giáo viên mọi cấp học: kế hoạch bài dạy, phiếu học tập, bài tập phân hóa, đề kiểm tra, rubric và hoạt động. Hỗ trợ OpenAI và Gemini.",
  robots: { index: true, follow: true }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
