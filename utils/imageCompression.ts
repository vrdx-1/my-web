/**
 * Image Compression Utility
 * Compresses images to JPEG format (iOS-compatible) with max width constraint.
 * Falls back to original file if compression fails (server will compress).
 * 
 * iOS Safari has poor Canvas.toBlob support for WebP, so we:
 * 1. Try JPEG compression first (better iOS support)
 * 2. Fall back to original file if compression fails
 * 3. Server-side Sharp will compress uncompressed files
 */

/**
 * Compress an image file to JPEG format (iOS-friendly)
 * @param file - Original image file
 * @param maxWidth - Maximum width (default: 1600)
 * @param quality - Compression quality 0-1 (default: 0.85)
 * @returns Promise<File> - Compressed file, or original file if compression fails
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1600,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    // Timeout for very slow devices (fallback to original after 10s)
    const timeout = setTimeout(() => {
      console.warn('[compressImage] Timeout: using original file');
      resolve(file);
    }, 10000);

    try {
      const reader = new FileReader();
      
      reader.onerror = () => {
        clearTimeout(timeout);
        console.warn('[compressImage] FileReader error: using original file');
        resolve(file);
      };

      reader.onload = (event) => {
        try {
          const img = new Image();
          
          img.onerror = () => {
            clearTimeout(timeout);
            console.warn('[compressImage] Image load error: using original file');
            resolve(file);
          };

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                clearTimeout(timeout);
                console.warn('[compressImage] Canvas context unavailable: using original file');
                resolve(file);
                return;
              }

              ctx.drawImage(img, 0, 0, width, height);

              // Try JPEG first (better iOS Safari support than WebP)
              canvas.toBlob(
                (jpegBlob) => {
                  clearTimeout(timeout);
                  
                  if (jpegBlob && jpegBlob.size > 0) {
                    // Success: use compressed JPEG
                    const compressedFile = new File(
                      [jpegBlob],
                      file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                      { type: 'image/jpeg', lastModified: Date.now() }
                    );
                    console.log(
                      `[compressImage] Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(jpegBlob.size / 1024).toFixed(1)}KB`
                    );
                    resolve(compressedFile);
                  } else {
                    // JPEG compression failed (returned null or empty blob)
                    console.warn('[compressImage] JPEG compression failed or returned empty: using original file');
                    resolve(file);
                  }
                },
                'image/jpeg',
                quality
              );
            } catch (e) {
              clearTimeout(timeout);
              console.warn('[compressImage] Image processing error:', e, '→ using original file');
              resolve(file);
            }
          };

          img.src = event.target?.result as string;
        } catch (e) {
          clearTimeout(timeout);
          console.warn('[compressImage] Image setup error:', e, '→ using original file');
          resolve(file);
        }
      };

      reader.readAsDataURL(file);
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[compressImage] FileReader setup error:', e, '→ using original file');
      resolve(file);
    }
  });
}
