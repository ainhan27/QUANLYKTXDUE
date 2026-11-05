// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO AI VISION & OCR MINH CHỨNG (BPMN TO-BE SP2 - TASK A6)
// TÁCH BIỆT 2 LOẠI ẢNH: CĂN CƯỚC CÔNG DÂN & MINH CHỨNG DIỆN ƯU TIÊN
// ==============================================================================

export interface CccdAnalysisResult {
  is_valid: boolean;
  has_cccd_keywords: boolean;
  has_police_chief_keyword: boolean; // "CỤC TRƯỞNG CỤC CẢNH SÁT"
  extracted_cccd?: string;
  extracted_name?: string;
  extracted_gender?: 'Nam' | 'Nữ';
  name_matched?: boolean;
  cccd_matched?: boolean;
  matched_fields?: string[];
  mismatched_fields?: string[];
  confidence: number;
  detected_text: string;
  notes: string;
  // BẮT BUỘC: CCCD không yêu cầu dấu đỏ
  requires_red_stamp: false;
}

export interface PriorityProofAnalysisResult {
  is_valid: boolean;
  matched_policy_keywords: string[];
  has_official_stamp_or_seal: boolean; // Con dấu / mộc đỏ của cơ quan thẩm quyền
  name_matched?: boolean;
  confidence: number;
  detected_text: string;
  notes: string;
  // BẮT BUỘC: Giấy xác nhận ưu tiên phải có con dấu/chữ ký xác nhận
  requires_red_stamp: true;
}

export interface AIVisionAnalysisRequest {
  applicationId: string;
  evidenceId: string;
  imageBufferBase64: string; // File chính hoặc ảnh CCCD
  priorityImageBase64?: string; // File minh chứng ưu tiên (nếu có)
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  expectedDocType: string;
  studentName: string;
  studentCitizenId: string;
  policyKey: string; // CON_THUONG_BINH_LIET_SI, HO_NGHEO_CAN_NGHEO...
  tinhThanh?: string;
  diaChiThuongTru?: string;
}

export interface AIVisionAnalysisResponse {
  is_valid_document: boolean;
  has_cccd_keyword: boolean;
  matched_policy_keywords: string[];
  document_type: string;
  confidence: number;
  detected_raw_text: string;
  extracted_info: {
    ho_ten?: string;
    so_dinh_danh?: string;
    ngay_sinh?: string;
    que_quan?: string;
    doi_tuong_chinh_sach?: string;
    name_matched?: boolean;
    cccd_matched?: boolean;
    input_name?: string;
    input_cccd?: string;
    matched_fields?: string[];
    mismatched_fields?: string[];
  };
  mismatch_warnings: string[];
  decision: 'THAM_DINH_DAT' | 'CHO_THAM_DINH' | 'CAN_BO_SUNG' | 'TU_CHOI';
  rejection_reason?: string | null;
  raw_reasoning: string;

  // PHÂN TÍCH CHI TIẾT 2 Ô RIÊNG BIỆT CHO CÁN BỘ QLSV XEM
  cccd_analysis?: CccdAnalysisResult;
  priority_analysis?: PriorityProofAnalysisResult;

  // BƯỚC 4: BẢN NHÁP EMAIL NỘI BỘ (DÀNH CHO CÁN BỘ)
  ai_draft_email?: {
    subject: string;
    body_html: string;
    type: 'DAT' | 'CAN_BO_SUNG' | 'TU_CHOI';
  };
}
