import { ProposalData, EquipmentPosition, PricingItem, TechnicalParam } from '../types';

export interface AiParseFilePayload {
  name: string;
  mimeType: string;
  base64Data: string;
}

/**
 * Parses unstructured Russian text and uploaded multi-modal files (documents, images, audio)
 * into structured ProposalData using the backend Gemini API,
 * with an intelligent rule-based fallback if the API or key is unavailable.
 */
export async function parseProposalTextWithAI(
  rawText: string,
  files: AiParseFilePayload[] = [],
  existingData: ProposalData
): Promise<ProposalData> {
  const hasText = Boolean(rawText && rawText.trim());
  const hasFiles = Boolean(files && files.length > 0);

  if (!hasText && !hasFiles) {
    throw new Error('Пожалуйста, введите текст или прикрепите файлы для анализа');
  }

  try {
    const res = await fetch('/api/ai/parse-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText, files }),
    });

    if (res.ok) {
      const data = await res.json();
      return mergeParsedData(data, existingData);
    } else {
      const errJson = await res.json().catch(() => ({}));
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    }
  } catch (err: any) {
    console.warn('AI Server API error, falling back if text available:', err);
    if (!hasText) {
      throw err;
    }
  }

  // Fallback heuristic parser for raw text if server is offline
  return parseWithHeuristics(rawText, existingData);
}

/**
 * AI text polish for descriptions
 */
export async function polishTextWithAI(text: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const res = await fetch('/api/ai/improve-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result) return data.result;
    }
  } catch (e) {
    console.warn('AI polish error:', e);
  }
  return text.trim();
}

function mergeParsedData(aiData: any, base: ProposalData): ProposalData {
  const result: ProposalData = { ...base };

  if (aiData.proposalNumber) result.proposalNumber = aiData.proposalNumber;
  if (aiData.proposalDate) result.proposalDate = aiData.proposalDate;
  if (aiData.contactPhone) result.contactPhone = aiData.contactPhone;
  if (aiData.contactEmail) result.contactEmail = aiData.contactEmail;

  if (
    aiData.titlePrefixType &&
    ['Оборудование', 'Запасные части', 'Оборудование и запчасти'].includes(aiData.titlePrefixType)
  ) {
    result.titlePrefixType = aiData.titlePrefixType;
  }
  if (aiData.titleSuffix) result.titleSuffix = aiData.titleSuffix;

  if (
    aiData.introPrefixType &&
    ['Производство и поставка', 'Поставка'].includes(aiData.introPrefixType)
  ) {
    result.introPrefixType = aiData.introPrefixType;
  }
  if (aiData.introSuffix) result.introSuffix = aiData.introSuffix;
  if (aiData.introSentence) result.introSentence = aiData.introSentence;

  // Equipment positions
  if (Array.isArray(aiData.positions) && aiData.positions.length > 0) {
    result.positions = aiData.positions.map((pos: any, idx: number) => {
      const existingPos = base.positions[idx];
      const params: TechnicalParam[] = Array.isArray(pos.params)
        ? pos.params.map((p: any, pIdx: number) => ({
            id: `p-${Date.now()}-${pIdx}`,
            label: String(p.label || '').trim(),
            value: String(p.value || '').trim(),
          }))
        : existingPos?.params || [];

      return {
        id: existingPos?.id || `pos-${Date.now()}-${idx}`,
        subtitleSuffix: pos.subtitleSuffix || existingPos?.subtitleSuffix || 'Оборудование',
        descriptionHeader: pos.descriptionHeader || 'Назначение и описание оборудования:',
        descriptionBody: pos.descriptionBody || '',
        images: existingPos?.images || [],
        videoLink: existingPos?.videoLink || '',
        showVideoLink: existingPos?.showVideoLink || false,
        params: params.length > 0 ? params : (existingPos?.params || []),
      };
    });
  }

  // Pricing items
  if (Array.isArray(aiData.pricingItems) && aiData.pricingItems.length > 0) {
    result.pricingItems = aiData.pricingItems.map((item: any, idx: number) => ({
      id: `pr-${Date.now()}-${idx}`,
      name: String(item.name || '').trim(),
      quantity: String(item.quantity || '1').trim(),
      pricePerUnit: String(item.pricePerUnit || '').trim(),
      total: String(item.total || item.pricePerUnit || '').trim(),
    }));
  }

  if (aiData.pricingNotes) result.pricingNotes = aiData.pricingNotes;
  if (aiData.warranty) result.warranty = aiData.warranty;
  if (aiData.paymentTerms) result.paymentTerms = aiData.paymentTerms;
  if (aiData.pnrNote) result.pnrNote = aiData.pnrNote;
  if (aiData.deliveryDays) result.deliveryDays = aiData.deliveryDays;
  if (aiData.deliveryTerms) result.deliveryTerms = aiData.deliveryTerms;
  if (aiData.signatureName) result.signatureName = aiData.signatureName;
  if (aiData.signatureTitle) result.signatureTitle = aiData.signatureTitle;
  if (aiData.signatureManagerNote) result.signatureManagerNote = aiData.signatureManagerNote;
  if (aiData.signaturePhone) result.signaturePhone = aiData.signaturePhone;
  if (aiData.signatureEmail) result.signatureEmail = aiData.signatureEmail;

  return result;
}

