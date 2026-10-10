# Prompt Giáo Viên

Website tiếng Việt giúp giáo viên mọi cấp học tối ưu prompt, sử dụng khóa API OpenAI hoặc Gemini cá nhân.

## Chức năng

- Chọn 6 nhóm công việc: kế hoạch bài dạy, phiếu học tập, bài tập theo mức độ, đề kiểm tra/ma trận, rubric, hoạt động/dàn ý slide.
- Dán yêu cầu ban đầu, chọn thông tin dạy học và các trường riêng theo công việc.
- AI hỏi bổ sung khi thiếu thông tin thiết yếu; chỉ khi đủ mới tạo prompt hoàn chỉnh.
- Tùy chọn công thức toán: LaTeX trong một cặp dấu `$...$`.
- Ghi mô tả tài liệu, cấu trúc form mẫu và chọn tên tệp PDF/Word/ảnh. **Không đọc hay tải nội dung tệp lên máy chủ.** Giáo viên đính kèm lại tài liệu khi sử dụng prompt tại công cụ AI khác.
- Sao chép, tải TXT/Markdown, tự lưu tối đa 20 prompt hoàn chỉnh trên trình duyệt.
- Giao diện nền sáng xanh dương, dùng được trên điện thoại, có hướng dẫn và lịch sử.

Website chỉ tạo prompt; không trực tiếp tạo giáo án hoặc tài liệu dạy học.

## Chạy trên máy

Cần Node.js 20.9 trở lên (khuyến nghị bản LTS hiện hành).

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:3000.

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Triển khai Vercel

1. Vercel → Add New → Project → Import repository `quants82/toi-uu-prompt`.
2. Project Name: `toi-uu-prompt`.
3. Application / Framework Preset: **Next.js**.
4. Root Directory: `./`.
5. Repo có `vercel.json` đặt Next.js, Install Command `npm ci`, Build Command `npm run build` và Output Directory mặc định. Tắt các tùy chỉnh Output Directory nếu có trong giao diện.
6. Environment Variables: không cần thêm khóa OpenAI/Gemini chung.
7. Deploy. Khi có trạng thái Ready, mở địa chỉ Vercel cấp.
8. Các commit vào nhánh production (`main`) kích hoạt triển khai lại.

Ứng dụng có route máy chủ `POST /api/optimize`; cần triển khai dưới dạng Next.js, không dùng static export.

## Dữ liệu và khóa API

- Khóa API chỉ nằm trong React state của tab đang mở; tải lại trang sẽ cần nhập lại.
- Khóa được gửi qua header tới route cùng nguồn, rồi chuyển tới nhà cung cấp qua HTTPS. Mã ứng dụng không ghi khóa hay nội dung yêu cầu vào log, database hoặc localStorage.
- Lịch sử trên localStorage chỉ có thông tin yêu cầu và prompt đầu ra; không chứa khóa API. Người dùng có thể xóa từng mục hoặc toàn bộ.
- Nội dung prompt, thông tin bổ sung, tên/mô tả tài liệu được gửi đến nhà cung cấp AI đã chọn. Không gửi nội dung tệp.
- OpenAI Responses đặt `store: false`; điều này không thay thế chính sách xử lý dữ liệu của nhà cung cấp.
- Chi phí và quyền sử dụng mô hình phụ thuộc tài khoản API của giáo viên.
- Không có tài khoản người dùng hoặc cơ sở dữ liệu của website.

## Mô hình và tài liệu API

Các mô hình mặc định có thể điều chỉnh tại `lib/config.ts`. Kiểm tra tên mô hình và quyền truy cập khi nhà cung cấp thay đổi.

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [OpenAI GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini GenerateContent Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Vercel Git deployment](https://vercel.com/docs/git)

## Kiểm thử

Bộ kiểm thử dùng phản hồi AI mô phỏng để xác minh cấu trúc phản hồi, vòng hỏi bổ sung, giữ LaTeX, giới hạn đầu vào, lịch sử không lưu khóa, định dạng API của hai nhà cung cấp và lỗi an toàn. Kiểm tra thực tế với nhà cung cấp cần khóa API hợp lệ do giáo viên nhập trên giao diện.


Kiểm thử giao diện: chạy `npm run build` rồi `npm run test:browser`. Trên Windows, bộ kiểm thử dùng Chrome hiện có; trên máy khác, chạy `npx playwright install chromium` trước. Các kiểm thử này dùng API mô phỏng, không gửi khóa hay yêu cầu tới nhà cung cấp thật.