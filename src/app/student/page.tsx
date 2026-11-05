'use client';

import React, { useState, useEffect } from 'react';
import ApplicationForm from '@/components/student/ApplicationForm';
import ApplicationTracker from '@/components/student/ApplicationTracker';

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'tracker'>('form');
  const [isRoundClosed, setIsRoundClosed] = useState(false);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem('student_page_tab') as 'form' | 'tracker';
      const hasSession = localStorage.getItem('active_student_session_code') || localStorage.getItem('last_submitted_student');
      if (savedTab) {
        setActiveTab(savedTab);
      } else if (hasSession) {
        setActiveTab('tracker');
      } else {
        setActiveTab('form');
      }
    } catch {}

    const handleSwitchTab = (e: any) => {
      const targetTab = e.detail;
      if (targetTab === 'form' || targetTab === 'tracker') {
        setActiveTab(targetTab);
      }
    };
    const handleSessionChanged = (e: any) => {
      if (!e.detail) {
        setActiveTab('form');
      }
      // Không tự ý nhảy tab sang tracker nếu người dùng đang chủ động ở tab Nộp Đơn
    };

    window.addEventListener('switch_student_tab', handleSwitchTab);
    window.addEventListener('student_session_changed', handleSessionChanged);

    const fetchWorkflow = async () => {
      try {
        const res = await fetch('/api/workflow');
        if (res.ok) {
          const data = await res.json();
          if (data.workflow?.isRankingsFinalized || data.workflow?.isPublished) {
            setIsRoundClosed(true);
          }
        }
      } catch (e) {
        console.error('Failed to fetch workflow state in StudentPage:', e);
      }
    };
    fetchWorkflow();

    return () => {
      window.removeEventListener('switch_student_tab', handleSwitchTab);
      window.removeEventListener('student_session_changed', handleSessionChanged);
    };
  }, []);

  const switchTab = (tab: 'form' | 'tracker') => {
    setActiveTab(tab);
    try {
      localStorage.setItem('student_page_tab', tab);
    } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Cổng Ký Túc Xá Sinh Viên DUE
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Đăng ký nội trú, theo dõi kết quả thẩm định và ký hợp đồng trực tuyến
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-3 sm:mt-0 flex bg-slate-200/90 p-1 rounded-xl">
          <button
            onClick={() => switchTab('form')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'form'
                ? 'bg-[#125FA9] text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nộp Đơn {isRoundClosed && <span className="text-rose-300 font-extrabold ml-1">(Đã đóng)</span>}
          </button>
          <button
            onClick={() => switchTab('tracker')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'tracker'
                ? 'bg-[#125FA9] text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hồ Sơ &amp; Hợp Đồng
          </button>
        </div>
      </div>

      {activeTab === 'form' ? (
        <ApplicationForm onSuccess={() => switchTab('tracker')} />
      ) : (
        <ApplicationTracker />
      )}
    </div>
  );
}
