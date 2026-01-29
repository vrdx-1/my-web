'use client'

import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from './postUtils';

/**
 * Toggle post status between 'recommend' and 'sold'
 */
export async function togglePostStatus(
  postId: string,
  currentStatus: string,
  setPosts: (updater: (prev: any[]) => any[]) => void
): Promise<void> {
  const newStatus = currentStatus === 'recommend' ? 'sold' : 'recommend';
  const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', postId);
  if (!error) {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }
}

/**
 * Delete a post (without confirmation - confirmation should be handled by caller)
 */
export async function deletePost(
  postId: string,
  setPosts: (updater: (prev: any[]) => any[]) => void
): Promise<void> {
  const { error } = await supabase.from('cars').delete().eq('id', postId);
  if (!error) {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }
}

/**
 * Report a post
 */
export function openReportModal(
  post: any,
  session: any,
  setReportingPost: (post: any | null) => void
): void {
  if (!session) {
    return;
  }
  setReportingPost(post);
}

/**
 * Submit a report
 */
export async function submitReport(
  reportingPost: any,
  reportReason: string,
  session: any,
  setReportingPost: (post: any | null) => void,
  setReportReason: (reason: string) => void,
  setIsSubmittingReport: (submitting: boolean) => void
): Promise<boolean> {
  if (!reportReason.trim()) {
    return false;
  }
  setIsSubmittingReport(true);
  const { error } = await supabase.from('reports').insert([
    {
      post_id: reportingPost.id,
      car_id: reportingPost.id,
      reporter_email: session.user.email,
      post_caption: reportingPost.caption,
      reason: reportReason,
      status: 'pending'
    }
  ]);

  if (error) {
    setIsSubmittingReport(false);
    return false;
  } else {
    setReportingPost(null);
    setReportReason('');
    setIsSubmittingReport(false);
    return true;
  }
}

/**
 * Share a post
 * ยอดแชร์นับทันทีเมื่อกด (ไม่สามารถยกเลิกได้) กดหลายครั้งก็นับเพิ่มเรื่อยๆ
 */
export async function sharePost(
  post: any,
  session: any,
  setPosts: (updater: (prev: any[]) => any[]) => void
): Promise<void> {
  const shareUrl = `${window.location.origin}/post/${post.id}`;
  const shareData = { url: shareUrl };

  // นับยอดแชร์ทันทีทุกครั้งที่กด (ไม่สามารถยกเลิกได้, คนเดิมกดหลายครั้งก็นับเพิ่ม)
  const isUser = !!session;
  const userId = isUser ? session.user.id : getPrimaryGuestToken();
  const table = isUser ? 'post_shares' : 'post_shares_guest';
  const column = isUser ? 'user_id' : 'guest_token';
  await supabase.from(table).insert([{ [column]: userId, post_id: post.id }]);
  await supabase.from('cars').update({ shares: (post.shares || 0) + 1 }).eq('id', post.id);
  setPosts(prev => prev.map(p => p.id === post.id ? { ...p, shares: (p.shares || 0) + 1 } : p));

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  } catch (err) {
    console.log('User cancelled share');
  }
}
