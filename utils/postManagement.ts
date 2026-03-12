'use client'

import { supabase } from '@/lib/supabase';
import { getPrimaryGuestToken } from './postUtils';
import { invalidateFeedCacheClient } from './invalidateFeedCacheClient';

/**
 * Toggle post status between 'recommend' and 'sold'
 * เมื่อผู้ขายย้ายไป "ຂາຍແລ້ວ" ระบบปิด boost อัตโนมัติ
 * ทำ optimistic update: ลบรายการจาก UI ทันที แล้วค่อยอัปเดต DB (real-time)
 */
export async function togglePostStatus(
  postId: string,
  currentStatus: string,
  setPosts: (updater: (prev: any[]) => any[]) => void,
  /** ใช้สำหรับ rollback ถ้า API ล้มเหลว */
  postToRestore?: any
): Promise<void> {
  const newStatus = currentStatus === 'recommend' ? 'sold' : 'recommend';

  // Optimistic: ลบจากรายการทันที ให้หายแบบ real-time
  setPosts((prev) => prev.filter((p) => p.id !== postId));

  const { error } = await supabase.from('cars').update({ status: newStatus }).eq('id', postId);
  if (error) {
    if (postToRestore) {
      setPosts((prev) => {
        const merged = [postToRestore, ...prev.filter((p) => p.id !== postId)];
        merged.sort((a, b) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime());
        return merged;
      });
    }
    throw error;
  }
  if (newStatus === 'sold') {
    await supabase.from('cars').update({ is_boosted: false, boost_expiry: null }).eq('id', postId);
    await supabase.from('post_boosts').update({ status: 'reject' }).eq('post_id', postId).eq('status', 'success');
  }
  invalidateFeedCacheClient();
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
      reporter_id: session.user.id,
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

  // นับยอดแชร์ลง DB ทันที (ยอดบน UI อัพเดทหลัง refresh เท่านั้น)
  await supabase.from('cars').update({ shares: (post.shares || 0) + 1 }).eq('id', post.id);

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
