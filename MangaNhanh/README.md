# Manga Nhanh — Android starter

Giao diện Kotlin + Jetpack Compose tối giản, ưu tiên đọc cuộn dọc. Có trang danh sách, tìm kiếm, chi tiết, danh sách chương, yêu thích, lưu chap đọc tiếp và lịch kiểm tra nền mỗi 6 giờ.

## Mở project
1. Cài Android Studio bản mới.
2. Chọn **Open** và chọn thư mục `MangaNhanh`.
3. Chờ Gradle Sync, sau đó chạy lên thiết bị Android hoặc emulator.

## Quan trọng: nguồn truyện và tự cập nhật chap
Đây hiện là **bản khung giao diện/demo**, chưa tải truyện thật. `ChapterUpdateWorker` đã được đặt lịch 6 giờ/lần nhưng adapter lấy chap mới chưa được cài đặt. Để hoàn thiện tính năng tự cập nhật, cần website/API cụ thể mà bạn có quyền truy cập và được phép sử dụng. Sau đó tích hợp parser/API, lưu chap mới vào database, tải ảnh có cache và gửi thông báo.

Không nên scrape website trái phép hoặc vượt paywall/đăng nhập. Dữ liệu truyện mẫu trong app chỉ để xem giao diện.
