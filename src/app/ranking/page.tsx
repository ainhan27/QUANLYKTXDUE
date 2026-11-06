import React, { Suspense } from 'react';
import RealtimeRankingTable from '@/components/ranking/RealtimeRankingTable';
import { getAllStoredApplications } from '@/lib/data/live-store';
import { computeMergedRankings } from '@/lib/data/mock-students';

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  let storedApps = getAllStoredApplications();

  // Đồng bộ thời gian thực từ CSDL Supabase Cloud nếu đã kết nối
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        storedApps = data as any;
      }
    } catch (err) {
      console.warn('Lỗi đọc bảng xếp hạng từ Supabase:', err);
    }
  }

  const merged = computeMergedRankings(storedApps, 120);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Bảng Xếp Hạng Tuyển Sinh Nội Trú KTX – Năm Học 2026 - 2027
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Bảng xếp hạng xét tuyển nội trú tự động cập nhật theo thời gian thực
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Đang tải bảng xếp hạng...</div>}>
        <RealtimeRankingTable initialData={merged} />
      </Suspense>
    </div>
  );
}
