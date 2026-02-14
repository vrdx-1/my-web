'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useImageUpload } from '@/hooks/useImageUpload';

const MAX_CAPTION_LINES = 15;
const ALLOWED_KEYS_AT_MAX = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];

export function useEditPostPage(id: string) {
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [province, setProvince] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef<{ caption: string; province: string; images: string[] } | null>(null);
  const hasChangesRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const imageUpload = useImageUpload({ maxFiles: 15 });

  const adjustCaptionHeight = useCallback(() => {
    const el = captionRef.current;
    if (!el) return;
    el.style.overflow = 'hidden';
    el.style.height = '0';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data: post, error } = await supabase.from('cars').select('*').eq('id', id).single();
      if (cancelled) return;
      if (error || !post) {
        router.back();
        return;
      }
      const cap = (post.caption || '').split('\n').slice(0, MAX_CAPTION_LINES).join('\n');
      const prov = post.province || '';
      const imgs = post.images || [];
      setCaption(cap);
      setProvince(prov);
      setImages(imgs);
      initialRef.current = { caption: cap, province: prov, images: imgs };
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [id, router]);

  const hasChanges = Boolean(
    !loading &&
      initialRef.current &&
      (caption !== initialRef.current.caption ||
        province !== initialRef.current.province ||
        JSON.stringify(images) !== JSON.stringify(initialRef.current.images) ||
        imageUpload.previews.length > 0)
  );
  hasChangesRef.current = hasChanges;

  const handleBack = useCallback(() => {
    if (hasChangesRef.current) {
      setShowLeaveConfirm(true);
      return;
    }
    allowLeaveRef.current = true;
    router.back();
  }, [router]);

  const handleDiscardAndBack = useCallback(() => {
    allowLeaveRef.current = true;
    setShowLeaveConfirm(false);
    router.back();
  }, [router]);

  const handleLeaveCancel = useCallback(() => setShowLeaveConfirm(false), []);

  useEffect(() => {
    if (!showLeaveConfirm || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showLeaveConfirm]);

  useEffect(() => {
    if (!loading) {
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        if (hasChangesRef.current && !allowLeaveRef.current) e.preventDefault();
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      const rafId = requestAnimationFrame(() => {
        adjustCaptionHeight();
        requestAnimationFrame(adjustCaptionHeight);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [loading, caption, adjustCaptionHeight]);

  const removeImage = useCallback((index: number, isNew: boolean) => {
    if (isNew) {
      imageUpload.removeImage(index);
      if (images.length === 0 && imageUpload.previews.length - 1 === 0) setIsViewing(false);
    } else {
      const next = images.filter((_, i) => i !== index);
      setImages(next);
      if (next.length === 0 && imageUpload.previews.length === 0) setIsViewing(false);
    }
  }, [images, imageUpload]);

  const handleUpdate = useCallback(async (goBackAfterSave?: boolean) => {
    if (!province || (images.length === 0 && imageUpload.selectedFiles.length === 0)) return;
    setUploading(true);
    const uploadedPaths: string[] = [];
    try {
      let finalImages = [...images];
      for (const file of imageUpload.selectedFiles) {
        const ext = file.name.split('.').pop() || 'webp';
        const path = `updates/${Date.now()}-${Math.random()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('car-images').upload(path, file);
        if (uploadError) {
          for (const p of uploadedPaths) await supabase.storage.from('car-images').remove([p]).catch(() => {});
          throw uploadError;
        }
        if (uploadData) {
          uploadedPaths.push(uploadData.path);
          const { data: { publicUrl } } = supabase.storage.from('car-images').getPublicUrl(uploadData.path);
          finalImages.push(publicUrl);
        }
      }
      const { error } = await supabase.from('cars').update({ caption, province, images: finalImages }).eq('id', id);
      if (error) {
        for (const p of uploadedPaths) await supabase.storage.from('car-images').remove([p]).catch(() => {});
        throw error;
      }
      if (goBackAfterSave) {
        allowLeaveRef.current = true;
        router.back();
      } else {
        router.push('/');
      }
      router.refresh();
    } catch {
      // Error already surfaced by throw / UI
    } finally {
      setUploading(false);
    }
  }, [id, province, caption, images, imageUpload.selectedFiles, router]);

  const limitCaptionToLines = useCallback((text: string) => text.split('\n').slice(0, MAX_CAPTION_LINES).join('\n'), []);

  const handleCaptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const lines = caption.split('\n');
    if (lines.length >= MAX_CAPTION_LINES && e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    if (lines.length >= MAX_CAPTION_LINES) {
      const mod = e.ctrlKey || e.metaKey || e.altKey;
      if (!ALLOWED_KEYS_AT_MAX.includes(e.key) && !mod && e.key.length === 1) e.preventDefault();
    }
  }, [caption]);

  const handleCaptionPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (caption.split('\n').length >= MAX_CAPTION_LINES) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const pasted = e.clipboardData.getData('text');
    const newText = limitCaptionToLines(caption.substring(0, start) + pasted + caption.substring(end));
    setCaption(newText);
    if (captionRef.current) {
      captionRef.current.value = newText;
      adjustCaptionHeight();
      const pos = Math.min(start + pasted.length, newText.length);
      setTimeout(() => captionRef.current?.setSelectionRange(pos, pos), 0);
    }
  }, [caption, limitCaptionToLines, adjustCaptionHeight]);

  const handleCaptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const limited = limitCaptionToLines(e.target.value);
    setCaption(limited);
    const el = captionRef.current;
    if (el && el.value !== limited) {
      const pos = el.selectionStart;
      el.value = limited;
      setTimeout(() => el.setSelectionRange(Math.min(pos, limited.length), Math.min(pos, limited.length)), 0);
    }
    setTimeout(adjustCaptionHeight, 0);
  }, [limitCaptionToLines, adjustCaptionHeight]);

  return {
    caption,
    setCaption,
    province,
    setProvince,
    images,
    setImages,
    loading,
    uploading,
    isViewing,
    setIsViewing,
    showLeaveConfirm,
    handleBack,
    handleDiscardAndBack,
    handleLeaveCancel,
    handleUpdate,
    removeImage,
    captionRef,
    imageUpload,
    hasChanges,
    adjustCaptionHeight,
    handleCaptionKeyDown,
    handleCaptionPaste,
    handleCaptionChange,
    maxCaptionLines: MAX_CAPTION_LINES,
  };
}
