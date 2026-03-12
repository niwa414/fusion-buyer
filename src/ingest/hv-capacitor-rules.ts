import type { CoolingType, MountingStyle } from './types';

export interface HvCapacitorRulePattern {
  pattern: RegExp;
  buildRawValue?: (match: RegExpExecArray) => string;
  confidence?: number;
}

const VALUE_CAPTURE = '([^,\\n;]+)';
const NUMBER_CAPTURE = '((?=.*\\d)[\\d.,]+)';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAlternatives(literals: readonly string[] = [], regexFragments: readonly string[] = []) {
  return [...literals.map((value) => escapeRegex(value)), ...regexFragments].join('|');
}

function buildLabelValuePattern(literals: readonly string[] = [], regexFragments: readonly string[] = [], capturePattern = VALUE_CAPTURE) {
  return new RegExp(`^\\s*(?:${buildAlternatives(literals, regexFragments)})(?:\\s*[:=\\-]\\s*|\\s+)${capturePattern}`, 'i');
}

function buildLabelUnitNumberPattern(
  literals: readonly string[] = [],
  regexFragments: readonly string[] = [],
  unitFragment = '[a-z]+',
) {
  return new RegExp(`^\\s*(?:${buildAlternatives(literals, regexFragments)})\\s*\\((${unitFragment})\\)(?:\\s*[:=\\-]\\s*|\\s+)${NUMBER_CAPTURE}`, 'i');
}

function buildDirectUnitNumberPattern(unitFragment: string) {
  return new RegExp(`(?<![\\w\\d])(${unitFragment})(?![\\w])\\s*[:=\\-]?\\s*${NUMBER_CAPTURE}`, 'i');
}

export const HV_CAPACITOR_CATEGORY = 'HV Capacitor' as const;

export const HV_CAPACITOR_FIELD_ALIASES = {
  partName: ['part name', 'description', 'product'],
  model: ['model', 'series', 'catalog number', 'part number', 'p/n', 'mpn'],
  ratedVoltage: [
    'rated voltage',
    'rated dc voltage',
    'rated voltage (dc)',
    'voltage rating',
    'max voltage',
    'maximum voltage',
    'working voltage',
    'operating voltage',
    'wvdc',
    'dc voltage',
    'kvdc',
    'vdc',
  ],
  capacitance: ['capacitance', 'nominal capacitance', 'capacity'],
  pulseCurrent: ['peak current', 'pulse current', 'peak discharge current', 'peak repetitive current', 'current capability'],
  dvDt: ['voltage rise rate', 'dv/dt capability', 'rise rate'],
  esr: ['esr', 'equivalent series resistance', 'series resistance'],
  cooling: ['cooling', 'cooling type', 'cooled by'],
  mounting: [
    'mounting',
    'mounting style',
    'installation',
    'mounting arrangement',
    'terminal type',
    'terminal arrangement',
    'connection style',
    'case style',
  ],
  dimensions: ['dimensions', 'overall dimensions', 'overall size', 'case dimensions', 'case size', 'size', 'outline'],
  lifecycle: [
    'pulse life',
    'lifetime',
    'cycle life',
    'expected life',
    'service life',
    'operating life',
    'life expectancy',
    'shot life',
    'pulse count',
    'life',
  ],
} as const;

export const HV_CAPACITOR_LABEL_REGEX_FRAGMENTS = {
  capacitance: ['nom\\.?\\s*cap(?:acitance)?'],
  pulseCurrent: ['ipk'],
  dvDt: ['d\\s*v\\s*\\/\\s*d\\s*t', 'dvdt', 'dv\\/dt', 'max(?:imum)?\\s*d\\s*v\\s*\\/\\s*d\\s*t'],
  esr: ['resistance\\s*\\(esr\\)'],
} as const;

export const HV_CAPACITOR_UNIT_PATTERNS = {
  voltage: /([\d.,]+)\s*(kv(?:dc|ac)?|v(?:dc|ac)?)\b/i,
  capacitance: /([\d.,]+)\s*(f|mf|uf|(?:\u03bc|\u00b5)f|ufd|mfd|microfarads?|nf|pf)\b/i,
  current: /([\d.,]+)\s*(ka|a)\b/i,
  dvDt: /([\d.,]+)\s*(kv|v)\s*(?:\/|per)\s*(us|\u00b5s|\u03bcs)/i,
  resistance: /([\d.,]+)\s*(mohm|mohms|m(?:\u03a9)|milliohm|milliohms|milli ohm|milli ohms|ohm|\u03a9)\b/i,
} as const;

