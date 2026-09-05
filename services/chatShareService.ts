import { uploadFileChunked } from './storageService';
import html2canvas from 'html2canvas';

export interface ChatShareAttachment {
  fileName: string;
  url: string;
}

export interface ChatShareOptions {
  attachment?: ChatShareAttachment;
  fileUrl?: string;
  fileName?: string;
  defaultMessage?: string;
  title?: string;
  onGoToChat?: (target: { type: 'private' | 'group' | 'task_group' | 'system'; id: string }) => void;
}

/**
 * Triggers the global SendToChat modal anywhere across the application
 */
export const openSendToChat = (options: ChatShareOptions): void => {
  if (typeof window !== 'undefined') {
    const formattedOptions: ChatShareOptions = {
      ...options,
      attachment: options.attachment || (options.fileUrl && options.fileName ? {
        url: options.fileUrl,
        fileName: options.fileName
      } : undefined)
    };
    window.dispatchEvent(new CustomEvent('app_open_send_to_chat', { detail: formattedOptions }));
  }
};

/**
 * Uploads a Blob or File and directly opens the Send to Chat modal with the uploaded URL.
 */
export const shareBlobToChat = async (
  blobOrFile: Blob | File,
  fileName: string,
  options?: {
    defaultMessage?: string;
    title?: string;
  }
): Promise<void> => {
  try {
    const file = blobOrFile instanceof File 
      ? blobOrFile 
      : new File([blobOrFile], fileName, { type: blobOrFile.type || 'application/pdf' });
      
    let url = '';
    try {
      const uploadRes = await uploadFileChunked(file, () => {});
      if (uploadRes?.url) {
        url = uploadRes.url;
      }
    } catch (upErr) {
      console.warn('Direct upload failed, falling back to data URL', upErr);
    }

    if (!url) {
      // Create data URL fallback
      url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.readAsDataURL(blobOrFile);
      });
    }

    openSendToChat({
      attachment: {
        fileName,
        url
      },
      defaultMessage: options?.defaultMessage || `فایل ارسالی: ${fileName}`,
      title: options?.title || 'ارسال به گفتگو'
    });
  } catch (err) {
    console.error('Failed to share blob to chat:', err);
    alert('خطا در آماده‌سازی فایل برای ارسال به گفتگو');
  }
};

/**
 * Converts a DOM element (by elementId or HTMLElement) into an image or PDF,
 * and opens the Send to Chat modal.
 */
export const shareElementToChat = async (
  elementOrId: string | HTMLElement,
  fileName: string,
  options?: {
    defaultMessage?: string;
    title?: string;
    scale?: number;
  }
): Promise<void> => {
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    throw new Error('المان مورد نظر برای تولید سند یافت نشد');
  }

  const canvas = await html2canvas(el, {
    scale: options?.scale || 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false
  });

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
  });

  const safeFileName = /\.(jpg|jpeg|png|webp|pdf)$/i.test(fileName) ? fileName : `${fileName}.jpg`;

  await shareBlobToChat(blob, safeFileName, {
    defaultMessage: options?.defaultMessage,
    title: options?.title || 'ارسال سند به گفتگو'
  });
};
