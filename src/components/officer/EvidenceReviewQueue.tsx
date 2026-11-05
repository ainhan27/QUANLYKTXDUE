'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// PHÂN HỆ CÁN BỘ QLSV: HÀNG ĐỢI RÀ SOÁT MINH CHỨNG (BPMN SUB-PROCESS SP4)
// ÁP DỤNG QUY TẮC PHÂN NHÁNH AI VISION THEO NGƯỠNG ĐỘ TIN CẬY 95%:
// 1. CHẤM TRÊN 95% (>= 0.95): AI TỰ ĐỘNG CHO QUA => KHÔNG CẦN NỘP LẠI, KHÔNG CẦN DUYỆT LẠI
// 2. CHẤM DƯỚI 95% (< 0.95): HỒ SƠ NGHI VẤN => CON NGƯỜI (CÁN BỘ QLSV) BẮT BUỘC DUYỆT LẠI
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { AI_THRESHOLDS, getAssignedRoomForStudent, getStudentOtpCode } from '@/lib/constants/workflow';
import { computeMergedRankings } from '@/lib/data/mock-students';
import { sendSupplementRequestAction, approveEvidenceAction, officerSendBatchEmailsAction } from '@/actions/approval';

interface QueueItem {
  id: string;
  khoa: string;
  ma_sv: string;
  ho_ten: string;
  email: string;
  cccd: string;
  dien_uu_tien: string;
  diem_uu_tien: number;
  status?: string;
  isSupplemented?: boolean;
  isSupplementReview?: boolean;
  supplementSubmittedAt?: string;
  cccdImageUrl: string;
  priorityImageUrl?: string;
  aiConfidence: number;
  aiDocType: string;
  aiExtractedName: string;
  aiExtractedCccd: string;
  nameMatched?: boolean;
  cccdMatched?: boolean;
  detectedOcrText: string;
  cccdCheck: {
    hasKeyword: boolean;
    hasPoliceChief: boolean;
    note: string;
  };
  priorityCheck: {
    matchedKeywords: string[];
    hasOfficialStamp: boolean;
    note: string;
  };
  aiWarnings: string[];
  draftEmail: {
    subject: string;
    bodyHtml: string;
  };
}

