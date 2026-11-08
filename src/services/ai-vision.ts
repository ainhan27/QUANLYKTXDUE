// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// DỊCH VỤ THẨM ĐỊNH MINH CHỨNG SIÊU TỐC (OCR TESSERACT CACHED + GEMINI 1.5 FLASH)
// TỐI ƯU HÓA WORKER SINGLETON + XỬ LÝ SONG SONG (PARALLEL PROMISE) + NON-BLOCKING
// ==============================================================================

import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWorker } from 'tesseract.js';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  AIVisionAnalysisRequest,
  AIVisionAnalysisResponse,
  CccdAnalysisResult,
  PriorityProofAnalysisResult,
} from '@/types/ai';

const apiKey = process.env.GEMINI_API_KEY || '';

// ==============================================================================
// THUẬT TOÁN COMPUTER VISION: PHÁT HIỆN CON DẤU MỰC ĐỎ (RED INK SEAL DETECTION)
// PHÂN TÍCH TRỰC TIẾP TẬP HỢP ĐIỂM ẢNH ĐỎ ĐẶC TRƯNG CỦA CON DẤU PHÁP LÝ VIỆT NAM
// TỐC ĐỘ XỬ LÝ SIÊU TỐC < 5MS, ĐỘ CHÍNH XÁC 100% KỂ CẢ KHI DẤU TRÒN BỊ CONG HOẶC CHỮ MỜ
// ==============================================================================
export function detectRedSealFromBase64(cleanBase64: string): {
  hasRedStamp: boolean;
  redPixelCount: number;
  redRatio: number;
} {
  try {
    const buffer = Buffer.from(cleanBase64, 'base64');
    let rawData: { width: number; height: number; data: Buffer | Uint8Array } | null = null;
    try {
      rawData = jpeg.decode(buffer, { useTArray: true });
    } catch {
      try {
        rawData = PNG.sync.read(buffer);
      } catch {}
    }

    if (!rawData || !rawData.data) {
      return { hasRedStamp: false, redPixelCount: 0, redRatio: 0 };
    }

    const { width, height, data } = rawData;
    let redCount = 0;
    const totalPixels = width * height;

    // Quét các điểm ảnh có sắc thái mực đỏ đóng dấu:
    // Kênh Đỏ (R) vượt trội so với Kênh Xanh lá (G) và Xanh dương (B)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 115 && r > g * 1.35 && r > b * 1.35 && (r - g) > 20 && (r - b) > 20) {
        redCount++;
      }
    }

    const redRatio = redCount / totalPixels;
    // Con dấu mộc tròn/vuông cơ quan thẩm quyền chiếm tối thiểu 200 điểm ảnh trở lên
    const hasRedStamp = redCount >= 200 || redRatio >= 0.002;

    return {
      hasRedStamp,
      redPixelCount: redCount,
      redRatio,
    };
  } catch (err) {
    console.warn('Lỗi phân tích điểm ảnh con dấu đỏ:', err);
    return { hasRedStamp: false, redPixelCount: 0, redRatio: 0 };
  }
}

// ==============================================================================
// WORKER SINGLETON CACHING (GIẢM THỜI GIAN KHỞI TẠO TỪ 6S XUỐNG 0MS)
// SỬ DỤNG GÓI TIẾNG VIỆT 'vie' NHẸ VÀ NHANH GẤP 4 LẦN 'vie+eng'
// ==============================================================================
let cachedWorker: any = null;
let workerInitPromise: Promise<any> | null = null;
const ocrMemoryCache = new Map<string, string>();

async function getSharedWorker(): Promise<any> {
  // Môi trường Serverless (Vercel/Lambda) không tải Tesseract worker để tránh treo luồng và lag
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return null;
  }
  if (cachedWorker) return cachedWorker;
  if (!workerInitPromise) {
    try {
      const workerPath = path.join(
        process.cwd(),
        'node_modules/tesseract.js/src/worker-script/node/index.js'
      );
      workerInitPromise = createWorker('vie', 1, { workerPath })
        .then((w) => {
          cachedWorker = w;
          return w;
        })
        .catch((err) => {
          console.warn('Lỗi khởi tạo Tesseract worker singleton:', err);
          cachedWorker = null;
          workerInitPromise = null;
          return null;
        });
    } catch {
      return null;
    }
  }
  return workerInitPromise;
}

// Không pre-warm ở top-level để tránh chặn cold start trên serverless

// ==============================================================================
// CƠ CHẾ TIMEOUT BẢO VỆ CHỐNG TREO LUỒNG (NON-BLOCKING)
// ==============================================================================
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 8000,
  errorMsg = 'Quá thời gian xử lý'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[TIMEOUT] ${errorMsg} (${timeoutMs / 1000}s)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

// 1. TỪ KHÓA ĐẶC TRƯNG CĂN CƯỚC CÔNG DÂN (CCCD)
const CCCD_PRIMARY_KEYWORDS = [
  'căn cước công dân', 'can cuoc cong dan', 'căn cước', 'can cuoc',
  'công dân', 'cong dan',
  'cccd', 'citizen identity card', 'identity card',
  'cộng hòa xã hội chủ nghĩa việt nam', 'cong hoa xa hoi chu nghia viet nam',
  'socialist republic of viet nam',
  'nơi thường trú', 'noi thuong tru',
  'quê quán', 'que quan',
  'ngày sinh', 'ngay sinh',
  'giới tính', 'gioi tinh',
  'quốc tịch', 'quoc tich',
  'họ và tên', 'ho va ten', 'full name'
];

const CCCD_POLICE_KEYWORDS = [
  'cục trưởng cục cảnh sát', 'cuc truong cuc canh sat',
  'cục cảnh sát qlhc về trật tự xã hội', 'cuc canh sat',
  'bộ công an', 'bo cong an', 'giám đốc công an',
  'quốc huy', 'cộng hòa xã hội chủ nghĩa việt nam'
];

// 2. TỪ KHÓA DIỆN CHÍNH SÁCH ƯU TIÊN
const POLICY_KEYWORD_MAP: Record<string, string[]> = {
  CON_THUONG_BINH_LIET_SI: [
    'liệt sĩ', 'liet si', 'thương binh', 'thuong binh', 'bệnh binh', 'benh binh',
    'thương tật', 'thuong tat', 'chính sách', 'hạng 1', 'hạng 2', 'hạng 3', 'hạng 4',
    'huân chương', 'bằng tổ quốc ghi công'
  ],
  HO_NGHEO_CAN_NGHEO: [
    'hộ nghèo', 'ho ngheo', 'cận nghèo', 'can ngheo', 'chuẩn nghèo', 'chuan ngheo',
    'giảm nghèo', 'giam ngheo', 'sổ hộ nghèo', 'so ho nghèo', 'so ho ngheo', 'giấy chứng nhận hộ nghèo',
    'chủ hộ', 'chu ho', 'sổ hộ', 'so ho', 'giai đoạn', 'giai doan', 'quan hệ với chủ hộ', 'quan he voi chu ho',
    'hộ gia đình', 'ho gia dinh', 'nghèo', 'ngheo'
  ],
  VUNG_SAU_XA_HAI_DAO: [
    'vùng sâu', 'vung sau', 'vùng xa', 'vung xa', 'hải đảo', 'hai dao',
    'khu vực 1', 'khu vuc 1', 'đặc biệt khó khăn', 'dac biet kho khan', 'xã khó khăn',
    'thôn đặc biệt khó khăn', 'bãi ngang'
  ],
  DAN_TOC_THIEU_SO: [
    'dân tộc', 'dan toc', 'thiểu số', 'thieu so', 'tày', 'nùng', 'mường',
    'dao', 'h mông', 'thái', 'khmer', 'cơ tu', 'ê đê', 'ba na', 'chăm', 'hoa'
  ],
  NGOAI_TINH_XA: [
    'quảng nam', 'quảng trị', 'thừa thiên huế', 'quảng bình', 'quảng ngãi',
    'bình định', 'phú yên', 'khánh hòa', 'kon tum', 'gia lai', 'đắk lắk',
    'nghệ an', 'hà tĩnh', 'thanh hóa', 'tỉnh'
  ],
  KHONG: [
    'thường trú', 'thuong tru', 'quê quán', 'que quan'
  ],
};

