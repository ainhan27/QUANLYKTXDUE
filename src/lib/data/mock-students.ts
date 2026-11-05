// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// DỮ LIỆU THỰC TẾ QUY MÔ 350 SINH VIÊN (K47, K48, K49, K50, K51)
// THIẾT KẾ ĐẢM BẢO TÍNH NHẤT QUÁN 100% (DETERMINISTIC - KHÔNG DÙNG Math.random())
// ==============================================================================

import { RankingRow } from '@/components/ranking/RealtimeRankingTable';

const FIRST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const MIDDLE_NAMES = ['Văn', 'Thị', 'Hoàng', 'Minh', 'Đức', 'Quốc', 'Thu', 'Thảo', 'Phương', 'Bảo', 'Gia', 'Hồng', 'Thành', 'Tuấn', 'Ngọc'];
const LAST_NAMES = ['An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Nhi', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Thịnh', 'Trang', 'Trí', 'Trung', 'Tú', 'Uyên', 'Việt', 'Vy', 'Xuân', 'Yến'];

const PROVINCES = [
  'Quảng Nam', 'Quảng Trị', 'Thừa Thiên Huế', 'Quảng Bình', 'Quảng Ngãi', 
  'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 
  'Đắk Nông', 'Lâm Đồng', 'Nghệ An', 'Hà Tĩnh', 'Thanh Hóa', 'Ninh Thuận'
];

const POLICIES: { key: string; label: string; points: number }[] = [
  { key: 'CON_THUONG_BINH_LIET_SI', label: 'Con liệt sĩ, con thương binh, bệnh binh', points: 40 },
  { key: 'HO_NGHEO_CAN_NGHEO', label: 'Hộ nghèo, hộ cận nghèo theo chuẩn QG', points: 35 },
  { key: 'VUNG_SAU_XA_HAI_DAO', label: 'Hộ khẩu thường trú tại vùng sâu, vùng xa, hải đảo', points: 30 },
  { key: 'DAN_TOC_THIEU_SO', label: 'Người dân tộc thiểu số vùng khó khăn', points: 25 },
  { key: 'NGOAI_TINH_XA', label: 'Sinh viên ngoại tỉnh cự ly di chuyển > 200km', points: 20 },
  { key: 'KHONG', label: 'Không thuộc diện ưu tiên chính sách', points: 0 },
];

const COHORTS = ['47K', '48K', '49K', '50K', '51K'];
const MAJORS = ['01', '02', '03', '11', '12', '14', '18', '21', '25', '30'];

export function generate350Students(quota = 120): RankingRow[] {
  const students: RankingRow[] = [];

  for (let i = 1; i <= 350; i++) {
    const cohort = COHORTS[(i * 2 + 1) % COHORTS.length];
    const major = MAJORS[(i * 3 + 2) % MAJORS.length];
    const seq = String(i).padStart(3, '0');
    let ma_sv = `${cohort}${major}.${seq}`;

    let fn = FIRST_NAMES[i % FIRST_NAMES.length];
    let mn = MIDDLE_NAMES[(i * 3) % MIDDLE_NAMES.length];
    let ln = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    let ho_ten = `${fn} ${mn} ${ln}`;

    let province = PROVINCES[i % PROVINCES.length];

    // Phân bổ diện ưu tiên CỐ ĐỊNH & NHẤT QUÁN 100%
    let policyObj = POLICIES[5]; // Mặc định không ưu tiên
    let distanceBonus = 0;

    if (i <= 20) {
      // Top 1 - 20: 45 điểm (Con TB liệt sĩ 40đ + ngoại tỉnh xa 5đ)
      policyObj = POLICIES[0];
      distanceBonus = 5;

      // Giữ cố định danh tính sinh viên top 16-20 khớp ảnh thực tế
      if (i === 16) { ma_sv = '50K21.096'; ho_ten = 'Phan Minh Mai'; province = 'Đắk Nông'; }
      if (i === 17) { ma_sv = '48K18.078'; ho_ten = 'Phạm Bảo Hải'; province = 'Đắk Lắk'; }
      if (i === 18) { ma_sv = '49K14.063'; ho_ten = 'Phạm Bảo Trang'; province = 'Lâm Đồng'; }
      if (i === 19) { ma_sv = '47K21.060'; ho_ten = 'Nguyễn Văn An'; province = 'Gia Lai'; }
      if (i === 20) { ma_sv = '51K11.057'; ho_ten = 'Hồ Thu Khoa'; province = 'Phú Yên'; }
    } else if (i <= 45) {
      // Top 21 - 45: 40 điểm (Con TB liệt sĩ 40đ)
      policyObj = POLICIES[0];
      distanceBonus = 0;
    } else if (i <= 95) {
      // Top 46 - 95: 35 điểm (Hộ nghèo, hộ cận nghèo theo chuẩn QG)
      policyObj = POLICIES[1];
      distanceBonus = 0;
    } else if (i <= 140) {
      // Top 96 - 140: 30 điểm (Vùng sâu, vùng xa, hải đảo)
      policyObj = POLICIES[2];
      distanceBonus = 0;
    } else if (i <= 190) {
      // Top 141 - 190: 25 điểm (Dân tộc thiểu số)
      policyObj = POLICIES[3];
      distanceBonus = 0;
    } else if (i <= 270) {
      // Top 191 - 270: 20 điểm (Ngoại tỉnh cự ly > 200km)
      policyObj = POLICIES[4];
      distanceBonus = 0;
    } else {
      // Top 271 - 350: 0 điểm (Không thuộc diện ưu tiên)
      policyObj = POLICIES[5];
      distanceBonus = 0;
    }

    const diem_uu_tien = policyObj.points + distanceBonus;

    students.push({
      id: `std-scale-${i}`,
      thu_hang: i,
      ma_sv,
      ho_ten,
      tinh_thanh: province,
      dien_uu_tien: policyObj.label,
      diem_uu_tien,
      is_trung_tuyen: i <= quota,
      status: 'DA_XEP_HANG',
      updated_at: new Date(Date.now() - (400 - i) * 60000).toISOString(),
    });
  }

  return students;
}

// ==============================================================================
// HÀM HỢP NHẤT DỮ LIỆU VÀ TÍNH THỨ HẠNG CHÍNH XÁC (DÙNG CHUNG SERVER & CLIENT)
// ==============================================================================
export function computeMergedRankings(storedApps: any[] = [], quota = 120): RankingRow[] {
  const baseline = generate350Students(quota);
  let merged: RankingRow[] = [...baseline];

  for (const s of storedApps) {
    const isDanang =
      s.tinh_thanh?.toLowerCase().includes('đà nẵng') ||
      s.tinh_thanh?.toLowerCase().includes('da nang');
    if (isDanang) continue;

    const isPendingReview = s.status === 'CHO_THAM_DINH' || s.status === 'CAN_BO_SUNG';
    const isCancelled = s.status === 'HUY_SUAT' || s.status === 'TU_CHOI_BO_TRI';
    // Nếu hồ sơ đang chờ rà soát hoặc đã hủy suất: Điểm ưu tiên tạm thời tính là 0đ
    const activePoints = (isPendingReview || isCancelled) ? 0 : (s.diem_uu_tien ?? 0);

    const existingIdx = merged.findIndex((m) => m.ma_sv === s.ma_sv || m.id === s.id);
    const row: RankingRow = {
      id: s.id,
      thu_hang: 0,
      ma_sv: s.ma_sv,
      ho_ten: s.ho_ten,
      tinh_thanh: s.tinh_thanh,
      dien_uu_tien: s.dien_uu_tien_label || 'Không thuộc diện ưu tiên',
      diem_uu_tien: activePoints,
      is_trung_tuyen: false,
      status: s.status || 'CHO_THAM_DINH',
      updated_at: s.created_at || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      merged[existingIdx] = row;
    } else {
      merged.unshift(row);
    }
  }

  // Sắp xếp ổn định: Điểm ưu tiên cao hơn xếp trước; nếu bằng điểm thì giữ thứ tự cố định theo mã SV (tránh nhảy vị trí)
  merged.sort((a, b) => {
    if (b.diem_uu_tien !== a.diem_uu_tien) {
      return b.diem_uu_tien - a.diem_uu_tien;
    }
    return a.ma_sv.localeCompare(b.ma_sv);
  });

  // Gán thứ hạng chính xác từ 1 -> N
  let admittedCount = 0;
  merged.forEach((item, idx) => {
    item.thu_hang = idx + 1;
    const isExcluded =
      item.status === 'CHO_THAM_DINH' ||
      item.status === 'CAN_BO_SUNG' ||
      item.status === 'HUY_SUAT' ||
      item.status === 'TU_CHOI_BO_TRI';

    if (!isExcluded && admittedCount < quota && item.diem_uu_tien > 0) {
      item.is_trung_tuyen = true;
      admittedCount++;
    } else {
      item.is_trung_tuyen = false;
    }
  });

  return merged;
}

// ==============================================================================
// HÀM TÍNH TOÁN THỨ HẠNG THỰC TẾ CHO MỘT SINH VIÊN (KHÔNG HARDCODE)
// ==============================================================================
export function getStudentRankInfo(
  maSvOrPoints: string | number,
  storedApps: any[] = []
): { rank: number; total: number; isAdmitted: boolean } {
  const merged = computeMergedRankings(storedApps);
  const total = merged.length;

  if (typeof maSvOrPoints === 'string' && maSvOrPoints.trim()) {
    const found = merged.find((x) => x.ma_sv.toLowerCase() === maSvOrPoints.trim().toLowerCase());
    if (found) {
      return {
        rank: found.thu_hang,
        total,
        isAdmitted: found.is_trung_tuyen,
      };
    }
  }

  const points = typeof maSvOrPoints === 'number' ? maSvOrPoints : 0;
  const higherCount = merged.filter((x) => x.diem_uu_tien > points).length;
  const calculatedRank = higherCount + 1;

  return {
    rank: calculatedRank,
    total,
    isAdmitted: calculatedRank <= 120,
  };
}
