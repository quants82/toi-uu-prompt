# Google Drive / Google Picker

Xem hướng dẫn có sẵn trên website tại /drive-setup. Website cần ba giá trị từ cùng một Google Cloud project:

| Vercel Environment Variable | Giá trị |
| --- | --- |
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | OAuth Client ID loại Web application |
| NEXT_PUBLIC_GOOGLE_PICKER_API_KEY | Developer API key dành riêng cho Picker, hạn chế Websites và APIs |
| NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER | Project number, không phải project ID |

Bật Google Drive API và Google Picker API. Authorized JavaScript origins phải khớp origin thực tế (không chứa đường dẫn). Thêm địa chỉ trang /privacy vào cấu hình ứng dụng OAuth. External/Testing chỉ dùng được với các test users đã thêm; hoàn tất xuất bản/xác minh theo yêu cầu Google trước khi mở cho mọi giáo viên.

Picker key xuất hiện trong mã trình duyệt theo thiết kế của Google. Chỉ dùng key được hạn chế Websites: https://toi-uu-prompt.vercel.app/* và https://docs.google.com/* (Picker chạy trong iframe docs.google.com), cộng http://127.0.0.1:3000/* nếu thử máy. API restrictions chỉ Google Picker API và Google Drive API. Không đưa OAuth Client Secret, khóa máy chủ hay khóa AI vào biến NEXT_PUBLIC. Không có endpoint công khai đọc credential máy chủ.

Trong Vercel chọn đúng project, thêm 3 biến trên cho Production rồi Redeploy vì chúng được đưa vào mã ở thời điểm build. Không cần cấu hình redirect URI cho luồng GIS token popup đang dùng. Tham khảo cấu hình mà Google Console yêu cầu cho tài khoản/domain của bạn.

## Quy trình giáo viên

- Kết nối Google Drive, cấp phạm vi drive.file, chọn nhiều mẫu trong Picker một lần. Có thể duyệt thư mục, nhưng cần chọn từng tệp mẫu. Không coi quyền chọn một thư mục là quyền đọc tất cả tệp con.
- Hỗ trợ Google Docs (xuất text/plain), DOCX (đề mục, đoạn văn, bảng), PDF có văn bản (tối đa 20 trang), TXT UTF-8. Tối đa 3 MB và 30.000 ký tự mỗi form, 30 form. Không OCR, không giữ bố cục Word/hình ảnh.
- Phân loại ban đầu theo tên tệp. Nên đặt tên KHBD Toán THCS, Phiếu học tập Tiếng Việt Tiểu học,... Mẫu tên không rõ cần giáo viên phân loại thủ công. Không suy đoán nội dung môn học từ tệp chưa đọc.
- Tự chọn theo loại công việc + môn + cấp; có thể sửa phân loại, chọn mẫu cụ thể hoặc Không dùng form. Lựa chọn thủ công được nhớ theo nhóm này.
- Văn bản và metadata được lưu trong IndexedDB của trình duyệt, lựa chọn lưu localStorage. Không tự đồng bộ giữa thiết bị, không có thư viện chung trên máy chủ. Xóa dữ liệu website sẽ xóa thư viện.
- Lần sau không phải chọn lại form trên Drive để tối ưu. Muốn đọc bản cập nhật, nhấn Cập nhật từ Drive; có thể phải cấp lại token. Token chỉ giữ trong bộ nhớ tab, không lưu lâu dài hoặc ghi log. Khi token hết hạn, bản văn bản đã lưu vẫn sử dụng được.
- Form đang chọn được gửi tới AI tối ưu và được chèn nguyên văn vào prompt cuối (công thức trong bản trích xuất được chuẩn hóa sang một cặp $ khi bật toán). Không cần tải lại để dùng cấu trúc văn bản. Nếu cần bố cục/hình ảnh chính xác, công cụ thực hiện cần tệp gốc.

## Yêu cầu cần đạt

Giáo viên cung cấp nguyên văn ở ô chuyên dụng, trả lời câu hỏi bổ sung hoặc dùng khối <yeu_cau_can_dat>...</yeu_cau_can_dat> trong prompt ban đầu. Thiếu nguyên văn thì máy chủ trả câu hỏi, không gọi AI để tự suy đoán. Nội dung gốc được chèn vào prompt sau bước chuẩn hóa công thức để không sửa cả công thức trong chuẩn. Mục tiêu thiết kế là trường riêng, không thay thế chuẩn gốc. Website không chứng nhận dữ liệu nhập là chương trình chính thức và không tự trích chuẩn từ tên SGK.

## Nguồn chính thức

- https://developers.google.com/workspace/drive/picker/guides/web-picker-sample
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/manage-downloads
