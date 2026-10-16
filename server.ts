import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// @ts-ignore
import mammoth from 'mammoth';

app.use(express.json({ limit: '100mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API endpoint for AI parsing of unstructured proposal text, documents, images, and audio
app.post('/api/ai/parse-proposal', async (req, res) => {
  try {
    const { text, files } = req.body;
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasFiles = Array.isArray(files) && files.length > 0;

    if (!hasText && !hasFiles) {
      return res.status(400).json({ error: 'Пожалуйста, введите текст или прикрепите файлы для анализа' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY не настроен на сервере' });
    }

    // Process uploaded files
    const inlineParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const extractedDocumentTexts: string[] = [];

    if (hasFiles) {
      for (const file of files) {
        if (!file.base64Data) continue;
        const mime = (file.mimeType || '').toLowerCase();
        const name = (file.name || '').toLowerCase();

        // 1. DOCX via mammoth
        if (name.endsWith('.docx') || mime.includes('wordprocessingml') || mime.includes('vnd.openxmlformats')) {
          try {
            const buf = Buffer.from(file.base64Data, 'base64');
            const result = await mammoth.extractRawText({ buffer: buf });
            if (result.value) {
              extractedDocumentTexts.push(`--- Содержимое документа Word (${file.name}):\n${result.value.trim()}\n`);
            }
          } catch (e) {
            console.warn('DOCX parse warning:', e);
          }
        }
        // 2. Text / CSV / RTF / JSON / MD
        else if (
          mime.startsWith('text/') ||
          name.endsWith('.txt') ||
          name.endsWith('.csv') ||
          name.endsWith('.rtf') ||
          name.endsWith('.md')
        ) {
          try {
            const textContent = Buffer.from(file.base64Data, 'base64').toString('utf-8');
            extractedDocumentTexts.push(`--- Содержимое текстового файла (${file.name}):\n${textContent.trim()}\n`);
          } catch (e) {
            console.warn('Text file read warning:', e);
          }
        }
        // 3. Audio (MP3, WAV, OGG, M4A, AAC, WEBM, FLAC)
        else if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|webm|amr|wma)$/i.test(name)) {
          let audioMime = 'audio/mp3';
          if (name.endsWith('.wav') || mime.includes('wav')) audioMime = 'audio/wav';
          else if (name.endsWith('.ogg') || mime.includes('ogg')) audioMime = 'audio/ogg';
          else if (name.endsWith('.m4a') || mime.includes('m4a') || mime.includes('x-m4a')) audioMime = 'audio/m4a';
          else if (name.endsWith('.aac') || mime.includes('aac')) audioMime = 'audio/aac';
          else if (name.endsWith('.flac') || mime.includes('flac')) audioMime = 'audio/flac';
          else if (name.endsWith('.webm') || mime.includes('webm')) audioMime = 'audio/webm';
          else if (mime.startsWith('audio/')) audioMime = mime;

          inlineParts.push({
            inlineData: {
              mimeType: audioMime,
              data: file.base64Data,
            },
          });
        }
        // 4. PDF
        else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
          inlineParts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: file.base64Data,
            },
          });
        }
        // 5. Images (JPEG, PNG, WEBP, GIF)
        else if (mime.startsWith('image/')) {
          let imgMime = 'image/jpeg';
          if (mime.includes('png') || name.endsWith('.png')) imgMime = 'image/png';
          else if (mime.includes('webp') || name.endsWith('.webp')) imgMime = 'image/webp';
          else if (mime.includes('gif') || name.endsWith('.gif')) imgMime = 'image/gif';

          inlineParts.push({
            inlineData: {
              mimeType: imgMime,
              data: file.base64Data,
            },
          });
        }
      }
    }

    // Build unified multi-modal text prompt
    let combinedPrompt = `Тщательно проанализируй все предоставленные материалы и извлеки структурированные данные для коммерческого предложения промышленного оборудования на русском языке.\n\n`;

    if (hasText) {
      combinedPrompt += `=== ТЕКСТ И ПОЖЕЛАНИЯ ИЗ ОКНА ВВОДА ===\n${text.trim()}\n\n`;
    }

    if (extractedDocumentTexts.length > 0) {
      combinedPrompt += `=== СОДЕРЖИМОЕ ЗАГРУЖЕННЫХ ДОКУМЕНТОВ ===\n${extractedDocumentTexts.join('\n')}\n\n`;
    }

    if (inlineParts.length > 0) {
      combinedPrompt += `К запросу также прикреплены медиафайлы (документы PDF, изображения оборудования, аудиозаписи с описанием и требованиями).
ВНИМАТЕЛЬНО ПРОСЛУШАЙ ВСЕ АУДИОЗАПИСИ: распознай речь, выдели озвученные параметры оборудования, производительность, тип продукта и тары, особенности конструкции, требования заказчика, цены, сроки и условия.
ВНИМАТЕЛЬНО ИЗУЧИ ВСЕ ДОКУМЕНТЫ И ИЗОБРАЖЕНИЯ: выдели технические характеристики, таблицы, схемы и спецификации.
Объедини всю информацию из текста, документов, изображений и аудиозаписей в единую согласованную структуру коммерческого предложения.`;
    }

    const contentsParts: any[] = [...inlineParts, { text: combinedPrompt }];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsParts,
      config: {
        systemInstruction: `Ты — эксперт по составлению коммерческих предложений промышленного оборудования и технических спецификаций (линии розлива, фасовки, укупорки, этикетирования, упаковочное оборудование, емкости и др.).
Твоя задача — извлечь данные из всех источников (аудио, изображения, документы, текст), объединить их и вернуть строго JSON по предоставленной схеме.
Все названия, параметры, условия и описания должны быть на русском языке.
В поле titleSuffix укажи точную фразу, характеризующую тип и основное назначение оборудования после предлога «для», например: «розлива и укупорки жидких продуктов в канистры 5 л».
В поле introSentence составь вежливое вводное деловое предложение, например: «Предлагаем Вашему вниманию коммерческое предложение на производство и поставку оборудования для розлива и укупорки жидких продуктов:»
Для описания каждой позиции (descriptionBody) сформируй связный структурированный текст из 2-3 логических абзацев, разделенных пустой строкой (\n\n): 1) назначение и тара, 2) конструкция и материалы, 3) автоматика и управление. Включи все технические детали, которые были упомянуты в аудиозаписях или документах!
Для цен обязательно указывай разделители тысяч пробелом, например "1 500 000".
Для технической таблицы извлеки четкие пары: параметр (label) и значение (value).
В поле pricingNotes укажи: "Все цены указаны в рублях без НДС.(предприятие-изготовитель не является плательщиком НДС). В стоимость включена заводская предпродажная подготовка и индивидуальное тестирование на образцах тары Заказчика." если нет иных указаний.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proposalNumber: { type: Type.STRING },
            proposalDate: { type: Type.STRING },
            contactPhone: { type: Type.STRING },
            contactEmail: { type: Type.STRING },
            titlePrefixType: {
              type: Type.STRING,
              description: 'Только "Оборудование", "Запасные части" или "Оборудование и запчасти"',
            },
            titleSuffix: {
              type: Type.STRING,
              description: 'Фраза, характеризующая назначение оборудования после предлога "для", например: "розлива и укупорки жидких продуктов"',
            },
            introPrefixType: {
              type: Type.STRING,
              description: 'Только "Производство и поставка" или "Поставка"',
            },
            introSuffix: { type: Type.STRING },
            introSentence: { type: Type.STRING },
            positions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  subtitleSuffix: { type: Type.STRING },
                  descriptionHeader: { type: Type.STRING },
                  descriptionBody: { type: Type.STRING },
                  params: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        value: { type: Type.STRING },
                      },
                      required: ['label', 'value'],
                    },
                  },
                },
                required: ['subtitleSuffix', 'descriptionBody'],
              },
            },
            pricingItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  pricePerUnit: { type: Type.STRING },
                  total: { type: Type.STRING },
                },
                required: ['name', 'quantity', 'pricePerUnit', 'total'],
              },
            },
            pricingNotes: { type: Type.STRING },
            warranty: { type: Type.STRING },
            paymentTerms: { type: Type.STRING },
            pnrNote: { type: Type.STRING },
            deliveryDays: { type: Type.STRING },
            deliveryTerms: { type: Type.STRING },
            signatureName: { type: Type.STRING },
            signatureTitle: { type: Type.STRING },
            signatureManagerNote: { type: Type.STRING },
            signaturePhone: { type: Type.STRING },
            signatureEmail: { type: Type.STRING },
          },
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/ai/parse-proposal:', error);
    return res.status(500).json({
      error: error?.message || 'Ошибка обработки данных искусственным интеллектом',
    });
  }
});

// API endpoint for text polishing / rewriting descriptions
app.post('/api/ai/improve-text', async (req, res) => {
  try {
    const { text, type } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Текст обязателен' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY не настроен' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Улучши и структурируй следующий текст описания промышленного оборудования для коммерческого предложения.
Обязательно разбей текст на 2-3 четких логических абзаца, разделенных пустой строкой (\n\n):
1. Назначение и технологическая применяемость оборудования.
2. Конструкция, материалы (нержавеющая сталь) и основные исполнительные узлы.
3. Система управления, датчики, автоматизация и безопасность.
Сохраняй техническую точность, солидный деловой стиль и ясность изложения:\n\n${text}`,
      config: {
        systemInstruction:
          'Ты — ведущий технический редактор коммерческих предложений. Верни структурированный по абзацам текст без вводных фраз и без кавычек.',
      },
    });

    return res.json({ result: response.text?.trim() });
  } catch (error: any) {
    console.error('Error in /api/ai/improve-text:', error);
    return res.status(500).json({ error: error?.message || 'Ошибка улучшения текста' });
  }
});

// Vite Middleware for Full-Stack dev mode
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR !== 'false';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }
app.get('*', (req, res) => {
  res.sendFile(process.cwd() + '/dist/index.html');
});
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
