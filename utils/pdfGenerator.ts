
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { saveBlobAndOpenFile } from '../services/fileService';

type PdfFormat = 'A4' | 'A5';
type PdfOrientation = 'portrait' | 'landscape';

export interface PdfOptions {
    elementId: string;
    filename: string;
    format?: PdfFormat;
    orientation?: PdfOrientation;
    returnBlob?: boolean;
    onComplete?: () => void;
    onError?: (error: any) => void;
}

export const generatePdfFromHtml = async (htmlString: string, filename: string): Promise<Blob | undefined> => {
    try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '794px';
        iframe.style.height = '1123px';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(iframe);
            return undefined;
        }
        
        doc.open();
        doc.write(htmlString);
        doc.close();

        // Wait for rendering
        await new Promise(r => setTimeout(r, 1000));

        const canvas = await html2canvas(doc.body, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 794,
            windowHeight: doc.body.scrollHeight > 1123 ? doc.body.scrollHeight : 1123
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 12) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const pdfBlob = pdf.output('blob');
        document.body.removeChild(iframe);
        return pdfBlob;
    } catch (error) {
        console.error('Error generating PDF from HTML:', error);
        return undefined;
    }
};

export const generatePdf = async ({
    elementId,
    filename,
    format = 'A4',
    orientation = 'portrait',
    returnBlob,
    onComplete,
    onError
}: PdfOptions) => {
    const originalElement = document.getElementById(elementId);
    
    if (!originalElement) {
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // 1. Create a container for rendering
        // We create a temporary container off-screen to ensure we capture the full dimensions 
        // regardless of the user's current screen size (Responsive fix).
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.zIndex = '-1';
        
        // Set dimensions based on format to ensure high quality scale
        // A4 @ 96 DPI: 794px x 1123px. We use 2x scale for better quality.
        let width = 0;
        let height = 0;
        
        if (format === 'A4') {
             if (orientation === 'portrait') { width = 794; height = 1123; }
             else { width = 1123; height = 794; }
        } else if (format === 'A5') {
             if (orientation === 'portrait') { width = 559; height = 794; }
             else { width = 794; height = 559; }
        }

        // Clone the element
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Clean up UI-only elements
        const noPrints = clone.querySelectorAll('.no-print');
        noPrints.forEach(el => el.remove());

        // Sync Form Values (Inputs, Selects, Textareas)
        // This is crucial because cloning doesn't copy current values of inputs
        const originalInputs = originalElement.querySelectorAll('input, textarea, select');
        const clonedInputs = clone.querySelectorAll('input, textarea, select');

        originalInputs.forEach((input: any, index) => {
            const clonedInput = clonedInputs[index] as any;
            if (!clonedInput) return;

            if (input.tagName === 'SELECT') {
                // Convert select to text for PDF clarity
                const selectedOption = input.options[input.selectedIndex];
                const span = document.createElement('span');
                span.innerText = selectedOption ? selectedOption.text : '';
                span.className = input.className; // Keep styles
                // Copy computed styles roughly
                span.style.display = 'inline-block';
                span.style.padding = '4px';
                if(input.parentNode) input.parentNode.replaceChild(span, input); // This assumes clone structure matches
                // Since we are iterating clone list based on original list index, 
                // modifying clone structure while iterating might desync if nested. 
                // Better approach for Select: set value.
                clonedInput.value = input.value;
            } else if (input.type === 'checkbox' || input.type === 'radio') {
                clonedInput.checked = input.checked;
                if(input.checked) clonedInput.setAttribute('checked', 'checked');
            } else {
                clonedInput.value = input.value;
                clonedInput.setAttribute('value', input.value);
            }
        });

        // Apply Print Specific Styles to Clone
        clone.style.width = `${width}px`;
        // clone.style.height = `${height}px`; // Let height grow if content is longer
        clone.style.margin = '0';
        clone.style.padding = '20px'; // Add some padding
        clone.style.transform = 'none'; // Remove any preview scaling
        clone.classList.add('printable-content'); // Ensure print styles apply

        // Force font and direction on all elements inside clone to prevent html2canvas RTL/font bugs
        clone.style.fontFamily = "'Vazirmatn', sans-serif";
        clone.style.direction = 'rtl';
        const allElements = clone.querySelectorAll('*');
        allElements.forEach((el: any) => {
            const currentFont = el.style.fontFamily || (window.getComputedStyle && window.getComputedStyle(el).fontFamily) || '';
            if (!currentFont.includes('monospace') && !el.classList.contains('font-mono') && !el.classList.contains('text-mono')) {
                el.style.fontFamily = "'Vazirmatn', sans-serif";
            }
            el.style.direction = 'rtl';
            
            // Fix text alignments inside tables specifically for RTL
            const style = window.getComputedStyle && window.getComputedStyle(el);
            if (style) {
                if (style.textAlign === 'left') {
                    el.style.textAlign = 'right'; // force alignment
                }
            }
        });

        container.appendChild(clone);
        document.body.appendChild(container);

        // 2. Generate Canvas
        // Wait a tick for DOM to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(clone, {
            scale: 2, // High resolution
            useCORS: true, // Allow cross-origin images (if backend serves them correctly)
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: width,
            width: width
        });

        // 3. Generate PDF
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: format
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // If content is taller than 1 page, add pages (Simple logic, usually invoices are 1 page)
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Only add a new page if the overflow is significant (> 12mm) to prevent trailing white space or empty pages
        while (heightLeft > 12) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

        const pdfBlob = pdf.output('blob');

        // Cleanup
        document.body.removeChild(container);
        
        if (returnBlob) {
            if (onComplete) onComplete();
            return pdfBlob;
        }

        if (Capacitor.isNativePlatform()) {
            await saveBlobAndOpenFile(pdfBlob, finalFilename);
        } else {
            try {
                pdf.save(finalFilename);
            } catch (saveErr) {
                // Fallback for strict browser contexts/iframes
                await saveBlobAndOpenFile(pdfBlob, finalFilename);
            }
        }

        if (onComplete) onComplete();
        return undefined;

    } catch (error: any) {
        console.error('Client-Side PDF Error:', error);
        alert('خطا در تولید PDF: ' + (error?.message || 'نامشخص'));
        if (onError) onError(error);
        return undefined;
    }
};