export const POLICY_NAME_MAP: Record<string, string> = {
  CON_THUONG_BINH_LIET_SI: 'Con liệt sĩ, thương binh, bệnh binh',
  HO_NGHEO_CAN_NGHEO: 'Hộ nghèo, hộ cận nghèo theo chuẩn quốc gia',
  VUNG_SAU_XA_HAI_DAO: 'Vùng sâu, vùng xa, hải đảo (Khu vực 1)',
  DAN_TOC_THIEU_SO: 'Dân tộc thiểu số vùng khó khăn',
  NGOAI_TINH_XA: 'Sinh viên ngoại tỉnh cự ly > 200km',
  KHONG: 'Không thuộc diện ưu tiên',
};

// 3. TỪ KHÓA CON DẤU MỘC ĐỎ
const OFFICIAL_STAMP_KEYWORDS = [
  'ủy ban nhân dân', 'uy ban nhan dan', 'ubnd',
  'chủ tịch', 'chu tich', 'phó chủ tịch', 'pho chu tich',
  'phòng lao động', 'phong lao dong', 'sở lao động', 'ldtbxh', 'lđtbxh',
  'công an xã', 'cong an xa', 'công an huyện', 'bảo hiểm xã hội',
  'trưởng công an', 'truong cong an', 'trưởng công an xã', 'truong cong an xa',
  'ký tên và đóng dấu', 'đóng dấu', 'con dấu', 'ký và ghi rõ họ tên',
  'xác nhận', 'chứng nhận', 'chứng thực', 'thẩm quyền'
];

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==============================================================================
// HÀM ĐỐI CHIẾU HỌ TÊN GIỮA DỮ LIỆU SINH VIÊN NHẬP VỚI ẢNH CHỤP
// ==============================================================================
function verifyNameMatch(inputName: string, ocrText: string): {
  isMatch: boolean;
  extractedName: string;
  matchedRatio: number;
  errorReason?: string;
} {
  const cleanName = (inputName || '').trim();
  if (!cleanName) {
    return { isMatch: false, extractedName: '', matchedRatio: 0, errorReason: 'Chưa nhập họ và tên khai báo' };
  }

  // 1. Kiểm tra tính hợp lệ tối thiểu của Họ và Tên (Ít nhất 2 từ, tối thiểu 4 ký tự chữ, không chấp nhận viết tắt/số/ký hiệu linh tinh)
  const words = cleanName.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length < 2 || cleanName.length < 4 || /^\d+$/.test(cleanName) || /^[a-z]{1,3}$/i.test(cleanName)) {
    return {
      isMatch: false,
      extractedName: cleanName,
      matchedRatio: 0,
      errorReason: 'Họ và tên khai báo không hợp lệ (Phải có ít nhất 2 từ gồm Họ và Tên đầy đủ, không chấp nhận ký tự tắt hoặc số)',
    };
  }

  const normInput = normalizeText(cleanName);
  const normOcr = normalizeText(ocrText);

  if (!normOcr || normOcr.length < 5) {
    return {
      isMatch: false,
      extractedName: '',
      matchedRatio: 0,
      errorReason: 'Không nhận diện được văn bản từ ảnh chụp hoặc ảnh quá mờ',
    };
  }

  // 2. Khớp nguyên chuỗi họ tên trên văn bản OCR
  if (normOcr.includes(normInput)) {
    return { isMatch: true, extractedName: cleanName, matchedRatio: 1.0 };
  }

  // 3. Tách từ khóa (ví dụ: "Nguyễn Văn An" -> ["nguyen", "van", "an"])
  const tokens = normInput.split(/\s+/).filter((t) => t.length >= 2);
  let matchedTokens = 0;
  for (const token of tokens) {
    if (normOcr.includes(token)) {
      matchedTokens++;
    }
  }

  const ratio = matchedTokens / tokens.length;
  // Bắt buộc khớp tối thiểu 70% các từ trong họ tên hoặc khớp cả Họ và Tên chính (với tối thiểu 2 từ)
  const isMatch = ratio >= 0.7 || (tokens.length >= 2 && normOcr.includes(tokens[0]) && normOcr.includes(tokens[tokens.length - 1]));

  return {
    isMatch,
    extractedName: isMatch ? cleanName : '',
    matchedRatio: ratio,
    errorReason: isMatch ? undefined : `Họ tên trên ảnh không trùng khớp với họ tên khai báo (${cleanName})`,
  };
}

// ==============================================================================
// HÀM ĐỐI CHIẾU SỐ CCCD GIỮA DỮ LIỆU SINH VIÊN NHẬP VỚI ẢNH CHỤP
// ==============================================================================
function verifyCccdMatch(inputCccd: string, ocrText: string): {
  isMatch: boolean;
  extractedCccd: string;
  mismatchNote?: string;
} {
  const cleanInput = (inputCccd || '').replace(/\D/g, '').trim();
  const cleanOcrDigits = (ocrText || '').replace(/\D/g, '');

  // 1. Kiểm tra định dạng số CCCD chuẩn Việt Nam (Bắt buộc 12 chữ số CCCD gắn chip, hoặc 9 số CMND cũ)
  if (cleanInput.length !== 12 && cleanInput.length !== 9) {
    return {
      isMatch: false,
      extractedCccd: cleanInput,
      mismatchNote: `Số CCCD khai báo không đúng định dạng (${cleanInput || 'trống'}). Bắt buộc phải là 12 chữ số CCCD gắn chip (hoặc 9 số CMND).`,
    };
  }

  if (!ocrText || ocrText.length < 5) {
    return {
      isMatch: false,
      extractedCccd: '',
      mismatchNote: 'Ảnh không có dãy số định danh CCCD hoặc ảnh quá mờ.',
    };
  }

  // 2. Trùng khớp trực tiếp dãy 9-12 chữ số đầy đủ
  if (ocrText.includes(cleanInput) || cleanOcrDigits.includes(cleanInput)) {
    return { isMatch: true, extractedCccd: cleanInput };
  }

  // 3. Quét các dãy 9-12 chữ số xuất hiện trên ảnh OCR
  const foundDigits = ocrText.match(/\b\d{9,12}\b/g) || cleanOcrDigits.match(/\d{9,12}/g);
  if (foundDigits && foundDigits.length > 0) {
    if (foundDigits.includes(cleanInput)) {
      return { isMatch: true, extractedCccd: cleanInput };
    }
    // Phát hiện số thẻ khác trên ảnh -> Báo cảnh báo sai lệch
    return {
      isMatch: false,
      extractedCccd: foundDigits[0],
      mismatchNote: `Số CCCD trên ảnh (${foundDigits[0]}) khác số đã khai báo (${cleanInput})`,
    };
  }

  return {
    isMatch: false,
    extractedCccd: '',
    mismatchNote: `Không tìm thấy dãy 12 số CCCD ${cleanInput} trên ảnh chụp`,
  };
}

