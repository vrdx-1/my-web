export const SAVE_POST_SUCCESS_EVENT = 'jutpai:save-post-success';
export const UNSAVE_POST_SUCCESS_EVENT = 'jutpai:unsave-post-success';

export function emitSavePostSuccessPopup() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVE_POST_SUCCESS_EVENT));
}

export function emitUnsavePostSuccessPopup() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UNSAVE_POST_SUCCESS_EVENT));
}