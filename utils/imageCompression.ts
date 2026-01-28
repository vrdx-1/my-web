/**
 * Image Compression Utility
 * Compresses images to WebP format with max width constraint
 */

/**
 * Compress an image file to WebP format
 * @param file - Original image file
 * @param maxWidth - Maximum width (default: 1080)
 * @param quality - Compression quality 0-1 (default: 0.8)
 * @returns Promise<File> - Compressed file
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1080,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
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
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, '') + '.webp',
                { type: 'image/webp', lastModified: Date.now() }
              );
              resolve(compressedFile);
              return;
            }
            canvas.toBlob(
              (blob2) => {
                if (blob2) {
                  const jpegFile = new File(
                    [blob2],
                    file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                    { type: 'image/jpeg', lastModified: Date.now() }
                  );
                  resolve(jpegFile);
                  return;
                }
                reject(new Error('Image compression failed'));
              },
              'image/jpeg',
              quality
            );
          },
          'image/webp',
          quality
        );
      };
    };
  });
}
