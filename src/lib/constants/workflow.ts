// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - QUẢN LÝ QUY TRÌNH KINH DOANH (BPM)
// ĐẠI HỌC KINH TẾ ĐÀ NẴNG (DUE) - NHÓM 4
// CÁC QUY TẮC NGHIỆP VỤ (BUSINESS RULES) VÀ ÁNH XẠ TRẠNG THÁI BPMN
// ==============================================================================

import { AppStatus, UserRole } from '@/types/database';

// 1. NHÃN TIẾNG VIỆT VÀ MÀU SẮC GIAO DIỆN CHO CÁC TRẠNG THÁI
export const STATUS_METADATA: Record<
  AppStatus,
  { label: string; color: string; badgeClass: string; stepNumber: number; description: string }
> = {
  DA_NOP: {
    label: 'Đã nộp đơn',
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    stepNumber: 1,
    description: 'Hồ sơ đã được gửi lên hệ thống và đang chờ tiếp nhận.',
  },
  DA_TIEP_NHAN: {
    label: 'Đã tiếp nhận',
    color: 'sky',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    stepNumber: 1,
    description: 'Hệ thống đã ghi nhận hồ sơ và kiểm tra điều kiện hộ khẩu.',
  },
  TU_CHOI_BO_TRI: {
    label: 'Từ chối bố trí (Hộ khẩu ĐN)',
    color: 'red',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    stepNumber: 1,
    description: 'Bị từ chối do sinh viên có hộ khẩu thường trú tại TP Đà Nẵng (XOR 1).',
  },
  CHO_THAM_DINH: {
    label: 'Chờ thẩm định minh chứng',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    stepNumber: 2,
    description: 'Đang thẩm định minh chứng ưu tiên qua AI Vision hoặc Cán bộ QLSV.',
  },
  CAN_BO_SUNG: {
    label: 'Yêu cầu bổ sung minh chứng',
    color: 'orange',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    stepNumber: 2,
    description: 'Minh chứng chưa đạt hoặc bị mờ. Cần bổ sung trong 48 giờ.',
  },
  THAM_DINH_DAT: {
    label: 'Minh chứng hợp lệ',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    stepNumber: 2,
    description: 'Minh chứng ưu tiên đã được xác thực hợp lệ.',
  },
  KHONG_DUOC_XET: {
    label: 'Không được xét',
    color: 'gray',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
    stepNumber: 2,
    description: 'Hồ sơ bị hủy do không bổ sung minh chứng đúng thời hạn.',
  },
  DA_XEP_HANG: {
    label: 'Đã xếp thứ hạng dự kiến',
    color: 'purple',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    stepNumber: 3,
    description: 'Đã tính điểm ưu tiên và xếp thứ hạng trên bảng xếp hạng Real-time.',
  },
  DA_CHOT: {
    label: 'QLSV đã chốt danh sách',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    stepNumber: 4,
    description: 'Danh sách xét tuyển đã được chốt theo chỉ tiêu và trình Trưởng ban.',
  },
  DA_DUYET: {
    label: 'Trưởng ban đã phê duyệt',
    color: 'teal',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    stepNumber: 4,
    description: 'Trưởng ban Quản lý KTX đã ký duyệt thông qua danh sách trúng tuyển (XOR 3).',
  },
  BI_TRA_VE: {
    label: 'Bị trả về điều chỉnh',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    stepNumber: 4,
    description: 'Trưởng ban yêu cầu QLSV rà soát điều chỉnh lại danh sách trúng tuyển.',
  },
  DA_PHAT_HANH: {
    label: 'Đã công bố & Phát hành HĐ',
    color: 'cyan',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    stepNumber: 5,
    description: 'Đã gửi thông báo trúng tuyển và hợp đồng điện tử có hiệu lực ký trong 72h.',
  },
  DA_KY: {
    label: 'Đã ký hợp đồng điện tử',
    color: 'green',
    badgeClass: 'bg-green-100 text-green-800 border-green-300',
    stepNumber: 5,
    description: 'Sinh viên đã hoàn tất ký hợp đồng bằng mã OTP và giữ chỗ thành công.',
  },
  HUY_SUAT: {
    label: 'Đã hủy suất ở KTX',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    stepNumber: 5,
    description: 'Suất ở bị hủy do sinh viên từ chối ký hoặc quá thời hạn 72h.',
  },
  DA_BAN_GIAO: {
    label: 'Đã bàn giao phòng',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    stepNumber: 6,
    description: 'Sinh viên đã nhận chìa khóa, kiểm kê cơ sở vật chất và vào ở KTX.',
  },
};

// 2. NGƯỠNG ĐỘ TIN CẬY AI VISION (CONFIDENCE THRESHOLDS) THEO QUY CHẾ KTX DUE
export const AI_THRESHOLDS = {
  AUTO_APPROVE: 0.95, // >= 0.95 (95%): AI tự động cho qua (Không cần nộp lại, vào thẳng BXH)
  MANUAL_REVIEW_MAX: 0.95, // < 0.95 (Dưới 95%): Bắt buộc con người (Cán bộ QLSV) phải duyệt lại
  AUTO_REJECT: 0.10, // < 0.10 hoặc ảnh meme/lạ: Tự động từ chối
};

