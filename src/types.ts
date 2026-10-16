import { REFERENCE_COMPANY_LOGO } from './utils/referenceLogo';

export interface TechnicalParam {
  id: string;
  label: string;
  value: string;
}

export interface PricingItem {
  id: string;
  name: string;
  quantity: string;
  pricePerUnit: string;
  total: string;
}

export interface ProposalImage {
  id: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface EquipmentPosition {
  id: string;
  subtitleSuffix: string;
  descriptionHeader: string;
  descriptionBody: string;
  images: ProposalImage[];
  videoLink: string;
  showVideoLink: boolean;
  params: TechnicalParam[];
}

export interface ProposalData {
  // Document Metadata
  proposalNumber: string;
  proposalDate: string;
  // Company Identity
  logo?: ProposalImage;
  logoWidth: number;
  contactPhone: string;
  contactEmail: string;
  // Titles
  titlePrefixType: 'Оборудование' | 'Запасные части' | 'Оборудование и запчасти';
  titleSuffix: string;
  introPrefixType: 'Производство и поставка' | 'Поставка';
  introSuffix: string;
  introSentence?: string; // Direct editable introductory sentence in proposal
  
  // Dynamic Positions
  positions: EquipmentPosition[];
  
  // Pricing
  pricingItems: PricingItem[];
  pricingNotes: string;
  