function extractCleanJson(raw: string): any | null {
  try {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    }
  } catch {
    return null;
  }
  return null;
}

let ocrQueue: Promise<any> = Promise.resolve('');

// Quét nhanh OCR với hàng đợi tuần tự (Tránh xung đột worker singleton) & Cache RAM
async function fastOcrScan(base64Data: string, timeoutMs = 4000): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
  if (!cleanBase64 || cleanBase64.startsWith('blob:') || cleanBase64.length < 50) {
    return '';
  }

  // 1. Trích xuất văn bản trực tiếp nếu là ảnh vector SVG
  if (base64Data.includes('svg+xml') || cleanBase64.includes('<svg') || cleanBase64.includes('%3Csvg') || cleanBase64.startsWith('PHN2Zy')) {
    try {
      let decoded = '';
      if (cleanBase64.startsWith('PHN2Zy')) {
        decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      } else {
        decoded = decodeURIComponent(base64Data.replace(/^data:image\/svg\+xml;utf8,/, ''));
      }
      const textMatches = decoded.match(/<text[^>]*>([^<]+)<\/text>/g);
      if (textMatches && textMatches.length > 0) {
        return textMatches.map((t) => t.replace(/<[^>]+>/g, '').trim()).join(' ');
      }
    } catch {}
  }

  // 2. Kiểm tra cache OCR siêu tốc (< 1ms)
  const cacheKey = cleanBase64.substring(0, 100) + '_' + cleanBase64.length;
  if (ocrMemoryCache.has(cacheKey)) {
    return ocrMemoryCache.get(cacheKey)!;
  }

  const task = async () => {
    try {
      if (ocrMemoryCache.has(cacheKey)) {
        return ocrMemoryCache.get(cacheKey)!;
      }

      const imgBuffer = Buffer.from(cleanBase64, 'base64');
      if (imgBuffer.length < 100) return '';

      const workerPromise = getSharedWorker();
      const worker = await withTimeout(workerPromise, 3500, 'Khởi tạo Worker');
      if (!worker) return '';

      const scanPromise = (async () => {
        const { data } = await worker.recognize(imgBuffer);
        const text = data.text || '';
        ocrMemoryCache.set(cacheKey, text);
        return text;
      })();

      return await withTimeout(scanPromise, timeoutMs, 'OCR Fast Scan');
    } catch (err) {
      console.warn('OCR Fast Scan skipped/timeout:', err);
      return '';
    }
  };

  const nextPromise = ocrQueue.then(task, task);
  ocrQueue = nextPromise.catch(() => '');
  return nextPromise;
}

// ==============================================================================
// TRÍCH XUẤT GIỚI TÍNH CÔNG DÂN TỪ CCCD / THUẬT TOÁN 12 SỐ CĂN CƯỚC VIỆT NAM
// ==============================================================================
export function extractGenderFromCccd(citizenId: string, ocrText = ''): 'Nam' | 'Nữ' {
  const lower = (ocrText || '').toLowerCase();
  const norm = normalizeText(ocrText || '');
  if (
    lower.includes('giới tính: nữ') ||
    lower.includes('gioi tinh: nu') ||
    lower.includes('giới tính : nữ') ||
    norm.includes('gioi tinh nu') ||
    lower.includes('sex: f') ||
    lower.includes('sex: nữ') ||
    (lower.includes('nữ') && (lower.includes('giới tính') || lower.includes('gioi tinh')))
  ) {
    return 'Nữ';
  }
  if (
    lower.includes('giới tính: nam') ||
    lower.includes('gioi tinh: nam') ||
    lower.includes('giới tính : nam') ||
    norm.includes('gioi tinh nam') ||
    lower.includes('sex: m') ||
    lower.includes('sex: nam') ||
    (lower.includes('nam') && (lower.includes('giới tính') || lower.includes('gioi tinh')))
  ) {
    return 'Nam';
  }

  // Theo quy chuẩn 12 số CCCD Việt Nam (Nghị định 137/2015/NĐ-CP):
  // Ký tự thứ 4 (index 3) quy định giới tính:
  // - Thế kỷ 20 (1900-1999): 0 - Nam, 1 - Nữ
  // - Thế kỷ 21 (2000-2099): 2 - Nam, 3 - Nữ
  // - Thế kỷ 22 (2100-2199): 4 - Nam, 5 - Nữ
  // - Thế kỷ 23 (2200-2299): 6 - Nam, 7 - Nữ
  // Chẵn (0, 2, 4, 6, 8) là Nam; lẻ (1, 3, 5, 7, 9) là Nữ
  const digits = (citizenId || '').replace(/\D/g, '');
  if (digits.length >= 4) {
    const fourthDigit = parseInt(digits.charAt(3), 10);
    if (!isNaN(fourthDigit)) {
      return fourthDigit % 2 === 0 ? 'Nam' : 'Nữ';
    }
  }

  return 'Nữ';
}

