/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  DollarSign,
  ShieldCheck,
  UserCheck,
  Building2,
  RefreshCw,
  Video,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileUp,
  Music,
  Mic,
  Square,
  RotateCcw,
  Volume2,
  FileSpreadsheet,
  X,
  Radio,
} from 'lucide-react';
import {
  ProposalData,
  EquipmentPosition,
  PricingItem,
  TechnicalParam,
  DEFAULT_PROPOSAL_DATA,
  createBlankProposalData,
  getProposalTitle,
  getIntroSentence,
  getEffectiveIntroSentence,
  getTargetWord,
  getCleanPurpose,
  generateProposalNumber,
  generateProposalDate,
} from './types';
import { FormInput, FormTextarea, FormSelect, Button, Card } from './components/UIPrimitives';
import { processImageFile, sanitizeFilename } from './utils/imageUtils';
import { exportProposalToDocx } from './services/docxExport';
import { exportProposalToPdf, printProposalDocument } from './services/pdfExport';
import { parseProposalTextWithAI, polishTextWithAI, AiParseFilePayload } from './services/aiParser';
import { compactRussianTechnicalText } from './utils/technicalAbbr';
import { REFERENCE_COMPANY_LOGO } from './utils/referenceLogo';

export interface UploadedImportFile {
  id: string;
  name: string;
  size: number;
  type: 'document' | 'image' | 'audio';
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
}

