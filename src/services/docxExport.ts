import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
} from 'docx';
import { ProposalData, getProposalTitle, getIntroSentence } from '../types';
import { sanitizeFilename } from '../utils/imageUtils';
import { compactRussianTechnicalText } from '../utils/technicalAbbr';

export async function exportProposalToDocx(data: ProposalData): Promise<void> {
  try {
    const docChildren: (Paragraph | Table)[] = [];

    // Helper for converting base64 to Uint8Array
    const base64ToUint8Array = (base64String: string): Uint8Array => {
      const cleanBase64 = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    // Header Table (Logo on left, Contacts & Proposal # on right)
    const headerCells: TableCell[] = [];

    if (data.logo?.base64) {
      try {
        const logoBytes = base64ToUint8Array(data.logo.base64);
        const aspect = data.logo.width / (data.logo.height || 1);
        const displayWidth = Math.min(data.logoWidth || 200, 240);
        const displayHeight = Math.round(displayWidth / (aspect || 2));

        const imgType = data.logo.mimeType.includes('png') ? 'png' : 'jpg';

        headerCells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            margins: { top: 0, bottom: 60, left: 0, right: 60 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new ImageRun({
                    data: logoBytes,
                    transformation: {
                      width: displayWidth,
                      height: displayHeight,
                    },
                    type: imgType as any,
                  }),
                ],
              }),
            ],
          })
        );
      } catch (err) {
        console.warn('Error embedding logo into docx:', err);
        headerCells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ text: '' })],
          })
        );
      }
    } else {
      headerCells.push(
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [],
            }),
          ],
        })
      );
    }

    // Right header cell (Meta)
    headerCells.push(
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Коммерческое предложение № ${(data.proposalNumber || 'б/н').replace(/^№\s*/, '')}`,
                bold: true,
                font: 'Aptos Narrow',
                size: 24, // 12pt
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `от ${data.proposalDate || ''}`,
                font: 'Aptos Narrow',
                size: 22,
                color: '64748B',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Тел: ${data.contactPhone || ''}`,
                font: 'Aptos Narrow',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Email: ${data.contactEmail || ''}`,
                font: 'Aptos Narrow',
                size: 22,
              }),
            ],
          }),
        ],
      })
    );

    const headerBottomBorder = {
      style: BorderStyle.SINGLE,
      size: 6,
      color: 'CBD5E1',
    };

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: headerBottomBorder,
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({ children: headerCells })],
      })
    );

    docChildren.push(new Paragraph({ spacing: { after: 240 } }));

    // Main Document Heading (Arial Narrow 22pt)
    const mainHeading = getProposalTitle(data.titlePrefixType, data.titleSuffix);
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 140 },
        children: [
          new TextRun({
            text: mainHeading,
            bold: true,
            font: 'Arial Narrow',
            size: 44, // 22pt
            color: '0F172A',
          }),
        ],
      })
    );

    // Intro greeting
    const introSentence =
      data.introSentence?.trim() ||
      getIntroSentence(
        data.introPrefixType,
        data.titlePrefixType,
        data.titleSuffix
      );
    docChildren.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: introSentence,
            font: 'Aptos Narrow',
            size: 28, // 14pt
          }),
        ],
      })
    );

    // Equipment Positions
    for (let posIdx = 0; posIdx < data.positions.length; posIdx++) {
      const pos = data.positions[posIdx];

      // Position title (only if provided)
      if (pos.subtitleSuffix && pos.subtitleSuffix.trim()) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: `${posIdx + 1}. ${pos.subtitleSuffix}`,
                bold: true,
                font: 'Arial Narrow',
                size: 36, // 18pt
                color: '1E293B',
              }),
            ],
          })
        );
      }

      // Images Gallery
      if (pos.images && pos.images.length > 0) {
        const imageRuns: ImageRun[] = [];
        for (const img of pos.images) {
          try {
            const imgBytes = base64ToUint8Array(img.base64);
            const aspect = img.width / (img.height || 1);
            const targetW = 220;
            const targetH = Math.round(targetW / (aspect || 1.33));
            const photoType = img.mimeType.includes('png') ? 'png' : 'jpg';
            imageRuns.push(
              new ImageRun({
                data: imgBytes,
                transformation: {
                  width: targetW,
                  height: targetH,
                },
                type: photoType as any,
              })
            );
          } catch (e) {
            console.warn('Failed to embed position photo into docx:', e);
          }
        }
        if (imageRuns.length > 0) {
          docChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
              children: imageRuns,
            })
          );
        }
      }

      // Description Header & Body
      if (pos.descriptionHeader) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: pos.descriptionHeader,
                bold: true,
                font: 'Aptos Narrow',
                size: 28, // 14pt
              }),
            ],
          })
        );
      }

      if (pos.descriptionBody) {
        const paragraphs = pos.descriptionBody
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean);

        for (let i = 0; i < paragraphs.length; i++) {
          const para = paragraphs[i];
          const isLast = i === paragraphs.length - 1;
          const isBullet = /^[•\-\*]\s+/.test(para);

          if (isBullet) {
            const cleanText = para.replace(/^[•\-\*]\s+/, '');
            docChildren.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: cleanText,
                    font: 'Aptos Narrow',
                    size: 28, // 14pt
                  }),
                ],
              })
            );
          } else {
            docChildren.push(
              new Paragraph({
                spacing: { after: isLast ? 160 : 100 },
                children: [
                  new TextRun({
                    text: para,
                    font: 'Aptos Narrow',
                    size: 28, // 14pt
                  }),
                ],
              })
            );
          }
        }
      }

      // Video Link if enabled
      if (pos.showVideoLink && pos.videoLink) {
        docChildren.push(
          new Paragraph({
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: `Видео работы оборудования: ${pos.videoLink}`,
                font: 'Aptos Narrow',
                size: 26,
                color: '2563EB',
                underline: {},
              }),
            ],
          })
        );
      }

      // Technical Parameters Table (WYSIWYG: 70% width, 65% label / 35% value)
      if (pos.params && pos.params.length > 0) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 80 },
            children: [
              new TextRun({
                text: 'Технические параметры и характеристики:',
                bold: true,
                font: 'Aptos Narrow',
                size: 28, // 14pt
              }),
            ],
          })
        );

        // Preprocess labels and values with Russian technical abbreviation rules
        let maxLabelLen = 'Параметр'.length;
        let maxValueLen = 'Значение'.length;

        const preparedParams = pos.params.map((p) => {
          const cLabel = compactRussianTechnicalText(p.label, 42);
          const cValue = compactRussianTechnicalText(p.value, 30);
          if (cLabel.length > maxLabelLen) maxLabelLen = cLabel.length;
          if (cValue.length > maxValueLen) maxValueLen = cValue.length;
          return { label: cLabel, value: cValue };
        });

        // Calculate dynamic column proportions adapting to longest single-line text
        const totalChars = maxLabelLen + maxValueLen;
        const labelPct = Math.max(30, Math.min(75, Math.round((maxLabelLen / totalChars) * 100)));
        const valuePct = 100 - labelPct;
        const tableWidthPct = Math.max(50, Math.min(85, Math.round((totalChars / 55) * 70)));

        const tableBorder = {
          style: BorderStyle.SINGLE,
          size: 4,
          color: 'CBD5E1',
        };

        const tableRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: labelPct, type: WidthType.PERCENTAGE },
                shading: { fill: 'F1F5F9' },
                borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Параметр',
                        bold: true,
                        font: 'Aptos Narrow',
                        size: 28, // 14pt (bold)
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: valuePct, type: WidthType.PERCENTAGE },
                shading: { fill: 'F1F5F9' },
                borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Значение',
                        bold: true,
                        font: 'Aptos Narrow',
                        size: 28, // 14pt (bold)
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ];

        for (const param of preparedParams) {
          tableRows.push(
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: labelPct, type: WidthType.PERCENTAGE },
                  borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
                  margins: { top: 50, bottom: 50, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: param.label,
                          font: 'Aptos Narrow',
                          size: 28, // 14pt
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: valuePct, type: WidthType.PERCENTAGE },
                  borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
                  margins: { top: 50, bottom: 50, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: param.value,
                          bold: true,
                          font: 'Aptos Narrow',
                          size: 28, // 14pt
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          );
        }

        docChildren.push(
          new Table({
            width: { size: tableWidthPct, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: tableRows,
          })
        );

        docChildren.push(new Paragraph({ spacing: { after: 200 } }));
      }
    }

    // Pricing Section
    docChildren.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: 'Стоимость оборудования и условия оплаты',
            bold: true,
            font: 'Arial Narrow',
            size: 36, // 18pt
            color: '0F172A',
          }),
        ],
      })
    );

    const priceTableBorder = {
      style: BorderStyle.SINGLE,
      size: 4,
      color: 'CBD5E1',
    };

    const priceRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 70, bottom: 70, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '№', bold: true, font: 'Aptos Narrow', size: 26 })] })],
          }),
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: 'Наименование', bold: true, font: 'Aptos Narrow', size: 26 })] })],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 70, bottom: 70, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Кол-во', bold: true, font: 'Aptos Narrow', size: 26 })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 70, bottom: 70, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Цена, руб', bold: true, font: 'Aptos Narrow', size: 26 })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 70, bottom: 70, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Сумма, руб', bold: true, font: 'Aptos Narrow', size: 26 })] })],
          }),
        ],
      }),
    ];

    let calcTotal = 0;
    data.pricingItems.forEach((item, idx) => {
      const rawNum = parseFloat(item.total.replace(/\s+/g, '').replace(',', '.')) || 0;
      calcTotal += rawNum;

      priceRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
              margins: { top: 50, bottom: 50, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, font: 'Aptos Narrow', size: 26 })] })],
            }),
            new TableCell({
              borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: item.name, font: 'Aptos Narrow', size: 26 })] })],
            }),
            new TableCell({
              borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
              margins: { top: 50, bottom: 50, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.quantity, font: 'Aptos Narrow', size: 26 })] })],
            }),
            new TableCell({
              borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
              margins: { top: 50, bottom: 50, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: item.pricePerUnit, font: 'Aptos Narrow', size: 26 })] })],
            }),
            new TableCell({
              borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
              margins: { top: 50, bottom: 50, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: item.total, bold: true, font: 'Aptos Narrow', size: 26 })] })],
            }),
          ],
        })
      );
    });

    // Total Row
    priceRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            shading: { fill: 'F8FAFC' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'ИТОГО К ОПЛАТЕ:', bold: true, font: 'Aptos Narrow', size: 28 })],
              }),
            ],
          }),
          new TableCell({
            shading: { fill: 'F8FAFC' },
            borders: { top: priceTableBorder, bottom: priceTableBorder, left: priceTableBorder, right: priceTableBorder },
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${calcTotal.toLocaleString('ru-RU')} руб.`,
                    bold: true,
                    font: 'Aptos Narrow',
                    size: 28,
                    color: '1E3A8A',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: priceRows,
      })
    );

    if (data.pricingNotes) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 160 },
          children: [
            new TextRun({
              text: data.pricingNotes,
              italics: true,
              font: 'Aptos Narrow',
              size: 24,
              color: '475569',
            }),
          ],
        })
      );
    }

    // Terms & Conditions Block
    docChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: 'Условия поставки и гарантия:',
            bold: true,
            font: 'Arial Narrow',
            size: 32,
            color: '0F172A',
          }),
        ],
      })
    );

    if (data.warranty) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Гарантийные обязательства: ', bold: true, font: 'Aptos Narrow', size: 28 }),
            new TextRun({ text: data.warranty, font: 'Aptos Narrow', size: 28 }),
          ],
        })
      );
    }

    if (data.paymentTerms) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Условия оплаты: ', bold: true, font: 'Aptos Narrow', size: 28 }),
            new TextRun({ text: data.paymentTerms, font: 'Aptos Narrow', size: 28 }),
          ],
        })
      );
    }

    if (data.deliveryDays || data.deliveryTerms) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Сроки и условия поставки: ', bold: true, font: 'Aptos Narrow', size: 28 }),
            new TextRun({ text: `${data.deliveryDays ? `${data.deliveryDays}. ` : ''}${data.deliveryTerms || ''}`, font: 'Aptos Narrow', size: 28 }),
          ],
        })
      );
    }

    if (data.pnrNote) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [
            new TextRun({ text: 'Пусконаладочные работы: ', bold: true, font: 'Aptos Narrow', size: 28 }),
            new TextRun({ text: data.pnrNote, font: 'Aptos Narrow', size: 28 }),
          ],
        })
      );
    }

    // Signature Block (Avoid page break inside)
    docChildren.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({ text: 'С уважением,', font: 'Aptos Narrow', size: 28 }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: data.signatureName || '', bold: true, font: 'Aptos Narrow', size: 30 }),
        ],
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: data.signatureTitle || '', color: '475569', font: 'Aptos Narrow', size: 26 }),
        ],
      })
    );

    if (data.signatureManagerNote) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: data.signatureManagerNote, font: 'Aptos Narrow', size: 26, italics: true }),
          ],
        })
      );
    }

    if (data.signaturePhone || data.signatureEmail) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `Моб: ${data.signaturePhone || ''}   `, font: 'Aptos Narrow', size: 26 }),
            new TextRun({ text: `Email: ${data.signatureEmail || ''}`, font: 'Aptos Narrow', size: 26 }),
          ],
        })
      );
    }

    // Create Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 400,
                bottom: 1000,
                left: 1000,
                right: 1000,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = sanitizeFilename(
      `КП №${data.proposalNumber || 'бн'} дата ${data.proposalDate || ''} название ${data.titleSuffix || 'Оборудование'}.docx`
    );

    // Browser direct download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('DOCX Export error:', error);
    throw error;
  }
}