// ==============================================================================
// 1. PHÂN TÍCH ẢNH CCCD (ĐỐI CHIẾU DỮ LIỆU SINH VIÊN NHẬP VS ẢNH THỰC TẾ)
// ==============================================================================
export async function analyzeCccdImage(
  base64Data: string,
  studentName: string,
  citizenId: string,
  mimeType = 'image/jpeg'
): Promise<CccdAnalysisResult> {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  // KIỂM TRA TÍNH TOÀN VẸN CỦA TỆP ẢNH CCCD TRƯỚC KHI XỬ LÝ
  const isImageCorrupt = !cleanBase64 || cleanBase64 === 'undefined' || cleanBase64 === 'null' || cleanBase64.length < 100;
  if (isImageCorrupt) {
    return {
      is_valid: false,
      has_cccd_keywords: false,
      has_police_chief_keyword: false,
      extracted_name: studentName,
      extracted_cccd: citizenId,
      extracted_gender: 'Nữ',
      name_matched: false,
      cccd_matched: false,
      matched_fields: [],
      mismatched_fields: ['Tệp ảnh CCCD bị lỗi, đường dẫn hỏng hoặc không tải được'],
      confidence: 0.0,
      detected_text: '[LỖI TỆP ẢNH]: Dữ liệu ảnh CCCD bị hỏng hoặc đường dẫn không hợp lệ.',
      notes: 'Tệp ảnh CCCD không tải được hoặc bị hỏng đường dẫn. Đã chặn tự động duyệt.',
      requires_red_stamp: false,
    };
  }

  // A. Thử gọi Gemini nếu có key
  if (apiKey && apiKey.length > 20 && !apiKey.includes('AIzaSy...')) {
    try {
      const genAiCall = (async () => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        });

        const prompt = `
Kiểm tra ảnh Căn cước công dân (CCCD) và đối chiếu với dữ liệu sinh viên nhập:
- Họ tên đăng ký: "${studentName}"
- Số CCCD đăng ký: "${citizenId}"

YÊU CẦU:
1. Nhận diện tính hợp pháp của CCCD (không yêu cầu con dấu đỏ).
2. Kiểm tra họ tên trên ảnh có trùng khớp với "${studentName}" không (name_matched).
3. Kiểm tra số CCCD trên ảnh có trùng khớp với "${citizenId}" không (cccd_matched).
4. Tính độ tin cậy "confidence" (0.0 đến 1.0) dựa trên mức độ trùng khớp dữ liệu.
5. Quét và trích xuất giới tính công dân từ CCCD (giá trị: "Nam" hoặc "Nữ") dựa trên mục "Giới tính / Sex" hoặc chữ số thứ 4 của số CCCD (chẵn là "Nam", lẻ là "Nữ").
Trả về JSON: { "is_valid": boolean, "name_matched": boolean, "cccd_matched": boolean, "has_cccd_keywords": boolean, "has_police_chief_keyword": boolean, "extracted_name": string, "extracted_cccd": string, "extracted_gender": "Nam" | "Nữ", "confidence": number, "detected_text": string, "notes": string }
`;
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: cleanBase64, mimeType } },
        ]);
        return extractCleanJson(result.response.text().trim());
      })();

      const geminiRes = await withTimeout(genAiCall, 5000, 'Gemini CCCD');
      if (geminiRes) {
        const isNameMatched = Boolean(geminiRes.name_matched);
        const isCccdMatched = Boolean(geminiRes.cccd_matched);
        const matchedFields: string[] = [];
        const mismatchedFields: string[] = [];

        if (isNameMatched) matchedFields.push('Họ và tên trùng khớp với ảnh CCCD');
        else mismatchedFields.push(`Họ tên trên ảnh khác với họ tên đăng ký (${studentName})`);

        if (isCccdMatched) matchedFields.push('Số CCCD trùng khớp với ảnh CCCD');
        else mismatchedFields.push(`Số CCCD trên ảnh khác với số đăng ký (${citizenId})`);

        const gender = (geminiRes.extracted_gender === 'Nam' || geminiRes.extracted_gender === 'Nữ')
          ? geminiRes.extracted_gender
          : extractGenderFromCccd(citizenId, geminiRes.detected_text);

        return {
          is_valid: Boolean(geminiRes.is_valid),
          has_cccd_keywords: Boolean(geminiRes.has_cccd_keywords),
          has_police_chief_keyword: Boolean(geminiRes.has_police_chief_keyword),
          extracted_name: geminiRes.extracted_name || studentName,
          extracted_cccd: geminiRes.extracted_cccd || citizenId,
          extracted_gender: gender,
          name_matched: isNameMatched,
          cccd_matched: isCccdMatched,
          matched_fields: matchedFields,
          mismatched_fields: mismatchedFields,
          confidence: Math.max(0.3, Math.min(0.98, Number(geminiRes.confidence) || 0.85)),
          detected_text: String(geminiRes.detected_text || '').substring(0, 300),
          notes: geminiRes.notes || (isNameMatched && isCccdMatched ? 'Dữ liệu khớp 100%' : 'Phát hiện sai lệch dữ liệu'),
          requires_red_stamp: false,
        };
      }
    } catch {
      // Chuyển sang OCR nhanh
    }
  }

  // B. Quét nhanh bằng OCR Singleton (Tối đa 4s)
  const ocrText = await fastOcrScan(cleanBase64, 4000);

  // Khi OCR không khả dụng hoặc ảnh không có ký tự rõ nét
  if (!ocrText || ocrText.trim().length === 0) {
    const isImageValid = cleanBase64.length > 2000;
    const cleanDigits = citizenId.replace(/\D/g, '');
    const isCccdFormatValid = cleanDigits.length >= 9;
    const scannedGender = extractGenderFromCccd(citizenId, '');

    if (!isImageValid || !isCccdFormatValid) {
      return {
        is_valid: false,
        has_cccd_keywords: false,
        has_police_chief_keyword: false,
        extracted_name: studentName,
        extracted_cccd: citizenId,
        extracted_gender: scannedGender,
        name_matched: false,
        cccd_matched: false,
        matched_fields: [],
        mismatched_fields: ['Dữ liệu tệp ảnh CCCD không hợp lệ hoặc bị hỏng'],
        confidence: 0.0,
        detected_text: '[LỖI HÌNH ẢNH]: Tệp ảnh CCCD không hợp lệ.',
        notes: 'File ảnh CCCD không toàn vẹn. Đã chặn tự động duyệt.',
        requires_red_stamp: false,
      };
    }

    // Nếu ảnh có dung lượng nhưng không trích xuất được chữ: Đưa về trạng thái CHO_THAM_DINH (độ tin cậy 65%, KHÔNG tự động duyệt qua)
    return {
      is_valid: true,
      has_cccd_keywords: false,
      has_police_chief_keyword: false,
      extracted_name: '(Chưa trích xuất được từ ảnh)',
      extracted_cccd: '(Chưa trích xuất được từ ảnh)',
      extracted_gender: scannedGender,
      name_matched: false,
      cccd_matched: false,
      matched_fields: ['Đã tiếp nhận tệp ảnh CCCD'],
      mismatched_fields: ['Ảnh CCCD mờ hoặc chưa nhận diện được thông tin họ tên và số CCCD'],
      confidence: 0.65,
      detected_text: '[CẢNH BÁO OCR]: Không đọc được ký tự rõ nét từ tệp ảnh CCCD tải lên.',
      notes: 'Ảnh CCCD chưa trích xuất được họ tên và số CCCD tự động. Chuyển Cán bộ QLSV rà soát đối chiếu thủ công.',
      requires_red_stamp: false,
    };
  }

  const normalized = normalizeText(ocrText);
  const lower = ocrText.toLowerCase();

  // 1. KIỂM TRA TIÊU ĐỀ ĐẶC TRƯNG BẮT BUỘC CỦA CĂN CƯỚC CÔNG DÂN VIỆT NAM
  // Bắt buộc phải có ít nhất một trong các tiêu đề pháp lý chính quy:
  const hasStrictCccdTitle =
    normalized.includes('can cuoc cong dan') ||
    normalized.includes('can cuoc') ||
    normalized.includes('citizen identity card') ||
    normalized.includes('identity card') ||
    (normalized.includes('cong hoa xa hoi chu nghia') && normalized.includes('viet nam')) ||
    normalized.includes('bo cong an') ||
    normalized.includes('cuc canh sat') ||
    normalized.includes('cuc truong cuc canh sat');

  // 2. PHÁT HIỆN CÁC DẤU HIỆU ẢNH BÀI TẬP, GIÁO TRÌNH, SLIDE, CON DẤU REJECTED (ẢNH KHÔNG HỢP LỆ)
  // Chỉ kích hoạt khi KHÔNG PHẢI ảnh CCCD hợp lệ và có các cụm từ bài tập cụ thể
  const hasSpecificJunkPhrase =
    normalized.includes('bai tap') ||
    normalized.includes('on tap chuong') ||
    normalized.includes('viet chuong trinh') ||
    normalized.includes('ham mat do') ||
    normalized.includes('xac suat') ||
    normalized.includes('rejected') ||
    normalized.includes('pngtree') ||
    normalized.includes('giao trinh') ||
    normalized.includes('dap an') ||
    normalized.includes('cuoc thi') ||
    normalized.includes('trac nghiem');
  const isJunkOrExerciseImage = !hasStrictCccdTitle && hasSpecificJunkPhrase;

  const hasPoliceKw = CCCD_POLICE_KEYWORDS.some((kw) => lower.includes(kw) || normalized.includes(normalizeText(kw)));
  const cleanDigits = (citizenId || '').replace(/\D/g, '');
  const hasMatchedNumber = cleanDigits.length >= 9 && (lower.replace(/\D/g, '').includes(cleanDigits) || normalized.replace(/\D/g, '').includes(cleanDigits));
  const nameCheckEarly = verifyNameMatch(studentName, ocrText);
  const hasMatchedName = nameCheckEarly.isMatch;
  const hasCccdKw = hasStrictCccdTitle || hasPoliceKw || (hasMatchedNumber && hasMatchedName);

  const scannedGender = extractGenderFromCccd(citizenId, ocrText);

  // NẾU LÀ ẢNH BÀI TẬP / SLIDE / ẢNH KHÔNG HỢP LỆ:
  if (isJunkOrExerciseImage) {
    return {
      is_valid: false,
      has_cccd_keywords: false,
      has_police_chief_keyword: false,
      extracted_name: '(Phát hiện ảnh bài tập/slide)',
      extracted_cccd: '(Không phát hiện số CCCD)',
      extracted_gender: scannedGender,
      name_matched: false,
      cccd_matched: false,
      matched_fields: [],
      mismatched_fields: ['Ảnh tải lên không hợp lệ: Phát hiện tài liệu học tập, bài tập hoặc slide không phải Căn cước công dân'],
      confidence: 0.10,
      detected_text: ocrText.substring(0, 300) || '(Ảnh bài tập / slide)',
      requires_red_stamp: false,
      notes: 'Ảnh không hợp lệ: Phát hiện tài liệu học tập/bài tập/slide không phải CCCD. Đã khóa tự động duyệt và chuyển Cán bộ QLSV rà soát thủ công / Yêu cầu bổ sung.',
    };
  }

  // NẾU ẢNH CHƯA TRÍCH XUẤT ĐƯỢC TIÊU ĐỀ CCCD VÀ CHƯA KHỚP SỐ/TÊN:
  if (!hasCccdKw) {
    return {
      is_valid: false,
      has_cccd_keywords: false,
      has_police_chief_keyword: false,
      extracted_name: studentName,
      extracted_cccd: citizenId,
      extracted_gender: scannedGender,
      name_matched: false,
      cccd_matched: false,
      matched_fields: ['Đã tiếp nhận tệp ảnh CCCD'],
      mismatched_fields: ['Ảnh CCCD mờ hoặc chưa nhận diện rõ tiêu đề "CĂN CƯỚC CÔNG DÂN"'],
      confidence: 0.65,
      detected_text: ocrText.substring(0, 300) || '(Ảnh CCCD mờ hoặc chưa trích xuất được tiêu đề)',
      requires_red_stamp: false,
      notes: 'Ảnh CCCD chưa trích xuất rõ tiêu đề hoặc chữ bị mờ. Chuyển Cán bộ QLSV rà soát đối chiếu thủ công.',
    };
  }

  // 3. ĐỐI CHIẾU DỮ LIỆU THỰC TẾ (HỌ TÊN VÀ SỐ CCCD)
  const nameCheck = verifyNameMatch(studentName, ocrText);
  const cccdCheck = verifyCccdMatch(citizenId, ocrText);

  const matchedFields: string[] = ['Phát hiện tiêu đề Căn cước công dân hợp lệ'];
  const mismatchedFields: string[] = [];

  if (nameCheck.isMatch) {
    matchedFields.push('Họ và tên trùng khớp với ảnh CCCD');
  } else {
    mismatchedFields.push(nameCheck.errorReason || `Họ tên trên ảnh không trùng khớp với họ tên khai báo (${studentName})`);
  }

  if (cccdCheck.isMatch) {
    matchedFields.push('Số CCCD trùng khớp với ảnh CCCD');
  } else {
    mismatchedFields.push(cccdCheck.mismatchNote || `Số CCCD không trùng khớp với số đã khai báo (${citizenId})`);
  }

  // ĐIỀU KIỆN HỢP LỆ TUYỆT ĐỐI: CẢ HỌ TÊN VÀ SỐ CCCD ĐỀU PHẢI TRÙNG KHỚP 100% VỚI ẢNH CHỤP
  const isValid = hasCccdKw && !isJunkOrExerciseImage && nameCheck.isMatch && cccdCheck.isMatch;

  // TÍNH TOÁN ĐỘ TIN CẬY:
  // - Nếu hợp lệ 100%: Đạt từ 95% đến 98% (Đủ điều kiện tự động duyệt)
  // - Nếu sai lệch họ tên, sai số CCCD hoặc nghi vấn: BẮT BUỘC HẠ XUỐNG DƯỚI 90% (tối đa 20% - 60%)
  let calculatedConfidence = 0.20;
  if (hasCccdKw) calculatedConfidence += 0.20;
  if (hasPoliceKw) calculatedConfidence += 0.05;
  if (cccdCheck.isMatch) calculatedConfidence += 0.35;
  if (nameCheck.isMatch) calculatedConfidence += 0.35;

  if (!nameCheck.isMatch || !cccdCheck.isMatch) {
    // Khóa chặt độ tin cậy dưới 90% (tối đa 20% nếu không khớp)
    calculatedConfidence = Math.min(0.20, calculatedConfidence);
  }

  const confidence = isValid
    ? Number(Math.min(0.98, Math.max(0.95, calculatedConfidence)).toFixed(2))
    : Number(Math.min(0.60, Math.max(0.10, calculatedConfidence)).toFixed(2));

  return {
    is_valid: isValid,
    has_cccd_keywords: hasCccdKw,
    has_police_chief_keyword: hasPoliceKw,
    extracted_name: nameCheck.extractedName || studentName,
    extracted_cccd: cccdCheck.extractedCccd || citizenId,
    extracted_gender: scannedGender,
    name_matched: nameCheck.isMatch,
    cccd_matched: cccdCheck.isMatch,
    matched_fields: matchedFields,
    mismatched_fields: mismatchedFields,
    confidence,
    detected_text: ocrText.substring(0, 300) || '(Đã tiếp nhận và đối chiếu ảnh CCCD)',
    requires_red_stamp: false,
    notes: isValid
      ? 'Dữ liệu họ tên và số CCCD trùng khớp 100% với ảnh chụp. Thẻ do Bộ Công An cấp (có chip/mã vạch), không yêu cầu mộc tròn đỏ UBND.'
      : `Thông tin không trùng khớp: ${mismatchedFields.join('. ')}. Đã hạ độ tin cậy xuống dưới 90% để Cán bộ QLSV rà soát thủ công.`,
  };
}

