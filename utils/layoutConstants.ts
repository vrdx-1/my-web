/**
 * Layout Constants
 * Centralized layout constants used across the application
 * Reduces duplication of inline styles
 */

import { LAO_FONT } from './constants';

/** Gap เส้นแบ่งรูปใน grid — เท่ากับ layout 2×2 ใช้กับทุก template (PhotoGrid, PhotoPreviewGrid, PostCard) */
export const PHOTO_GRID_GAP = '3px';

/** Aspect ratio ของแต่ละ layout (ใช้ในหน้าจัดเรียงให้ตัวอย่างขนาดสมจริง) */
export const LAYOUT_ASPECT_RATIO: Record<string, string> = {
  default: '1',
  'car-gallery': '1',
  'two-left-three-right': '5/6',
  'five-images': '1',
  'one-top-three-bottom': '1',
  'one-left-three-right': '1',
  'one-top-two-bottom': '1',
  'three-images': '1',
};

export const LAYOUT_CONSTANTS = {
  // Container widths
  MAIN_CONTAINER_WIDTH: '600px',
  ADMIN_CONTAINER_WIDTH: '1000px',
  
  // Heights
  HEADER_HEIGHT: '118px',

  /** ขนาดโลโก้และปุ่มฟิลเตอร์ใน header หน้า Home (ให้ปุ่มฟิลเตอร์ใหญ่เท่าโลโก้) */
  HEADER_LOGO_SIZE: 40,
  
  // Main container styles (used in saved, liked, edit-profile, sold, create-post, etc.)
  MAIN_CONTAINER: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    background: '#ffffff',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    fontFamily: LAO_FONT,
    position: 'relative' as const,
    boxSizing: 'border-box' as const,
    overflowX: 'clip' as const,
  },
  
  // Main container with flex column (used in create-post, edit-post)
  MAIN_CONTAINER_FLEX: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    minHeight: '100vh',
    background: '#ffffff',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: LAO_FONT,
    boxSizing: 'border-box' as const,
    overflowX: 'clip' as const,
  },
  
  // Admin container styles (used in admin/reporting, admin/review, admin/visitor)
  ADMIN_CONTAINER: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    background: '#f0f2f5',
    minHeight: '100vh',
  },
  
  // Admin container with different margin (used in admin/visitor)
  ADMIN_CONTAINER_WITH_MARGIN: {
    maxWidth: '1000px',
    margin: '40px auto',
    padding: '20px',
  },
  
  /** สีพื้นหลังหน้า App profile (ใช้กับแบ็กกราวนด์แท็บในหน้า Home ให้ตรงกับ profile) */
  PROFILE_PAGE_BACKGROUND: '#ffffff',

  // Header spacer (used in page.tsx, sold/page.tsx)
  HEADER_SPACER: {
    height: '118px',
    background: '#ffffff',
    backgroundColor: '#ffffff',
  },
} as const;
