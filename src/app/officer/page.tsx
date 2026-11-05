'use client';

import React from 'react';
import EvidenceReviewQueue from '@/components/officer/EvidenceReviewQueue';

export default function OfficerPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Cổng Nghiệp Vụ Cán Bộ Quản Lý Sinh Viên (QLSV)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Rà soát và thẩm định hồ sơ minh chứng ưu tiên, tổng hợp danh sách xét tuyển trình Trưởng Ban
        </p>
      </div>

      <EvidenceReviewQueue />
    </div>
  );
}
