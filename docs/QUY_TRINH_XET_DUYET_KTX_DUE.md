# Quy trình hệ thống đăng ký và xét duyệt nội trú KTX DUE

Tài liệu này mô tả quy trình mà hệ thống (mã nguồn QUANLYKTXDUE) thực hiện, từ lúc sinh viên nộp hồ sơ đến lúc nhận phòng. Nội dung được viết từ việc đối chiếu mã nguồn và mô hình BPMN To-Be v12. Các ngưỡng và con số lấy đúng chuẩn theo quy định hệ thống.

---

## 1. Các vai trò trên hệ thống

| Vai trò | Trang | Việc làm trên hệ thống |
| :--- | :--- | :--- |
| **Sinh viên (SV)** | `/student` | Điền form, tải ảnh CCCD và giấy ưu tiên, theo dõi trạng thái, bổ sung minh chứng khi bị yêu cầu, đọc và ký hợp đồng bằng OTP hoặc từ chối ký, xem bảng xếp hạng cập nhật liên tục (xếp hạng dự kiến). |
| **AI Vision (Hệ thống)** | Tự động | Đọc ảnh CCCD và giấy ưu tiên, đối chiếu họ tên, số CCCD, mộc đỏ, diện ưu tiên, trả về độ tin cậy từ 0 đến 1. |
| **Cán bộ QLSV** | `/officer` | Rà soát hồ sơ AI không chắc chắn (dưới 95%), bấm Duyệt đạt hoặc Yêu cầu bổ sung, kiểm tra email AI soạn sẵn rồi bấm phát hành, bàn giao phòng, xác nhận hủy suất. |
| **Trưởng ban KTX** | `/director` | Xem dashboard, phê duyệt danh sách bằng một lần bấm, hoặc trả về kèm lý do cho QLSV chỉnh sửa. |

*Lưu ý:* README có nhắc vai trò Cán bộ Hành chính (HC), nhưng trong mã nguồn hiện tập trung vào 3 giao diện nghiệp vụ trực tiếp: SV, QLSV và Trưởng ban.

---

## 2. Các quy tắc nghiệp vụ cốt lõi

1. **Hộ khẩu Đà Nẵng:** Tỉnh thành có chữ `"Đà Nẵng"` thì bị từ chối bố trí ngay (`TU_CHOI_BO_TRI`), điểm 0, không vào BXH và gửi email thông báo từ chối.
2. **Điểm ưu tiên quy định:**
   - Con liệt sĩ, thương binh, bệnh binh: `+40` điểm.
   - Hộ nghèo, cận nghèo: `+35` điểm.
   - Vùng sâu, vùng xa, hải đảo: `+30` điểm.
   - Dân tộc thiểu số vùng khó khăn: `+25` điểm.
   - Ngoại tỉnh trên 200 km: `+20` điểm.
   - Không thuộc diện ưu tiên: `+0` điểm.
3. **Ngưỡng AI Vision:**
   - Độ tin cậy `≥ 0.95` và hồ sơ khớp: Tự động thẩm định đạt (`THAM_DINH_DAT`).
   - Độ tin cậy `< 0.95`: Chuyển cán bộ QLSV rà soát thủ công (`CHO_THAM_DINH`).
   - Ảnh không phải giấy tờ hoặc độ tin cậy `< 0.10`: Yêu cầu chụp lại (`CAN_BO_SUNG`), hạn bổ sung 48 giờ.
