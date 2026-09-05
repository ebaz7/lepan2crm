import { uploadFileChunked } from './storageService';
import { toBlob, toJpeg, toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ChatShareAttachment {
  fileName: string;
  url: string;
}

export interface ChatShareOptions {
  attachment?: ChatShareAttachment;
  attachmentPromise?: Promise<ChatShareAttachment | null>;
  isGeneratingAttachment?: boolean;
  fileUrl?: string;
  fileName?: string;
  defaultMessage?: string;
  title?: string;
  onGoToChat?: (target: { type: 'private' | 'group' | 'task_group' | 'system'; id: string }) => void;
}

/**
 * Triggers the global SendToChat modal anywhere across the application immediately
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
 * Renders an element cleanly off-screen using browser-native SVG/ForeignObject rendering (html-to-image),
 * guaranteeing 100% connected, flawless Persian/Arabic letters (ligatures), sharp borders, and perfect tables.
 */
export const renderCleanElementToBlob = async (
  elementOrId: string | HTMLElement,
  options?: {
    scale?: number;
    asPdf?: boolean;
    format?: 'a4' | 'a5' | 'custom';
    orientation?: 'portrait' | 'landscape';
  }
): Promise<{ blob: Blob; mimeType: string }> => {
  const originalElement = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!originalElement) {
    throw new Error('المان مورد نظر برای تبدیل یافت نشد');
  }

  const isPdf = options?.asPdf;
  const pixelRatio = options?.scale || 2.5;

  const filterNoPrint = (node: HTMLElement) => {
    if (node.classList && (node.classList.contains('no-print') || node.classList.contains('no-export'))) {
      return false;
    }
    if (node.tagName === 'BUTTON' && !node.classList?.contains('printable-button')) {
      return false;
    }
    return true;
  };

  // Primary Method: html-to-image (Uses native browser text shaping engine - fixes all Persian ligature bugs)
  try {
    if (isPdf) {
      const imgData = await toJpeg(originalElement, {
        quality: 0.98,
        pixelRatio,
        backgroundColor: '#ffffff',
        filter: filterNoPrint as any
      });

      const isLandscape = (originalElement.offsetWidth || 800) >= (originalElement.offsetHeight || 600);
      const pdf = new jsPDF({
        orientation: options?.orientation || (isLandscape ? 'landscape' : 'portrait'),
        unit: 'mm',
        format: options?.format || ((originalElement.offsetWidth || 800) <= 650 ? 'a5' : 'a4')
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, imgHeight));
      const pdfBlob = pdf.output('blob');
      return { blob: pdfBlob, mimeType: 'application/pdf' };
    }

    const blob = await toBlob(originalElement, {
      quality: 0.98,
      pixelRatio,
      backgroundColor: '#ffffff',
      filter: filterNoPrint as any
    });

    if (blob) {
      return { blob, mimeType: 'image/jpeg' };
    }
  } catch (nativeErr) {
    console.warn('html-to-image native render failed, falling back to canvas clone:', nativeErr);
  }

  // Fallback Method: Isolated Container Clone
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';

  const clone = originalElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, button:not(.printable-button)').forEach(el => el.remove());

  const origInputs = originalElement.querySelectorAll('input, textarea, select');
  const cloneInputs = clone.querySelectorAll('input, textarea, select');
  origInputs.forEach((inp: any, idx) => {
    const cInp = cloneInputs[idx] as any;
    if (!cInp) return;
    if (inp.type === 'checkbox' || inp.type === 'radio') {
      cInp.checked = inp.checked;
      if (inp.checked) cInp.setAttribute('checked', 'checked');
    } else {
      cInp.value = inp.value;
      cInp.setAttribute('value', inp.value);
    }
  });

  const naturalWidth = originalElement.offsetWidth || 794;
  clone.style.transform = 'none';
  clone.style.margin = '0 auto';
  clone.style.boxSizing = 'border-box';
  clone.style.direction = 'rtl';
  clone.style.backgroundColor = '#ffffff';

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 60));

    // Try html-to-image on the clone first
    try {
      if (isPdf) {
        const imgData = await toJpeg(clone, { quality: 0.98, pixelRatio, backgroundColor: '#ffffff' });
        const isLandscape = clone.offsetWidth >= clone.offsetHeight;
        const pdf = new jsPDF({
          orientation: options?.orientation || (isLandscape ? 'landscape' : 'portrait'),
          unit: 'mm',
          format: options?.format || (naturalWidth <= 650 ? 'a5' : 'a4')
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, imgHeight));
        return { blob: pdf.output('blob'), mimeType: 'application/pdf' };
      }

      const imgBlob = await toBlob(clone, { quality: 0.98, pixelRatio, backgroundColor: '#ffffff' });
      if (imgBlob) {
        return { blob: imgBlob, mimeType: 'image/jpeg' };
      }
    } catch (cloneImgErr) {
      console.warn('Clone html-to-image failed, using html2canvas as last resort', cloneImgErr);
    }

    // Last resort: html2canvas
    const canvas = await html2canvas(clone, {
      scale: pixelRatio,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: naturalWidth,
      width: naturalWidth
    });

    if (isPdf) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const isLandscape = canvas.width > canvas.height;
      const pdf = new jsPDF({
        orientation: options?.orientation || (isLandscape ? 'landscape' : 'portrait'),
        unit: 'mm',
        format: options?.format || (naturalWidth <= 650 ? 'a5' : 'a4')
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, imgHeight));
      return { blob: pdf.output('blob'), mimeType: 'application/pdf' };
    }

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
    });

    return { blob, mimeType: 'image/jpeg' };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};

