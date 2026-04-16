'use client'

import { useState, useRef, useCallback, useEffect } from 'react';
import { compressImage } from '@/utils/imageCompression';

interface UseImageUploadProps {
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
  onPreviewsChange?: (previews: string[]) => void;
  /** ตัวเลือกสำหรับการบีบอัดรูป (ใช้เฉพาะบางหน้าที่ต้องการบีบอัดแรงเป็นพิเศษ) */
  compressMaxWidth?: number;
  compressQuality?: number;
}

interface UseImageUploadReturn {
  selectedFiles: File[];
  previews: string[];
  loading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeImage: (index: number) => void;
  clearImages: () => void;
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setPreviews: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * useImageUpload Hook
 * Manages image file selection, compression, and preview generation
 */
export function useImageUpload({
  maxFiles = 15,
  onFilesChange,
  onPreviewsChange,
  compressMaxWidth,
  compressQuality,
}: UseImageUploadProps = {}): UseImageUploadReturn {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFilesRef = useRef<File[]>([]);
  const previewsRef = useRef<string[]>([]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;

      const remainingSlots = maxFiles - selectedFilesRef.current.length;
      if (remainingSlots <= 0) return;

      let incomingFiles = Array.from(e.target.files);
      if (incomingFiles.length > remainingSlots) {
        incomingFiles = incomingFiles.slice(0, remainingSlots);
      }

      setLoading(true);
      try {
        const compressedFiles = await Promise.all(
          incomingFiles.map((file) =>
            // ถ้า caller ไม่กำหนดค่า จะใช้ default (1080, 0.7) จาก compressImage
            compressImage(file, compressMaxWidth, compressQuality)
          )
        );

        const latestFiles = selectedFilesRef.current;
        const latestPreviews = previewsRef.current;
        const latestRemainingSlots = maxFiles - latestFiles.length;

        if (latestRemainingSlots <= 0) {
          return;
        }

        const acceptedFiles = compressedFiles.slice(0, latestRemainingSlots);
        const acceptedPreviews = acceptedFiles.map((file) => URL.createObjectURL(file));
        const newFiles = [...latestFiles, ...acceptedFiles];
        const newPreviews = [...latestPreviews, ...acceptedPreviews];

        selectedFilesRef.current = newFiles;
        previewsRef.current = newPreviews;

        setSelectedFiles(newFiles);
        setPreviews(newPreviews);

        if (onFilesChange) onFilesChange(newFiles);
        if (onPreviewsChange) onPreviewsChange(newPreviews);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error processing images:', error);
      } finally {
        setLoading(false);
      }
    },
    [maxFiles, onFilesChange, onPreviewsChange, compressMaxWidth, compressQuality]
  );

  const removeImage = useCallback(
    (index: number) => {
      const updatedFiles = [...selectedFilesRef.current];
      const updatedPreviews = [...previewsRef.current];

      if (updatedFiles.length > 0 && index < updatedFiles.length) {
        // Revoke object URL to free memory
        URL.revokeObjectURL(updatedPreviews[index]);

        updatedFiles.splice(index, 1);
        updatedPreviews.splice(index, 1);

        selectedFilesRef.current = updatedFiles;
        previewsRef.current = updatedPreviews;

        setSelectedFiles(updatedFiles);
        setPreviews(updatedPreviews);

        if (onFilesChange) onFilesChange(updatedFiles);
        if (onPreviewsChange) onPreviewsChange(updatedPreviews);
      }
    },
    [onFilesChange, onPreviewsChange]
  );

  const clearImages = useCallback(() => {
    // Revoke all object URLs
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    selectedFilesRef.current = [];
    previewsRef.current = [];
    setSelectedFiles([]);
    setPreviews([]);
    if (onFilesChange) onFilesChange([]);
    if (onPreviewsChange) onPreviewsChange([]);
  }, [onFilesChange, onPreviewsChange]);

  return {
    selectedFiles,
    previews,
    loading,
    fileInputRef,
    handleFileChange,
    removeImage,
    clearImages,
    setSelectedFiles,
    setPreviews,
  };
}