4. **Chỉ cộng điểm khi minh chứng đạt:** Hồ sơ đang chờ thẩm định (`CHO_THAM_DINH`) hoặc cần bổ sung (`CAN_BO_SUNG`) chỉ được tính `0 điểm` trên Bảng xếp hạng.
5. **Chỉ tiêu tuyển sinh:** Cố định **120 suất**. Xếp hạng theo điểm ưu tiên từ cao xuống thấp; nếu bằng điểm thì xếp theo thứ tự cố định theo mã SV.
6. **Điều kiện để Trưởng ban duyệt và để phát hành:** Không còn hồ sơ nào ở trạng thái chờ thẩm định (`CHO_THAM_DINH`) hoặc cần bổ sung (`CAN_BO_SUNG`).
7. **Thời hạn bổ sung minh chứng:** 48 giờ kể từ khi gửi yêu cầu (quá hạn chuyển `KHONG_DUOC_XET`).
8. **Thời hạn ký hợp đồng:** 72 giờ kể từ khi phát hành (quá hạn hoặc từ chối chuyển `HUY_SUAT`).
9. **Đóng cổng nộp hồ sơ:** Đóng khi Trưởng ban đã duyệt danh sách hoặc đã công bố.

---

## 3. Quy trình chính (Đường đi suôn sẻ)

1. **Sinh viên nộp hồ sơ tại `/student`:** Nhập MSSV, họ tên, email, CCCD, ngày sinh, tỉnh thành, địa chỉ, chọn diện ưu tiên, tải ảnh CCCD (bắt buộc) và giấy ưu tiên (nếu có diện), tích cam đoan rồi nộp.
2. **Hệ thống sàng lọc hộ khẩu:** Nếu không phải Đà Nẵng thì tiếp tục.
3. **AI Vision thẩm định ảnh:** Đọc CCCD và giấy ưu tiên, trả về quyết định và độ tin cậy.
4. **Phân luồng theo kết quả AI:** Đạt (`≥ 95%`) thì cộng điểm ưu tiên ngay. Không chắc chắn (`< 95%`) thì vào hàng đợi Cán bộ QLSV. Thiếu hoặc sai minh chứng thì yêu cầu bổ sung.
5. **Email xác nhận:** Hệ thống gửi email đã tiếp nhận hồ sơ cho sinh viên.
6. **Bảng xếp hạng cập nhật liên tục:** Cập nhật thứ hạng dự kiến theo điểm ưu tiên.
7. **Cán bộ QLSV xử lý:** Xử lý toàn bộ hồ sơ trong hàng đợi (Duyệt đạt hoặc Yêu cầu bổ sung).
8. **Trưởng ban phê duyệt danh sách:** Duyệt một lần bấm (hoặc trả về). Sau bước này cổng nộp hồ sơ đóng.
9. **Cán bộ QLSV phát hành kết quả:** Kiểm tra email AI soạn sẵn và bấm phát hành. Top 120 sinh viên đầu nhận email trúng tuyển kèm hợp đồng và mã OTP, các sinh viên còn lại nhận email danh sách chờ.
10. **Sinh viên ký hợp đồng OTP:** Thực hiện trong vòng 72 giờ. Ký thành công chuyển sang `DA_KY`, phòng được giữ chỗ.
11. **Bàn giao phòng:** Cán bộ ghi nhận số phòng, gửi email hẹn nhận phòng, sinh viên nhận chìa khóa. Trạng thái cuối là `DA_BAN_GIAO`.

---

## 4. Chi tiết 12 trường hợp nghiệp vụ