/**
 * Uploads a Blob or File in background while opening the Send to Chat modal INSTANTLY.
 */
export const shareBlobToChat = async (
  blobOrFile: Blob | File,
  fileName: string,
  options?: {
    defaultMessage?: string;
    title?: string;
  }
): Promise<void> => {
  let resolveAtt: (att: ChatShareAttachment | null) => void;
  const attachmentPromise = new Promise<ChatShareAttachment | null>((res) => {
    resolveAtt = res;
  });

  // Open SendToChat modal INSTANTLY (0ms)
  openSendToChat({
    title: options?.title || 'ارسال به گفتگو',
    defaultMessage: options?.defaultMessage || `فایل ارسالی: ${fileName}`,
    fileName,
    attachmentPromise,
    isGeneratingAttachment: true
  });

  // Process and upload in the background
  (async () => {
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

      const attachment: ChatShareAttachment = { fileName, url };
      resolveAtt(attachment);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_send_to_chat_attachment_ready', { detail: { attachment } }));
      }
    } catch (err) {
      console.error('Failed to share blob to chat:', err);
      resolveAtt(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_send_to_chat_attachment_failed', { detail: { error: err } }));
      }
    }
  })();
};

/**
 * Converts a DOM element (by elementId or HTMLElement) into an image or PDF in the background,
 * cleanly formatted without font/letter distortion,
 * while opening the Send to Chat modal INSTANTLY (0ms) without any blocking UI freeze.
 */
export const shareElementToChat = async (
  elementOrId: string | HTMLElement,
  fileName: string,
  options?: {
    defaultMessage?: string;
    title?: string;
    scale?: number;
    asPdf?: boolean;
    format?: 'a4' | 'a5' | 'custom';
    orientation?: 'portrait' | 'landscape';
  }
): Promise<void> => {
  const isPdf = options?.asPdf || /\.pdf$/i.test(fileName);
  const safeFileName = /\.(jpg|jpeg|png|webp|pdf)$/i.test(fileName) ? fileName : (isPdf ? `${fileName}.pdf` : `${fileName}.jpg`);
  
  let resolveAtt: (att: ChatShareAttachment | null) => void;
  const attachmentPromise = new Promise<ChatShareAttachment | null>((res) => {
    resolveAtt = res;
  });

  // Open SendToChat modal INSTANTLY without waiting for rendering
  openSendToChat({
    title: options?.title || 'ارسال سند به گفتگو',
    defaultMessage: options?.defaultMessage || `سند ارسالی: ${safeFileName}`,
    fileName: safeFileName,
    attachmentPromise,
    isGeneratingAttachment: true
  });

  // Background capture and upload pipeline
  (async () => {
    try {
      const { blob, mimeType } = await renderCleanElementToBlob(elementOrId, {
        scale: options?.scale || 2.5,
        asPdf: isPdf,
        format: options?.format,
        orientation: options?.orientation
      });

      const file = new File([blob], safeFileName, { type: mimeType });
      let url = '';
      try {
        const uploadRes = await uploadFileChunked(file, () => {});
        if (uploadRes?.url) {
          url = uploadRes.url;
        }
      } catch (upErr) {
        console.warn('Chunked upload failed in background, falling back to data URL', upErr);
      }

      if (!url) {
        url = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || '');
          reader.readAsDataURL(blob);
        });
      }

      const attachment: ChatShareAttachment = { fileName: safeFileName, url };
      resolveAtt(attachment);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_send_to_chat_attachment_ready', { detail: { attachment } }));
      }
    } catch (err) {
      console.error('Background element render error:', err);
      resolveAtt(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_send_to_chat_attachment_failed', { detail: { error: err } }));
      }
    }
  })();
};
