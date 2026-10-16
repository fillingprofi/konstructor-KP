/**
 * Intelligently contracts Russian technical parameter labels or values
 * according to standard Russian technical orthography and abbreviation rules (GOST),
 * ensuring the text fits on a single line without wrapping.
 */
export function compactRussianTechnicalText(text: string, maxLen = 42): string {
  if (!text) return '';
  let result = text.trim();

  // Standard Russian technical terminology and unit contractions
  const standardReplacements: [RegExp, string][] = [
    [/Габаритные размеры\s*\(Длина\s*×\s*Ширина\s*×\s*Высота\)/gi, 'Габариты (Д×Ш×В)'],
    [/Габаритные размеры\s*\(Д×Ш×В\)/gi, 'Габариты (Д×Ш×В)'],
    [/Габаритные размеры/gi, 'Габариты'],
    [/Установленная электрическая мощность/gi, 'Установл. мощность'],
    [/Установленная мощность/gi, 'Установл. мощность'],
    [/Потребляемая электрическая мощность/gi, 'Потребл. мощность'],
    [/Потребляемая мощность/gi, 'Потребл. мощность'],
    [/Давление сжатого воздуха/gi, 'Давление воздуха'],
    [/Расход сжатого воздуха/gi, 'Расход воздуха'],
    [/Параметры электропитания/gi, 'Электропитание'],
    [/Напряжение электропитания/gi, 'Электропитание'],
    [/Напряжение питания/gi, 'Электропитание'],
    [/Температура окружающей среды/gi, 'Темп. окруж. среды'],
    [/Погрешность дозирования/gi, 'Погрешность'],
    [/Масса оборудования/gi, 'Масса'],
    [/Вес оборудования/gi, 'Масса'],
    [/Количество операторов/gi, 'Кол-во операторов'],
    [/Количество циклов/gi, 'Кол-во циклов'],
    [/Количество/gi, 'Кол-во'],
    [/штук\s*в\s*час/gi, 'шт/ч'],
    [/штук\/час/gi, 'шт/ч'],
    [/шт\/час/gi, 'шт/ч'],
    [/литров\s*в\s*минуту/gi, 'л/мин'],
    [/литров\/мин/gi, 'л/мин'],
    [/миллиметров/gi, 'мм'],
    [/сантиметров/gi, 'см'],
    [/миллилитров/gi, 'мл'],
    [/килограмм/gi, 'кг'],
    [/мегапаскаль/gi, 'МПа'],
    [/киловатт/gi, 'кВт'],
    [/нержавеющая сталь/gi, 'нерж. сталь'],
    [/включительно/gi, 'вкл.'],
    [/ориентировочно/gi, 'ориент.'],
    [/приблизительно/gi, 'прим.'],
    [/максимальная|максимальный|максимально/gi, 'макс.'],
    [/минимальная|минимальный|минимально/gi, 'мин.'],
    [/автоматический|автоматическая/gi, 'автом.'],
    [/полуавтоматический|полуавтоматическая/gi, 'полуавтом.'],
    [/пневматический|пневматическая/gi, 'пневм.'],
    [/электрический|электрическая/gi, 'электр.'],
    [/технический|техническая/gi, 'техн.'],
    [/номинальный|номинальная/gi, 'ном.'],
  ];

  for (const [regex, rep] of standardReplacements) {
    result = result.replace(regex, rep);
  }

  // Clean redundant whitespace
  result = result.replace(/\s+/g, ' ').trim();

  // If string length still exceeds target maxLen, contract words ending on a consonant before vowel
  if (result.length > maxLen) {
    const words = result.split(' ');
    const contracted = words.map((word) => {
      // Don't shorten short tokens, numbers, or already contracted words
      if (word.length <= 6 || word.endsWith('.') || /\d/.test(word) || word.includes('(') || word.includes(')')) {
        return word;
      }
      // Rule of Russian abbreviations: cut at consonant before vowel with period
      const match = word.match(/^([а-яА-ЯёЁ]{4,6}[бвгджзклмнпрстфхцчшщ])([аеёиоуыэюя].*)$/i);
      if (match && match[1]) {
        return match[1] + '.';
      }
      return word;
    });
    result = contracted.join(' ');
  }

  return result;
}