- **Trường hợp 1. Minh chứng đúng, AI tự duyệt (≥ 95%):** Vào BXH, nằm trong 120 suất đầu, Trưởng ban duyệt, QLSV phát hành, SV ký OTP trong 72h (`DA_KY`), bàn giao phòng (`DA_BAN_GIAO`).
- **Trường hợp 2. Minh chứng đúng nhưng AI không chắc chắn (< 95%):** Vào `CHO_THAM_DINH`, điểm tạm tính 0đ. Cán bộ QLSV duyệt đạt -> `THAM_DINH_DAT`, cộng điểm, BXH cập nhật. Trưởng ban duyệt, phát hành. Nếu SV bấm từ chối ký hoặc để quá 72h -> `HUY_SUAT`, phòng trả về trống, nhường cho top 1 danh sách chờ (TH8).
- **Trường hợp 3. Minh chứng sai hoặc thiếu:** Điểm giữ 0đ. Trạng thái `CAN_BO_SUNG` (hạn 48h). SV tải lại ảnh đúng: nếu AI ≥ 0.95 tự đạt, nếu < 0.95 chuyển Cán bộ duyệt đạt -> đi tiếp vào BXH.
- **Trường hợp 4. Sinh viên không bổ sung kịp (quá 48h):** Hồ sơ tự động chuyển sang `KHONG_DUOC_XET` và loại khỏi BXH.
- **Trường hợp 5. Hộ khẩu Đà Nẵng:** Trạng thái `TU_CHOI_BO_TRI`, điểm 0, không thẩm định AI, loại khỏi BXH, gửi email từ chối, kết thúc.
- **Trường hợp 6. Ảnh không phải giấy tờ (ảnh lạ, meme, < 10%):** Trạng thái `CAN_BO_SUNG`, yêu cầu chụp lại trong 48 giờ.
- **Trường hợp 7. Thông tin CCCD không khớp với khai báo:** AI hạ độ tin cậy xuống tối đa 0.65, trạng thái `CHO_THAM_DINH`, điểm 0. Cán bộ QLSV rà soát thủ công.
- **Trường hợp 8. Sinh viên nằm trong danh sách chờ (#121 trở đi):** Nhận email danh sách chờ. Khi có sinh viên trúng tuyển hủy suất (`HUY_SUAT`), suất chuyển ngay cho sinh viên đứng đầu danh sách chờ kèm email hợp đồng 72 giờ.
- **Trường hợp 9. Trưởng ban trả danh sách về:** Trạng thái `BI_TRA_VE` kèm lý do. Danh sách chưa khóa, QLSV điều chỉnh và trình duyệt lại.
- **Trường hợp 10. Còn hồ sơ chưa xử lý:** Nếu còn hồ sơ ở `CHO_THAM_DINH` hoặc `CAN_BO_SUNG`, hệ thống chặn Trưởng ban duyệt và chặn QLSV phát hành, hiển thị số lượng hồ sơ tồn đọng.
- **Trường hợp 11. Nộp hồ sơ sau khi cổng đã đóng:** Sau khi Trưởng ban duyệt hoặc công bố, hệ thống từ chối nộp hồ sơ mới với thông báo cổng đã đóng.
- **Trường hợp 12. Xác thực OTP ký hợp đồng:** Nhập sai mã OTP báo lỗi, không cho ký hợp đồng.

---

## 5. Bảng ma trận trạng thái hồ sơ

| Trạng thái | Ý nghĩa | Điểm cộng | Vào bảng xếp hạng |
| :--- | :--- | :--- | :--- |
| `TU_CHOI_BO_TRI` | Hộ khẩu Đà Nẵng, kết thúc | 0 | Không |
| `CHO_THAM_DINH` | Chờ AI hoặc cán bộ rà soát | 0 | Tính 0 điểm |
| `CAN_BO_SUNG` | Cần bổ sung trong 48 giờ | 0 | Tính 0 điểm |
| `THAM_DINH_DAT` | Minh chứng hợp lệ | Theo diện | Có |
| `KHONG_DUOC_XET` | Không bổ sung kịp (quá 48h), kết thúc | 0 | Không |
| `DA_CHOT, DA_DUYET` | QLSV chốt, Trưởng ban duyệt | Theo diện | Có |
| `BI_TRA_VE` | Trưởng ban trả về chỉnh sửa | Theo diện | Có |
| `DA_PHAT_HANH` | Đã gửi thư trúng tuyển, chờ ký (72h) | Theo diện | Có |
| `DA_KY` | Đã ký hợp đồng, giữ chỗ phòng | Theo diện | Có |
| `HUY_SUAT` | Từ chối hoặc quá hạn ký, kết thúc | Không còn | Không |
| `DA_BAN_GIAO` | Đã nhận phòng, kết thúc thành công | Theo diện | Có |
