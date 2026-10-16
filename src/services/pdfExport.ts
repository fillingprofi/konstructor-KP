import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ProposalData } from '../types';
import { sanitizeFilename } from '../utils/imageUtils';

export async function exportProposalToPdf(
  element: HTMLElement,
  data: ProposalData,
  onProgress?: (status: string) => void
): Promise<void> {
  if (!element) {
    throw new Error('Элемент для экспорта не найден');
  }

  onProgress?.('Подготовка документа к рендерингу...');

  // Save current scroll position and style adjustments
  const originalWidth = element.style.width;
  const originalTransform = element.style.transform;
  
  try {
    onProgress?.('Формирование графического слоя (A4)...');

    // Render with optimized scale = 1.5 to guarantee crisp text while keeping memory low
    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    onProgress?.('Нарезка на страницы A4...');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfPageWidth = 210;
    const pdfPageHeight = 297;

    const imgWidth = pdfPageWidth;
    const pageCanvasHeight = (canvas.width * pdfPageHeight) / pdfPageWidth;
    const totalHeight = canvas.height;

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < totalHeight) {
      if (pageIndex > 0) {
        pdf.addPage('a4', 'p');
      }

      // Height of current slice in canvas pixels
      const chunkHeight = Math.min(pageCanvasHeight, totalHeight - renderedHeight);

      // Create a temporary canvas for this page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageCanvasHeight;

      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvasHeight);

        pageCtx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          chunkHeight,
          0,
          0,
          canvas.width,
          chunkHeight
        );

        // Convert slice to compressed JPEG
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.88);
        pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, pdfPageHeight, undefined, 'FAST');
      }

      renderedHeight += pageCanvasHeight;
      pageIndex++;
    }

    onProgress?.('Сохранение файла...');

    const fileName = sanitizeFilename(
      `КП №${data.proposalNumber || 'бн'} дата ${data.proposalDate || ''} название ${data.titleSuffix || 'Оборудование'}.pdf`
    );

    // Direct browser blob download (avoids IPC/sandbox payload errors)
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

    onProgress?.('Готово!');
  } finally {
    element.style.width = originalWidth;
    element.style.transform = originalTransform;
  }
}

/**
 * Native Vector PDF / Print fallback
 */
export function printProposalDocument(): void {
  window.print();
}
