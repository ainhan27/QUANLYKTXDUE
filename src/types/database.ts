// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// ĐỀ TÀI: HỆ THỐNG XÉT DUYỆT HỒ SƠ NỘI TRÚ KÝ TÚC XÁ (KTX)
// ĐỊNH NGHĨA KIỂU DỮ LIỆU TYPESCRIPT TỪ SUPABASE DATABASE SCHEMA
// ==============================================================================

export type UserRole = 'SV' | 'HC' | 'QLSV' | 'TB';

export type AppStatus =
  | 'DA_NOP'
  | 'DA_TIEP_NHAN'
  | 'TU_CHOI_BO_TRI'
  | 'CHO_THAM_DINH'
  | 'CAN_BO_SUNG'
  | 'THAM_DINH_DAT'
  | 'KHONG_DUOC_XET'
  | 'DA_XEP_HANG'
  | 'DA_CHOT'
  | 'DA_DUYET'
  | 'BI_TRA_VE'
  | 'DA_PHAT_HANH'
  | 'DA_KY'
  | 'HUY_SUAT'
  | 'DA_BAN_GIAO';

export type EvidenceStatus =
  | 'DA_TAI_LEN'
  | 'DA_RA_SOAT'
  | 'DAT'
  | 'CAN_BO_SUNG'
  | 'DA_BO_SUNG';

export type RoomStatus = 'CON_TRONG' | 'DA_GIU_CHO' | 'DANG_SU_DUNG' | 'DAY';

export type ContractStatus = 'CHO_KY' | 'DA_KY' | 'DA_HUY';

export type NotificationType =
  | 'XAC_NHAN_NOP'
  | 'YEU_CAU_BO_SUNG'
  | 'TU_CHOI'
  | 'TRUNG_TUYEN_KY_HD'
  | 'DANH_SACH_CHO'
  | 'NHAN_PHONG_BAN_GIAO'
  | 'HUY_SUAT';

export type NotificationStatus = 'PENDING' | 'DA_GUI' | 'LOI';

// ------------------------------------------------------------------------------
// INTERFACES CHO TỪNG BẢNG
// ------------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  ho_ten: string;
  so_dien_thoai?: string | null;
  role: UserRole;
  ma_dinh_danh?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  student_id: string;
  ma_sv: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh: string;
  gioi_tinh: 'Nam' | 'Nữ';
  tinh_thanh: string;
  dia_chi_thuong_tru: string;
  dien_uu_tien: string;
  diem_uu_tien: number;
  status: AppStatus;
  is_supplemented?: boolean;
  is_supplement_review?: boolean;
  supplement_submitted_at?: string;
  assigned_room_id?: string | null;
  ghi_chu_ly_do?: string | null;
  han_bo_sung?: string | null;
  created_at: string;
  updated_at: string;
  // Quan hệ kèm theo khi JOIN
  profile?: Profile;
  evidences?: Evidence[];
  ai_logs?: AILog[];
  room?: Room | null;
  contract?: Contract | null;
}

export interface Evidence {
  id: string;
  application_id: string;
  file_path: string;
  file_name: string;
  file_type: 'CCCD_MAT_TRUOC' | 'CCCD_MAT_SAU' | 'GIAY_XAC_NHAN_UU_TIEN' | 'KHAC';
  lan_nop: number;
  status: EvidenceStatus;
  uploaded_at: string;
  // URL có chữ ký tạm thời để hiển thị trên UI
  signed_url?: string;
}

export interface AILog {
  id: string;
  application_id: string;
  evidence_id?: string | null;
  model_name: string;
  confidence: number; // 0.000 - 1.000
  ket_luan: 'HOP_LE' | 'NGHI_VAN' | 'TU_CHOI_ANH_LA';
  loai_giay_to_phat_hien?: string | null;
  trich_xuat_thong_tin: {
    ho_ten?: string;
    so_dinh_danh?: string;
    ngay_sinh?: string;
    que_quan?: string;
    doi_tuong_chinh_sach?: string;
    ghi_chu?: string;
  };
  ly_do_chi_tiet?: string | null;
  payload_json?: Record<string, unknown>;
  loi_api: boolean;
  so_lan_thu: number;
  created_at: string;
}

export interface ManualReview {
  id: string;
  application_id: string;
  evidence_id?: string | null;
  reviewer_id: string;
  ket_qua: 'DAT' | 'CAN_BO_SUNG' | 'TU_CHOI';
  ly_do?: string | null;
  reviewed_at: string;
  reviewer?: Profile;
}

export interface Room {
  id: string;
  so_phong: string;
  khu: string;
  loai_phong: string;
  tong_cho: number;
  cho_da_o: number;
  status: RoomStatus;
  created_at: string;
}

export interface ApprovalRound {
  id: string;
  ten_dot: string;
  chi_tieu: number;
  trang_thai: 'DANG_XET_DUYET' | 'DA_CHOT' | 'DA_DUYET' | 'BI_TRA_VE' | 'DA_KHOA';
  approved_by?: string | null;
  ghi_chu_tra_ve?: string | null;
  created_at: string;
  approved_at?: string | null;
  approver?: Profile;
}

export interface RankingItem {
  id: string;
  round_id?: string | null;
  application_id: string;
  diem_uu_tien: number;
  thu_hang: number;
  is_trung_tuyen: boolean;
  status: 'DU_KIEN' | 'DA_CHOT';
  updated_at: string;
  application?: Application;
}

export interface Contract {
  id: string;
  application_id: string;
  room_id: string;
  ma_hop_dong: string;
  sign_deadline: string; // ISO String (+72 hours)
  otp_code_hash?: string | null;
  status: ContractStatus;
  signed_at?: string | null;
  created_at: string;
  room?: Room;
}

export interface NotificationItem {
  id: string;
  application_id?: string | null;
  recipient_email: string;
  tieu_de: string;
  noi_dung: string;
  loai: NotificationType;
  kenh: string;
  status: NotificationStatus;
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_name: string;
  entity_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
  actor?: Profile;
}