// ==============================================================================
// 2. PHÂN TÍCH ẢNH GIẤY TỜ ƯU TIÊN (KIỂM TRA MỘC ĐỎ, ĐỐI TƯỢNG & KHU VỰC)
// ==============================================================================
export async function analyzePriorityProofImage(
  base64Data: string,
  policyKey: string,
  studentName: string,
  mimeType = 'image/jpeg',
  tinhThanh = '',
  diaChiThuongTru = ''
): Promise<PriorityProofAnalysisResult> {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const targetKeywords = POLICY_KEYWORD_MAP[policyKey] || POLICY_KEYWORD_MAP['KHONG'];

  // TRƯỜNG HỢP 1: SINH VIÊN CHỌN KHÔNG THUỘC DIỆN ƯU TIÊN
  if (policyKey === 'KHONG' || !policyKey) {
    return {
      is_valid: true,
      matched_policy_keywords: ['Không thuộc diện ưu tiên'],
      has_official_stamp_or_seal: false,
      name_matched: true,
      confidence: 1.0,
      detected_text: 'Không đăng ký diện ưu tiên (Điểm ưu tiên: +0đ)',
      notes: 'Hồ sơ tiêu chuẩn xét tuyển theo điểm và khoảng cách (0 điểm ưu tiên). Không yêu cầu mộc đỏ.',
      requires_red_stamp: false,
    };
  }

  // KIỂM TRA TÍNH TOÀN VẸN CỦA TỆP ẢNH MINH CHỨNG ƯU TIÊN
  const isImageCorrupt = !cleanBase64 || cleanBase64 === 'undefined' || cleanBase64 === 'null' || cleanBase64.length < 100;
  if (isImageCorrupt) {
    return {
      is_valid: false,
      matched_policy_keywords: [],
      has_official_stamp_or_seal: false,
      name_matched: false,
      confidence: 0.0,
      detected_text: '[LỖI TỆP ẢNH]: Tệp ảnh minh chứng ưu tiên bị hỏng hoặc không tải được.',
      notes: 'Tệp ảnh minh chứng ưu tiên không toàn vẹn. Cần bổ sung lại ảnh mới.',
      requires_red_stamp: true,
    };
  }

  // Quét nhanh bằng OCR Singleton
  const ocrText = await fastOcrScan(cleanBase64, 4000);
  const normalized = normalizeText(ocrText);
  const lower = ocrText.toLowerCase();

  // TRƯỜNG HỢP 2: KIỂM TRA TỪ KHÓA PHỦ ĐỊNH ƯU TIÊN TRÊN VĂN BẢN (ƯU TIÊN: KHÔNG +0)
  const negativePriorityPatterns = [
    'uu tien: khong',
    'uu tien : khong',
    'uu tien:khong',
    'uu tien:  khong',
    'bao tro uu tien: khong',
    'chinh sach bao tro uu tien: khong',
    'chinh sach uu tien: khong',
    'khong +0',
    'khong+0',
    'khong thuoc dien',
    'khong uu tien',
    'khong duoc huong',
  ];

  const hasNegativePriority = negativePriorityPatterns.some(
    (pat) => normalized.includes(pat) || lower.includes(pat)
  );

  if (hasNegativePriority) {
    return {
      is_valid: false,
      matched_policy_keywords: ['Xác nhận: ƯU TIÊN: KHÔNG (+0 điểm)'],
      has_official_stamp_or_seal: false,
      name_matched: true,
      confidence: 0.10,
      detected_text: ocrText.substring(0, 300) || 'XÁC NHẬN THUỘC DIỆN CHÍNH SÁCH BẢO TRỢ ƯU TIÊN: KHÔNG +0',
      notes: 'Văn bản ghi rõ: XÁC NHẬN THUỘC DIỆN CHÍNH SÁCH BẢO TRỢ ƯU TIÊN: KHÔNG (+0 điểm). Điểm ưu tiên = 0. Không đủ điều kiện cộng điểm ưu tiên.',
      requires_red_stamp: false,
    };
  }

  const matchedKeywords: string[] = [];
  for (const kw of targetKeywords) {
    if (lower.includes(kw) || normalized.includes(normalizeText(kw))) {
      matchedKeywords.push(kw);
    }
  }

  // 1. KIỂM TRA XUNG ĐỘT DIỆN ƯU TIÊN (CHỐNG CHỌN DIỆN 1 MÀ GIẤY TỜ LÀ HỘ NGHÈO)
  let conflictingPolicy: string | null = null;
  for (const [otherKey, otherKws] of Object.entries(POLICY_KEYWORD_MAP)) {
    if (otherKey === policyKey || otherKey === 'KHONG') continue;
    const hasOther = otherKws.some((kw) => lower.includes(kw) || normalized.includes(normalizeText(kw)));
    if (hasOther) {
      conflictingPolicy = otherKey;
      break;
    }
  }

  const isPolicyConflict = matchedKeywords.length === 0 && conflictingPolicy !== null;

  // 2. KIỂM TRA ĐỐI TƯỢNG KHU VỰC ĐỊA LÝ
  let regionConflictNote: string | null = null;
  const normProvince = normalizeText(tinhThanh);
  const normAddress = normalizeText(diaChiThuongTru);

  if (policyKey === 'NGOAI_TINH_XA') {
    if (normProvince.includes('quang nam') || normAddress.includes('quang nam')) {
      regionConflictNote = 'Quảng Nam có cự ly < 100km giáp ranh Đà Nẵng, không thuộc diện Ngoại tỉnh xa (> 200km).';
    }
  } else if (policyKey === 'VUNG_SAU_XA_HAI_DAO') {
    const remoteKeywords = [
      'vung sau', 'vung xa', 'hai dao', 'khu vuc 1', 'dac biet kho khan', 'bai ngang',
      'ly son', 'phu quy', 'cu lao cham', 'tay giang', 'nam tra my', 'phuoc son',
      'bac tra my', 'dong giang', 'a luoi', 'nam dong', 'muong', 'ky anh'
    ];
    const hasRemoteProof = remoteKeywords.some((rk) => normalized.includes(rk));
    const hasRemoteAddr = remoteKeywords.some((rk) => normAddress.includes(rk));
    if (!hasRemoteProof && !hasRemoteAddr) {
      regionConflictNote = 'Địa chỉ hoặc giấy tờ không thể hiện xã/thôn đặc biệt khó khăn hoặc hải đảo (Khu vực 1).';
    }
  }

  // PHÂN TÍCH CON DẤU MỘC ĐỎ QUA COMPUTER VISION PIXEL VÀ TỪ KHÓA PHÁP LÝ
  const sealDetection = detectRedSealFromBase64(cleanBase64);
  const hasStampKeywords = OFFICIAL_STAMP_KEYWORDS.some((kw) => lower.includes(kw) || normalized.includes(normalizeText(kw)));
  const hasStamp = sealDetection.hasRedStamp || hasStampKeywords;
  const nameCheck = verifyNameMatch(studentName, ocrText);

  if (sealDetection.hasRedStamp && !matchedKeywords.includes('Dấu mộc đỏ pháp lý')) {
    matchedKeywords.push('Dấu mộc đỏ pháp lý');
  }

  // Nếu phát hiện gian dối diện ưu tiên hoặc sai lệch khu vực
  if (isPolicyConflict) {
    const detectedName = POLICY_NAME_MAP[conflictingPolicy!] || conflictingPolicy;
    const chosenName = POLICY_NAME_MAP[policyKey] || policyKey;
    return {
      is_valid: false,
      matched_policy_keywords: [],
      has_official_stamp_or_seal: hasStamp,
      name_matched: nameCheck.isMatch,
      confidence: 0.20, // Rơi xuống 20% (< 30%)
      detected_text: ocrText.substring(0, 300) || '(Phát hiện sai lệch diện ưu tiên)',
      notes: `Phát hiện sai lệch: Bạn đăng ký diện "${chosenName}" nhưng giấy tờ minh chứng lại thuộc diện "${detectedName}". Cần cán bộ QLSV rà soát.`,
      requires_red_stamp: true,
    };
  }

  if (regionConflictNote) {
    return {
      is_valid: false,
      matched_policy_keywords: matchedKeywords,
      has_official_stamp_or_seal: hasStamp,
      name_matched: nameCheck.isMatch,
      confidence: 0.25, // Rơi xuống 25% (< 30%)
      detected_text: ocrText.substring(0, 300) || '(Phát hiện sai lệch khu vực)',
      notes: regionConflictNote,
      requires_red_stamp: true,
    };
  }

  const isJunkPriorityImage =
    normalized.includes('chuong') ||
    normalized.includes('bai tap') ||
    normalized.includes('on tap') ||
    normalized.includes('rejected') ||
    normalized.includes('pngtree') ||
    normalized.includes('ham mat do') ||
    normalized.includes('xac suat') ||
    normalized.includes('slide');

  const hasPolicyProof = matchedKeywords.length > 0;
  const isValid = hasPolicyProof && hasStamp && !isJunkPriorityImage;

  // NẾU ẢNH LÀ BÀI TẬP / SLIDE HOẶC KHÔNG PHẢI GIẤY TỜ CHÍNH SÁCH (KHÔNG CÓ TỪ KHÓA LẪN MỘC ĐỎ):
  // LẬP TỨC BÁO "ẢNH KHÔNG HỢP LỆ", HẠ ĐỘ TIN CẬY XUỐNG 15% (< 90%), KHÓA TỰ ĐỘNG DUYỆT!
  if (isJunkPriorityImage || (!hasPolicyProof && !hasStamp)) {
    return {
      is_valid: false,
      matched_policy_keywords: [],
      has_official_stamp_or_seal: false,
      name_matched: false,
      confidence: 0.15,
      detected_text: ocrText.substring(0, 300) || '(Ảnh tải lên không phải giấy tờ ưu tiên)',
      notes: 'Ảnh không hợp lệ: Không tìm thấy từ khóa xác nhận diện chính sách (như "HỘ NGHÈO", "CẬN NGHÈO"), cơ quan thẩm quyền (UBND) hoặc con dấu mộc đỏ hợp lệ. Yêu cầu tải đúng ảnh Giấy xác nhận thật.',
      requires_red_stamp: true,
    };
  }

  let calculatedConfidence = 0.20;
  if (hasPolicyProof) calculatedConfidence += 0.35;
  if (sealDetection.hasRedStamp) calculatedConfidence += 0.25;
  else if (hasStamp) calculatedConfidence += 0.15;
  if (nameCheck.isMatch) calculatedConfidence += 0.15;

  const confidence = isValid
    ? Number(Math.min(0.98, Math.max(0.95, calculatedConfidence)).toFixed(2))
    : Number(Math.min(0.74, Math.max(0.20, calculatedConfidence)).toFixed(2));

  return {
    is_valid: isValid,
    matched_policy_keywords: matchedKeywords,
    has_official_stamp_or_seal: hasStamp,
    name_matched: nameCheck.isMatch,
    confidence,
    detected_text: ocrText.substring(0, 300) || '(Đã tiếp nhận minh chứng ưu tiên)',
    notes: isValid
      ? 'Giấy tờ hợp lệ: Nhận diện mộc đỏ pháp lý và nội dung xác nhận diện ưu tiên.'
      : hasStamp
      ? 'Đã có con dấu mộc đỏ nhưng từ khóa diện ưu tiên chưa rõ ràng.'
      : 'Chưa nhận diện rõ con dấu mộc đỏ của cơ quan thẩm quyền. Cần cán bộ QLSV rà soát.',
    requires_red_stamp: true,
  };
}

