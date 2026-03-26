'use client';

import { useState, useCallback } from 'react';

interface UseReportModalStateReturn {
  reportingPost: any | null;
  setReportingPost: React.Dispatch<React.SetStateAction<any | null>>;
  reportReason: string;
  setReportReason: React.Dispatch<React.SetStateAction<string>>;
  isSubmittingReport: boolean;
  setIsSubmittingReport: React.Dispatch<React.SetStateAction<boolean>>;
  resetModal: () => void;
}

/**
 * ควบคุม state ของ report modal
 * รวม 3 state (reportingPost, reportReason, isSubmittingReport) เข้าไว้ใน hook เดียว
 */
export function useReportModalState(): UseReportModalStateReturn {
  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const resetModal = useCallback(() => {
    setReportingPost(null);
    setReportReason('');
    setIsSubmittingReport(false);
  }, []);

  return {
    reportingPost,
    setReportingPost,
    reportReason,
    setReportReason,
    isSubmittingReport,
    setIsSubmittingReport,
    resetModal,
  };
}