const voltageUnitLabels = 'kvdc|vdc|kv|v';
const capacitanceUnitLabels = 'uf|(?:\\u03bc|\\u00b5)f|nf|pf|mfd|ufd|mf|f';
const currentUnitLabels = 'ka|a';
const dvDtUnitLabels = '(?:kv|v)\\s*(?:\\/|per)\\s*(?:us|\\u00b5s|\\u03bcs)';
const resistanceUnitLabels = 'mohm|mohms|m(?:\\u03a9)|milliohm|milliohms|milli\\s+ohm|milli\\s+ohms|ohm|\\u03a9';

export const HV_CAPACITOR_MOUNTING_STYLE_KEYWORDS: Record<Exclude<MountingStyle, 'unknown'>, string[]> = {
  stud: ['stud', 'threaded', 'bolt', 'screw terminal'],
  busbar: ['busbar', 'bus bar', 'flat terminal', 'tab terminal', 'lug'],
  chassis: ['chassis', 'panel mount', 'base mount'],
  clamp: ['clamp', 'bracket', 'strap'],
};

export const HV_CAPACITOR_DIMENSION_KEYWORDS = ['dimensions', 'overall dimensions', 'overall size', 'case dimensions', 'case size', 'size', 'outline'] as const;

export const HV_CAPACITOR_SUB_DIMENSION_PATTERNS = [
  /\blead diameter\b/i,
  /\bterminal length\b/i,
  /\bwire diameter\b/i,
  /\bpin spacing\b/i,
  /\blead spacing\b/i,
  /\blead length\b/i,
  /\bterminal diameter\b/i,
  /\bwire length\b/i,
] as const;

export const HV_CAPACITOR_SINGLE_MODEL_ANCHOR_PATTERNS = [
  /^(?:catalog number|part number|p\/n|mpn|model)\s*[:=-]?\s*([A-Z0-9-]+)/i,
] as const;

export const HV_CAPACITOR_COOLING_TYPE_KEYWORDS: Record<Exclude<CoolingType, 'unknown'>, string[]> = {
  oil: ['oil'],
  water: ['water'],
  air: ['air'],
  passive: ['passive', 'self-cooled', 'self cooled', 'natural convection'],
};

export const HV_CAPACITOR_PLACEHOLDER_PATTERNS = [/to be confirmed/i, /\btbd\b/i, /\bpending\b/i, /\breview\b/i] as const;

export const HV_CAPACITOR_SECTION_TITLE_PATTERNS = [
  /^warranty$/i,
  /^drawings$/i,
  /^outline drawings$/i,
  /^dimensional drawings$/i,
  /^ordering information$/i,
  /^specifications$/i,
  /^features$/i,
  /^notes?$/i,
  /^dimensions$/i,
] as const;

export const HV_CAPACITOR_PART_NAME_WEAK_BLACKLIST_PATTERNS = [
  /^warranty$/i,
  /^product warranty$/i,
  /^support$/i,
  /^notes?$/i,
  /^features$/i,
  /^specifications$/i,
  /^ordering information$/i,
  /^drawings$/i,
  /^dimensions$/i,
  /^important notes$/i,
  /^product safety$/i,
] as const;

export const HV_CAPACITOR_FAMILY_CATALOG_HINT_PATTERNS = [
  /catalog number/i,
  /ordering code/i,
  /ordering information/i,
  /ratings/i,
  /case dimensions/i,
  /outline drawings/i,
  /voltage range/i,
  /capacitance range/i,
  /package type/i,
  /table/i,
  /max\./i,
] as const;

export const HV_CAPACITOR_FAMILY_CATALOG_SECTION_PATTERNS = [
  /^ratings$/i,
  /^ordering information$/i,
  /^catalog$/i,
  /^catalog number$/i,
  /^case dimensions$/i,
  /^cap\.$/i,
  /^(?:uF|µF)$/i,
  /^cap\.\s*(?:uF|µF)$/i,
  /^capacitance(?:\s+range)?$/i,
] as const;

export const HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN = /^(\d+(?:\.\d+)?)\s*kVdc\b/i;

export const HV_CAPACITOR_FAMILY_CATALOG_MODEL_CODE_PATTERN = /\b[A-Z]{2,}[A-Z0-9-]*\d{2,}[A-Z0-9-]*\b/;

export const HV_CAPACITOR_PART_NAME_FALLBACK_EXCLUDE_PATTERN = /(rated voltage|capacitance|esr|dv\/dt|peak current)/i;

