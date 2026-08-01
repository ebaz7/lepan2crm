
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type PdfFormat = 'A4' | 'A5';
type PdfOrientation = 'portrait' | 'landscape';

export interface PdfOptions {
    elementId: string;
    filename: string;
    format?: PdfFormat;
    orientation?: PdfOrientation;
    onComplete?: () => void;
    onError?: (error: any) => void;
}

export const generatePdf = async ({
    elementId,
    filename,
    format = 'A4',
    orientation = 'portrait',
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

        pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

        // Cleanup
        document.body.removeChild(container);

        if (onComplete) onComplete();

    } catch (error: any) {
        console.error('Client-Side PDF Error:', error);
        alert('خطا در تولید PDF: ' + error.message);
        if (onError) onError(error);
    }
};