  // Conditions
  warranty: string;
  paymentTerms: string;
  pnrNote: string;
  deliveryDays: string;
  deliveryTerms: string;
  // Signature
  signatureName: string;
  signatureTitle: string;
  signatureManagerNote: string;
  signaturePhone: string;
  signatureEmail: string;
}

export function getTargetWord(prefixType: ProposalData['titlePrefixType']): string {
  switch (prefixType) {
    case 'Запасные части':
      return 'комплектующих';
    case 'Оборудование и запчасти':
      return 'оборудования и комплектующих';
    case 'Оборудование':
    default:
      return 'оборудования';
  }
}

export function getCleanPurpose(titleSuffix: string): string {
  const trimmed = (titleSuffix || '').trim();
  return trimmed.replace(/^для\s+/i, '');
}

export function getProposalTitle(
  prefixType: ProposalData['titlePrefixType'],
  titleSuffix: string
): string {
  const targetWord = getTargetWord(prefixType);
  const purpose = getCleanPurpose(titleSuffix);
  if (!purpose) {
    return `Коммерческое предложение на поставку ${targetWord}`;
  }
  return `Коммерческое предложение на поставку ${targetWord} для ${purpose}`;
}

export function getIntroSentence(
  introPrefixType: ProposalData['introPrefixType'],
  titlePrefixType: ProposalData['titlePrefixType'],
  titleSuffix: string
): string {
  const actionWords = introPrefixType === 'Поставка' ? 'поставку' : 'производство и поставку';
  const targetWord = getTargetWord(titlePrefixType);
  const purpose = getCleanPurpose(titleSuffix);
  if (!purpose) {
    return `Предлагаем Вашему вниманию коммерческое предложение на ${actionWords} ${targetWord}:`;
  }
  return `Предлагаем Вашему вниманию коммерческое предложение на ${actionWords} ${targetWord} для ${purpose}:`;
}

export function getEffectiveIntroSentence(data: {
  introSentence?: string;
  introPrefixType: ProposalData['introPrefixType'];
  titlePrefixType: ProposalData['titlePrefixType'];
  titleSuffix: string;
}): string {
  if (data.introSentence && data.introSentence.trim()) {
    return data.introSentence.trim();
  }
  return getIntroSentence(data.introPrefixType, data.titlePrefixType, data.titleSuffix);
}

/**
 * Calculates 1-based day of year (1..366)
 */
export function getDayOfYear(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  return Math.floor(diffTime / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Generates proposal number according to rule: гггг-(порядковый номер дня в году)
 */
export function generateProposalNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const dayOfYear = getDayOfYear(date);
  return `${year}-${dayOfYear}`;
}

/**
 * Generates current proposal date formatted as ДД.ММ.ГГГГ
 */
export function generateProposalDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export const DEFAULT_PROPOSAL_DATA: ProposalData = {
  proposalNumber: generateProposalNumber(),
  proposalDate: generateProposalDate(),
  logo: undefined, // Empty by default as requested
  logoWidth: 220,
  contactPhone: '+7 (937) 980-22-02',
  contactEmail: 'filling.profi@yandex.ru',
  titlePrefixType: 'Оборудование',
  titleSuffix: '',
  introPrefixType: 'Производство и поставка',
  introSuffix: '',
  introSentence: 'Предлагаем Вашему вниманию коммерческое предложение на производство и поставку оборудования:',
  positions: [
    {
      id: 'pos-1',
      subtitleSuffix: '',
      descriptionHeader: '',
      descriptionBody: '',
      images: [],
      videoLink: '',
      showVideoLink: false,
      params: []
    }
  ],
  pricingItems: [],
  pricingNotes: 'Все цены указаны в рублях без НДС.(предприятие-изготовитель не является плательщиком НДС). В стоимость включена заводская предпродажная подготовка и индивидуальное тестирование на образцах тары Заказчика.',
  warranty: '12 месяцев с момента ввода оборудования в эксплуатацию, но не более 14 месяцев с даты отгрузки с производства.',
  paymentTerms: '50% — авансовый платеж при заключении договора; 40% — по готовности оборудования к отгрузке; 10% — после завершения пусконаладочных работ.',
  pnrNote: 'Проезд, проживание и суточные сервисных инженеров оплачиваются Заказчиком отдельно.',
  deliveryDays: '45-60 рабочих дней',
  deliveryTerms: 'Самовывоз со склада Поставщика либо доставка транспортной компанией по согласованию сторон.',
  signatureName: 'Владимир Лустин',
  signatureTitle: 'Руководитель технических проектов | Filling Profi',
  signatureManagerNote: 'Готов ответить на ваши вопросы:',
  signaturePhone: '+7 (937) 980-22-02',
  signatureEmail: 'filling.profi@yandex.ru'
};

export function createBlankProposalData(): ProposalData {
  return {
    proposalNumber: generateProposalNumber(),
    proposalDate: generateProposalDate(),
    logo: undefined,
    logoWidth: 220,
    contactPhone: '+7 (937) 980-22-02',
    contactEmail: 'filling.profi@yandex.ru',
    titlePrefixType: 'Оборудование',
    titleSuffix: '',
    introPrefixType: 'Производство и поставка',
    introSuffix: '',
    introSentence: 'Предлагаем Вашему вниманию коммерческое предложение на производство и поставку оборудования:',
    positions: [
      {
        id: `pos-${Date.now()}`,
        subtitleSuffix: '',
        descriptionHeader: '',
        descriptionBody: '',
        images: [],
        videoLink: '',
        showVideoLink: false,
        params: []
      }
    ],
    pricingItems: [],
    pricingNotes: 'Все цены указаны в рублях без НДС.(предприятие-изготовитель не является плательщиком НДС). В стоимость включена заводская предпродажная подготовка и индивидуальное тестирование на образцах тары Заказчика.',
    warranty: '12 месяцев с момента ввода оборудования в эксплуатацию.',
    paymentTerms: '50% — аванс; 40% — по готовности к отгрузке; 10% — после ПНР.',
    pnrNote: 'Проезд, проживание и суточные сервисных инженеров оплачиваются Заказчиком отдельно.',
    deliveryDays: '45-60 рабочих дней',
    deliveryTerms: 'Самовывоз со склада Поставщика либо доставка транспортной компанией.',
    signatureName: 'Владимир Лустин',
    signatureTitle: 'Руководитель технических проектов | Filling Profi',
    signatureManagerNote: 'Готов ответить на ваши вопросы:',
    signaturePhone: '+7 (937) 980-22-02',
    signatureEmail: 'filling.profi@yandex.ru'
  };
}