/**
 * Intelligent rule-based parser that handles typical Russian proposals / emails
 */
function parseWithHeuristics(text: string, base: ProposalData): ProposalData {
  const result: ProposalData = { ...base };
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Proposal Number
  const numMatch = text.match(/(?:КП|предложени[ея]|счет|номер|№)\s*(?:№\s*)?([A-Za-zА-Яа-я0-9\-_/]+)/i);
  if (numMatch && numMatch[1]) {
    result.proposalNumber = numMatch[1].replace(/[/\\:*?"<>|]/g, '-');
  }

  // Date
  const dateMatch = text.match(/(?:от\s*)?(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  if (dateMatch && dateMatch[1]) {
    result.proposalDate = dateMatch[1].replace(/\//g, '.');
  }

  // Phone
  const phoneMatch = text.match(/(?:\+7|8)[\s(]?\d{3}[)\s]?\s*\d{3}[-\s]?\d{2}[-\s]?\d{2}/);
  if (phoneMatch) {
    result.contactPhone = phoneMatch[0];
  }

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.contactEmail = emailMatch[0];
  }

  // Technical parameters (lines matching "Param: Value" or "Param - Value" or "Param — Value")
  const extractedParams: TechnicalParam[] = [];
  const candidateLines: string[] = [];

  for (const line of lines) {
    const paramMatch = line.match(/^[-*•]?\s*([^:—–-]+?)[:—–-]\s*(.+)$/);
    if (paramMatch && paramMatch[1].length < 60 && paramMatch[2].length < 120) {
      extractedParams.push({
        id: `p-${Date.now()}-${extractedParams.length}`,
        label: paramMatch[1].trim(),
        value: paramMatch[2].trim(),
      });
    } else {
      candidateLines.push(line);
    }
  }

  if (candidateLines.length > 0) {
    const firstLine = candidateLines[0];
    if (firstLine.length < 80) {
      const cleanTitle = firstLine.replace(/^(Оборудование|КП|Линия|Автомат|Установка):\s*/i, '').replace(/^для\s+/i, '');
      result.titleSuffix = cleanTitle;
      result.introSuffix = cleanTitle;
      if (result.positions[0]) {
        result.positions[0].subtitleSuffix = firstLine.replace(/^(КП|Оборудование):\s*/i, '');
      }
    }
    const descriptionCandidates = candidateLines.filter(
      (l) => l.length > 40 && !l.toLowerCase().includes('гарантия') && !l.toLowerCase().includes('оплата')
    );
    if (descriptionCandidates.length > 0 && result.positions[0]) {
      result.positions[0].descriptionBody = descriptionCandidates.join(' ');
    }
  }

  if (extractedParams.length > 0 && result.positions[0]) {
    result.positions[0].params = extractedParams;
  }

  // Pricing lines (look for lines with numbers and rub/руб/р)
  const priceMatches = text.match(/(?:цена|стоимость|итого|сумма)?[^.\n]*?(\d[\d\s.,]{3,})\s*(?:руб|р\b|RUB)/gi);
  if (priceMatches && priceMatches.length > 0) {
    const items: PricingItem[] = [];
    priceMatches.slice(0, 4).forEach((pm, idx) => {
      const numOnly = pm.replace(/[^\d]/g, '');
      if (numOnly.length >= 4) {
        const formatted = Number(numOnly).toLocaleString('ru-RU');
        items.push({
          id: `pr-${Date.now()}-${idx}`,
          name: idx === 0 ? result.titleSuffix || 'Комплект оборудования' : `Дополнительная опция ${idx}`,
          quantity: '1',
          pricePerUnit: formatted,
          total: formatted,
        });
      }
    });
    if (items.length > 0) {
      result.pricingItems = items;
    }
  }

  // Warranty
  const warrantyMatch = text.match(/гарантия[:\s]+([^.\n]+)/i);
  if (warrantyMatch && warrantyMatch[1]) {
    result.warranty = warrantyMatch[1].trim();
  }

  // Payment terms
  const paymentMatch = text.match(/(?:оплата|условия оплаты)[:\s]+([^.\n]+)/i);
  if (paymentMatch && paymentMatch[1]) {
    result.paymentTerms = paymentMatch[1].trim();
  }

  // Delivery
  const deliveryMatch = text.match(/(?:срок поставки|поставка)[:\s]+([^.\n]+)/i);
  if (deliveryMatch && deliveryMatch[1]) {
    result.deliveryDays = deliveryMatch[1].trim();
  }

  return result;
}
