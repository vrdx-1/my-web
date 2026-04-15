'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useImageUpload } from '@/hooks/useImageUpload';

const MAX_CAPTION_LINES = 15;
const ALLOWED_KEYS_AT_MAX = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];
const VALID_LAYOUTS = ['default', 'car-gallery', 'five-images', 'three-images'];

export function useEditPostPage(id: string) {
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [province, setProvince] = useState('');
  const [carPrice, setCarPrice] = useState('');
  const [carCurrency, setCarCurrency] = useState<'₭' | '฿' | '$'>('₭');
  const [images, setImages] = useState<string[]>([]);
  const [layout, setLayout] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef<{
    caption: string;
    province: string;
    carPrice: string;
    carCurrency: '₭' | '฿' | '$';
    images: string[];
    layout: string;
  } | null>(null);
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
      const prov = typeof post.province === 'string' ? post.province.trim() : '';
      const normalizedPrice = typeof post.price === 'number'
        ? String(post.price)
        : typeof post.price === 'string'
          ? post.price.replace(/\D/g, '')
          : '';
      const normalizedCurrency = post.price_currency === '฿' || post.price_currency === '$'
        ? post.price_currency
        : '₭';
      const imgs = Array.isArray(post.images) ? post.images : [];
      const rawLayout = post.layout;
      const postLayout = VALID_LAYOUTS.includes(String(rawLayout || '')) ? String(rawLayout) : 'default';
      setCaption(cap);
      setProvince(prov);
      setCarPrice(normalizedPrice);
      setCarCurrency(normalizedCurrency);
      setImages(imgs);
      setLayout(postLayout);
      initialRef.current = {
        caption: cap,
        province: prov,
        carPrice: normalizedPrice,
        carCurrency: normalizedCurrency,
        images: imgs,
        layout: postLayout,
      };
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [id, router]);

  const totalImageCount = images.length + imageUpload.previews.length;
  const initial = initialRef.current;
  const captionChanged = initial && caption !== initial.caption;
  const provinceChanged = initial && String(province).trim() !== String(initial.province).trim();
  const priceChanged = initial && carPrice !== initial.carPrice;
  const currencyChanged = initial && carCurrency !== initial.carCurrency;
  const imagesChanged = initial && JSON.stringify(images) !== JSON.stringify(initial.images);
  const hasNewPreviews = imageUpload.previews.length > 0;
  const layoutChanged = totalImageCount >= 6 && initial && String(layout) !== String(initial.layout);
  const hasChanges = Boolean(
    !loading &&
      initial &&
      (captionChanged || provinceChanged || priceChanged || currencyChanged || imagesChanged || hasNewPreviews || layoutChanged)
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
    if (uploading) return;
    setSaveError(null);
    const noProvince = !String(province).trim();
    const noImages = images.length === 0 && imageUpload.selectedFiles.length === 0;
    if (noProvince || noImages) {
      setSaveError(noProvince ? 'กรุณาเลือกแขวง' : 'กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป');
      return;
    }
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
      const normalizedPrice = carPrice.replace(/\D/g, '');
      const priceValue = normalizedPrice ? Number(normalizedPrice) : null;
      const updatePayload: {
        caption: string;
        province: string;
        price: number | null;
        price_currency: '₭' | '฿' | '$';
        images: string[];
        layout?: string;
      } = {
        caption,
        province,
        price: priceValue && Number.isFinite(priceValue) ? priceValue : null,
        price_currency: carCurrency || '₭',
        images: finalImages,
      };
      if (finalImages.length >= 6) {
        updatePayload.layout = layout;
      }
      const { error } = await supabase.from('cars').update(updatePayload).eq('id', id);
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
  }, [id, province, caption, carPrice, carCurrency, images, layout, uploading, imageUpload.selectedFiles, router]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

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
    carPrice,
    setCarPrice,
    carCurrency,
    setCarCurrency,
    images,
    setImages,
    layout,
    setLayout,
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
    saveError,
    clearSaveError,
  };
}