export default function App() {
  const [data, setData] = useState<ProposalData>(DEFAULT_PROPOSAL_DATA);
  const [activeTab, setActiveTab] = useState<
    'ai' | 'general' | 'positions' | 'pricing' | 'signature'
  >('ai');

  // AI Import State
  const [aiInputText, setAiInputText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Uploaded Multi-Modal Files (Documents, Images, Audios)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedImportFile[]>([]);
  const [uploadedAudios, setUploadedAudios] = useState<UploadedImportFile[]>([]);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Live microphone recording
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Reset confirmation modal state
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Export & preview states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Hidden file inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const positionPhotoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const previewSheetRef = useRef<HTMLDivElement>(null);

  // Calculate pricing total
  const calculatedTotal = useMemo(() => {
    return data.pricingItems.reduce((acc, item) => {
      const clean = item.total.replace(/\s+/g, '').replace(',', '.');
      const val = parseFloat(clean);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [data.pricingItems]);

  // Handlers for Data Updates
  const updateData = <K extends keyof ProposalData>(field: K, value: ProposalData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePosition = (
    posId: string,
    field: keyof EquipmentPosition,
    value: any
  ) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((p) => (p.id === posId ? { ...p, [field]: value } : p)),
    }));
  };

  const addPosition = () => {
    const newPos: EquipmentPosition = {
      id: `pos-${Date.now()}`,
      subtitleSuffix: '',
      descriptionHeader: '',
      descriptionBody: '',
      images: [],
      videoLink: '',
      showVideoLink: false,
      params: [],
    };
    setData((prev) => ({ ...prev, positions: [...prev.positions, newPos] }));
  };

  const removePosition = (posId: string) => {
    if (data.positions.length <= 1) {
      showToast('Документ должен содержать хотя бы одну позицию оборудования', 'info');
      return;
    }
    setData((prev) => ({
      ...prev,
      positions: prev.positions.filter((p) => p.id !== posId),
    }));
  };

  // Technical Parameters Ordering
  const moveParam = (posId: string, paramIdx: number, direction: 'up' | 'down') => {
    setData((prev) => {
      const pos = prev.positions.find((p) => p.id === posId);
      if (!pos) return prev;

      const newParams = [...pos.params];
      const targetIdx = direction === 'up' ? paramIdx - 1 : paramIdx + 1;
      if (targetIdx < 0 || targetIdx >= newParams.length) return prev;

      const temp = newParams[paramIdx];
      newParams[paramIdx] = newParams[targetIdx];
      newParams[targetIdx] = temp;

      return {
        ...prev,
        positions: prev.positions.map((p) => (p.id === posId ? { ...p, params: newParams } : p)),
      };
    });
  };

  const updateParam = (posId: string, paramId: string, field: 'label' | 'value', value: string) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((pos) => {
        if (pos.id !== posId) return pos;
        return {
          ...pos,
          params: pos.params.map((param) =>
            param.id === paramId ? { ...param, [field]: value } : param
          ),
        };
      }),
    }));
  };

  const addParam = (posId: string) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((pos) => {
        if (pos.id !== posId) return pos;
        return {
          ...pos,
          params: [
            ...pos.params,
            { id: `p-${Date.now()}`, label: 'Новый параметр', value: 'Значение' },
          ],
        };
      }),
    }));
  };

  const removeParam = (posId: string, paramId: string) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((pos) => {
        if (pos.id !== posId) return pos;
        return {
          ...pos,
          params: pos.params.filter((p) => p.id !== paramId),
        };
      }),
    }));
  };

  // File to base64 helper
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Upload handler for documents & images
  const handleDocFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: UploadedImportFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await readFileAsBase64(file);
        const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
        newDocs.push({
          id: `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: isImg ? 'image' : 'document',
          mimeType: file.type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
          base64Data: base64,
          previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        });
      } catch (err) {
        console.error('File read error:', err);
      }
    }
    setUploadedDocs((prev) => [...prev, ...newDocs]);
    showToast(`Загружено документов/фото: ${newDocs.length}`, 'success');
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  // Upload handler for audio files
  const handleAudioFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAudios: UploadedImportFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await readFileAsBase64(file);
        newAudios.push({
          id: `aud-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: 'audio',
          mimeType: file.type || 'audio/mp3',
          base64Data: base64,
          previewUrl: URL.createObjectURL(file),
        });
      } catch (err) {
        console.error('Audio file read error:', err);
      }
    }
    setUploadedAudios((prev) => [...prev, ...newAudios]);
    showToast(`Загружено звуковых файлов: ${newAudios.length}`, 'success');
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  // Microphone voice memo recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          const audioFile: UploadedImportFile = {
            id: `rec-${Date.now()}`,
            name: `Голосовая_заметка_${timeStr}.${mimeType.includes('webm') ? 'webm' : 'm4a'}`,
            size: audioBlob.size,
            type: 'audio',
            mimeType,
            base64Data: base64,
            previewUrl: URL.createObjectURL(audioBlob),
          };
          setUploadedAudios((prev) => [...prev, audioFile]);
          showToast('Голосовая запись успешно добавлена к анализу', 'success');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setIsRecordingMic(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      showToast('Не удалось получить доступ к микрофону: ' + (err?.message || 'проверьте разрешения'));
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMic(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const removeUploadedDoc = (id: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const removeUploadedAudio = (id: string) => {
    setUploadedAudios((prev) => prev.filter((a) => a.id !== id));
  };

  // Reset and clear all data action
  const handleResetAllData = () => {
    setAiInputText('');
    setUploadedDocs([]);
    setUploadedAudios([]);
    setAiStatus(null);
    setData(createBlankProposalData());
    setShowResetConfirmModal(false);
    showToast('Все данные, файлы и поля очищены. Создан новый бланк КП!', 'success');
  };

  // Image Upload Handlers (Directly from PC)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processImageFile(file, 800, 0.9);
      updateData('logo', processed);
    } catch (err: any) {
      showToast('Ошибка при загрузке логотипа: ' + (err?.message || 'Неверный формат'));
    }
  };

  const handlePositionPhotosUpload = async (
    posId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newImages = await Promise.all(
        Array.from(files).map((f) => processImageFile(f, 1200, 0.85))
      );
      setData((prev) => ({
        ...prev,
        positions: prev.positions.map((p) => {
          if (p.id !== posId) return p;
          return {
            ...p,
            images: [...p.images, ...newImages],
          };
        }),
      }));
    } catch (err: any) {
      showToast('Ошибка загрузки фотографий: ' + (err?.message || 'Неверный формат'));
    }
  };

  const removePositionPhoto = (posId: string, photoId: string) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((p) => {
        if (p.id !== posId) return p;
        return {
          ...p,
          images: p.images.filter((img) => img.id !== photoId),
        };
      }),
    }));
  };

  // Pricing Handlers
  const updatePricingItem = (id: string, field: keyof PricingItem, value: string) => {
    setData((prev) => {
      const newItems = prev.pricingItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Auto calculate total if quantity or price changed
        if (field === 'pricePerUnit' || field === 'quantity') {
          const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 1;
          const cleanPrice = parseFloat(
            (field === 'pricePerUnit' ? value : updated.pricePerUnit)
              .replace(/\s+/g, '')
              .replace(',', '.')
          );
          if (!isNaN(cleanPrice)) {
            updated.total = Math.round(qty * cleanPrice).toLocaleString('ru-RU');
          }
        }
        return updated;
      });
      return { ...prev, pricingItems: newItems };
    });
  };

  const addPricingItem = () => {
    setData((prev) => ({
      ...prev,
      pricingItems: [
        ...prev.pricingItems,
        {
          id: `pr-${Date.now()}`,
          name: '',
          quantity: '1',
          pricePerUnit: '',
          total: '',
        },
      ],
    }));
  };

  const removePricingItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      pricingItems: prev.pricingItems.filter((i) => i.id !== id),
    }));
  };

  const movePricingItem = (idx: number, direction: 'up' | 'down') => {
    setData((prev) => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.pricingItems.length) return prev;
      const newItems = [...prev.pricingItems];
      const temp = newItems[idx];
      newItems[idx] = newItems[targetIdx];
      newItems[targetIdx] = temp;
      return { ...prev, pricingItems: newItems };
    });
  };

  const duplicatePricingItem = (idx: number) => {
    setData((prev) => {
      const itemToClone = prev.pricingItems[idx];
      if (!itemToClone) return prev;
      const cloned: PricingItem = {
        ...itemToClone,
        id: `pr-${Date.now()}`,
        name: itemToClone.name ? `${itemToClone.name} (копия)` : 'Позиция (копия)',
      };
      const newItems = [...prev.pricingItems];
      newItems.splice(idx + 1, 0, cloned);
      return { ...prev, pricingItems: newItems };
    });
    showToast('Позиция спецификации продублирована', 'success');
  };

  const importPositionsToPricing = () => {
    const validPositions = data.positions.filter((p) => p.subtitleSuffix && p.subtitleSuffix.trim());
    if (validPositions.length === 0) {
      showToast('Нет позиций оборудования с заполненным наименованием', 'info');
      return;
    }
    const newItems: PricingItem[] = validPositions.map((p, idx) => ({
      id: `pr-${Date.now()}-${idx}`,
      name: p.subtitleSuffix,
      quantity: '1',
      pricePerUnit: '',
      total: '',
    }));
    setData((prev) => ({
      ...prev,
      pricingItems: [...prev.pricingItems, ...newItems],
    }));
    showToast(`Импортировано позиций в спецификацию: ${validPositions.length}`, 'success');
  };

  // Full Reset & Clean-up for generating a new proposal from scratch
  const handleResetAll = () => {
    setData(createBlankProposalData());
    setAiInputText('');
    setUploadedDocs([]);
    setUploadedAudios([]);
    setAiStatus(null);
    setShowResetConfirmModal(false);
    showToast('Вся информация сброшена. Готово к созданию нового документа', 'info');
  };

  // AI Parser Action: Combines text, uploaded documents, images, and audios
  const handleAiParse = async () => {
    const filesPayload: AiParseFilePayload[] = [
      ...uploadedDocs.map((d) => ({
        name: d.name,
        mimeType: d.mimeType,
        base64Data: d.base64Data,
      })),
      ...uploadedAudios.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        base64Data: a.base64Data,
      })),
    ];

    const hasText = Boolean(aiInputText.trim());
    const hasFiles = filesPayload.length > 0;

    if (!hasText && !hasFiles) {
      setAiStatus({
        type: 'error',
        message: 'Пожалуйста, введите текст или прикрепите документы, изображения или звуковые файлы для анализа.',
      });
      return;
    }

    setIsAiParsing(true);
    setAiStatus(null);
    try {
      const updated = await parseProposalTextWithAI(aiInputText, filesPayload, data);
      setData(updated);
      setAiStatus({
        type: 'success',
        message: `Данные успешно объединены и проанализированы! Извлечено позиций: ${updated.positions.length}, строк спецификации: ${updated.pricingItems.length}. Вся информация распределена по КП.`,
      });
      showToast('Коммерческое предложение успешно обновлено ИИ!', 'success');
    } catch (err: any) {
      console.error(err);
      setAiStatus({
        type: 'error',
        message: err?.message || 'Не удалось распознать данные. Попробуйте еще раз.',
      });
      showToast('Ошибка распознавания: ' + (err?.message || 'Попробуйте снова'));
    } finally {
      setIsAiParsing(false);
    }
  };

  // AI Polish Single Description
  const handlePolishDescription = async (posId: string, currentText: string) => {
    if (!currentText.trim()) return;
    try {
      const improved = await polishTextWithAI(currentText);
      updatePosition(posId, 'descriptionBody', improved);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto split continuous text into structured paragraphs
  const handleAutoParagraphs = (posId: string, text: string) => {
    if (!text.trim()) return;
    const clean = text.trim();
    if (clean.includes('\n\n')) {
      return;
    }
    // If it has single newlines, turn them into paragraph breaks
    if (clean.includes('\n')) {
      const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
      updatePosition(posId, 'descriptionBody', lines.join('\n\n'));
      return;
    }
    // Group sentences into 2-3 logical paragraphs
    const sentences = clean
      .split(/(?<=[.?!])\s+(?=[А-ЯA-Z0-9«"])/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length <= 1) return;

    const chunkSize = Math.max(1, Math.ceil(sentences.length / 3));
    const paras: string[] = [];
    for (let i = 0; i < sentences.length; i += chunkSize) {
      paras.push(sentences.slice(i, i + chunkSize).join(' '));
    }
    updatePosition(posId, 'descriptionBody', paras.join('\n\n'));
  };

  // Extract purpose phrase from equipment description
  const extractPurposeFromDescription = () => {
    const desc = data.positions[0]?.descriptionBody || '';
    if (!desc) return;
    const match = desc.match(/предназначен[а-я]*\s+для\s+([^.]+)/i);
    if (match && match[1]) {
      const extracted = match[1].trim().replace(/^для\s+/i, '');
      updateData('titleSuffix', extracted);
      updateData('introSuffix', extracted);
      showToast('Назначение успешно извлечено из описания!', 'success');
    } else {
      const fallback = data.positions[0]?.subtitleSuffix?.toLowerCase() || '';
      if (fallback) {
        updateData('titleSuffix', fallback);
        updateData('introSuffix', fallback);
        showToast('Подставлено наименование позиции оборудования', 'info');
      }
    }
  };

  // Compact parameters using Russian technical abbreviation rules
  const handleCompactParams = (posId: string) => {
    setData((prev) => ({
      ...prev,
      positions: prev.positions.map((pos) => {
        if (pos.id !== posId) return pos;
        return {
          ...pos,
          params: pos.params.map((p) => ({
            ...p,
            label: compactRussianTechnicalText(p.label, 42),
            value: compactRussianTechnicalText(p.value, 30),
          })),
        };
      }),
    }));
    showToast('Параметры сокращены по правилам русского языка (ГОСТ)', 'success');
  };

  // Export handlers
  const handlePdfExport = async () => {
    if (!previewSheetRef.current) return;
    setIsExportingPdf(true);
    setExportProgress('Формирование PDF...');
    try {
      await exportProposalToPdf(previewSheetRef.current, data, (status) =>
        setExportProgress(status)
      );
    } catch (error: any) {
      console.error(error);
      showToast('Ошибка экспорта в PDF: ' + (error?.message || 'Попробуйте нажать Печать'));
    } finally {
      setIsExportingPdf(false);
      setExportProgress('');
    }
  };

  const handleDocxExport = async () => {
    setIsExportingDocx(true);
    try {
      await exportProposalToDocx(data);
    } catch (error: any) {
      console.error(error);
      showToast('Ошибка экспорта в DOCX: ' + (error?.message || 'Сбой сборки документа'));
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Header Bar */}
      <header className="no-print bg-white border-b border-slate-200/90 px-4 py-2.5 sticky top-0 z-40 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Конструктор КП v2
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                PRO WYSIWYG
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">
              КП №{data.proposalNumber || 'б/н'} от {data.proposalDate} • {data.titleSuffix}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Printer}
            onClick={printProposalDocument}
            title="Печать или нативный экспорт в PDF"
          >
            Печать
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Download}
            loading={isExportingDocx}
            onClick={handleDocxExport}
            className="text-blue-700 border-blue-200 hover:bg-blue-50"
            title="Скачать документ в формате Microsoft Word (.docx)"
          >
            DOCX Экспорт
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Download}
            loading={isExportingPdf}
            onClick={handlePdfExport}
            className="shadow-xs bg-blue-600 hover:bg-blue-700"
            title="Скачать точную копию в формате PDF"
          >
            {exportProgress || 'PDF Экспорт'}
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Control & Configuration Panel */}
        <div className="no-print w-full md:w-[480px] lg:w-[540px] xl:w-[580px] border-r border-slate-200 bg-white flex flex-col shrink-0 h-[calc(100vh-53px)] overflow-hidden shadow-xs">
          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-1.5 flex gap-1 overflow-x-auto text-xs shrink-0">
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              AI Импорт
            </button>

            <button
              onClick={() => setActiveTab('general')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Шапка & Лого
            </button>

            <button
              onClick={() => setActiveTab('positions')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'positions'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Позиции ({data.positions.length})
            </button>

            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Цены & Условия
            </button>

            <button
              onClick={() => setActiveTab('signature')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'signature'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Подпись
            </button>
          </div>

          {/* Tab Content Panel (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* TAB: AI IMPORT */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <Card
                  title="AI Мультимодальный импорт"
                  subtitle="Объединение текста, документов, фото и аудиозаписей в единое КП"
                  icon={Sparkles}
                  action={
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={RotateCcw}
                      onClick={() => setShowResetConfirmModal(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px]"
                      title="Сбросить все загруженные файлы и очистить КП"
                    >
                      Сброс и очистка
                    </Button>
                  }
                >
                  <div className="space-y-4">
                    {/* Hidden File Pickers */}
                    <input
                      type="file"
                      ref={docFileInputRef}
                      accept="image/*,application/pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx"
                      multiple
                      onChange={handleDocFilesSelect}
                      className="hidden"
                    />
                    <input
                      type="file"
                      ref={audioFileInputRef}
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm,.flac,.amr,.wma"
                      multiple
                      onChange={handleAudioFilesSelect}
                      className="hidden"
                    />

                    {/* Section 1: Upload Buttons Bar */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span>Загрузка файлов для распознавания</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          Документы, фото и аудио объединяются
                        </span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Button 1: Any Documents & Images */}
                        <button
                          type="button"
                          onClick={() => docFileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-blue-800 text-xs font-medium transition-colors cursor-pointer text-left shadow-2xs"
                        >
                          <FileUp className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-blue-900 leading-tight truncate">
                              Документы и фото
                            </div>
                            <div className="text-[10px] text-blue-600 truncate">
                              PDF, DOCX, TXT, CSV, JPG, PNG
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        </button>

                        {/* Button 2: Audio Files */}
                        <button
                          type="button"
                          onClick={() => audioFileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-800 text-xs font-medium transition-colors cursor-pointer text-left shadow-2xs"
                        >
                          <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-emerald-900 leading-tight truncate">
                              Звуковые файлы
                            </div>
                            <div className="text-[10px] text-emerald-600 truncate">
                              MP3, WAV, OGG, M4A, AAC, WEBM
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        </button>
                      </div>

                      {/* Bonus Live Mic Recording Feature */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Mic className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[11px]">
                            {isRecordingMic ? (
                              <span className="text-rose-700 font-semibold animate-pulse">
                                Идет запись голоса ({recordDuration} сек)... Нажмите «Стоп»
                              </span>
                            ) : (
                              'Можно надиктовать требования к оборудованию прямо в микрофон:'
                            )}
                          </span>
                        </div>
                        {isRecordingMic ? (
                          <Button
                            variant="danger"
                            size="xs"
                            icon={Square}
                            onClick={stopVoiceRecording}
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                          >
                            Стоп ({recordDuration}с)
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Mic}
                            onClick={startVoiceRecording}
                            className="text-rose-700 border-rose-200 hover:bg-rose-50"
                          >
                            Начать запись
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Section 2: List of Attached Documents & Images */}
                    {uploadedDocs.length > 0 && (
                      <div className="space-y-1.5 p-2.5 bg-blue-50/40 rounded-lg border border-blue-100">
                        <div className="flex justify-between items-center text-[11px] font-semibold text-blue-900">
                          <span>Прикрепленные документы и изображения ({uploadedDocs.length}):</span>
                          <button
                            type="button"
                            onClick={() => setUploadedDocs([])}
                            className="text-slate-400 hover:text-red-600 text-[10px] cursor-pointer"
                          >
                            Очистить список
                          </button>
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {uploadedDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-blue-100 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {doc.type === 'image' ? (
                                  doc.previewUrl ? (
                                    <img
                                      src={doc.previewUrl}
                                      alt={doc.name}
                                      className="w-6 h-6 object-cover rounded shrink-0 border border-slate-200"
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                                  )
                                ) : (
                                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                )}
                                <span className="font-medium text-slate-800 truncate" title={doc.name}>
                                  {doc.name}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({(doc.size / 1024).toFixed(0)} КБ)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeUploadedDoc(doc.id)}
                                className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                                title="Удалить файл"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 3: List of Attached Audio Files */}
                    {uploadedAudios.length > 0 && (
                      <div className="space-y-1.5 p-2.5 bg-emerald-50/40 rounded-lg border border-emerald-100">
                        <div className="flex justify-between items-center text-[11px] font-semibold text-emerald-900">
                          <span>Прикрепленные звуковые файлы и голосовые заметки ({uploadedAudios.length}):</span>
                          <button
                            type="button"
                            onClick={() => setUploadedAudios([])}
                            className="text-slate-400 hover:text-red-600 text-[10px] cursor-pointer"
                          >
                            Очистить список
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {uploadedAudios.map((aud) => (
                            <div
                              key={aud.id}
                              className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-emerald-100 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-800 truncate" title={aud.name}>
                                    {aud.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {(aud.size / 1024).toFixed(0)} КБ
                                  </div>
                                </div>
                              </div>
                              {aud.previewUrl && (
                                <audio
                                  controls
                                  src={aud.previewUrl}
                                  className="h-6 w-36 max-w-full"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeUploadedAudio(aud.id)}
                                className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer shrink-0"
                                title="Удалить аудиозапись"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Manual Textarea */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-800">
                          Текстовое описание и требования:
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setAiInputText(
                              `Линия розлива и укупорки жидких удобрений в канистры 5 л.
Производительность: до 800 шт/ч
Давление воздуха: 0.6 МПа
Мощность: 5.5 кВт
Материал: сталь AISI 304
Стоимость оборудования: 2 150 000 руб.
Срок поставки: 45 дней.
Гарантия: 12 месяцев. Предоплата 50%...`
                            )
                          }
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[11px]"
                        >
                          Вставить пример
                        </Button>
                      </div>

                      <FormTextarea
                        rows={4}
                        placeholder="Вставьте текст письма, ТЗ, переписку или примечания к заказу..."
                        value={aiInputText}
                        onChange={(e) => setAiInputText(e.target.value)}
                      />
                    </div>

                    {/* Unified Execution Button */}
                    <div className="space-y-2 pt-1">
                      <Button
                        variant="primary"
                        size="md"
                        icon={Sparkles}
                        loading={isAiParsing}
                        onClick={handleAiParse}
                        className="w-full bg-blue-600 hover:bg-blue-700 font-semibold py-2.5 shadow-sm"
                      >
                        {isAiParsing
                          ? 'Объединяю и анализирую файлы, аудио и текст...'
                          : 'Распознать и заполнить КП (объединить всё)'}
                      </Button>

                      <p className="text-[11px] text-slate-500 text-center leading-tight">
                        Информация из загруженных документов, изображений, звуковых файлов и окна ввода текста
                        объединяется и анализируется нейросетью вместе.
                      </p>
                    </div>

                    {/* Reset Button */}
                    <div className="pt-2 border-t border-slate-200">
                      <Button
                        variant="outline"
                        size="xs"
                        icon={RotateCcw}
                        onClick={() => setShowResetConfirmModal(true)}
                        className="w-full text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50"
                      >
                        Очистить всё и создать новый документ
                      </Button>
                    </div>

                    {aiStatus && (
                      <div
                        className={`p-3 rounded-lg flex items-start gap-2.5 text-xs ${
                          aiStatus.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {aiStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <p>{aiStatus.message}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Quick Info Box */}
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    Мультимодальная обработка данных:
                  </p>
                  <p className="text-blue-700/90 text-[11px] leading-relaxed">
                    Поддерживаются любые файлы: спецификации в Word (.docx) и PDF, фото оборудования, аудиосообщения
                    и голосовые заметки заказчика. ИИ автоматически собирает параметры, описание и цены.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: GENERAL / HEADER */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <Card title="Реквизиты и метаданные КП" icon={Building2}>
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput
                      label="Номер КП"
                      value={data.proposalNumber}
                      onChange={(e) => updateData('proposalNumber', e.target.value)}
                    />
                    <FormInput
                      label="Дата предложения"
                      value={data.proposalDate}
                      onChange={(e) => updateData('proposalDate', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <FormInput
                      label="Телефон контакта"
                      value={data.contactPhone}
                      onChange={(e) => updateData('contactPhone', e.target.value)}
                    />
                    <FormInput
                      label="Email контакта"
                      value={data.contactEmail}
                      onChange={(e) => updateData('contactEmail', e.target.value)}
                    />
                  </div>
                </Card>

                <Card title="Логотип компании" icon={ImageIcon}>
                  <div className="space-y-3">
                    {/* Hidden input to pick image directly from PC */}
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />

                    {data.logo ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="p-1.5 bg-white rounded border border-slate-200 shrink-0">
                            <img
                              src={`data:${data.logo.mimeType};base64,${data.logo.base64}`}
                              alt="Логотип компании"
                              style={{ width: `${Math.min(data.logoWidth || 180, 160)}px` }}
                              className="max-h-16 object-contain"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-800">
                                {data.logo.id === REFERENCE_COMPANY_LOGO.id
                                  ? 'Логотип по умолчанию (из референса)'
                                  : 'Пользовательский логотип'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {data.logoWidth}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="100"
                              max="320"
                              step="10"
                              value={data.logoWidth}
                              onChange={(e) => updateData('logoWidth', Number(e.target.value))}
                              className="w-full accent-blue-600"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="primary"
                            size="xs"
                            icon={Upload}
                            onClick={() => logoInputRef.current?.click()}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Загрузить новый лого с ПК
                          </Button>

                          {data.logo.id !== REFERENCE_COMPANY_LOGO.id && (
                            <Button
                              variant="outline"
                              size="xs"
                              icon={RefreshCw}
                              onClick={() => {
                                updateData('logo', REFERENCE_COMPANY_LOGO);
                                showToast('Восстановлен логотип из референса', 'success');
                              }}
                            >
                              Вернуть из референса
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                            onClick={() => updateData('logo', undefined)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-lg space-y-2">
                        <p className="text-xs text-slate-500 font-medium">Логотип не выбран (по умолчанию место для логотипа в шапке остается пустым)</p>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Upload}
                            onClick={() => logoInputRef.current?.click()}
                          >
                            Загрузить лого с ПК
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={RefreshCw}
                            onClick={() => {
                              updateData('logo', REFERENCE_COMPANY_LOGO);
                              showToast('Установлен референсный логотип Filling Profi', 'info');
                            }}
                          >
                            Вставить демо-логотип
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Заголовки и вводная часть">
                  <div className="space-y-3">
                    <FormSelect
                      label="Тип заголовка"
                      hint="подставит: оборудования / комплектующих / оборудования и комплектующих"
                      value={data.titlePrefixType}
                      options={[
                        { value: 'Оборудование', label: 'Оборудование (подставит: «оборудования»)' },
                        { value: 'Запасные части', label: 'Запасные части (подставит: «комплектующих»)' },
                        { value: 'Оборудование и запчасти', label: 'Оборудование и запчасти (подставит: «оборудования и комплектующих»)' },
                      ]}
                      onChange={(e) => updateData('titlePrefixType', e.target.value as any)}
                    />

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          Назначение оборудования (фраза после «для»)
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={extractPurposeFromDescription}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[11px]"
                          title="Автоматически взять назначение из описания позиции"
                        >
                          Взять из описания
                        </Button>
                      </div>
                      <FormInput
                        placeholder="розлива и укупорки жидких продуктов..."
                        value={data.titleSuffix}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateData('titleSuffix', val);
                          updateData('introSuffix', val);
                        }}
                      />
                    </div>

                    <FormSelect
                      label="Вводный префикс предложения"
                      hint="подставит: производство и поставку / поставку"
                      value={data.introPrefixType}
                      options={[
                        { value: 'Производство и поставка', label: 'Производство и поставка (подставит: «производство и поставку»)' },
                        { value: 'Поставка', label: 'Поставка (подставит: «поставку»)' },
                      ]}
                      onChange={(e) => updateData('introPrefixType', e.target.value as any)}
                    />

                    {/* Editable Introductory Sentence */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          Вводное предложение (редактируемый текст в КП)
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const gen = getIntroSentence(data.introPrefixType, data.titlePrefixType, data.titleSuffix);
                            updateData('introSentence', gen);
                            showToast('Вводное предложение сгенерировано по шаблону', 'info');
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[11px]"
                          title="Сгенерировать предложение автоматически на основе настроек выше"
                        >
                          Сгенерировать по шаблону
                        </Button>
                      </div>
                      <FormTextarea
                        rows={2}
                        placeholder="Предлагаем Вашему вниманию коммерческое предложение на..."
                        value={data.introSentence ?? getIntroSentence(data.introPrefixType, data.titlePrefixType, data.titleSuffix)}
                        onChange={(e) => updateData('introSentence', e.target.value)}
                      />
                    </div>

                    {/* Dynamic Preview Box of Title & Intro */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2 text-slate-700">
                      <div>
                        <div className="font-semibold text-slate-600 text-[11px] uppercase tracking-wider">
                          Заголовок документа:
                        </div>
                        <div className="font-bold text-blue-900 mt-0.5 leading-snug">
                          {getProposalTitle(data.titlePrefixType, data.titleSuffix)}
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200/80">
                        <div className="font-semibold text-slate-600 text-[11px] uppercase tracking-wider">
                          Вводное предложение в документе:
                        </div>
                        <div className="text-slate-800 mt-0.5 leading-snug">
                          {getEffectiveIntroSentence(data)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB: POSITIONS */}
            {activeTab === 'positions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Позиции оборудования ({data.positions.length})
                  </span>
                  <Button variant="primary" size="xs" icon={Plus} onClick={addPosition}>
                    Добавить позицию
                  </Button>
                </div>

                {data.positions.map((pos, posIdx) => (
                  <Card
                    key={pos.id}
                    title={`${posIdx + 1}. ${pos.subtitleSuffix || 'Новая позиция'}`}
                    action={
                      data.positions.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removePosition(pos.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : undefined
                    }
                  >
                    <div className="space-y-3">
                      <FormInput
                        label="Подзаголовок позиции"
                        placeholder="Например: Автоматический моноблок розлива и укупорки"
                        value={pos.subtitleSuffix}
                        onChange={(e) => updatePosition(pos.id, 'subtitleSuffix', e.target.value)}
                      />

                      {/* Photos of position directly from PC */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-medium text-slate-700">
                            Фотографии оборудования
                          </label>
                          <input
                            type="file"
                            ref={(el) => {
                              positionPhotoInputRefs.current[pos.id] = el;
                            }}
                            accept="image/*"
                            multiple
                            onChange={(e) => handlePositionPhotosUpload(pos.id, e)}
                            className="hidden"
                          />
                          <Button
                            variant="outline"
                            size="xs"
                            icon={Upload}
                            onClick={() => positionPhotoInputRefs.current[pos.id]?.click()}
                          >
                            Выбрать фото с ПК
                          </Button>
                        </div>

                        {pos.images.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            {pos.images.map((img) => (
                              <div key={img.id} className="relative group rounded-md overflow-hidden bg-white border border-slate-200">
                                <img
                                  src={`data:${img.mimeType};base64,${img.base64}`}
                                  alt="Фото"
                                  className="w-full h-16 object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removePositionPhoto(pos.id, img.id)}
                                  className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-700 text-white p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Description Header and Body with AI Polish button */}
                      <FormInput
                        label="Заголовок описания"
                        placeholder="Например: Назначение и описание оборудования:"
                        value={pos.descriptionHeader}
                        onChange={(e) =>
                          updatePosition(pos.id, 'descriptionHeader', e.target.value)
                        }
                      />

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-slate-700">
                            Текст описания (по абзацам)
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleAutoParagraphs(pos.id, pos.descriptionBody)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[11px]"
                              title="Разбить сплошной текст на отдельные абзацы"
                            >
                              Разбить на абзацы
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={Sparkles}
                              onClick={() => handlePolishDescription(pos.id, pos.descriptionBody)}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-[11px]"
                              title="Улучшить текст и структурировать по абзацам с помощью ИИ"
                            >
                              AI корректура
                            </Button>
                          </div>
                        </div>
                        <FormTextarea
                          rows={6}
                          placeholder="Абзац 1: Назначение оборудования и тара...&#10;&#10;Абзац 2: Конструкция и материалы (сталь AISI 304)...&#10;&#10;Абзац 3: Автоматика и система управления..."
                          hint="Разделяйте абзацы пустой строкой (Enter)"
                          value={pos.descriptionBody}
                          onChange={(e) =>
                            updatePosition(pos.id, 'descriptionBody', e.target.value)
                          }
                        />
                      </div>

                      {/* Video Link */}
                      <div className="pt-1 border-t border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pos.showVideoLink}
                            onChange={(e) =>
                              updatePosition(pos.id, 'showVideoLink', e.target.checked)
                            }
                            className="rounded text-blue-600"
                          />
                          <span>Отображать ссылку на видео</span>
                        </label>
                        {pos.showVideoLink && (
                          <div className="mt-2">
                            <FormInput
                              placeholder="https://..."
                              value={pos.videoLink}
                              onChange={(e) => updatePosition(pos.id, 'videoLink', e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Technical Parameters with Row Movement */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-xs font-semibold text-slate-800">
                              Технические параметры (по центру)
                            </span>
                            <p className="text-[10px] text-slate-400">
                              Стрелки ↑ ↓ для сортировки • Авто-ширина строк
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleCompactParams(pos.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[11px]"
                              title="Сократить длинные термины и единицы измерения по правилам русского языка"
                            >
                              Сократить по ГОСТ
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Plus}
                              onClick={() => addParam(pos.id)}
                            >
                              Параметр
                            </Button>
                          </div>
                        </div>

                        {pos.params.length === 0 ? (
                          <div className="p-3 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                            Технические параметры пока не добавлены. Нажмите «+ Параметр» для добавления строки.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {pos.params.map((param, pIdx) => (
                              <div
                                key={param.id}
                                className="flex items-center gap-1.5 p-1 bg-slate-50/80 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
                              >
                                {/* Reorder Buttons */}
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={pIdx === 0}
                                    onClick={() => moveParam(pos.id, pIdx, 'up')}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                                    title="Переместить вверх"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pIdx === pos.params.length - 1}
                                    onClick={() => moveParam(pos.id, pIdx, 'down')}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                                    title="Переместить вниз"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Label (65%) */}
                                <input
                                  type="text"
                                  className="w-[60%] px-2 py-1 text-xs bg-white text-slate-800 border border-slate-200 rounded focus:border-blue-500 focus:outline-hidden"
                                  value={param.label}
                                  placeholder="Параметр"
                                  onChange={(e) =>
                                    updateParam(pos.id, param.id, 'label', e.target.value)
                                  }
                                />

                                {/* Value (35%) */}
                                <input
                                  type="text"
                                  className="w-[35%] px-2 py-1 text-xs bg-white font-medium text-slate-900 border border-slate-200 rounded focus:border-blue-500 focus:outline-hidden"
                                  value={param.value}
                                  placeholder="Значение"
                                  onChange={(e) =>
                                    updateParam(pos.id, param.id, 'value', e.target.value)
                                  }
                                />

                                {/* Delete Param */}
                                <button
                                  type="button"
                                  onClick={() => removeParam(pos.id, param.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Удалить строку"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* TAB: PRICING & CONDITIONS */}
            {activeTab === 'pricing' && (
              <div className="space-y-4">
                <Card
                  title="Таблица спецификации и цен"
                  action={
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={importPositionsToPricing}
                        className="text-blue-700 border-blue-200 hover:bg-blue-50 text-[11px]"
                        title="Автоматически добавить позиции из раздела оборудования в спецификацию цен"
                      >
                        Импорт из позиций
                      </Button>
                      <Button variant="primary" size="xs" icon={Plus} onClick={addPricingItem}>
                        Добавить позицию
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {data.pricingItems.length === 0 ? (
                      <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-lg space-y-2">
                        <p className="text-xs text-slate-500">Спецификация цен пока пуста</p>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={addPricingItem}
                          >
                            Добавить строку
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={importPositionsToPricing}
                          >
                            Импорт из оборудования
                          </Button>
                        </div>
                      </div>
                    ) : (
                      data.pricingItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            {/* Reorder Buttons Up and Down */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePricingItem(idx, 'up')}
                                className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-200/60"
                                title="Переместить позицию выше в списке"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === data.pricingItems.length - 1}
                                onClick={() => movePricingItem(idx, 'down')}
                                className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-200/60"
                                title="Переместить позицию ниже в списке"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 w-6">#{idx + 1}</span>

                            <input
                              type="text"
                              className="flex-1 px-2 py-1 text-xs bg-white font-medium text-slate-800 border border-slate-200 rounded focus:border-blue-500 focus:outline-hidden"
                              placeholder="Наименование позиции"
                              value={item.name}
                              onChange={(e) => updatePricingItem(item.id, 'name', e.target.value)}
                            />

                            {/* Duplicate Item Button */}
                            <button
                              type="button"
                              onClick={() => duplicatePricingItem(idx)}
                              className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer rounded hover:bg-slate-200/60"
                              title="Дублировать позицию"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Item Button */}
                            <button
                              type="button"
                              onClick={() => removePricingItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1 cursor-pointer rounded hover:bg-red-50"
                              title="Удалить позицию"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500">Кол-во</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 text-xs bg-white text-center border border-slate-200 rounded"
                                value={item.quantity}
                                onChange={(e) => updatePricingItem(item.id, 'quantity', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Цена за шт, руб</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 text-xs bg-white text-right font-medium border border-slate-200 rounded"
                                value={item.pricePerUnit}
                                placeholder="1 000 000"
                                onChange={(e) =>
                                  updatePricingItem(item.id, 'pricePerUnit', e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Сумма, руб</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 text-xs bg-white text-right font-semibold text-blue-700 border border-slate-200 rounded"
                                value={item.total}
                                placeholder="1 000 000"
                                onChange={(e) => updatePricingItem(item.id, 'total', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="p-3 bg-blue-50 rounded-lg flex justify-between items-center font-bold text-sm text-blue-900 border border-blue-100">
                      <span>Итого к оплате:</span>
                      <span>{calculatedTotal.toLocaleString('ru-RU')} руб.</span>
                    </div>

                    <FormTextarea
                      label="Примечание к расчетам (НДС, тестирование и т.д.)"
                      value={data.pricingNotes}
                      rows={2}
                      onChange={(e) => updateData('pricingNotes', e.target.value)}
                    />
                  </div>
                </Card>

                {/* Conditions Fields */}
                <Card title="Гарантии и условия поставки" icon={ShieldCheck}>
                  <div className="space-y-3">
                    <FormTextarea
                      label="Гарантийные обязательства"
                      rows={2}
                      value={data.warranty}
                      onChange={(e) => updateData('warranty', e.target.value)}
                    />
                    <FormTextarea
                      label="Условия оплаты"
                      rows={2}
                      value={data.paymentTerms}
                      onChange={(e) => updateData('paymentTerms', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput
                        label="Срок изготовления / поставки"
                        value={data.deliveryDays}
                        onChange={(e) => updateData('deliveryDays', e.target.value)}
                      />
                      <FormInput
                        label="Условия отгрузки (склад/доставка)"
                        value={data.deliveryTerms}
                        onChange={(e) => updateData('deliveryTerms', e.target.value)}
                      />
                    </div>
                    <FormTextarea
                      label="Пусконаладочные работы (ПНР)"
                      rows={2}
                      value={data.pnrNote}
                      onChange={(e) => updateData('pnrNote', e.target.value)}
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* TAB: SIGNATURE */}
            {activeTab === 'signature' && (
              <div className="space-y-4">
                <Card
                  title="Подпись и контакты подписанта"
                  subtitle="Блок всегда отображается целиком без разрыва на странице"
                  icon={UserCheck}
                >
                  <div className="space-y-3">
                    <FormInput
                      label="ФИО подписанта"
                      value={data.signatureName}
                      onChange={(e) => updateData('signatureName', e.target.value)}
                    />
                    <FormInput
                      label="Должность и компания"
                      value={data.signatureTitle}
                      onChange={(e) => updateData('signatureTitle', e.target.value)}
                    />
                    <FormInput
                      label="Приветственная строка менеджера"
                      value={data.signatureManagerNote}
                      onChange={(e) => updateData('signatureManagerNote', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput
                        label="Моб. телефон"
                        value={data.signaturePhone}
                        onChange={(e) => updateData('signaturePhone', e.target.value)}
                      />
                      <FormInput
                        label="Email"
                        value={data.signatureEmail}
                        onChange={(e) => updateData('signatureEmail', e.target.value)}
                      />
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Quick Bottom Export Footer in Control Panel */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">Экспорт документа</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                icon={Download}
                loading={isExportingDocx}
                onClick={handleDocxExport}
              >
                DOCX
              </Button>
              <Button
                variant="primary"
                size="xs"
                icon={Download}
                loading={isExportingPdf}
                onClick={handlePdfExport}
              >
                PDF Экспорт
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Live WYSIWYG A4 Preview */}
        <div className="flex-1 bg-slate-200/80 overflow-y-auto overflow-x-hidden p-6 flex flex-col items-center">
          {/* Preview Toolbar */}
          <div className="no-print w-full max-w-[210mm] mb-4 flex items-center justify-between bg-white/90 backdrop-blur-xs px-4 py-2 rounded-xl border border-slate-300 shadow-2xs">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Предварительный просмотр (A4 1:1)</span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(50, z - 10))}
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                title="Уменьшить"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold text-slate-600 min-w-10 text-center">
                {previewZoom}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(150, z + 10))}
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                title="Увеличить"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(100)}
                className="p-1 text-slate-400 hover:text-slate-700 text-xs ml-1"
                title="100% масштаб"
              >
                100%
              </button>
            </div>
          </div>

          {/* The Actual A4 Document Sheet with Aptos Narrow and Arial Narrow Typography */}
          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="transition-transform duration-100 ease-out"
          >
            <div
              ref={previewSheetRef}
              id="proposal-document-content"
              className="a4-page px-[15mm] pb-[15mm] pt-0 text-slate-900 shadow-2xl relative font-aptos font-proposal-body"
              style={{
                fontFamily: '"Aptos Narrow", "Arial Narrow", "Roboto Condensed", sans-serif',
                fontSize: '14pt',
                lineHeight: '1.35',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              {/* Document Header (Logo on top-left flush to top border, info on right, separated only by thin line below) */}
              <div className="flex justify-between items-start pt-0 mt-0 pb-3 border-b border-slate-300 mb-5">
                {/* Logo or Brand flush to top-left */}
                <div className="flex-1 mt-0 ml-0 flex items-start">
                  {data.logo?.base64 ? (
                    <img
                      src={`data:${data.logo.mimeType};base64,${data.logo.base64}`}
                      alt="Logo"
                      style={{ width: `${data.logoWidth || 200}px` }}
                      className="max-h-24 object-contain object-left-top block mt-0 pt-0"
                    />
                  ) : (
                    <div className="min-h-12 flex items-center text-xs text-slate-300 italic no-print select-none">
                      {/* Empty by default in output document */}
                    </div>
                  )}
                </div>

                {/* Proposal Number & Contacts - clean text, no table borders */}
                <div className="text-right text-[12pt] space-y-0.5 leading-snug text-slate-700">
                  <div className="font-bold text-[13pt] text-slate-900">
                    Коммерческое предложение № {data.proposalNumber || 'б/н'}
                  </div>
                  <div className="text-slate-500 text-[11pt]">от {data.proposalDate}</div>
                  <div>Тел: {data.contactPhone}</div>
                  <div>Email: {data.contactEmail}</div>
                </div>
              </div>

              {/* Main Proposal Heading: Arial Narrow 22pt Bold */}
              <div
                className="font-arial-narrow font-bold text-center mb-4 tracking-tight leading-tight text-slate-900"
                style={{
                  fontFamily: '"Arial Narrow", "Aptos Narrow", "Roboto Condensed", sans-serif',
                  fontSize: '22pt',
                  fontWeight: 700,
                }}
              >
                {getProposalTitle(data.titlePrefixType, data.titleSuffix)}
              </div>

              {/* Intro Line: Aptos Narrow 14pt (Directly editable) */}
              <p className="mb-4 text-justify">
                {getEffectiveIntroSentence(data)}
              </p>

              {/* Equipment Positions */}
              <div className="space-y-6">
                {data.positions.map((pos, pIdx) => (
                  <div key={pos.id} className="page-break-avoid space-y-3">
                    {/* Position Subtitle: Arial Narrow 18pt */}
                    {pos.subtitleSuffix && pos.subtitleSuffix.trim() ? (
                      <h2
                        className="font-arial-narrow font-bold text-slate-900 border-b border-slate-300 pb-1"
                        style={{
                          fontFamily: '"Arial Narrow", "Aptos Narrow", sans-serif',
                          fontSize: '18pt',
                        }}
                      >
                        {pIdx + 1}. {pos.subtitleSuffix}
                      </h2>
                    ) : null}

                    {/* Position Photo Gallery (Clean horizontal row) */}
                    {pos.images && pos.images.length > 0 && (
                      <div className="flex flex-wrap gap-3 my-2 justify-center">
                        {pos.images.map((img) => (
                          <div
                            key={img.id}
                            className="rounded-sm border border-slate-200 overflow-hidden shadow-2xs max-h-48"
                          >
                            <img
                              src={`data:${img.mimeType};base64,${img.base64}`}
                              alt={pos.subtitleSuffix}
                              className="max-h-48 object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Description Header & Body (Structured by Paragraphs) */}
                    {pos.descriptionHeader && (
                      <div className="font-bold text-[14pt] text-slate-900 mt-2 mb-1.5">
                        {pos.descriptionHeader}
                      </div>
                    )}
                    {pos.descriptionBody && (
                      <div className="space-y-2.5 text-[14pt] text-slate-800 text-justify">
                        {pos.descriptionBody
                          .split(/\n+/)
                          .map((p) => p.trim())
                          .filter(Boolean)
                          .map((para, idx) => {
                            const isBullet = /^[•\-\*]\s+/.test(para);
                            if (isBullet) {
                              const clean = para.replace(/^[•\-\*]\s+/, '');
                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 pl-3 leading-relaxed text-left"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-2.5 shrink-0" />
                                  <span>{clean}</span>
                                </div>
                              );
                            }
                            return (
                              <p key={idx} className="leading-relaxed indent-0">
                                {para}
                              </p>
                            );
                          })}
                      </div>
                    )}

                    {/* Video Link if active */}
                    {pos.showVideoLink && pos.videoLink && (
                      <div className="text-[12pt] text-blue-700 underline flex items-center gap-1.5 my-1">
                        <Video className="w-4 h-4 shrink-0" />
                        <span>Видео работы оборудования: {pos.videoLink}</span>
                      </div>
                    )}

                    {/* TECHNICAL PARAMETERS TABLE (WYSIWYG: width adapts to content, no line wraps, centered) */}
                    {pos.params && pos.params.length > 0 && (
                      <div className="mt-3">
                        <div className="font-bold text-[14pt] mb-2 text-slate-900 text-center">
                          Технические параметры и характеристики:
                        </div>
                        <div className="flex justify-center my-1">
                          <table
                            className="border-collapse border border-slate-300 text-[14pt] mx-auto w-auto max-w-full"
                            style={{
                              margin: '0 auto',
                              tableLayout: 'auto',
                            }}
                          >
                            <thead>
                              <tr className="bg-slate-100 text-slate-900">
                                <th className="border border-slate-300 font-bold text-left px-3 py-1 whitespace-nowrap">
                                  Параметр
                                </th>
                                <th className="border border-slate-300 font-bold text-left px-3 py-1 whitespace-nowrap">
                                  Значение
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {pos.params.map((param) => {
                                const compactedLabel = compactRussianTechnicalText(param.label, 42);
                                const compactedValue = compactRussianTechnicalText(param.value, 30);
                                return (
                                  <tr key={param.id} className="hover:bg-slate-50/50">
                                    <td className="border border-slate-300 px-3 py-1 text-slate-800 whitespace-nowrap align-middle">
                                      {compactedLabel}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-1 font-bold text-slate-900 whitespace-nowrap align-middle">
                                      {compactedValue}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* PRICING SECTION */}
              <div className="page-break-avoid mt-6">
                <h2
                  className="font-arial-narrow font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2.5"
                  style={{
                    fontFamily: '"Arial Narrow", "Aptos Narrow", sans-serif',
                    fontSize: '18pt',
                  }}
                >
                  Стоимость оборудования и условия оплаты
                </h2>

                <table className="w-full border-collapse border border-slate-300 text-[13pt] table-fixed">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900">
                      <th className="border border-slate-300 px-1.5 py-1 text-center w-[6%]">№</th>
                      <th className="border border-slate-300 px-2 py-1 text-left w-[52%]">Наименование</th>
                      <th className="border border-slate-300 px-1 py-1 text-center w-[10%]">Кол-во</th>
                      <th className="border border-slate-300 px-2 py-1 text-right w-[16%]">
                        Цена, руб
                      </th>
                      <th className="border border-slate-300 px-2 py-1 text-right w-[16%]">
                        Сумма, руб
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pricingItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-slate-300 px-3 py-2 text-center text-slate-400 italic text-[12pt]">
                          Позиции спецификации не добавлены
                        </td>
                      </tr>
                    ) : (
                      data.pricingItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="border border-slate-300 px-1 py-1 text-center text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-slate-800">
                            {item.name}
                          </td>
                          <td className="border border-slate-300 px-1 py-1 text-center text-slate-700">
                            {item.quantity}
                          </td>
                          <td
                            className="border border-slate-300 px-2 py-1 text-right font-medium text-slate-800"
                            style={{ letterSpacing: 'normal' }}
                          >
                            {item.pricePerUnit}
                          </td>
                          <td
                            className="border border-slate-300 px-2 py-1 text-right font-bold text-slate-900"
                            style={{ letterSpacing: 'normal' }}
                          >
                            {item.total}
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Total row */}
                    <tr className="bg-slate-50 font-bold text-[14pt]">
                      <td colSpan={4} className="border border-slate-300 px-3 py-1.5 text-right">
                        ИТОГО К ОПЛАТЕ:
                      </td>
                      <td
                        className="border border-slate-300 px-2 py-1.5 text-right text-blue-900"
                        style={{ letterSpacing: 'normal' }}
                      >
                        {calculatedTotal.toLocaleString('ru-RU')} руб.
                      </td>
                    </tr>
                  </tbody>
                </table>

                {data.pricingNotes && (
                  <p className="text-[12pt] text-slate-600 italic mt-1.5 leading-snug">
                    {data.pricingNotes}
                  </p>
                )}
              </div>

              {/* TERMS & CONDITIONS BLOCK */}
              <div className="page-break-avoid mt-5 space-y-1.5 text-[14pt]">
                <div
                  className="font-arial-narrow font-bold text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5"
                  style={{
                    fontFamily: '"Arial Narrow", "Aptos Narrow", sans-serif',
                    fontSize: '16pt',
                  }}
                >
                  Условия поставки и гарантия:
                </div>

                {data.warranty && (
                  <p className="leading-snug">
                    <span className="font-bold">Гарантийные обязательства:</span> {data.warranty}
                  </p>
                )}
                {data.paymentTerms && (
                  <p className="leading-snug">
                    <span className="font-bold">Условия оплаты:</span> {data.paymentTerms}
                  </p>
                )}
                {(data.deliveryDays || data.deliveryTerms) && (
                  <p className="leading-snug">
                    <span className="font-bold">Сроки и условия поставки:</span>{' '}
                    {data.deliveryDays ? `${data.deliveryDays}. ` : ''}
                    {data.deliveryTerms}
                  </p>
                )}
                {data.pnrNote && (
                  <p className="leading-snug">
                    <span className="font-bold">Пусконаладочные работы:</span> {data.pnrNote}
                  </p>
                )}
              </div>

              {/* SIGNATURE BLOCK (ALWAYS TOGETHER, AVOID BREAKING) */}
              <div
                className="page-break-avoid mt-6 pt-3 text-[14pt] leading-tight space-y-1 border-t border-slate-200"
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                <div>С уважением,</div>
                <div className="font-bold text-[15pt] text-slate-900 pt-0.5">
                  {data.signatureName}
                </div>
                <div className="text-slate-600 text-[13pt]">{data.signatureTitle}</div>
                {data.signatureManagerNote && (
                  <div className="text-slate-700 italic pt-1">{data.signatureManagerNote}</div>
                )}
                <div className="pt-0.5 text-slate-800 flex gap-4">
                  {data.signaturePhone && <span>Моб: {data.signaturePhone}</span>}
                  {data.signatureEmail && <span>Email: {data.signatureEmail}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset and Clear */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Сбросить и очистить все данные?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Это действие очистит всю загруженную и заполненную информацию (документы, фото, аудиозаписи, позиции оборудования и спецификации цен) для ввода новой информации и генерации нового документа.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirmModal(false)}
              >
                Отмена
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleResetAll}
                className="bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                Да, очистить всё
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking in-app Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200 shadow-xl rounded-xl overflow-hidden border border-slate-200">
          <div
            className={`px-4 py-3 flex items-start gap-3 text-xs font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-200'
                : toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-slate-900 text-white'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 leading-snug">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
