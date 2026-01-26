'use client'

import React from 'react';
import { SuccessPopup } from './SuccessPopup';

interface ReportSuccessPopupProps {
  onClose: () => void;
}

export const ReportSuccessPopup = React.memo<ReportSuccessPopupProps>(({ onClose }) => {
  return <SuccessPopup message="ສົ່ງລາຍງານສຳເລັດ" onClose={onClose} />;
});

ReportSuccessPopup.displayName = 'ReportSuccessPopup';
