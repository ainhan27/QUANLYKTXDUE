'use client';
import React from 'react';
import ApprovalDashboard from '@/components/director/ApprovalDashboard';

export default function DirectorPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Cổng Phê Duyệt Của Trưởng Ban Quản Lý Ký Túc Xá
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Ký quyết định phê duyệt danh sách thí sinh trúng tuyển nội trú đợt 1 và phân bổ chỉ tiêu KTX
        </p>
      </div>

      <ApprovalDashboard />
    </div>
  );
}