// 3. THANG ĐIỂM ƯU TIÊN THEO QUY ĐỊNH KTX ĐH KINH TẾ ĐÀ NẴNG
export const PRIORITY_POLICY_POINTS: Record<string, { label: string; points: number }> = {
  CON_THUONG_BINH_LIET_SI: {
    label: 'Con liệt sĩ, con thương binh, con bệnh binh',
    points: 40,
  },
  HO_NGHEO_CAN_NGHEO: {
    label: 'Hộ nghèo, hộ cận nghèo theo chuẩn quốc gia',
    points: 35,
  },
  VUNG_SAU_XA_HAI_DAO: {
    label: 'Hộ khẩu thường trú tại vùng sâu, vùng xa, hải đảo (Khu vực 1)',
    points: 30,
  },
  DAN_TOC_THIEU_SO: {
    label: 'Người dân tộc thiểu số vùng khó khăn',
    points: 25,
  },
  NGOAI_TINH_XA: {
    label: 'Sinh viên ngoại tỉnh cự ly di chuyển > 200km',
    points: 20,
  },
  KHONG: {
    label: 'Không thuộc diện ưu tiên',
    points: 0,
  },
};

// 4. KIỂM TRA ĐIỀU KIỆN CHUYỂN TRẠNG THÁI HỢP LỆ (STATE MACHINE THEO BPMN)
export const VALID_STATUS_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  DA_NOP: ['DA_TIEP_NHAN', 'TU_CHOI_BO_TRI'],
  DA_TIEP_NHAN: ['CHO_THAM_DINH', 'TU_CHOI_BO_TRI'],
  TU_CHOI_BO_TRI: [], // Trạng thái kết thúc lỗi ERR_HO_KHAU_DA_NANG
  CHO_THAM_DINH: ['THAM_DINH_DAT', 'CAN_BO_SUNG', 'TU_CHOI_BO_TRI'],
  CAN_BO_SUNG: ['CHO_THAM_DINH', 'KHONG_DUOC_XET'],
  THAM_DINH_DAT: ['DA_XEP_HANG'],
  KHONG_DUOC_XET: [], // Trạng thái kết thúc lỗi ERR_KHONG_BO_SUNG_KIP
  DA_XEP_HANG: ['DA_CHOT'],
  DA_CHOT: ['DA_DUYET', 'BI_TRA_VE'],
  BI_TRA_VE: ['DA_CHOT'], // QLSV chỉnh sửa và chốt lại
  DA_DUYET: ['DA_PHAT_HANH'],
  DA_PHAT_HANH: ['DA_KY', 'HUY_SUAT'],
  DA_KY: ['DA_BAN_GIAO'],
  HUY_SUAT: [], // Trạng thái kết thúc hủy suất
  DA_BAN_GIAO: [], // Trạng thái kết thúc thành công toàn quy trình
};

export function canTransitionStatus(current: AppStatus, next: AppStatus): boolean {
  return VALID_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

// ==============================================================================
// 5. PHÂN BỔ PHÒNG NỘI TRÚ ĐỘC LẬP & DUY NHẤT CHO TỪNG SINH VIÊN (1 NGƯỜI 1 PHÒNG / GIƯỜNG)
// ==============================================================================
export function getAssignedRoomForStudent(
  student: {
    ma_sv?: string;
    gioi_tinh?: string;
    thu_hang?: number;
    rank?: number;
  },
  rankOrFallback?: number
): string {
  const currentRank = student?.thu_hang ?? student?.rank ?? rankOrFallback ?? 1;

  // Nếu thứ hạng > 120: Vượt quá chỉ tiêu 120 chỗ -> Danh sách chờ dự bị, không cấp phòng
  if (currentRank > 120) {
    return `Chưa phân bổ (Danh sách chờ dự bị #${currentRank - 120})`;
  }

  // Quy chuẩn phân khu KTX DUE: Sức chứa 4 người/phòng
  // Sinh viên Nữ -> Khu B
  // Sinh viên Nam -> Khu A
  const isFemale =
    student?.gioi_tinh?.toLowerCase() === 'nữ' ||
    student?.gioi_tinh?.toLowerCase() === 'nu';

  const building = isFemale ? 'B' : 'A';
  const labelKhu = isFemale ? 'Khu B (Nữ)' : 'Khu A (Nam)';

  // Tính toán số phòng và số giường hoàn toàn duy nhất dựa theo thứ hạng trúng tuyển 1..120
  const zeroIndexed = currentRank - 1;
  const roomIndex = Math.floor(zeroIndexed / 4); // Mỗi phòng 4 sinh viên
  const bedIndex = (zeroIndexed % 4) + 1; // Giường 01, 02, 03, 04

  // Tầng 1: 101 - 110, Tầng 2: 201 - 210, Tầng 3: 301 - 310
  const floor = Math.floor(roomIndex / 10) + 1;
  const roomOnFloor = (roomIndex % 10) + 1;
  const roomNumber = `${floor}${roomOnFloor < 10 ? '0' + roomOnFloor : roomOnFloor}`;

  return `Phòng ${building}.${roomNumber} - Giường số 0${bedIndex} (${labelKhu} - 4 người/phòng)`;
}

// ==============================================================================
// 6. MÃ OTP XÁC THỰC HỢP ĐỒNG ĐIỆN TỬ DUY NHẤT CHO TỪNG SINH VIÊN (6 CHỮ SỐ)
// ==============================================================================
export function getStudentOtpCode(ma_sv: string): string {
  if (!ma_sv || !ma_sv.trim()) return '888888';
  let hash = 0;
  const cleanCode = ma_sv.trim().toUpperCase();
  for (let i = 0; i < cleanCode.length; i++) {
    hash = (hash << 5) - hash + cleanCode.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  // Tạo mã OTP 6 chữ số cố định cho từng sinh viên (Deterministic Hash)
  const otpNumber = (positiveHash % 900000) + 100000;
  return otpNumber.toString();
}