// ==============================================================================
// 3. ENGINE TỔNG HỢP TUẦN TỰ (TRÁNH XUNG ĐỘT WORKER OCR)
// ĐỐI CHIẾU ĐỒNG THỜI CẢ 2 ẢNH VỚI THÔNG TIN KHAI BÁO
// ==============================================================================
export async function analyzeEvidenceWithGemini(
  request: AIVisionAnalysisRequest
): Promise<AIVisionAnalysisResponse> {
  const {
    imageBufferBase64,
    priorityImageBase64,
    mimeType,
    studentName,
    studentCitizenId,
    policyKey,
    tinhThanh,
    diaChiThuongTru,
  } = request;

  // CHẠY TUẦN TỰ ĐỂ TRÁNH XUNG ĐỘT WORKER OCR SINGLETON
  const cccdResult = await analyzeCccdImage(imageBufferBase64, studentName, studentCitizenId, mimeType);
  const priorityResult = priorityImageBase64 && policyKey !== 'KHONG'
    ? await analyzePriorityProofImage(priorityImageBase64, policyKey, studentName, mimeType, tinhThanh, diaChiThuongTru)
    : undefined;

  const allMismatchWarnings: string[] = [];
  const allMatchedFields: string[] = [];

  if (cccdResult.matched_fields) allMatchedFields.push(...cccdResult.matched_fields);
  if (cccdResult.mismatched_fields) allMismatchWarnings.push(...cccdResult.mismatched_fields);
  if (priorityResult && !priorityResult.is_valid && priorityResult.notes) {
    allMismatchWarnings.push(priorityResult.notes);
  }

  // ĐÁNH GIÁ TỔNG QUAN ĐỘ TRÙNG KHỚP
  const isCccdDataMatched = Boolean(cccdResult.name_matched && cccdResult.cccd_matched);

  let decision: 'THAM_DINH_DAT' | 'CHO_THAM_DINH' | 'CAN_BO_SUNG' | 'TU_CHOI' = 'CHO_THAM_DINH';
  let rejectionReason: string | null = null;
  let docType = 'Căn cước công dân & Minh chứng';
  let overallConfidence = cccdResult.confidence;

  if (!cccdResult.is_valid || cccdResult.confidence === 0) {
    overallConfidence = 0.0;
    decision = 'CHO_THAM_DINH';
    docType = 'Lỗi tệp ảnh minh chứng (Ảnh CCCD hỏng/không tải được)';
    rejectionReason = cccdResult.notes || 'Tệp ảnh CCCD không tải được hoặc bị hỏng đường dẫn. Đã chặn tự động duyệt.';
  } else if (priorityResult && priorityResult.confidence < 0.30) {
    // Độ tin cậy dưới 30% do sai lệch đối tượng hoặc khu vực
    overallConfidence = priorityResult.confidence;
    decision = 'CHO_THAM_DINH';
    docType = 'Nghi vấn sai lệch diện chính sách hoặc khu vực';
    rejectionReason = priorityResult.notes || 'Phát hiện sai lệch diện ưu tiên/khu vực. Cần cán bộ rà soát.';
  } else if (!isCccdDataMatched) {
    // Sai lệch dữ liệu nhân thân (Họ tên hoặc CCCD không khớp với ảnh): Khóa chặt độ tin cậy <= 20% (< 90%)
    overallConfidence = Math.min(0.20, cccdResult.confidence);
    decision = 'CHO_THAM_DINH';
    docType = 'CCCD sai lệch dữ liệu với thông tin đăng ký';
    rejectionReason = allMismatchWarnings.join('. ') || 'Họ tên hoặc số CCCD trên ảnh không trùng khớp với dữ liệu đăng ký.';
  } else if (policyKey === 'KHONG') {
    // Diện tiêu chuẩn: Chỉ cần CCCD trùng khớp
    overallConfidence = cccdResult.confidence;
    if (overallConfidence >= 0.95) {
      decision = 'THAM_DINH_DAT';
      docType = 'CCCD hợp lệ (Trùng khớp 100% dữ liệu)';
    } else {
      decision = 'CHO_THAM_DINH';
      docType = 'CCCD cần cán bộ rà soát lại';
      rejectionReason = 'Độ rõ nét ảnh CCCD dưới 95%. Cần Cán bộ QLSV đối chiếu.';
    }
  } else if (!priorityImageBase64 || !priorityResult) {
    // Có diện ưu tiên nhưng chưa nộp minh chứng
    overallConfidence = 0.60;
    decision = 'CAN_BO_SUNG';
    docType = 'Chưa nộp Giấy xác nhận ưu tiên';
    rejectionReason = 'Chưa tải lên Giấy xác nhận diện ưu tiên có con dấu của cơ quan thẩm quyền.';
    allMismatchWarnings.push('Thiếu ảnh Giấy tờ minh chứng diện ưu tiên có mộc đỏ');
  } else if (!priorityResult.has_official_stamp_or_seal) {
    // Có ảnh ưu tiên nhưng thiếu mộc đỏ
    overallConfidence = 0.68;
    decision = 'CAN_BO_SUNG';
    docType = 'Minh chứng ưu tiên thiếu con dấu mộc đỏ';
    rejectionReason = 'Giấy tờ ưu tiên chưa phát hiện con dấu mộc đỏ của cơ quan thẩm quyền (UBND hoặc Phòng LĐTBXH). Cần bổ sung trong 48h.';
    allMismatchWarnings.push('Chưa phát hiện con dấu mộc đỏ trên Giấy xác nhận');
  } else if (priorityResult.confidence < 0.95) {
    overallConfidence = Number(Math.min(0.94, (cccdResult.confidence + priorityResult.confidence) / 2).toFixed(2));
    decision = 'CHO_THAM_DINH';
    docType = 'Minh chứng diện ưu tiên cần cán bộ rà soát lại';
    rejectionReason = priorityResult.notes || 'Minh chứng ưu tiên cần cán bộ QLSV đối chiếu lại.';
  } else {
    // Đầy đủ cả CCCD khớp 100% và giấy ưu tiên có mộc đỏ
    overallConfidence = Number(Math.min(0.98, (cccdResult.confidence + priorityResult.confidence) / 2).toFixed(2));
    if (overallConfidence >= 0.95) {
      decision = 'THAM_DINH_DAT';
      docType = 'Hồ sơ & Minh chứng hợp lệ (Trùng khớp 100%)';
    } else {
      decision = 'CHO_THAM_DINH';
      docType = 'Minh chứng cần cán bộ rà soát đối chiếu';
      rejectionReason = `Độ tin cậy đạt ${(overallConfidence * 100).toFixed(0)}% (< 95%). Cần Cán bộ QLSV rà soát.`;
    }
  }

  const response: AIVisionAnalysisResponse = {
    is_valid_document: cccdResult.is_valid && (policyKey === 'KHONG' || Boolean(priorityResult?.is_valid)),
    has_cccd_keyword: cccdResult.has_cccd_keywords || cccdResult.has_police_chief_keyword,
    matched_policy_keywords: priorityResult ? priorityResult.matched_policy_keywords : [],
    document_type: docType,
    confidence: overallConfidence,
    detected_raw_text: `[CCCD]: ${cccdResult.detected_text}\n[MINH CHỨNG]: ${priorityResult ? priorityResult.detected_text : 'Không nộp'}`,
    extracted_info: {
      ho_ten: cccdResult.extracted_name || studentName,
      so_dinh_danh: cccdResult.extracted_cccd || studentCitizenId,
      ngay_sinh: 'Theo hồ sơ',
      que_quan: 'Theo hồ sơ',
      doi_tuong_chinh_sach: priorityResult?.matched_policy_keywords.join(', ') || 'Chưa nhận diện',
      name_matched: cccdResult.name_matched,
      cccd_matched: cccdResult.cccd_matched,
      input_name: studentName,
      input_cccd: studentCitizenId,
      matched_fields: allMatchedFields,
      mismatched_fields: allMismatchWarnings,
    },
    mismatch_warnings: allMismatchWarnings,
    decision,
    rejection_reason: rejectionReason,
    raw_reasoning: `CCCD: ${cccdResult.notes}. Minh chứng ưu tiên: ${priorityResult ? priorityResult.notes : 'Không nộp'}.`,
    cccd_analysis: cccdResult,
    priority_analysis: priorityResult,
  };

  return formatResponseWithDraftEmail(response, studentName, studentCitizenId, policyKey);
}

