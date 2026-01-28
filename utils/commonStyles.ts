/**
 * Common Style Constants
 * Shared inline style objects used across components
 */

import { LAO_FONT } from '@/utils/constants';

export const commonStyles = {
  // Container styles
  mainContainer: {
    maxWidth: '600px',
    margin: '0 auto',
    background: '#fff',
    minHeight: '100vh',
    fontFamily: LAO_FONT,
    position: 'relative' as const,
  },

  // Header styles
  stickyHeader: {
    padding: '10px 15px',
    display: 'flex',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    background: '#fff',
    zIndex: 100,
    borderBottom: '1px solid #f0f0f0',
  },

  // Button styles
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    touchAction: 'manipulation' as const,
  },

  primaryButton: {
    background: '#1877f2',
    border: 'none',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '20px',
  },

  // Menu styles
  menuItem: {
    padding: '12px 15px',
    fontSize: '14px',
    color: '#000',
    cursor: 'pointer',
    background: '#fff',
    borderBottom: '1px solid #eee',
    fontWeight: 'normal' as const,
    touchAction: 'manipulation' as const,
  },

  menuItemLast: {
    padding: '12px 15px',
    fontSize: '14px',
    color: '#000',
    cursor: 'pointer',
    background: '#fff',
    fontWeight: 'normal' as const,
    touchAction: 'manipulation' as const,
  },

  // Modal overlay
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },

  // Post header
  postHeader: {
    padding: '12px 15px 8px 15px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },

  // Online status indicator
  onlineIndicator: {
    width: '10px',
    height: '10px',
    background: '#31a24c',
    borderRadius: '50%',
    border: '1.5px solid #fff',
  },
};