export const HV_CAPACITOR_EXTRACTION_PATTERNS = {
  partName: [buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.partName, [], '(.+)$')],
  modelFallback: [buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.model, [], '(.+)$')],
  ratedVoltage: [
    { pattern: buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.ratedVoltage) },
    {
      pattern: buildLabelUnitNumberPattern(
        ['rated voltage', 'rated dc voltage', 'voltage rating', 'working voltage', 'operating voltage'],
        [],
        voltageUnitLabels,
      ),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
    {
      pattern: buildDirectUnitNumberPattern(voltageUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
      confidence: 0.76,
    },
  ],
  capacitance: [
    { pattern: buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.capacitance, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.capacitance]) },
    { pattern: /^\s*c\s*[:=\-]\s*([^,\n;]+)/i },
    {
      pattern: buildLabelUnitNumberPattern(HV_CAPACITOR_FIELD_ALIASES.capacitance, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.capacitance], capacitanceUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
    {
      pattern: /^\s*c\s*\(((?:uf|(?:\u03bc|\u00b5)f|nf|pf|mfd|ufd|mf|f))\)\s*[:=\-]?\s*([\d.,]+)/i,
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
    {
      pattern: buildDirectUnitNumberPattern(capacitanceUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
      confidence: 0.76,
    },
  ],
  pulseCurrent: [
    { pattern: buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.pulseCurrent, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.pulseCurrent]) },
    {
      pattern: buildLabelUnitNumberPattern(
        HV_CAPACITOR_FIELD_ALIASES.pulseCurrent,
        [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.pulseCurrent],
        currentUnitLabels,
      ),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
  ],
  dvDt: [
    { pattern: buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.dvDt, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.dvDt]) },
    {
      pattern: buildLabelUnitNumberPattern(HV_CAPACITOR_FIELD_ALIASES.dvDt, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.dvDt], dvDtUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
    {
      pattern: buildDirectUnitNumberPattern(dvDtUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
      confidence: 0.72,
    },
  ],
  esr: [
    { pattern: buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.esr, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.esr]) },
    {
      pattern: buildLabelUnitNumberPattern(HV_CAPACITOR_FIELD_ALIASES.esr, [...HV_CAPACITOR_LABEL_REGEX_FRAGMENTS.esr], resistanceUnitLabels),
      buildRawValue: (match: RegExpExecArray) => `${match[2]} ${match[1]}`,
    },
  ],
  cooling: [buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.cooling)],
  mounting: [buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.mounting)],
  dimensions: [
    buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.dimensions, [], '(.+)$'),
    /(\d+(?:\.\d+)?\s*(?:mm|cm|in(?:ch)?(?:es)?|")\s*(?:x|\u00d7|by)\s*\d+(?:\.\d+)?\s*(?:mm|cm|in(?:ch)?(?:es)?|")(?:\s*(?:x|\u00d7|by)\s*\d+(?:\.\d+)?\s*(?:mm|cm|in(?:ch)?(?:es)?|"))?)/i,
    /((?:od|dia(?:meter)?|height|length|width)\s*[:=\-]?\s*[\d.]+\s*(?:mm|cm|in(?:ch)?(?:es)?|").*)/i,
  ],
  lifecycle: [buildLabelValuePattern(HV_CAPACITOR_FIELD_ALIASES.lifecycle, [], '(.+)$')],
  lifecycleFallback: [/((?:\d[\d,]*)\s*(?:shots|cycles|pulses))/i],
} as const;

export function inferKeywordValue<T extends string>(rawValue: string, keywordMap: Record<T, string[]>) {
  const normalized = rawValue.toLowerCase();

  for (const [value, keywords] of Object.entries(keywordMap) as Array<[T, string[]]>) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return value;
    }
  }

  return null;
}

export function matchesRulePatterns(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value.trim()));
}

export function isWeakPartNameValue(value: string) {
  return matchesRulePatterns(value, HV_CAPACITOR_PART_NAME_WEAK_BLACKLIST_PATTERNS);
}

export function isSectionTitleValue(value: string) {
  return matchesRulePatterns(value, HV_CAPACITOR_SECTION_TITLE_PATTERNS);
}

export function isSubDimensionLine(value: string) {
  return matchesRulePatterns(value, HV_CAPACITOR_SUB_DIMENSION_PATTERNS);
}

export function hasFamilyCatalogHints(value: string) {
  return matchesRulePatterns(value, HV_CAPACITOR_FAMILY_CATALOG_HINT_PATTERNS);
}

export function isFamilyCatalogSectionLine(value: string) {
  return matchesRulePatterns(value, HV_CAPACITOR_FAMILY_CATALOG_SECTION_PATTERNS);
}

export function looksLikeCatalogModelCode(value: string) {
  return HV_CAPACITOR_FAMILY_CATALOG_MODEL_CODE_PATTERN.test(value);
}

export function readSingleModelAnchor(value: string) {
  for (const pattern of HV_CAPACITOR_SINGLE_MODEL_ANCHOR_PATTERNS) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1].trim().toUpperCase();
    }
  }

  return null;
}

export function looksLikeSpecificModelAnchor(value: string) {
  const normalized = value.trim();

  if (!normalized || /type\b|series\b|capacitors?\b/i.test(normalized)) {
    return false;
  }

  return /[A-Z]{2,}[A-Z0-9-]*\d{2,}[A-Z0-9-]*/.test(normalized);
}