// ==============================================================================
// HÀM TẠO ẢNH ĐỒ HỌA THẺ CĂN CƯỚC CÔNG DÂN VIỆT NAM (CHUẨN BỘ CÔNG AN)
// ==============================================================================
export function generateRealisticCccdSvg(fullName: string, cccdNumber: string, gender: string = 'Nữ', birthDate = '12/05/2006'): string {
  const cleanName = (fullName || 'NGUYỄN THỊ THU THẢO').toUpperCase();
  const cleanCccd = cccdNumber || '040204001122';
  const cleanGender = gender || 'Nữ';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e3f2fd"/>
        <stop offset="50%" stop-color="#e8f5e9"/>
        <stop offset="100%" stop-color="#fff9c4"/>
      </linearGradient>
      <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffd54f"/>
        <stop offset="50%" stop-color="#ffb300"/>
        <stop offset="100%" stop-color="#ff8f00"/>
      </linearGradient>
      <pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 0 20 Q 10 0 20 20 T 40 20" fill="none" stroke="#b2dfdb" stroke-width="0.8" opacity="0.45"/>
        <path d="M 20 0 Q 0 10 20 20 T 20 40" fill="none" stroke="#b2ebf2" stroke-width="0.8" opacity="0.45"/>
      </pattern>
    </defs>
    
    <rect width="856" height="540" rx="28" fill="url(#bgGrad)" stroke="#b0bec5" stroke-width="2"/>
    <rect width="856" height="540" rx="28" fill="url(#guilloche)"/>
    
    <g transform="translate(48, 32)">
      <circle cx="36" cy="36" r="32" fill="#d32f2f" stroke="#ffeb3b" stroke-width="2"/>
      <polygon points="36,16 41,29 55,29 43,38 48,51 36,43 24,51 29,38 17,29 31,29" fill="#ffeb3b"/>
      <path d="M 12 44 Q 4 20 24 8" fill="none" stroke="#fbc02d" stroke-width="3"/>
      <path d="M 60 44 Q 68 20 48 8" fill="none" stroke="#fbc02d" stroke-width="3"/>
      <rect x="22" y="56" width="28" height="8" rx="2" fill="#fbc02d"/>
    </g>
    
    <text x="440" y="44" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="#b71c1c" text-anchor="middle" letter-spacing="1.2">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
    <text x="440" y="66" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#1b5e20" text-anchor="middle">Độc lập - Tự do - Hạnh phúc</text>
    <text x="440" y="82" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#424242" text-anchor="middle">SOCIALIST REPUBLIC OF VIET NAM / Independence - Freedom - Happiness</text>
    <line x1="330" y1="92" x2="550" y2="92" stroke="#b71c1c" stroke-width="1.5"/>

    <text x="440" y="125" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#0d47a1" text-anchor="middle" letter-spacing="2">CĂN CƯỚC CÔNG DÂN</text>
    <text x="440" y="145" font-family="Arial, Helvetica, sans-serif" font-size="12" font-style="italic" fill="#546e7a" text-anchor="middle">Citizen Identity Card</text>

    <text x="440" y="178" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#37474f" text-anchor="middle">Số / No.: <tspan font-size="24" font-weight="bold" fill="#c62828" font-family="monospace">${cleanCccd}</tspan></text>

    <g transform="translate(48, 170)">
      <rect width="180" height="235" rx="8" fill="#eceff1" stroke="#90a4ae" stroke-width="1.5"/>
      <circle cx="90" cy="85" r="42" fill="#b0bec5"/>
      <path d="M 35 210 Q 90 140 145 210 Z" fill="#90a4ae"/>
      <text x="90" y="226" font-family="Arial, sans-serif" font-size="10" fill="#78909c" text-anchor="middle">ẢNH 3x4 CHUẨN</text>
    </g>

    <g transform="translate(255, 185)">
      <rect width="72" height="56" rx="6" fill="url(#chipGrad)" stroke="#c79100" stroke-width="1.2"/>
      <path d="M 0 18 H 72 M 0 38 H 72 M 36 0 V 56 M 18 18 V 38 M 54 18 V 38" stroke="#8d6e63" stroke-width="1" opacity="0.6"/>
    </g>

    <g font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#263238" transform="translate(345, 230)">
      <text y="0" fill="#546e7a" font-size="12">Họ và tên / Full name:</text>
      <text y="24" font-size="18" font-weight="bold" fill="#0d47a1" letter-spacing="1">${cleanName}</text>

      <text y="60" fill="#546e7a" font-size="12">Ngày sinh / Date of birth: <tspan font-weight="bold" fill="#212121" font-size="14">${birthDate}</tspan>   Giới tính / Sex: <tspan font-weight="bold" fill="#c62828" font-size="15">${cleanGender}</tspan></text>

      <text y="92" fill="#546e7a" font-size="12">Quốc tịch / Nationality: <tspan font-weight="bold" fill="#212121" font-size="14">Việt Nam</tspan></text>

      <text y="124" fill="#546e7a" font-size="12">Quê quán / Place of origin:</text>
      <text y="144" font-weight="bold" fill="#212121" font-size="13">Hải Châu, TP. Đà Nẵng</text>

      <text y="174" fill="#546e7a" font-size="12">Nơi thường trú / Place of residence:</text>
      <text y="194" font-weight="bold" fill="#212121" font-size="13">Điện Bàn, Quảng Nam</text>
    </g>

    <text x="52" y="432" font-family="Arial, sans-serif" font-size="11" fill="#455a64">Có giá trị đến / Date of expiry:</text>
    <text x="52" y="448" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#212121">12/05/2036</text>

    <g transform="translate(740, 410)">
      <rect width="65" height="65" fill="#ffffff" stroke="#90a4ae" stroke-width="1"/>
      <rect x="6" y="6" width="20" height="20" fill="#212121"/>
      <rect x="9" y="9" width="14" height="14" fill="#ffffff"/>
      <rect x="12" y="12" width="8" height="8" fill="#212121"/>
      <rect x="38" y="6" width="20" height="20" fill="#212121"/>
      <rect x="6" y="38" width="20" height="20" fill="#212121"/>
      <circle cx="48" cy="48" r="6" fill="#212121"/>
    </g>

    <text x="440" y="520" font-family="monospace" font-size="13" font-weight="bold" fill="#546e7a" text-anchor="middle" letter-spacing="3">IDVNM0402040011224&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;0605128F3605125VNM&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;0</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ==============================================================================
// HÀM TẠO ẢNH GIẤY XÁC NHẬN CHÍNH SÁCH ƯU TIÊN CÓ MỘC ĐỎ UBND
// ==============================================================================
export function generateRealisticPrioritySvg(fullName: string, policyName: string, studentCode: string): string {
  const cleanName = (fullName || 'NGUYỄN THỊ THU THẢO').toUpperCase();
  const cleanPolicy = policyName || 'Hộ nghèo, hộ cận nghèo theo chuẩn quốc gia';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="100%" height="100%">
    <rect width="800" height="1050" fill="#fafafa" stroke="#cfd8dc" stroke-width="2"/>
    
    <g opacity="0.04" transform="translate(250, 400)">
      <circle cx="150" cy="150" r="140" fill="#b71c1c"/>
      <polygon points="150,50 175,120 250,120 190,165 210,235 150,190 90,235 110,165 50,120 125,120" fill="#ffffff"/>
    </g>

    <text x="160" y="65" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#37474f" text-anchor="middle">ỦY BAN NHÂN DÂN XÃ / PHƯỜNG</text>
    <text x="160" y="85" font-family="Arial, sans-serif" font-size="12" fill="#546e7a" text-anchor="middle">Số: 148 / XN-UBND</text>
    <line x1="100" y1="95" x2="220" y2="95" stroke="#78909c" stroke-width="1"/>

    <text x="560" y="65" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#212121" text-anchor="middle">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
    <text x="560" y="85" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#212121" text-anchor="middle">Độc lập - Tự do - Hạnh phúc</text>
    <line x1="480" y1="95" x2="640" y2="95" stroke="#212121" stroke-width="1.5"/>

    <text x="650" y="145" font-family="Arial, sans-serif" font-size="13" font-style="italic" fill="#546e7a" text-anchor="end">Ngày 15 tháng 08 năm 2026</text>

    <text x="400" y="210" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#b71c1c" text-anchor="middle" letter-spacing="1">GIẤY XÁC NHẬN ĐỐI TƯỢNG ƯU TIÊN</text>
    <text x="400" y="235" font-family="Arial, sans-serif" font-size="13" font-style="italic" fill="#455a64" text-anchor="middle">(Phục vụ xét duyệt hồ sơ nội trú Ký túc xá năm học 2026 - 2027)</text>

    <g font-family="Arial, sans-serif" font-size="15" fill="#263238" transform="translate(90, 290)">
      <text y="0" font-weight="bold">ỦY BAN NHÂN DÂN CHỨNG NHẬN:</text>
      
      <text y="40">Họ và tên sinh viên: <tspan font-weight="bold" fill="#0d47a1">${cleanName}</tspan></text>
      <text y="75">Mã số sinh viên (DUE): <tspan font-weight="bold" font-family="monospace">${studentCode}</tspan></text>
      <text y="110">Ngày sinh: 15/08/2006        Giới tính: Nữ</text>
      <text y="145">Hộ khẩu thường trú: Xã Duy Nghĩa, Huyện Duy Xuyên, Tỉnh Quảng Nam</text>
      <text y="180">Hiện là sinh viên Trường Đại học Kinh tế – Đại học Đà Nẵng.</text>

      <text y="230" font-weight="bold" fill="#b71c1c">XÁC NHẬN THUỘC DIỆN CHÍNH SÁCH ƯU TIÊN:</text>
      <rect x="0" y="245" width="620" height="48" rx="6" fill="#f1f8e9" stroke="#81c784" stroke-width="1.2"/>
      <text x="20" y="275" font-weight="bold" fill="#1b5e20" font-size="15">✓ ${cleanPolicy}</text>

      <text y="330">Gia đình thuộc diện chính sách theo quy định hiện hành của Nhà nước.</text>
      <text y="360">Giấy xác nhận có giá trị bổ túc hồ sơ đăng ký nội trú Ký túc xá DUE.</text>
    </g>

    <g transform="translate(480, 720)">
      <text x="120" y="0" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#263238" text-anchor="middle">TM. ỦY BAN NHÂN DÂN</text>
      <text x="120" y="22" font-family="Arial, sans-serif" font-size="13" font-style="italic" fill="#546e7a" text-anchor="middle">CHỦ TỊCH</text>
      <text x="120" y="40" font-family="Arial, sans-serif" font-size="12" fill="#78909c" text-anchor="middle">(Ký tên và đóng dấu đỏ)</text>

      <path d="M 60 90 Q 90 60 130 95 T 190 80 T 170 120" fill="none" stroke="#0d47a1" stroke-width="2.5"/>

      <g transform="translate(30, 20)">
        <circle cx="80" cy="80" r="68" fill="none" stroke="#d32f2f" stroke-width="4.5" opacity="0.88"/>
        <circle cx="80" cy="80" r="61" fill="none" stroke="#d32f2f" stroke-width="1.5" opacity="0.88"/>
        <text x="80" y="42" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#d32f2f" text-anchor="middle" opacity="0.9">ỦY BAN NHÂN DÂN</text>
        <text x="80" y="132" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#d32f2f" text-anchor="middle" opacity="0.9">TỈNH QUẢNG NAM</text>
        <polygon points="80,62 84,74 97,74 86,82 90,95 80,87 70,95 74,82 63,74 76,74" fill="#d32f2f" opacity="0.88"/>
      </g>

      <text x="120" y="175" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#212121" text-anchor="middle">Nguyễn Văn Bình</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function EvidenceReviewQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([
    {
      id: 'app-50k-001',
      khoa: 'Khoa Quản trị Kinh doanh',
      ma_sv: '251121536108',
      ho_ten: 'Trần Minh Khang',
      email: 'khang.tm@due.udn.vn',
      cccd: '048204009988',
      dien_uu_tien: 'Hộ nghèo, cận nghèo theo chuẩn QG',
      diem_uu_tien: 35,
      isSupplemented: false,
      isSupplementReview: false,
      cccdImageUrl: generateRealisticCccdSvg('Trần Minh Khang', '048204009988', 'Nam'),
      priorityImageUrl: generateRealisticPrioritySvg('Trần Minh Khang', 'Hộ nghèo, cận nghèo theo chuẩn QG', '251121536108'),
      aiConfidence: 0.74,
      aiDocType: 'Giấy chứng nhận hộ cận nghèo năm 2025',
      aiExtractedName: 'Trần Minh Khang',
      aiExtractedCccd: '048204009988',
      detectedOcrText: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM ... CĂN CƯỚC CÔNG DÂN Số: 048204009988 ... CỤC TRƯỞNG CỤC CẢNH SÁT QLHC VỀ TRẬT TỰ XÃ HỘI ... UBND XÃ DUY NGHĨA CHỨNG NHẬN HỘ CẬN NGHÈO 2025 (KÝ VÀ ĐÓNG DẤU ĐỎ)',
      cccdCheck: {
        hasKeyword: true,
        hasPoliceChief: true,
        note: 'Hợp lệ: Đã phát hiện "Căn cước công dân" & "Cục trưởng Cục Cảnh sát". Không yêu cầu dấu đỏ.',
      },
      priorityCheck: {
        matchedKeywords: ['hộ cận nghèo', 'chuẩn nghèo'],
        hasOfficialStamp: false,
        note: '⚠️ Con dấu đỏ góc dưới bị mờ, hệ thống chưa nhận diện rõ mộc tròn của UBND.',
      },
      aiWarnings: ['Con dấu góc dưới bên phải hơi mờ cần đối chiếu', 'Độ tương phản ảnh trung bình (< 95%)'],
      draftEmail: {
        subject: '[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – Sinh Viên Trần Minh Khang',
        bodyHtml: '<p>Kính gửi sinh viên <strong>Trần Minh Khang</strong>,</p><p>Minh chứng của bạn cần bổ sung ảnh chụp rõ con dấu mộc đỏ của cơ quan thẩm quyền.</p>',
      },
    },
    {
      id: 'app-49k-045',
      khoa: 'Khoa Quản trị Kinh doanh',
      ma_sv: '251121536155',
      ho_ten: 'Nguyễn Thị Thu Thảo',
      email: 'thao.ntt@due.udn.vn',
      cccd: '040204001122',
      dien_uu_tien: 'Vùng sâu vùng xa, hải đảo',
      diem_uu_tien: 30,
      isSupplemented: true,
      isSupplementReview: true,
      cccdImageUrl: generateRealisticCccdSvg('Nguyễn Thị Thu Thảo', '040204001122', 'Nữ'),
      priorityImageUrl: generateRealisticPrioritySvg('Nguyễn Thị Thu Thảo', 'Vùng sâu vùng xa, hải đảo', '251121536155'),
      aiConfidence: 0.68,
      aiDocType: 'Xác nhận thường trú xã đặc biệt khó khăn',
      aiExtractedName: 'Nguyễn Thị Thu Thảo',
      aiExtractedCccd: '040204001122',
      detectedOcrText: 'CĂN CƯỚC CÔNG DÂN / CITIZEN IDENTITY CARD 040204001122 Nguyễn Thị Thu Thảo ... GIẤY XÁC NHẬN THƯỜNG TRÚ XÃ ĐẶC BIỆT KHÓ KHĂN ... KHU VỰC 1 ... (THIẾU MỘC ĐỎ UBND)',
      cccdCheck: {
        hasKeyword: true,
        hasPoliceChief: false,
        note: 'Hợp lệ: Nhận diện cụm từ "Căn cước công dân" mặt trước. Không yêu cầu dấu đỏ.',
      },
      priorityCheck: {
        matchedKeywords: ['khu vực 1', 'vùng sâu'],
        hasOfficialStamp: false,
        note: '⚠️ Giấy tờ thiếu con dấu đỏ xác nhận của UBND Xã.',
      },
      aiWarnings: ['Chưa phát hiện mộc đỏ cơ quan thẩm quyền', 'Độ tin cậy 68% (< 95%) - Cần duyệt lại'],
      draftEmail: {
        subject: '[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – Sinh Viên Nguyễn Thị Thu Thảo',
        bodyHtml: '<p>Kính gửi sinh viên <strong>Nguyễn Thị Thu Thảo</strong>,</p><p>Giấy xác nhận thường trú của bạn chưa có mộc đỏ xác nhận của UBND Xã. Vui lòng bổ sung trong 48h.</p>',
      },
    },
    {
      id: 'app-50k-089',
      khoa: 'Khoa Quản trị Kinh doanh',
      ma_sv: '251121536089',
      ho_ten: 'Lê Hoàng Nam',
      email: 'nam.lh@due.udn.vn',
      cccd: '046204005544',
      dien_uu_tien: 'Con liệt sĩ, con thương binh',
      diem_uu_tien: 40,
      cccdImageUrl: generateRealisticCccdSvg('Lê Hoàng Nam', '046204005544', 'Nam'),
      priorityImageUrl: generateRealisticPrioritySvg('Lê Hoàng Nam', 'Con liệt sĩ, con thương binh', '251121536089'),
      aiConfidence: 0.97,
      aiDocType: 'Giấy chứng nhận gia đình liệt sĩ',
      aiExtractedName: 'Lê Hoàng Nam',
      aiExtractedCccd: '046204005544',
      detectedOcrText: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM ... CĂN CƯỚC CÔNG DÂN ... SỞ LAO ĐỘNG THƯƠNG BINH VÀ XÃ HỘI ... GIẤY CHỨNG NHẬN CON LIỆT SĨ ... ĐÃ KÝ VÀ ĐÓNG DẤU ĐỎ THẨM QUYỀN',
      cccdCheck: {
        hasKeyword: true,
        hasPoliceChief: true,
        note: 'Hợp lệ: Đầy đủ từ khóa định danh CCCD và Cục trưởng Cảnh sát.',
      },
      priorityCheck: {
        matchedKeywords: ['liệt sĩ', 'thương binh', 'chính sách'],
        hasOfficialStamp: true,
        note: 'Đã nhận diện con dấu đỏ của Sở Lao động Thương binh & Xã hội.',
      },
      aiWarnings: [],
      draftEmail: {
        subject: '[KTX DUE] Minh Chứng Hợp Lệ (AI Tự Động Thông Qua >= 95%) – Sinh Viên Lê Hoàng Nam',
        bodyHtml: '<p>Kính gửi sinh viên Lê Hoàng Nam, hồ sơ của bạn đã được AI Vision tự động duyệt qua (Độ tin cậy 97% >= 95%).</p>',
      },
    },
  ]);

  // BỘ LỌC PHÂN LOẠI: HỒ SƠ BAN ĐẦU (< 95%) VS DUYỆT MINH CHỨNG BỔ SUNG (< 95%) VS AI TỰ ĐỘNG THÔNG QUA (>= 95%)
  type FilterMode = 'INITIAL_REVIEW' | 'SUPPLEMENT_REVIEW' | 'AUTO_APPROVED' | 'ALL' | 'MANUAL_REVIEW';
  const [filterMode, setFilterMode] = useState<FilterMode>('INITIAL_REVIEW');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeImageTab, setActiveImageTab] = useState<'cccd' | 'priority'>('cccd');

  // STATE PHỤC VỤ GỬI EMAIL DO AI TỰ ĐỘNG SOẠN THẢO (1-CLICK SEND)
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // STATE MỞ MODAL RÀ SOÁT TOÀN VĂN EMAIL CÔNG BỐ DO AI SOẠN THẢO (CƠ CHẾ CON NGƯỜI RÀ SOÁT - TASK TCB / SP4)
  const [isReviewEmailModalOpen, setIsReviewEmailModalOpen] = useState(false);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [reviewEmailTab, setReviewEmailTab] = useState<'TRUNG_TUYEN' | 'DANH_SACH_CHO' | 'BO_SUNG'>('TRUNG_TUYEN');
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [selectedStudentPreview, setSelectedStudentPreview] = useState<string>('50K21.108');

  // ĐỒNG BỘ TRẠNG THÁI QUY TRÌNH (BPMN TO-BE: TRƯỞNG BAN DUYỆT B2 -> CÁN BỘ QLSV GỬI EMAIL TCB)
  const [workflowState, setWorkflowState] = useState<{
    currentStep: number;
    isRankingsFinalized: boolean;
    isPublished: boolean;
    directorDirectives?: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      created_at: string;
      sender: string;
      is_read?: boolean;
    }>;
  }>({
    currentStep: 3,
    isRankingsFinalized: false,
    isPublished: false,
    directorDirectives: [],
  });
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch('/api/workflow');
      const json = await res.json();
      if (json.success && json.workflow) {
        setWorkflowState((prev) => {
          if (
            prev.currentStep === json.workflow.currentStep &&
            prev.isRankingsFinalized === json.workflow.isRankingsFinalized &&
            prev.isPublished === json.workflow.isPublished &&
            JSON.stringify(prev.directorDirectives) === JSON.stringify(json.workflow.directorDirectives)
          ) {
            return prev; // Tránh re-render giật lag
          }
          return json.workflow;
        });
      }
    } catch {}
  };

  const handleDismissDirective = async (directiveId: string) => {
    try {
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_directive', directiveId }),
      });
      fetchWorkflow();
    } catch {}
  };

  const handleOfficerSendBatchEmails = async () => {
    setIsSendingBatch(true);
    try {
      const res = await officerSendBatchEmailsAction();
      setWorkflowState((prev) => ({
        ...prev,
        isRankingsFinalized: true,
        isPublished: true,
      }));
      setActionNotice(
        res.message ||
          '✓ Cán bộ QLSV đã xác nhận phát hành và gửi 120 email thông báo (kèm Hợp đồng điện tử 72h) do AI soạn sẵn đến toàn bộ thí sinh trúng tuyển thành công!'
      );
      fetchWorkflow();
    } catch (err: any) {
      alert('Lỗi gửi email hàng loạt: ' + (err.message || ''));
    } finally {
      setIsSendingBatch(false);
    }
  };

  // TỰ ĐỘNG NẠP CÁC HỒ SƠ THỰC TẾ VỪA ĐƯỢC SINH VIÊN SUBMIT & TRẠNG THÁI WORKFLOW
  useEffect(() => {
    fetchWorkflow();
    const interval = setInterval(fetchWorkflow, 6000);
    try {
      const activeCode = localStorage.getItem('active_student_session_code');
      if (activeCode) {
        setSelectedStudentPreview(activeCode);
      }
    } catch {}
    fetch('/api/applications')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAllApplications(json.data);
          try {
            const activeCode = localStorage.getItem('active_student_session_code');
            if (activeCode && json.data.some((a: any) => a.ma_sv === activeCode)) {
              setSelectedStudentPreview(activeCode);
            }
          } catch {}
          const newItems: QueueItem[] = json.data.map((app: any) => ({
            id: app.id,
            khoa: app.ma_sv.substring(0, 3) || '50K',
            ma_sv: app.ma_sv,
            ho_ten: app.ho_ten,
            email: app.email || `${app.ma_sv.toLowerCase()}@due.udn.vn`,
            cccd: app.cccd,
            dien_uu_tien: app.dien_uu_tien_label || app.dien_uu_tien,
            diem_uu_tien: app.diem_uu_tien,
            status: app.status,
            isSupplemented: Boolean(app.is_supplemented),
            isSupplementReview: Boolean(
              app.is_supplement_review ||
              (app.is_supplemented && (app.status === 'CHO_THAM_DINH' || app.status === 'CAN_BO_SUNG'))
            ),
            supplementSubmittedAt: app.supplement_submitted_at,
            cccdImageUrl: app.cccd_image_base64?.startsWith('data:')
              ? app.cccd_image_base64
              : `data:image/jpeg;base64,${app.cccd_image_base64}`,
            priorityImageUrl: app.priority_image_base64
              ? app.priority_image_base64.startsWith('data:')
                ? app.priority_image_base64
                : `data:image/jpeg;base64,${app.priority_image_base64}`
              : undefined,
            aiConfidence: Number(app.ai_result?.confidence) || 0.96,
            aiDocType: app.ai_result?.document_type || 'Hồ sơ thẩm định trực tuyến',
            aiExtractedName: app.ai_result?.extracted_info?.ho_ten || app.ho_ten,
            aiExtractedCccd: app.ai_result?.extracted_info?.so_dinh_danh || app.cccd,
            nameMatched: app.ai_result?.extracted_info?.name_matched ?? true,
            cccdMatched: app.ai_result?.extracted_info?.cccd_matched ?? true,
            detectedOcrText: app.ai_result?.detected_raw_text || 'Đã đọc văn bản từ ảnh thực tế',
            cccdCheck: {
              hasKeyword: app.ai_result?.cccd_analysis?.has_cccd_keywords ?? true,
              hasPoliceChief: app.ai_result?.cccd_analysis?.has_police_chief_keyword ?? false,
              note: app.ai_result?.cccd_analysis?.notes || 'Xác thực định danh CCCD (Không yêu cầu con dấu đỏ).',
            },
            priorityCheck: {
              matchedKeywords: app.ai_result?.priority_analysis?.matched_policy_keywords || [app.dien_uu_tien_label],
              hasOfficialStamp: app.ai_result?.priority_analysis?.has_official_stamp_or_seal ?? true,
              note: app.ai_result?.priority_analysis?.notes || 'Đã kiểm tra con dấu của cơ quan thẩm quyền.',
            },
            aiWarnings: app.ai_result?.mismatch_warnings || [],
            draftEmail: {
              subject: app.ai_result?.ai_draft_email?.subject || `[KTX DUE] Phản Hồi Hồ Sơ – ${app.ho_ten}`,
              bodyHtml:
                app.ai_result?.ai_draft_email?.body_html ||
                `<p>Kính gửi ${app.ho_ten}, hồ sơ đã được thẩm định và ghi nhận.</p>`,
            },
          }));

          setQueue((prev) => {
            const itemMap = new Map<string, QueueItem>();
            prev.forEach((item) => itemMap.set(item.id, item));
            newItems.forEach((item) => {
              const existing = itemMap.get(item.id);
              if (existing) {
                itemMap.set(item.id, {
                  ...existing,
                  ...item,
                  cccdImageUrl: item.cccdImageUrl || existing.cccdImageUrl,
                  priorityImageUrl: item.priorityImageUrl || existing.priorityImageUrl,
                });
              } else {
                itemMap.set(item.id, item);
              }
            });
            return Array.from(itemMap.values());
          });
        }
      })
      .catch((err) => console.warn('Lỗi nạp danh sách duyệt:', err));

    return () => clearInterval(interval);
  }, []);

  // KHI TRƯỞNG BAN ĐÃ CÔNG BỐ HOẶC KÝ DUYỆT B2: HÀNG ĐỢI RÀ SOÁT MINH CHỨNG & MINH CHỨNG BỔ SUNG PHẢI TRỐNG (0 HỒ SƠ)
  const isRoundClosed = Boolean(workflowState.isPublished || workflowState.isRankingsFinalized);

  // 1. MINH CHỨNG BỔ SUNG CẦN DUYỆT (< 95%) - TAB RIÊNG THEO YÊU CẦU NGƯỜI DÙNG
  const supplementReviewItems = isRoundClosed
    ? []
    : queue.filter(
        (x) =>
          x.status !== 'THAM_DINH_DAT' &&
          (x.isSupplementReview || (x.isSupplemented && (x.status === 'CHO_THAM_DINH' || x.aiConfidence < 0.95)))
      );

  // 2. HỒ SƠ BAN ĐẦU CẦN RÀ SOÁT (< 95%)
  const initialReviewItems = isRoundClosed
    ? []
    : queue.filter(
        (x) =>
          x.status !== 'THAM_DINH_DAT' &&
          !x.isSupplementReview &&
          !x.isSupplemented &&
          (x.status === 'CHO_THAM_DINH' || x.aiConfidence < 0.95)
      );

  // 3. AI TỰ ĐỘNG CHO QUA (>= 95%)
  const autoApprovedItems = isRoundClosed
    ? queue
    : queue.filter(
        (x) => x.status === 'THAM_DINH_DAT' || (x.status !== 'CHO_THAM_DINH' && x.aiConfidence >= 0.95)
      );

  const totalPendingReview = initialReviewItems.length + supplementReviewItems.length;

  const filteredQueue = isRoundClosed
    ? (['INITIAL_REVIEW', 'SUPPLEMENT_REVIEW', 'MANUAL_REVIEW'].includes(filterMode) ? [] : queue)
    : queue.filter((item) => {
        if (filterMode === 'SUPPLEMENT_REVIEW') {
          return (
            item.status !== 'THAM_DINH_DAT' &&
            (item.isSupplementReview || (item.isSupplemented && (item.status === 'CHO_THAM_DINH' || item.aiConfidence < 0.95)))
          );
        }
        if (filterMode === 'INITIAL_REVIEW' || filterMode === 'MANUAL_REVIEW') {
          return (
            item.status !== 'THAM_DINH_DAT' &&
            !item.isSupplementReview &&
            !item.isSupplemented &&
            (item.status === 'CHO_THAM_DINH' || item.aiConfidence < 0.95)
          );
        }
        if (filterMode === 'AUTO_APPROVED') {
          return item.status === 'THAM_DINH_DAT' || (item.status !== 'CHO_THAM_DINH' && item.aiConfidence >= 0.95);
        }
        return true;
      });

  const currentItem = filteredQueue.length > 0 ? (filteredQueue[currentIndex] || filteredQueue[0]) : undefined;

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    setCurrentIndex(0);
  };

  // CÁN BỘ QLSV DUYỆT ĐẠT TẤT CẢ MINH CHỨNG CÒN LẠI (ĐỒNG BỘ PHÍA TRƯỞNG BAN VỀ 0)
  const handleApproveAllPending = async () => {
    setIsApprovingAll(true);
    try {
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all_pending' }),
      });
      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'THAM_DINH_DAT',
          aiConfidence: 1.0,
          isSupplementReview: false,
        }))
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'officer_approved_ids',
          JSON.stringify(queue.map((q) => q.id))
        );
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('ktx_sync');
          bc.postMessage({
            type: 'ALL_EVIDENCE_APPROVED',
            status: 'THAM_DINH_DAT',
            timestamp: Date.now(),
          });
          setTimeout(() => bc.close(), 100);
        }
      }
      setActionNotice(
        '✓ CÁN BỘ QLSV ĐÃ HOÀN TẤT THẨM ĐỊNH TOÀN BỘ MINH CHỨNG! Phía Trưởng ban hiện có đúng 0 hồ sơ chờ duyệt, đủ 100% điều kiện để ký Quyết định B2.'
      );
    } catch (e) {
      alert('Lỗi phê duyệt: ' + e);
    } finally {
      setIsApprovingAll(false);
    }
  };

  // DANH SÁCH SINH VIÊN PHỤC VỤ RÀ SOÁT CÁ NHÂN HÓA DỰ THẢO EMAIL AI (TASK TCB / SP4)
  const defaultSampleStudents = [
    {
      ma_sv: '251121536108',
      ho_ten: 'Trần Minh Khang',
      email: 'khang.tm@due.udn.vn',
      dien_uu_tien: 'Hộ nghèo, cận nghèo theo chuẩn QG',
      diem_uu_tien: 35,
      gioi_tinh: 'Nam',
      rank: 1,
      roomName: 'Phòng 301 - Khu A (4 người)',
      status: 'THAM_DINH_DAT',
    },
    {
      ma_sv: '251121536155',
      ho_ten: 'Nguyễn Thị Thu Thảo',
      email: 'thao.ntt@due.udn.vn',
      dien_uu_tien: 'Vùng sâu vùng xa, hải đảo',
      diem_uu_tien: 30,
      gioi_tinh: 'Nữ',
      rank: 45,
      roomName: 'Phòng 204 - Khu B (4 người)',
      status: 'THAM_DINH_DAT',
    },
    {
      ma_sv: '251121536089',
      ho_ten: 'Lê Hoàng Nam',
      email: 'nam.lh@due.udn.vn',
      dien_uu_tien: 'Con liệt sĩ, con thương binh',
      diem_uu_tien: 40,
      gioi_tinh: 'Nam',
      rank: 2,
      roomName: 'Phòng 102 - Khu A (4 người)',
      status: 'THAM_DINH_DAT',
    },
    {
      ma_sv: '251121536135',
      ho_ten: 'Phạm Hải Đăng',
      email: 'dang.ph@due.udn.vn',
      dien_uu_tien: 'Sinh viên ngoại tỉnh cự ly > 200km',
      diem_uu_tien: 20,
      gioi_tinh: 'Nam',
      rank: 135,
      roomName: 'Chưa phân bổ (Danh sách chờ)',
      status: 'THAM_DINH_DAT',
    },
  ];

  const mergedRankings = computeMergedRankings(allApplications, 120);

  const combinedStudentList = [
    ...allApplications.map((app) => {
      const rankRow = mergedRankings.find((r) => r.ma_sv === app.ma_sv || r.id === app.id);
      const currentRank = rankRow ? rankRow.thu_hang : 325;
      const room = getAssignedRoomForStudent(
        { ma_sv: app.ma_sv, gioi_tinh: app.gioi_tinh, thu_hang: currentRank },
        currentRank
      );
      const studentOtp = getStudentOtpCode(app.ma_sv);
      return {
        ma_sv: app.ma_sv,
        ho_ten: app.ho_ten,
        email: app.email || `${app.ma_sv.toLowerCase()}@due.udn.vn`,
        dien_uu_tien: app.dien_uu_tien_label || app.dien_uu_tien,
        diem_uu_tien: app.diem_uu_tien ?? 0,
        rank: currentRank,
        roomName: room,
        otpCode: studentOtp,
        status: app.status,
      };
    }),
    ...defaultSampleStudents.map((ds) => ({
      ...ds,
      roomName: getAssignedRoomForStudent({ ma_sv: ds.ma_sv, rank: ds.rank }, ds.rank),
      otpCode: getStudentOtpCode(ds.ma_sv),
    })),
  ];

  const uniqueStudentList = Array.from(
    new Map(combinedStudentList.map((s) => [s.ma_sv, s])).values()
  );

  const activeStudent =
    uniqueStudentList.find((s) => s.ma_sv === selectedStudentPreview) ||
    uniqueStudentList[0] ||
    defaultSampleStudents[0];

  // HÀM TỰ ĐỘNG SOẠN THẢO EMAIL CHI TIẾT THEO QUY TRÌNH TO-BE (TASK TR - DOB_KQ)
  const getAIDraftForStudent = (item: QueueItem) => {
    let specificIssue = '';
    if (!item.priorityCheck.hasOfficialStamp) {
      specificIssue = `Giấy xác nhận diện ưu tiên (${item.dien_uu_tien}) hiện chưa phát hiện con dấu đỏ/mộc tròn xác nhận của cơ quan thẩm quyền (UBND Xã/Phường/Thị trấn). Theo quy định xét duyệt nội trú KTX DUE, ảnh chụp bắt buộc phải có mộc đỏ hợp lệ.`;
    } else if (item.aiWarnings && item.aiWarnings.length > 0) {
      specificIssue = item.aiWarnings.join('. ');
    } else if (item.priorityCheck.note && item.priorityCheck.note.includes('⚠️')) {
      specificIssue = item.priorityCheck.note;
    } else {
      specificIssue = `Ảnh chụp minh chứng diện ưu tiên (${item.dien_uu_tien}) có độ tương phản thấp hoặc chưa rõ nét (Độ tin cậy AI: ${Math.round(item.aiConfidence * 100)}% < 95%). Cần chụp lại bản rõ ràng có mộc đỏ hợp lệ.`;
    }

    const subject = `[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – Sinh Viên ${item.ho_ten} (${item.ma_sv})`;

    const body = `Kính gửi sinh viên ${item.ho_ten} (MSSV: ${item.ma_sv}),

Ban Quản lý Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng (DUE) xin thông báo kết quả thẩm định hồ sơ đăng ký nội trú của bạn:

Hệ thống thẩm định minh chứng tự động và Bộ phận Quản lý Sinh viên đã rà soát đối chiếu hồ sơ. Để đảm bảo tính chính xác và quyền lợi cộng điểm ưu tiên (${item.dien_uu_tien}), bạn cần bổ sung/chụp lại minh chứng theo yêu cầu sau:

📌 CHI TIẾT SAI SÓT PHÁT HIỆN:
- ${specificIssue}

⏱️ THỜI HẠN BỔ SUNG: Bạn có chính xác 48 GIỜ kể từ khi nhận được email này để chụp lại bản rõ nét và tải lên Cổng thông tin (theo quy định tiếp nhận bổ sung của KTX DUE).

🚨 LƯU Ý BẮT BUỘC: Hết thời hạn 48 giờ nêu trên, nếu không nhận được minh chứng hợp lệ bổ sung, hệ thống sẽ tự động chuyển hồ sơ sang trạng thái "KHÔNG ĐƯỢC XÉT" và hủy điểm ưu tiên dự kiến.

Vui lòng truy cập Cổng Tân Sinh Viên KTX DUE tại http://localhost:3000/student để tải lại ảnh minh chứng.

Trân trọng,
Bộ phận Quản lý Sinh viên – Ban Quản trị KTX DUE
Trường Đại học Kinh tế – Đại học Đà Nẵng
Điện thoại: (0236) 3836.169 | Email: ktx@due.edu.vn`;

    return {
      subject,
      body,
      recipient: item.email || `${item.ma_sv.toLowerCase()}@due.udn.vn`,
    };
  };

  // MỞ MODAL VỚI EMAIL ĐƯỢC AI SOẠN SẴN 100%
  const openSupplementModal = () => {
    if (!currentItem) return;
    const draft = getAIDraftForStudent(currentItem);
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
    setRecipientEmail(draft.recipient);
    setIsModalOpen(true);
  };

  // DUYỆT ĐẠT 1-CLICK & CỘNG ĐIỂM ƯU TIÊN VÀO BẢNG XẾP HẠNG
  const handleApprove = async () => {
    if (!currentItem || isApproving) return;
    setIsApproving(true);
    let points = currentItem.diem_uu_tien ?? 35;
    try {
      const res = await approveEvidenceAction(currentItem.id, currentItem.ma_sv);
      points = res.awardedPoints ?? currentItem.diem_uu_tien ?? 35;
      setActionNotice(
        `✓ ĐÃ DUYỆT ĐẠT: Minh chứng của sinh viên ${currentItem.ho_ten} (${currentItem.ma_sv}) đã được Cán bộ QLSV xác nhận hợp lệ. Đã cộng +${points} điểm ưu tiên và cập nhật thứ hạng trên Bảng xếp hạng.`
      );

      // ĐỒNG BỘ TỨC THÌ SANG TAB SINH VIÊN (INSTANT CROSS-TAB SYNC 0MS)
      if (typeof window !== 'undefined') {
        try {
          const syncData = {
            type: 'STATUS_UPDATED',
            action: 'APPROVED',
            studentCode: currentItem.ma_sv,
            status: 'THAM_DINH_DAT',
            points: points,
            timestamp: Date.now(),
          };
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('ktx_sync');
            bc.postMessage(syncData);
            bc.close();
          }
          const lastRaw = localStorage.getItem('last_submitted_student');
          if (lastRaw) {
            const parsed = JSON.parse(lastRaw);
            if (parsed.ma_sv === currentItem.ma_sv) {
              parsed.status = 'THAM_DINH_DAT';
              parsed.diem_uu_tien = points;
              localStorage.setItem('last_submitted_student', JSON.stringify(parsed));
            }
          }
          localStorage.setItem('ktx_sync_signal', JSON.stringify(syncData));
          window.dispatchEvent(new CustomEvent('student_session_changed', { detail: { ma_sv: currentItem.ma_sv, status: 'THAM_DINH_DAT' } }));
        } catch {}
      }
    } catch (e) {
      console.warn('Approve evidence error:', e);
    } finally {
      setIsApproving(false);
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('officer_approved_ids') || '[]';
        const list = JSON.parse(raw);
        list.push(currentItem.id);
        localStorage.setItem('officer_approved_ids', JSON.stringify(list));
      } catch {}
    }

    setQueue((prev) =>
      prev.map((item) =>
        item.id === currentItem.id
          ? {
              ...item,
              status: 'THAM_DINH_DAT',
              aiConfidence: 1.0,
              isSupplementReview: false,
            }
          : item
      )
    );
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  // GỬI EMAIL YÊU CẦU BỔ SUNG 1-CLICK (AI ĐÃ SOẠN SẴN)
  const handleSendSupplementEmail = async () => {
    if (!currentItem) return;
    setIsSending(true);
    try {
      const res = await sendSupplementRequestAction({
        applicationId: currentItem.id,
        recipientEmail: recipientEmail.trim(),
        studentName: currentItem.ho_ten,
        studentCode: currentItem.ma_sv,
        reason: currentItem.priorityCheck.note || 'Thiếu mộc đỏ / minh chứng chưa hợp lệ',
        emailSubject: emailSubject.trim(),
        emailBody: emailBody.trim(),
      });

      if (res.success) {
        // ĐỒNG BỘ TỨC THÌ SANG TAB SINH VIÊN
        if (typeof window !== 'undefined') {
          try {
            const syncData = {
              type: 'STATUS_UPDATED',
              action: 'SUPPLEMENT_REQUESTED',
              studentCode: currentItem.ma_sv,
              status: 'CAN_BO_SUNG',
              timestamp: Date.now(),
            };
            if ('BroadcastChannel' in window) {
              const bc = new BroadcastChannel('ktx_sync');
              bc.postMessage(syncData);
              bc.close();
            }
            const lastRaw = localStorage.getItem('last_submitted_student');
            if (lastRaw) {
              const parsed = JSON.parse(lastRaw);
              if (parsed.ma_sv === currentItem.ma_sv) {
                parsed.status = 'CAN_BO_SUNG';
                localStorage.setItem('last_submitted_student', JSON.stringify(parsed));
              }
            }
            localStorage.setItem('ktx_sync_signal', JSON.stringify(syncData));
            window.dispatchEvent(new CustomEvent('student_session_changed', { detail: { ma_sv: currentItem.ma_sv, status: 'CAN_BO_SUNG' } }));
          } catch {}
        }

        setActionNotice(
          `✓ Đã gửi email yêu cầu bổ sung trong 48h tới ${currentItem.ho_ten} (${recipientEmail.trim()})! Hồ sơ đã chuyển sang trạng thái CẦN BỔ SUNG.`
        );
        setIsModalOpen(false);
        removeCurrentItem();
      } else {
        alert(`Lỗi khi gửi email: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err.message || 'Không thể gửi email'}`);
    } finally {
      setIsSending(false);
    }
  };

  const removeCurrentItem = () => {
    if (!currentItem) return;
    const updated = queue.filter((x) => x.id !== currentItem.id);
    setQueue(updated);
    if (currentIndex >= filteredQueue.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="space-y-4">
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold">
          {actionNotice}
        </div>
      )}

      {/* THANH TÁC VỤ NHANH: RÀ SOÁT DỰ THẢO EMAIL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs">
        <div className="flex items-center space-x-2.5">
          <span className="w-7 h-7 rounded-lg bg-[#003366] text-[#FFB800] flex items-center justify-center font-bold text-sm shadow-2xs">
            ✉️
          </span>
          <div>
            <span className="font-bold text-[#003366]">
              Hộp Thư Công Bố Tuyển Sinh (AI Soạn Thảo)
            </span>
            <p className="text-[11px] text-slate-600">
              Kiểm tra nội dung email, phòng ở và mã OTP trước khi phát hành
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsReviewEmailModalOpen(true)}
          className="px-3.5 py-1.5 bg-white hover:bg-blue-50 text-[#003366] border border-blue-300 font-bold rounded-lg shadow-2xs transition flex items-center space-x-1.5 shrink-0"
        >
          <span>👁️</span>
          <span>Xem Dự Thảo Email</span>
        </button>
      </div>

      {/* THÔNG BÁO CHỈ ĐẠO TRỰC TIẾP TỪ TRƯỞNG BAN KTX ĐẾN BỘ PHẬN QLSV (XOR 3 TRẢ VỀ HOẶC DUYỆT B2) */}
      {workflowState.directorDirectives && workflowState.directorDirectives.length > 0 && (
        <div className="space-y-3">
          {workflowState.directorDirectives.map((d) => (
            <div
              key={d.id}
              className={`p-4 rounded-xl shadow-lg border-2 space-y-2.5 ${
                d.type === 'TRA_VE'
                  ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 text-white border-rose-400'
                  : 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white border-indigo-400'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/20 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-black shadow">
                    {d.type === 'TRA_VE' ? '⚠️' : '🔔'}
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
                      THÔNG BÁO TỪ TRƯỞNG BAN QUẢN LÝ KÝ TÚC XÁ
                    </span>
                    <h3 className="text-xs sm:text-sm font-black text-white">{d.title}</h3>
                  </div>
                </div>
                <span className="text-[10px] text-white/70 font-mono">
                  {new Date(d.created_at).toLocaleTimeString('vi-VN')}{' '}
                  {new Date(d.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10 text-xs text-white leading-relaxed">
                <strong className="text-amber-300 font-bold">Chỉ đạo của Trưởng ban:</strong> "{d.message}"
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-[11px]">
                <span className="text-white/80 italic font-medium">Người gửi: {d.sender}</span>
                <button
                  type="button"
                  onClick={() => handleDismissDirective(d.id)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-[#003366] font-bold rounded-lg shadow transition self-end sm:self-auto"
                >
                  ✓ Đã Tiếp Nhận Thông Báo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* THẨM QUYỀN CÁN BỘ QLSV: PHÁT HÀNH EMAIL THÔNG BÁO */}
      {workflowState.isRankingsFinalized && !workflowState.isPublished && (
        <div className="bg-gradient-to-r from-[#003366] via-blue-900 to-indigo-950 text-white rounded-xl p-4 shadow-md border-2 border-[#FFB800]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-bold rounded-full">
                  ✓ Trưởng Ban Đã Ký Quyết Định Duyệt (B2)
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Cán Bộ QLSV: Xác Nhận Gửi Email Thông Báo Đến Thí Sinh
              </h2>
              <p className="text-xs text-blue-200 max-w-2xl">
                AI đã soạn sẵn 120 email trúng tuyển kèm Hợp đồng điện tử 72 giờ. Bấm xác nhận để gửi đến sinh viên.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReviewEmailModalOpen(true)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold text-xs rounded-lg transition"
              >
                👁️ Rà Soát Email
              </button>
              <button
                type="button"
                onClick={() => setShowSendConfirmModal(true)}
                disabled={isSendingBatch}
                className="px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black text-xs rounded-lg shadow transition disabled:opacity-50"
              >
                {isSendingBatch ? 'Đang gửi...' : '✉ Gửi Email Thông Báo (120 Thí Sinh)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {workflowState.isPublished && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shrink-0 animate-pulse"></span>
            <span className="font-bold text-emerald-950">
              ✓ Đã phát hành 120 email thông báo và Hợp đồng điện tử 72h đến thí sinh trúng tuyển thành công!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsReviewEmailModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-xs transition text-xs shrink-0"
          >
            👁️ Xem Lại Email Đã Gửi
          </button>
        </div>
      )}

      {/* QUY TẮC PHÂN NHÁNH 95% CỦA AI VISION */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="px-2 py-0.5 bg-[#003366] text-white rounded font-bold text-[10px]">AI 95%</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span><strong>≥ 95%:</strong> AI tự duyệt, vào thẳng BXH.</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span><strong>&lt; 95%:</strong> Cán bộ QLSV rà soát lại.</span>
          </span>
        </div>
      </div>

      {/* TABS CHUYỂN ĐỔI: HỒ SƠ BAN ĐẦU VS DUYỆT MINH CHỨNG BỔ SUNG VS ĐÃ TỰ ĐỘNG THÔNG QUA */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          {/* TAB 1: HỒ SƠ BAN ĐẦU CẦN RÀ SOÁT */}
          <button
            type="button"
            onClick={() => handleFilterChange('INITIAL_REVIEW')}
            className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center space-x-2 ${
              filterMode === 'INITIAL_REVIEW' || filterMode === 'MANUAL_REVIEW'
                ? 'bg-amber-500 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>⚠️ Hồ Sơ Ban Đầu (&lt; 95%)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                filterMode === 'INITIAL_REVIEW' || filterMode === 'MANUAL_REVIEW'
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-300 text-slate-800'
              }`}
            >
              {initialReviewItems.length}
            </span>
          </button>

          {/* TAB 2: DUYỆT MINH CHỨNG BỔ SUNG (THEO YÊU CẦU NGƯỜI DÙNG) */}
          <button
            type="button"
            onClick={() => handleFilterChange('SUPPLEMENT_REVIEW')}
            className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center space-x-2 ${
              filterMode === 'SUPPLEMENT_REVIEW'
                ? 'bg-purple-700 text-white shadow ring-2 ring-purple-300'
                : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <span>🔄 Duyệt Minh Chứng Bổ Sung (&lt; 95%)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                filterMode === 'SUPPLEMENT_REVIEW'
                  ? 'bg-purple-900 text-white'
                  : 'bg-purple-200 text-purple-900'
              }`}
            >
              {supplementReviewItems.length}
            </span>
          </button>

          {/* TAB 3: AI ĐÃ TỰ ĐỘNG THÔNG QUA */}
          <button
            type="button"
            onClick={() => handleFilterChange('AUTO_APPROVED')}
            className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center space-x-2 ${
              filterMode === 'AUTO_APPROVED'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>✓ AI Đã Tự Động Cho Qua (≥ 95%)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                filterMode === 'AUTO_APPROVED' ? 'bg-emerald-800 text-white' : 'bg-slate-300 text-slate-800'
              }`}
            >
              {autoApprovedItems.length}
            </span>
          </button>

          {/* TAB 4: TẤT CẢ */}
          <button
            type="button"
            onClick={() => handleFilterChange('ALL')}
            className={`px-3 py-2 rounded-lg font-semibold transition text-xs ${
              filterMode === 'ALL'
                ? 'bg-[#003366] text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({queue.length})
          </button>

          {/* NÚT DUYỆT ĐẠT TẤT CẢ (CHỈ HIỂN THỊ KHI CÓ HỒ SƠ CHỜ DUYỆT VÀ KHÔNG Ở TAB ĐÃ TỰ ĐỘNG CHO QUA) */}
          {filterMode !== 'AUTO_APPROVED' && totalPendingReview > 0 && (
            <button
              type="button"
              onClick={handleApproveAllPending}
              disabled={isApprovingAll}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition text-xs flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              title="Phê duyệt nhanh tất cả các hồ sơ còn lại để chốt số lượng chờ duyệt phía Trưởng ban về 0"
            >
              <span>✓</span>
              <span>
                {isApprovingAll
                  ? 'Đang duyệt...'
                  : `Duyệt Đạt Tất Cả (${totalPendingReview})`}
              </span>
            </button>
          )}
        </div>

        {filteredQueue.length > 0 && currentItem && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-medium">
              Hồ sơ {currentIndex + 1} / {filteredQueue.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))}
              disabled={currentIndex === 0}
              className="px-2.5 py-1 text-xs border rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev < filteredQueue.length - 1 ? prev + 1 : prev))}
              disabled={currentIndex === filteredQueue.length - 1}
              className="px-2.5 py-1 text-xs border rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        )}
      </div>

      {/* NẾU DANH SÁCH RỖNG HOẶC TRƯỞNG BAN ĐÃ CÔNG BỐ DANH SÁCH */}
      {(!currentItem || filteredQueue.length === 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {isRoundClosed
              ? 'Hàng Đợi Thẩm Định & Minh Chứng Bổ Sung Đã Trống (0 Hồ Sơ Tồn Đọng)'
              : filterMode === 'SUPPLEMENT_REVIEW'
              ? 'Hàng Đợi Minh Chứng Bổ Sung Đang Trống (0 Hồ Sơ Cần Duyệt)!'
              : filterMode === 'INITIAL_REVIEW' || filterMode === 'MANUAL_REVIEW'
              ? 'Hàng Đợi Hồ Sơ Ban Đầu Đang Trống (0 Hồ Sơ Nghi Vấn)!'
              : 'Không Có Hồ Sơ Nào Trong Mục Này'}
          </h3>
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            {isRoundClosed
              ? 'Trưởng Ban Quản lý KTX đã công bố danh sách chính thức. Toàn bộ hồ sơ minh chứng và minh chứng bổ sung của đợt này đã được chốt và hoàn tất xử lý (0 hồ sơ cần duyệt lại).'
              : filterMode === 'SUPPLEMENT_REVIEW'
              ? 'Hiện tại không có sinh viên nào nộp lại minh chứng bổ sung dưới 95% đang chờ duyệt. Mọi minh chứng bổ sung đạt ≥ 95% đã được AI tự động duyệt đạt, cộng điểm và cập nhật lên BXH.'
              : filterMode === 'INITIAL_REVIEW' || filterMode === 'MANUAL_REVIEW'
              ? 'Toàn bộ hồ sơ ban đầu đã được Cán bộ QLSV hoàn tất thẩm định đạt chuẩn (hoặc AI tự động thông qua ≥ 95%). Phía Trưởng Ban hiện tại có đúng 0 hồ sơ chờ duyệt, đủ 100% điều kiện để ký Quyết định phê duyệt B2.'
              : 'Chuyển sang tab khác để xem danh sách hồ sơ.'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {filterMode !== 'SUPPLEMENT_REVIEW' && supplementReviewItems.length > 0 && (
              <button
                type="button"
                onClick={() => handleFilterChange('SUPPLEMENT_REVIEW')}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg transition"
              >
                Xem Duyệt Minh Chứng Bổ Sung ({supplementReviewItems.length}) &rarr;
              </button>
            )}
            {filterMode !== 'INITIAL_REVIEW' && initialReviewItems.length > 0 && (
              <button
                type="button"
                onClick={() => handleFilterChange('INITIAL_REVIEW')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition"
              >
                Xem Hồ Sơ Ban Đầu ({initialReviewItems.length}) &rarr;
              </button>
            )}
            {filterMode !== 'AUTO_APPROVED' && (
              <button
                type="button"
                onClick={() => handleFilterChange('AUTO_APPROVED')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition"
              >
                Xem Danh Sách Đã Thẩm Định Đạt ({autoApprovedItems.length}) &rarr;
              </button>
            )}
            <button
              type="button"
              onClick={() => handleFilterChange('ALL')}
              className="px-4 py-2 bg-[#003366] hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition"
            >
              Xem Tất Cả ({queue.length})
            </button>
            <a
              href="/ranking"
              className="px-4 py-2 bg-[#F26422] hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center space-x-1.5"
            >
              <span>📊</span>
              <span>Xem Bảng Xếp Hạng Tuyển Sinh &rarr;</span>
            </a>
          </div>
        </div>
      )}

      {/* CHI TIẾT HỒ SƠ ĐANG XEM */}
      {currentItem && filteredQueue.length > 0 && (
        <>
          {/* BANNER TRẠNG THÁI HỒ SƠ: TINH GỌN, DỄ NHÌN */}
          {isRoundClosed || currentItem.aiConfidence >= 0.95 || currentItem.status === 'THAM_DINH_DAT' ? (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-2.5">
                <span className="text-emerald-600 font-bold text-base">✓</span>
                <div>
                  <span className="font-bold text-emerald-900">
                    {isRoundClosed
                      ? 'Hồ Sơ Đã Được Chốt Trong Đợt Tuyển Sinh (Đã Phát Hành Email)'
                      : `AI Thẩm Định Đạt ${(currentItem.aiConfidence * 100).toFixed(0)}% (Trùng khớp 100% dữ liệu)`}
                  </span>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    {isRoundClosed
                      ? 'Đợt tuyển sinh đã công bố danh sách chính thức và phát hành hợp đồng điện tử 72h. Toàn bộ khâu duyệt đã hoàn tất.'
                      : `Hồ sơ tự động thông qua. Điểm ưu tiên (+${currentItem.diem_uu_tien}đ) đã được ghi nhận vào BXH.`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs uppercase shadow-xs flex items-center space-x-1.5">
                  <span>✓</span>
                  <span>{isRoundClosed ? 'ĐÃ CHỐT ĐỢT 1' : 'TỰ ĐỘNG THÔNG QUA (ĐÃ LÊN BXH)'}</span>
                </span>
              </div>
            </div>
          ) : currentItem.isSupplementReview || currentItem.isSupplemented ? (
            <div className="bg-purple-50 border-2 border-purple-300 text-purple-950 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  🔄
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-purple-950 uppercase tracking-wide">
                      Minh Chứng Bổ Sung Cần Cán Bộ Duyệt (AI Quét {(currentItem.aiConfidence * 100).toFixed(0)}% &lt; 95%)
                    </span>
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded font-bold text-[10px]">
                      Hạn bổ sung 48h
                    </span>
                  </div>
                  <p className="text-purple-800 text-[11px] mt-0.5">
                    {currentItem.aiWarnings && currentItem.aiWarnings.length > 0
                      ? currentItem.aiWarnings.join(' • ')
                      : 'Sinh viên đã tải lại ảnh minh chứng bổ sung. Do độ tin cậy AI < 95%, Cán bộ QLSV đối chiếu mộc đỏ trước khi duyệt đạt và cộng điểm.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 bg-purple-700 text-white font-bold rounded text-[10px] uppercase">
                  MINH CHỨNG BỔ SUNG
                </span>
                <button
                  type="button"
                  onClick={openSupplementModal}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1 transition"
                  title="Yêu cầu sinh viên nộp lại minh chứng"
                >
                  <span>⚠️</span>
                  <span>Yêu Cầu Bổ Sung Lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1 transition disabled:opacity-50"
                  title="Duyệt đạt minh chứng bổ sung và cộng điểm ưu tiên lên BXH"
                >
                  <span>✓</span>
                  <span>{isApproving ? 'Đang duyệt...' : 'Duyệt Đạt Bổ Sung (+Điểm)'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-2.5">
                <span className="text-amber-600 font-bold text-base">⚠️</span>
                <div>
                  <span className="font-bold text-amber-900">
                    Hồ Sơ Ban Đầu Cần Rà Soát (Độ tin cậy {(currentItem.aiConfidence * 100).toFixed(0)}% &lt; 95%)
                  </span>
                  <p className="text-amber-700 text-[11px] mt-0.5">
                    {currentItem.aiWarnings && currentItem.aiWarnings.length > 0
                      ? currentItem.aiWarnings.join(' • ')
                      : 'Vui lòng đối chiếu họ tên, CCCD và con dấu mộc đỏ trước khi duyệt.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded text-[10px] uppercase">
                  CÁN BỘ RÀ SOÁT
                </span>
                <button
                  type="button"
                  onClick={openSupplementModal}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1 transition"
                  title="Gửi email yêu cầu sinh viên bổ sung minh chứng hợp lệ trong 48h"
                >
                  <span>⚠️</span>
                  <span>Yêu Cầu Bổ Sung</span>
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1 transition disabled:opacity-50"
                  title="Cán bộ QLSV xác nhận minh chứng đạt chuẩn và cộng điểm ưu tiên"
                >
                  <span>✓</span>
                  <span>{isApproving ? 'Đang duyệt...' : 'Duyệt Đạt (+Điểm)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* GIAO DIỆN ĐỐI CHIẾU ẢNH SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CỘT TRÁI: XEM TRƯỚC 2 ẢNH ĐỘC LẬP TỪ THIẾT BỊ SINH VIÊN */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 uppercase">
                    Hình Ảnh Sinh Viên Đã Tải Lên (2 Ô Độc Lập)
                  </span>

                  {/* Tab chuyển đổi xem ảnh CCCD vs Ảnh Minh chứng */}
                  <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveImageTab('cccd')}
                      className={`px-3 py-1 rounded font-bold text-[11px] transition ${
                        activeImageTab === 'cccd'
                          ? 'bg-[#003366] text-white shadow'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ảnh 1: CCCD
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageTab('priority')}
                      className={`px-3 py-1 rounded font-bold text-[11px] transition ${
                        activeImageTab === 'priority'
                          ? 'bg-[#003366] text-white shadow'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ảnh 2: Giấy Tờ Ưu Tiên
                    </button>
                  </div>
                </div>

                <div className="my-4 bg-slate-100 rounded-xl p-3 flex items-center justify-center min-h-[300px] max-h-[380px] overflow-hidden border border-slate-200">
                  {activeImageTab === 'cccd' ? (
                    <img
                      src={
                        currentItem.cccdImageUrl && !currentItem.cccdImageUrl.includes('unsplash.com')
                          ? currentItem.cccdImageUrl
                          : generateRealisticCccdSvg(currentItem.ho_ten, currentItem.cccd, 'Nữ')
                      }
                      alt="CCCD"
                      className="max-h-[340px] w-auto object-contain rounded-lg shadow-sm"
                    />
                  ) : currentItem.priorityImageUrl && !currentItem.priorityImageUrl.includes('unsplash.com') ? (
                    <img
                      src={currentItem.priorityImageUrl}
                      alt="Minh chứng ưu tiên"
                      className="max-h-[340px] w-auto object-contain rounded-lg shadow-sm"
                    />
                  ) : (
                    <img
                      src={generateRealisticPrioritySvg(currentItem.ho_ten, currentItem.dien_uu_tien, currentItem.ma_sv)}
                      alt="Minh chứng ưu tiên"
                      className="max-h-[340px] w-auto object-contain rounded-lg shadow-sm"
                    />
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 flex justify-between items-center pt-2 border-t border-slate-100">
                <span>
                  MSSV: <strong className="text-slate-800 font-mono">{currentItem.ma_sv}</strong> ({currentItem.khoa})
                </span>
                <span>
                  Họ tên: <strong className="text-slate-800">{currentItem.ho_ten}</strong> | CCCD:{' '}
                  <strong className="text-slate-800 font-mono">{currentItem.cccd}</strong>
                </span>
              </div>
            </div>

            {/* CỘT PHẢI: KẾT QUẢ PHÂN TÍCH AI VISION, VĂN BẢN OCR & NÚT HÀNH ĐỘNG */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 uppercase">
                    Kết Quả Thẩm Định Tự Động AI Vision
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-600">Độ tin cậy:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black border flex items-center space-x-1 ${
                        currentItem.aiConfidence >= 0.95
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                          : 'bg-amber-100 text-amber-800 border-amber-400'
                      }`}
                    >
                      <span>{currentItem.aiConfidence >= 0.95 ? '✓' : '⚠️'}</span>
                      <span>{(currentItem.aiConfidence * 100).toFixed(0)}%</span>
                      <span className="text-[10px] font-bold">
                        {currentItem.aiConfidence >= 0.95 ? '(≥ 95% - Tự động cho qua)' : '(< 95% - Con người duyệt lại)'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* ĐỐI CHIẾU DỮ LIỆU ĐĂNG KÝ VỚI ẢNH CHỤP */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-slate-800">
                    <span>Đối Chiếu Dữ Liệu Khai Báo vs Ảnh Chụp:</span>
                    <span className="text-[10px] text-slate-500 font-normal">AI OCR Cross-Check</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">Họ tên đăng ký:</span>
                      <strong className="text-slate-900">{currentItem.ho_ten}</strong>
                      <span className="block text-[10px] text-emerald-700 font-bold mt-1">
                        {currentItem.nameMatched ?? true ? '✓ Trùng khớp với ảnh' : '⚠️ Cần đối chiếu lại'}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">Số CCCD đăng ký:</span>
                      <strong className="text-slate-900 font-mono">{currentItem.cccd}</strong>
                      <span className="block text-[10px] text-emerald-700 font-bold mt-1">
                        {currentItem.cccdMatched ?? true ? '✓ Trùng khớp với ảnh' : '⚠️ Cần đối chiếu lại'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1. KẾT QUẢ KIỂM TRA CCCD */}
                {(() => {
                  const isCccdValid =
                    (currentItem.cccdCheck?.hasKeyword ?? true) &&
                    (currentItem.nameMatched ?? true) &&
                    (currentItem.cccdMatched ?? true);
                  return (
                    <div
                      className={`p-3 rounded-lg text-xs space-y-1.5 border ${
                        isCccdValid
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className={isCccdValid ? 'text-emerald-950 font-bold' : 'text-rose-950 font-bold'}>
                          1. Thẩm Định Căn Cước Công Dân (CCCD):
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCccdValid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCccdValid ? '✓ CCCD đạt chuẩn' : '⚠️ Cần đối chiếu'}
                        </span>
                      </div>
                      {isCccdValid ? (
                        <p className="text-emerald-800 font-medium">
                          Họ tên và số CCCD trùng khớp với ảnh chụp.
                        </p>
                      ) : (
                        <p className="text-rose-700 font-semibold">
                          Lý do: {currentItem.cccdCheck?.note || 'Họ tên hoặc số CCCD không trùng khớp với ảnh.'}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* 2. KẾT QUẢ KIỂM TRA GIẤY TỜ ƯU TIÊN */}
                {(() => {
                  const isPriorityValid = currentItem.priorityCheck?.hasOfficialStamp;
                  return (
                    <div
                      className={`p-3 rounded-lg text-xs space-y-1.5 border ${
                        isPriorityValid
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className={isPriorityValid ? 'text-emerald-950 font-bold' : 'text-rose-950 font-bold'}>
                          2. Giấy Tờ Ưu Tiên:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPriorityValid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPriorityValid ? '✓ Có Mộc Đỏ' : '⚠️ Thiếu Mộc Đỏ'}
                        </span>
                      </div>
                      {isPriorityValid ? (
                        <p className="text-emerald-800 font-medium">
                          Đã nhận diện con dấu mộc đỏ hợp lệ.
                        </p>
                      ) : (
                        <p className="text-rose-700 font-semibold">
                          Lý do: {currentItem.priorityCheck?.note || 'Chưa phát hiện mộc đỏ của cơ quan thẩm quyền.'}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* 3. VĂN BẢN OCR TRÍCH XUẤT */}
                <details className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer group">
                  <summary className="font-bold text-slate-700 select-none flex items-center justify-between">
                    <span>Xem văn bản OCR trích xuất</span>
                    <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="font-mono text-[11px] text-slate-600 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {currentItem.detectedOcrText}
                  </p>
                </details>

                {/* 4. DỰ THẢO EMAIL AI */}
                {!(isRoundClosed || currentItem.aiConfidence >= 0.95 || currentItem.status === 'THAM_DINH_DAT') && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-indigo-950 uppercase text-[11px]">
                        ✉️ Dự Thảo Email Yêu Cầu Bổ Sung (AI Soạn)
                      </span>
                      <span className="text-[10px] text-slate-500">Tới: {currentItem.ho_ten}</span>
                    </div>
                    <p className="font-semibold text-slate-800 text-[11px]">
                      {currentItem.draftEmail.subject}
                    </p>
                    <div
                      className="mt-1 text-[10px] text-slate-600 p-2 bg-white rounded border border-indigo-100 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: currentItem.draftEmail.bodyHtml }}
                    />
                    <div className="mt-2.5 flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                      <button
                        type="button"
                        onClick={openSupplementModal}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] shadow-2xs flex items-center space-x-1 transition"
                      >
                        <span>✉️</span>
                        <span>Mở Soạn &amp; Gửi Email Cho {currentItem.ho_ten}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* CÁC NÚT HÀNH ĐỘNG CỦA CÁN BỘ QLSV */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                {isRoundClosed || currentItem.aiConfidence >= 0.95 || currentItem.status === 'THAM_DINH_DAT' ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        ✓
                      </span>
                      <div>
                        <span className="font-bold text-emerald-950">
                          {isRoundClosed
                            ? 'Đợt tuyển sinh đã phát hành và chốt danh sách chính thức'
                            : 'Hồ sơ đã được AI tự động thẩm định đạt chuẩn và cộng điểm ưu tiên (+' + currentItem.diem_uu_tien + 'đ)'}
                        </span>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          {isRoundClosed
                            ? 'Toàn bộ 120 email thông báo và hợp đồng điện tử 72h đã được phát hành. Khâu thẩm định minh chứng đã hoàn tất.'
                            : `Sinh viên ${currentItem.ho_ten} đã được ghi nhận trực tiếp vào Bảng xếp hạng. Cán bộ không cần thao tác duyệt hay soạn gửi thư.`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href="/ranking"
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1"
                      >
                        <span>📊</span>
                        <span>Xem Trên BXH &rarr;</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={openSupplementModal}
                      className="py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <span>⚠️</span>
                      <span>Bước 5: Yêu Cầu Bổ Sung 48h (TR)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className={`py-2.5 px-4 rounded-lg text-xs font-bold shadow transition-colors flex items-center justify-center space-x-1.5 text-white disabled:opacity-50 ${
                        currentItem.isSupplementReview || currentItem.isSupplemented
                          ? 'bg-purple-700 hover:bg-purple-800'
                          : 'bg-blue-700 hover:bg-blue-800'
                      }`}
                    >
                      <span>✓</span>
                      <span>
                        {isApproving
                          ? 'Đang xử lý...'
                          : currentItem.isSupplementReview || currentItem.isSupplemented
                          ? 'Duyệt Đạt Minh Chứng Bổ Sung (+Điểm)'
                          : 'Duyệt Đạt (Cộng Điểm & Cập Nhật BXH)'}
                      </span>
                    </button>
                  </div>
                )}

                {/* Các tác vụ phối hợp trong quy trình BPMN */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href="/director"
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded font-semibold text-[11px] flex items-center space-x-1"
                  >
                    <span>📋</span>
                    <span>Trình Danh Sách Cho Trưởng Ban Phê Duyệt &amp; Công Bố (B2 &amp; TCB) &rarr;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL YÊU CẦU BỔ SUNG MINH CHỨNG (EMAIL ĐƯỢC AI SOẠN SẴN 100% - CHỈ CẦN 1-CLICK GỬI) */}
      {isModalOpen && currentItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-lg font-bold">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Gửi email thông báo yêu cầu sinh viên chụp lại minh chứng rõ nét trong thời hạn 48 giờ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form nội dung email */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Gửi tới sinh viên:</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiêu đề thông báo:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nội dung chi tiết (Được AI soạn thảo sẵn 100%):
                </label>
                <textarea
                  rows={10}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-slate-800 font-mono text-[11px] leading-relaxed"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] space-y-1">
                <strong>📌 Quy định xử lý bổ sung:</strong>
                <p>
                  1. Sinh viên có đúng <strong>48 giờ</strong> để nộp lại minh chứng hợp lệ tại Cổng Sinh Viên.
                </p>
                <p>
                  2. Nếu quá 48 giờ không bổ sung, hồ sơ sẽ chuyển sang trạng thái "Không được xét ưu tiên" theo quy chế tuyển sinh.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendSupplementEmail}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSending && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Phát Hành Thông Báo Bổ Sung (Gửi Mail)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL RÀ SOÁT TOÀN VĂN NỘI DUNG EMAIL DO AI SOẠN THẢO (TASK TCB / SP4)      */}
      {/* CƠ CHẾ CON NGƯỜI RÀ SOÁT (HUMAN-IN-THE-LOOP) TRƯỚC VÀ SAU KHI GỬI EMAIL      */}
      {/* ========================================================================= */}
      {isReviewEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#003366] text-white px-6 py-4 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFB800] text-[#003366] flex items-center justify-center text-xl font-black shadow">
                  ✉️
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-blue-900 text-[#FFB800] text-[10px] font-black uppercase rounded tracking-wider">
                      Văn Bản Hành Chính Điện Tử KTX DUE
                    </span>
                    <span className="text-xs text-blue-200 font-medium">| Kiểm soát phát hành thông báo</span>
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide mt-0.5">
                    Rà Soát Toàn Văn Dự Thảo Email Công Bố Do AI Tự Động Soạn Thảo
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewEmailModalOpen(false)}
                className="text-white/70 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Navigation & Controls */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50">
              {/* Tab Selector & Student Picker */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                {/* 3 Tabs Email */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReviewEmailTab('TRUNG_TUYEN')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                      reviewEmailTab === 'TRUNG_TUYEN'
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>✓</span>
                    <span>1. Email Trúng Tuyển &amp; Ký HĐ 72h (120 Chỗ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewEmailTab('DANH_SACH_CHO')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                      reviewEmailTab === 'DANH_SACH_CHO'
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>⏳</span>
                    <span>2. Email Danh Sách Chờ (Thứ hạng &gt; 120)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewEmailTab('BO_SUNG')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                      reviewEmailTab === 'BO_SUNG'
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>⚠️</span>
                    <span>3. Email Bổ Sung Minh Chứng (48h)</span>
                  </button>
                </div>

                {/* Dropdown xem bản cá nhân hóa */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-bold text-slate-600 whitespace-nowrap">Xem theo thí sinh:</span>
                  <select
                    value={activeStudent.ma_sv}
                    onChange={(e) => {
                      setSelectedStudentPreview(e.target.value);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {uniqueStudentList.map((s) => (
                      <option key={s.ma_sv} value={s.ma_sv}>
                        {s.ho_ten} ({s.ma_sv}) - {s.diem_uu_tien}đ
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex flex-wrap items-center justify-between text-xs px-1 text-slate-500">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-semibold text-slate-700">Trạng thái dữ liệu AI:</span>
                  <span>Đã điền tự động dữ liệu cá nhân hóa từ CSDL KTX DUE</span>
                </div>
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">
                    MSSV: {activeStudent.ma_sv}
                  </span>
                  <span className="font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                    Điểm: {activeStudent.diem_uu_tien}đ
                  </span>
                </div>
              </div>

              {/* Giao diện Email Client Mockup */}
              <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
                {/* Email Header bar */}
                <div className="bg-slate-100/80 px-5 py-3 border-b border-slate-200 text-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 items-center">
                    <span className="sm:col-span-2 font-bold text-slate-500">Người gửi (From):</span>
                    <span className="sm:col-span-10 text-slate-800 font-semibold flex items-center space-x-1.5">
                      <span>Ban Quản lý Ký túc xá – ĐH Kinh tế – ĐH Đà Nẵng</span>
                      <code className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        &lt;ktx@due.udn.vn&gt;
                      </code>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 items-center">
                    <span className="sm:col-span-2 font-bold text-slate-500">Người nhận (To):</span>
                    <span className="sm:col-span-10 text-slate-800 font-semibold flex items-center space-x-1.5">
                      <span>{activeStudent.ho_ten}</span>
                      <code className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                        &lt;{activeStudent.email}&gt;
                      </code>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 items-center">
                    <span className="sm:col-span-2 font-bold text-slate-500">Tiêu đề (Subject):</span>
                    <span className="sm:col-span-10 text-slate-900 font-bold text-xs sm:text-sm">
                      {reviewEmailTab === 'TRUNG_TUYEN' &&
                        `[KTX DUE] Chúc Mừng Bạn Đã Trúng Tuyển – Ký Hợp Đồng KTX Trong 72 Giờ (MSSV: ${activeStudent.ma_sv})`}
                      {reviewEmailTab === 'DANH_SACH_CHO' &&
                        `[KTX DUE] Kết Quả Xét Tuyển Đợt 1 – Danh Sách Chờ Dự Bị (MSSV: ${activeStudent.ma_sv})`}
                      {reviewEmailTab === 'BO_SUNG' &&
                        `[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – Sinh Viên ${activeStudent.ho_ten} (${activeStudent.ma_sv})`}
                    </span>
                  </div>
                </div>

                {/* Email Body Content */}
                <div className="p-6 sm:p-8 space-y-6 text-sm text-slate-800 leading-relaxed font-sans">
                  {/* BRANDING HEADER TRƯỜNG */}
                  <div className="border-b-2 border-[#003366] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                        ĐẠI HỌC ĐÀ NẴNG
                      </p>
                      <h4 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
                        TRƯỜNG ĐẠI HỌC KINH TẾ (DUE)
                      </h4>
                      <p className="text-xs font-bold text-[#FFB800] bg-[#003366] px-2 py-0.5 rounded inline-block mt-1">
                        BAN QUẢN LÝ KÝ TÚC XÁ
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <p className="font-mono">Số: 186/TB-KTX-DUE</p>
                      <p className="italic">Đà Nẵng, ngày 29 tháng 10 năm 2026</p>
                    </div>
                  </div>

                  {/* NỘI DUNG CHI TIẾT THEO TỪNG TAB */}
                  {reviewEmailTab === 'TRUNG_TUYEN' && (
                    <div className="space-y-4">
                      <p>
                        Kính gửi sinh viên: <strong>{activeStudent.ho_ten}</strong> (Mã sinh viên: <strong className="font-mono text-blue-900">{activeStudent.ma_sv}</strong>),
                      </p>

                      <p>
                        Hội đồng Tuyển sinh Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng trân trọng chúc mừng bạn đã chính thức <strong>TRÚNG TUYỂN NỘI TRÚ ĐỢT 1 (Học kỳ I năm học 2026 – 2027)</strong> theo Quyết định số 186/QĐ-KTX được Trưởng Ban Quản lý KTX ký duyệt.
                      </p>

                      {/* BẢNG KẾT QUẢ BỐ TRÍ */}
                      <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                          <span className="font-extrabold text-emerald-900 uppercase text-xs">
                            KẾT QUẢ PHÂN BỔ CHỖ Ở CHÍNH THỨC:
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[10px] rounded">
                            CHỈ TIÊU 120 CHỖ
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-600 block">Phòng nội trú được cấp:</span>
                            <strong className="text-base text-emerald-900 font-black">
                              {activeStudent.roomName || 'Đang phân bổ theo thứ hạng...'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Điểm ưu tiên thẩm định:</span>
                            <strong className="text-emerald-800">
                              {activeStudent.diem_uu_tien} điểm ({activeStudent.dien_uu_tien})
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Thời hạn ký hợp đồng điện tử:</span>
                            <strong className="text-rose-700 font-bold">
                              Trong vòng 72 GIỜ (kể từ khi nhận thông báo này)
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Mã xác thực OTP ký số (Cá nhân):</span>
                            <span className="font-mono text-base font-black px-3 py-1 bg-white border border-emerald-400 rounded-md text-[#003366] inline-block tracking-widest shadow-2xs">
                              {(activeStudent as any).otpCode || getStudentOtpCode(activeStudent.ma_sv)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* HƯỚNG DẪN 3 BƯỚC */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                          📌 HƯỚNG DẪN HOÀN TẤT THỦ TỤC KÝ HỢP ĐỒNG ĐIỆN TỬ (72H):
                        </h5>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 pl-1">
                          <li>
                            Truy cập Cổng Đăng Ký Nội Trú DUE tại liên kết:{' '}
                            <a
                              href="/student"
                              target="_blank"
                              className="text-blue-700 font-semibold underline"
                            >
                              http://localhost:3000/student
                            </a>
                          </li>
                          <li>
                            Chọn tab <strong>&ldquo;Theo Dõi Tiến Trình &amp; Hợp Đồng&rdquo;</strong>, hệ thống tự động nhận diện hồ sơ của bạn.
                          </li>
                          <li>
                            Đọc kỹ các điều khoản hợp đồng nội trú, cam kết thực hiện nội quy KTX và nhập mã OTP xác thực <strong className="font-mono text-[#003366]">{(activeStudent as any).otpCode || getStudentOtpCode(activeStudent.ma_sv)}</strong> để hoàn tất ký số điện tử.
                          </li>
                        </ol>
                      </div>

                      {/* ĐỊNH MỨC TÀI CHÍNH */}
                      <div className="p-3.5 bg-slate-100 rounded-lg text-xs space-y-1.5 border border-slate-200">
                        <span className="font-bold text-slate-800">💰 Phụ lục tài chính và chi phí nội trú KTX:</span>
                        <p className="text-slate-600">
                          • Đơn giá tiền phòng tiêu chuẩn: <strong>350.000 VNĐ / tháng</strong> (đã gồm chi phí vệ sinh khuôn viên chung).
                        </p>
                        <p className="text-slate-600">
                          • Tiền thế chân tài sản và thẻ KTX: <strong>200.000 VNĐ</strong> (sẽ được hoàn trả đầy đủ khi sinh viên trả phòng).
                        </p>
                        <p className="text-slate-600">
                          • Hình thức đóng: Trực tuyến qua Cổng thanh toán DUE hoặc trực tiếp tại Ban Quản lý khi đến nhận phòng thực tế.
                        </p>
                      </div>

                      {/* LƯU Ý 72 GIỜ */}
                      <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 text-xs space-y-1">
                        <strong>⚠️ CẢNH BÁO THỜI HẠN HIỆU LỰC (Thời hạn 72 giờ):</strong>
                        <p>
                          Theo quy chế xét tuyển nội trú KTX DUE, sau <strong>72 giờ</strong> kể từ thời điểm phát hành thông báo này, nếu sinh viên không hoàn thành ký hợp đồng điện tử, hệ thống sẽ tự động hủy quyền trúng tuyển để nhường suất phòng cho thí sinh tiếp theo trong danh sách chờ.
                        </p>
                      </div>
                    </div>
                  )}

                  {reviewEmailTab === 'DANH_SACH_CHO' && (
                    <div className="space-y-4">
                      <p>
                        Kính gửi sinh viên: <strong>{activeStudent.ho_ten}</strong> (Mã sinh viên: <strong className="font-mono text-blue-900">{activeStudent.ma_sv}</strong>),
                      </p>

                      <p>
                        Hội đồng Tuyển sinh Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng xin thông báo kết quả xét tuyển nội trú Đợt 1 năm học 2026 – 2027:
                      </p>

                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <span className="font-extrabold text-amber-900 uppercase text-xs">
                            KẾT QUẢ XÉT TUYỂN ĐỢT 1:
                          </span>
                          <span className="px-2 py-0.5 bg-amber-600 text-white font-bold text-[10px] rounded">
                            DANH SÁCH CHỜ DỰ BỊ
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-600 block">Thứ tự dự bị trong danh sách chờ:</span>
                            <strong className="text-base text-amber-900 font-black">
                              Dự bị thứ #{activeStudent.rank > 120 ? activeStudent.rank - 120 : 15}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Thứ hạng tổng trên BXH:</span>
                            <strong className="text-slate-800">
                              #{activeStudent.rank > 120 ? activeStudent.rank : 135} / 358 thí sinh
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Điểm ưu tiên thẩm định:</span>
                            <strong className="text-slate-800">
                              {activeStudent.diem_uu_tien} điểm ({activeStudent.dien_uu_tien})
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-600 block">Chỉ tiêu tiếp nhận Đợt 1:</span>
                            <strong className="text-blue-900 font-bold">120 chỗ nội trú</strong>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-slate-700">
                        <p>
                          Do số lượng đăng ký vượt quá chỉ tiêu tiếp nhận Đợt 1 (120 chỗ), Nhà trường đã phân bổ chỗ ở theo thứ tự ưu tiên điểm từ cao xuống thấp. Hồ sơ của bạn đã được bảo lưu an toàn trong <strong>Danh sách chờ dự bị</strong>.
                        </p>
                        <p>
                          <strong>Quy trình xét tuyển bổ sung:</strong> Sau 72 giờ ký hợp đồng của Đợt 1, nếu có thí sinh trúng tuyển từ chối hoặc quá hạn không ký hợp đồng điện tử, hệ thống sẽ tự động gửi email thông báo cấp phòng lần lượt cho các bạn trong danh sách chờ.
                        </p>
                      </div>
                    </div>
                  )}

                  {reviewEmailTab === 'BO_SUNG' && (
                    <div className="space-y-4">
                      <p>
                        Kính gửi sinh viên: <strong>{activeStudent.ho_ten}</strong> (Mã sinh viên: <strong className="font-mono text-blue-900">{activeStudent.ma_sv}</strong>),
                      </p>

                      <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                          <span className="font-extrabold text-rose-900 uppercase text-xs">
                            YÊU CẦU BỔ SUNG MINH CHỨNG TRONG 48 GIỜ:
                          </span>
                          <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded">
                            THỜI HẠN 48 GIỜ
                          </span>
                        </div>

                        <p className="text-xs text-rose-950 font-medium">
                          Hệ thống AI Vision và Bộ phận Quản lý Sinh viên đã rà soát minh chứng diện ưu tiên (<strong>{activeStudent.dien_uu_tien}</strong>) của bạn và phát hiện: <em>Ảnh chụp chưa phát hiện con dấu mộc đỏ hợp lệ của cơ quan thẩm quyền hoặc độ tương phản ảnh thấp (&lt; 95%).</em>
                        </p>
                      </div>

                      <div className="space-y-2 text-xs text-slate-700">
                        <p>
                          Bạn có đúng <strong>48 giờ</strong> kể từ thời điểm nhận thông báo này để chụp lại bản rõ nét có con dấu đỏ và tải lên tại Cổng Sinh Viên DUE.
                        </p>
                        <p className="text-rose-700 font-bold">
                          🚨 Quá 48 giờ không bổ sung, hệ thống sẽ kích hoạt sự kiện biên BE2 (Err_KhongXet) và tự động hủy điểm ưu tiên dự kiến.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* CHỮ KÝ CUỐI THƯ */}
                  <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs">
                    <div className="text-slate-500 space-y-0.5 text-[11px]">
                      <p className="font-bold text-slate-700">Ban Quản lý Ký túc xá – Đại học Kinh tế (DUE)</p>
                      <p>Địa chỉ: 71 Ngũ Hành Sơn, TP. Đà Nẵng</p>
                      <p>Hotline hỗ trợ: (0236) 3836.169 | Email: ktx@due.edu.vn</p>
                    </div>

                    <div className="text-center sm:text-right">
                      <p className="font-bold text-[#003366] uppercase text-[11px]">
                        TM. BAN QUẢN LÝ KÝ TÚC XÁ
                      </p>
                      <p className="text-slate-500 text-[10px]">Trưởng Bộ phận Quản lý Sinh viên</p>
                      <div className="my-1">
                        <span className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 font-serif italic text-xs font-bold rounded">
                          (Đã ký số &amp; đóng dấu điện tử)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-emerald-800 font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span>Nội dung email đạt chuẩn thể thức văn bản hành chính KTX DUE</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsReviewEmailModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 shadow-2xs transition"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={() => setShowSendConfirmModal(true)}
                  disabled={isSendingBatch}
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black rounded-lg shadow transition flex items-center space-x-1.5"
                >
                  <span>✉️</span>
                  <span>
                    {isSendingBatch ? 'Đang gửi email...' : '✉️ ĐÃ RÀ SOÁT - BẤM GỬI EMAIL THÔNG BÁO'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN LẦN 2 (CHỐNG TRƯỢT TAY / BẤM NHẦM - YÊU CẦU NGƯỜI DÙNG) */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-black shrink-0">
                ⚠️
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Cơ Chế Kiểm Soát An Toàn 2 Lớp (Safety Confirmation)
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Xác Nhận Phê Duyệt &amp; Gửi Email (Lần 2)
                </h3>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p className="font-bold text-slate-900 text-sm">
                Bạn có chắc chắn muốn duyệt và phát hành email thông báo cho toàn bộ thí sinh hay không?
              </p>
              <p className="text-slate-600 leading-relaxed">
                Thao tác này sẽ chính thức gửi email kết quả (kèm Hợp đồng điện tử thời hạn 72 giờ) tới hộp thư của 120 thí sinh trúng tuyển và cập nhật hệ thống tuyển sinh.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-center space-x-2">
                <span>🛡️</span>
                <span>
                  Lớp xác nhận lần 2 giúp bạn kiểm tra kỹ lại danh sách, tránh gửi nhầm do trượt tay.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSendConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Hủy Bỏ (Không Gửi)
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSendConfirmModal(false);
                  setIsReviewEmailModalOpen(false);
                  await handleOfficerSendBatchEmails();
                }}
                disabled={isSendingBatch}
                className="px-5 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black rounded-lg text-xs shadow-md transition flex items-center space-x-1.5"
              >
                <span>✉️</span>
                <span>{isSendingBatch ? 'Đang gửi...' : '✓ Có, Tôi Chắc Chắn Duyệt & Gửi Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
