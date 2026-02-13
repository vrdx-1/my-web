'use client'

/**
 * Custom hook สำหรับจัดการ popups ในหน้า Home
 * รวม logic สำหรับ popups ทั้งหมดเพื่อลดความซับซ้อน
 */
export function useHomePopups({
  postFeedHandlers,
  showRegistrationSuccess,
  setShowRegistrationSuccess,
}: {
  postFeedHandlers: {
    showReportSuccess?: boolean;
    setShowReportSuccess?: (show: boolean) => void;
    showDeleteConfirm?: boolean;
    handleConfirmDelete?: () => void;
    handleCancelDelete?: () => void;
    showDeleteSuccess?: boolean;
    setShowDeleteSuccess?: (show: boolean) => void;
  };
  showRegistrationSuccess: boolean;
  setShowRegistrationSuccess: (show: boolean) => void;
}) {
  return {
    showReportSuccess: postFeedHandlers.showReportSuccess,
    onCloseReportSuccess: () => postFeedHandlers.setShowReportSuccess?.(false),
    showDeleteConfirm: postFeedHandlers.showDeleteConfirm,
    onConfirmDelete: postFeedHandlers.handleConfirmDelete,
    onCancelDelete: postFeedHandlers.handleCancelDelete,
    showDeleteSuccess: postFeedHandlers.showDeleteSuccess,
    onCloseDeleteSuccess: () => postFeedHandlers.setShowDeleteSuccess?.(false),
    showRegistrationSuccess,
    onCloseRegistrationSuccess: () => setShowRegistrationSuccess(false),
  };
}
