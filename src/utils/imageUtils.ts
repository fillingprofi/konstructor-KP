import { ProposalImage } from '../types';

/**
 * Resizes and compresses an image from a File object.
 * Constrains max dimension to maxDimension (default 1200px) and quality (0.85),
 * keeping payload small and preventing memory/IPC crashes.
 */
export async function processImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<ProposalImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось декодировать изображение'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Не удалось инициализировать контекст Canvas'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG transparency if it is png, otherwise compress as jpeg
        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, isPng ? undefined : quality);
        const base64 = dataUrl.split(',')[1] || '';

        resolve({
          id: 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          base64,
          mimeType,
          width,
          height,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sanitize filename to avoid invalid characters across OS and browser downloads
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}