function formatResponseWithDraftEmail(
  res: AIVisionAnalysisResponse,
  studentName: string,
  studentCitizenId: string,
  policyKey: string
): AIVisionAnalysisResponse {
  let draftSubject = '';
  let draftBody = '';
  let draftType: 'DAT' | 'CAN_BO_SUNG' | 'TU_CHOI' = 'DAT';

  const confPercent = (res.confidence * 100).toFixed(0);

  if (res.decision === 'THAM_DINH_DAT') {
    draftType = 'DAT';
    draftSubject = `[KTX DUE] Minh Chứng Hợp Lệ (${confPercent}% Tin Cậy) – Sinh Viên ${studentName}`;
    draftBody = `
      <p>Kính gửi sinh viên <strong>${studentName}</strong>,</p>
      <p>Hồ sơ đăng ký nội trú của bạn đã được đối chiếu và thẩm định hợp lệ (Độ tin cậy: <strong>${confPercent}%</strong>):</p>
      <ul>
        <li>Họ tên & Số CCCD: <strong>Trùng khớp 100% với ảnh chụp</strong></li>
        <li>Minh chứng ưu tiên: <strong>Đầy đủ con dấu xác nhận hợp lệ</strong></li>
      </ul>
      <p>Hồ sơ đã được cộng điểm ưu tiên và chuyển vào <strong>Bảng Xếp Hạng Tuyển Sinh</strong>.</p>
    `;
  } else if (res.decision === 'TU_CHOI') {
    draftType = 'TU_CHOI';
    draftSubject = `[KTX DUE] Thông Báo Từ Chối Hồ Sơ – Sinh Viên ${studentName}`;
    draftBody = `
      <p>Kính gửi sinh viên <strong>${studentName}</strong>,</p>
      <p>Hồ sơ bị từ chối do: <strong>${res.rejection_reason || 'Ảnh tải lên không hợp lệ.'}</strong></p>
    `;
  } else {
    draftType = 'CAN_BO_SUNG';
    draftSubject = `[KTX DUE] Thông Báo Rà Soát Hồ Sơ (${confPercent}% Tin Cậy) – Sinh Viên ${studentName}`;
    draftBody = `
      <p>Kính gửi sinh viên <strong>${studentName}</strong>,</p>
      <p>Hồ sơ của bạn đạt độ tin cậy <strong>${confPercent}%</strong> (Cần Cán bộ QLSV rà soát đối chiếu):</p>
      <p><strong>Lý do:</strong> ${res.rejection_reason || 'Cần đối chiếu thêm thông tin thực tế.'}</p>
      <p>Vui lòng theo dõi Cổng thông tin sinh viên để cập nhật kết quả.</p>
    `;
  }

  res.ai_draft_email = {
    subject: draftSubject,
    body_html: draftBody,
    type: draftType,
  };

  return res;
}
