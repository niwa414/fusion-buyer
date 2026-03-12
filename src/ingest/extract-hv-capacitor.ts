import type {
  BomInput,
  ExtractedField,
  FieldStatus,
  HvCapacitorExtractResult,
  MissingNote,
} from './types';
import {
  HV_CAPACITOR_CATEGORY,
  HV_CAPACITOR_COOLING_TYPE_KEYWORDS,
  HV_CAPACITOR_EXTRACTION_PATTERNS,
  HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN,
  HV_CAPACITOR_MOUNTING_STYLE_KEYWORDS,
  HV_CAPACITOR_PART_NAME_FALLBACK_EXCLUDE_PATTERN,
  HV_CAPACITOR_PLACEHOLDER_PATTERNS,
  HV_CAPACITOR_UNIT_PATTERNS,
  isFamilyCatalogSectionLine,
  looksLikeSpecificModelAnchor,
  looksLikeCatalogModelCode,
  readSingleModelAnchor,
  isSectionTitleValue,
  isSubDimensionLine,
  isWeakPartNameValue,
  type HvCapacitorRulePattern,
  inferKeywordValue,
} from './hv-capacitor-rules';

interface Candidate<T> {
  rawValue: string;
  normalizedValue: T;
  evidenceSnippet: string;
  confidence: number;
}

interface SingleModelAlignedFields {
  anchor: string;
  ratedVoltageKv: ExtractedField<number> | null;
  capacitanceUf: ExtractedField<number> | null;
  dimensions: ExtractedField<string> | null;
}

type MatchPattern = RegExp | HvCapacitorRulePattern;

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function normalizeNumber(raw: string) {
  const cleaned = raw.replace(/,/g, '').trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePartNameCandidate(rawValue: string) {
  return normalizeWhitespace(rawValue.replace(/^[^A-Za-z0-9]+/, ''));
}

function createField<T>(
  status: FieldStatus,
  rawValue: string | null,
  normalizedValue: T | null,
  evidenceSnippet: string | null,
  confidence: number,
): ExtractedField<T> {
  return {
    rawValue,
    normalizedValue,
    evidenceSnippet,
    confidence,
    status,
  };
}

function emptyField<T>(): ExtractedField<T> {
  return createField<T>('missing', null, null, null, 0);
}

function toPatternSpec(pattern: MatchPattern): HvCapacitorRulePattern {
  return pattern instanceof RegExp ? { pattern } : pattern;
}

function lineMatches(lines: string[], patternSpecs: MatchPattern[]) {
  return patternSpecs.flatMap((patternSpec) => {
    const { pattern, buildRawValue, confidence } = toPatternSpec(patternSpec);

    return lines
      .map((line) => {
        const match = pattern.exec(line);

        if (!match) {
          return null;
        }

        const rawValue = normalizeWhitespace(buildRawValue ? buildRawValue(match) : match[1] ?? '');

        if (!rawValue) {
          return null;
        }

        return {
          line,
          rawValue,
          confidence: confidence ?? null,
        };
      })
      .filter((item): item is { line: string; rawValue: string; confidence: number | null } => Boolean(item));
  });
}

function uniqBy<T>(items: T[], selector: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = selector(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildFieldFromCandidates<T>(candidates: Candidate<T>[], formatter: (value: T) => string): ExtractedField<T> {
  if (candidates.length === 0) {
    return emptyField<T>();
  }

  const uniqueCandidates = uniqBy(candidates, (candidate) => formatter(candidate.normalizedValue));

  if (uniqueCandidates.length === 1) {
    const candidate = uniqueCandidates[0];

    return createField('extracted', candidate.rawValue, candidate.normalizedValue, candidate.evidenceSnippet, candidate.confidence);
  }

  return createField<T>(
    'conflict',
    `candidates: ${uniqueCandidates.map((candidate) => formatter(candidate.normalizedValue)).join(', ')}`,
    null,
    uniqBy(uniqueCandidates, (candidate) => candidate.evidenceSnippet).map((candidate) => candidate.evidenceSnippet).join(' | '),
    Math.max(...uniqueCandidates.map((candidate) => candidate.confidence)) - 0.2,
  );
}

function buildConflictField<T>(candidates: Candidate<T>[], formatter: (value: T) => string, confidence = 0.66): ExtractedField<T> | null {
  const uniqueCandidates = uniqBy(candidates, (candidate) => formatter(candidate.normalizedValue));

  if (uniqueCandidates.length < 2) {
    return null;
  }

  return createField<T>(
    'conflict',
    `candidates: ${uniqueCandidates.map((candidate) => formatter(candidate.normalizedValue)).join(', ')}`,
    null,
    uniqBy(uniqueCandidates, (candidate) => candidate.evidenceSnippet).map((candidate) => candidate.evidenceSnippet).join(' | '),
    confidence,
  );
}

function formatNumericValue(value: number, unit: string, precision = 3) {
  return `${Number(Number(value).toFixed(precision)).toString()} ${unit}`;
}

function formatCapacitanceValue(value: number) {
  const precision = value > 0 && value < 0.01 ? 6 : 3;

  return formatNumericValue(value, 'uF', precision);
}

function parseVoltageToKv(rawValue: string) {
  const match = rawValue.match(HV_CAPACITOR_UNIT_PATTERNS.voltage);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);

  if (value === null) {
    return null;
  }

  return match[2].toLowerCase().startsWith('v') ? value / 1000 : value;
}

function parseCapacitanceToUf(rawValue: string) {
  const match = rawValue.match(HV_CAPACITOR_UNIT_PATTERNS.capacitance);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);

  if (value === null) {
    return null;
  }

  switch (match[2].toLowerCase()) {
    case 'f':
      return value * 1_000_000;
    case 'mf':
      return value * 1_000;
    case 'uf':
    case '\u03bcf':
    case '\u00b5f':
    case 'ufd':
    case 'microfarad':
    case 'microfarads':
      return value;
    case 'nf':
      return value / 1_000;
    case 'pf':
      return value / 1_000_000;
    default:
      return null;
  }
}

function parseCurrentToKa(rawValue: string) {
  const match = rawValue.match(HV_CAPACITOR_UNIT_PATTERNS.current);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);

  if (value === null) {
    return null;
  }

  return match[2].toLowerCase() === 'a' ? value / 1000 : value;
}

function parseDvDtToKvPerUs(rawValue: string) {
  const match = rawValue.match(HV_CAPACITOR_UNIT_PATTERNS.dvDt);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);

  if (value === null) {
    return null;
  }

  return match[2].toLowerCase() === 'v' ? value / 1000 : value;
}

function parseResistanceToMohm(rawValue: string) {
  const match = rawValue.match(HV_CAPACITOR_UNIT_PATTERNS.resistance);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);

  if (value === null) {
    return null;
  }

  const unit = match[2].toLowerCase();

  return unit === 'ohm' || unit === '\u03c9' ? value * 1000 : value;
}

function extractNumericField(
  lines: string[],
  patterns: MatchPattern[],
  parser: (rawValue: string) => number | null,
  displayFormatter: (value: number) => string,
  defaultConfidence = 0.88,
): ExtractedField<number> {
  const candidates = lineMatches(lines, patterns)
    .map(({ line, rawValue, confidence }) => {
      const parsed = parser(rawValue);

      if (parsed === null) {
        return null;
      }

      return {
        rawValue,
        normalizedValue: Number(parsed.toFixed(3)),
        evidenceSnippet: line,
        confidence: confidence ?? defaultConfidence,
      } satisfies Candidate<number>;
    })
    .filter((item): item is Candidate<number> => Boolean(item));

  return buildFieldFromCandidates(candidates, displayFormatter);
}

function extractTextField<T extends string>(
  lines: string[],
  patterns: MatchPattern[],
  mapper: (rawValue: string) => T | null,
  defaultConfidence = 0.8,
): ExtractedField<T> {
  const candidates = lineMatches(lines, patterns)
    .map(({ line, rawValue, confidence }) => {
      const mapped = mapper(rawValue);

      if (!mapped) {
        return null;
      }

      return {
        rawValue,
        normalizedValue: mapped,
        evidenceSnippet: line,
        confidence: confidence ?? defaultConfidence,
      } satisfies Candidate<T>;
    })
    .filter((item): item is Candidate<T> => Boolean(item));

  return buildFieldFromCandidates(candidates, (value) => value);
}

function parseBareDecimalLine(line: string) {
  const match = line.match(/^(?:\d+(?:\.\d+)?|\.\d+)$/);

  if (!match) {
    return null;
  }

  return normalizeNumber(match[0]);
}

function normalizeDimensionValue(rawValue: string) {
  const match = rawValue.match(
    /(\d+(?:\.\d+)?)(?:\s*(mm|cm|in(?:ch)?(?:es)?|"))?\s*(?:x|\u00d7|by)\s*(\d+(?:\.\d+)?)(?:\s*(mm|cm|in(?:ch)?(?:es)?|"))?\s*(?:x|\u00d7|by)\s*(\d+(?:\.\d+)?)(?:\s*(mm|cm|in(?:ch)?(?:es)?|"))?/i,
  );

  if (!match) {
    return null;
  }

  const unit = match[6] ?? match[4] ?? match[2] ?? '';

  if ((match[2] || match[4]) && unit) {
    return `${match[1]} ${unit} x ${match[3]} ${unit} x ${match[5]} ${unit}`;
  }

  return `${match[1]} x ${match[3]} x ${match[5]}${unit ? ` ${unit}` : ''}`;
}

function parseNumericTokensLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed || /[A-Za-z]/.test(trimmed)) {
    return null;
  }

  const tokens = trimmed.match(/(?:\d+(?:\.\d+)?|\.\d+)/g);

  if (!tokens || tokens.join(' ') !== trimmed.replace(/\s+/g, ' ')) {
    return null;
  }

  return tokens.map((token) => normalizeNumber(token)).filter((value): value is number => value !== null);
}

function inferCoolingType(rawValue: string) {
  return inferKeywordValue(rawValue, HV_CAPACITOR_COOLING_TYPE_KEYWORDS);
}

function inferMountingStyle(rawValue: string) {
  return inferKeywordValue(rawValue, HV_CAPACITOR_MOUNTING_STYLE_KEYWORDS);
}

function extractPartName(lines: string[]) {
  const labelled = extractTextField<string>(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.partName],
    (value) => {
      const normalized = normalizePartNameCandidate(value);
      return !normalized || isWeakPartNameValue(normalized) ? null : normalized;
    },
  );

  if (labelled.status !== 'missing') {
    return labelled;
  }

  const modelFallback = extractTextField<string>(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.modelFallback],
    (value) => {
      const normalized = normalizePartNameCandidate(value);
      return !normalized || isWeakPartNameValue(normalized) ? null : normalized;
    },
  );

  if (
    modelFallback.status !== 'missing' &&
    modelFallback.normalizedValue &&
    looksLikeSpecificModelAnchor(modelFallback.normalizedValue) &&
    (labelled.status === 'missing' || !labelled.normalizedValue || !looksLikeSpecificModelAnchor(labelled.normalizedValue))
  ) {
    return createField(
      modelFallback.status === 'extracted' ? 'inferred' : modelFallback.status,
      modelFallback.rawValue,
      modelFallback.normalizedValue,
      modelFallback.evidenceSnippet,
      Math.max(modelFallback.confidence - 0.1, 0.7),
    );
  }

  if (modelFallback.status !== 'missing') {
    return createField(
      modelFallback.status === 'extracted' ? 'inferred' : modelFallback.status,
      modelFallback.rawValue,
      modelFallback.normalizedValue,
      modelFallback.evidenceSnippet,
      modelFallback.confidence - 0.1,
    );
  }

  const fallbackLine = lines.find(
    (line) => {
      const normalized = normalizePartNameCandidate(line);
      return Boolean(
        normalized &&
          /capacitor/i.test(normalized) &&
          !HV_CAPACITOR_PART_NAME_FALLBACK_EXCLUDE_PATTERN.test(normalized) &&
          !isWeakPartNameValue(normalized),
      );
    },
  );

  if (!fallbackLine) {
    return emptyField<string>();
  }

  const normalizedFallback = normalizePartNameCandidate(fallbackLine);

  return createField('inferred', normalizedFallback, normalizedFallback, fallbackLine, 0.58);
}

function extractDimensions(lines: string[]) {
  const explicitCandidates = lineMatches(lines, [HV_CAPACITOR_EXTRACTION_PATTERNS.dimensions[0]])
    .map(({ line, rawValue, confidence }) => {
      if (
        isSubDimensionLine(line) ||
        HV_CAPACITOR_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(rawValue)) ||
        isSectionTitleValue(rawValue)
      ) {
        return null;
      }

      const normalized = normalizeDimensionValue(rawValue);

      if (!normalized) {
        return null;
      }

      return {
        rawValue: normalized,
        normalizedValue: normalized,
        evidenceSnippet: line,
        confidence: confidence ?? 0.8,
      } satisfies Candidate<string>;
    })
    .filter((item): item is Candidate<string> => Boolean(item));

  if (explicitCandidates.length > 0) {
    return buildFieldFromCandidates(explicitCandidates, (value) => value);
  }

  const fallbackCandidates = lineMatches(lines, [...HV_CAPACITOR_EXTRACTION_PATTERNS.dimensions.slice(1)])
    .map(({ line, rawValue, confidence }) => {
      if (
        isSubDimensionLine(line) ||
        HV_CAPACITOR_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(rawValue)) ||
        isSectionTitleValue(rawValue)
      ) {
        return null;
      }

      const normalized = normalizeDimensionValue(rawValue);

      if (!normalized) {
        return null;
      }

      return {
        rawValue: normalized,
        normalizedValue: normalized,
        evidenceSnippet: line,
        confidence: confidence ?? 0.8,
      } satisfies Candidate<string>;
    })
    .filter((item): item is Candidate<string> => Boolean(item));

  return buildFieldFromCandidates(fallbackCandidates, (value) => value);
}

function extractLifecycle(lines: string[]) {
  const labelled = extractTextField<string>(lines, [...HV_CAPACITOR_EXTRACTION_PATTERNS.lifecycle], (value) => value);

  if (labelled.status !== 'missing') {
    return labelled;
  }

  return extractTextField<string>(lines, [...HV_CAPACITOR_EXTRACTION_PATTERNS.lifecycleFallback], (value) => value);
}

function normalizeAnchorValue(value: string) {
  return value.trim().toUpperCase();
}

function resolveSingleModelAnchor(lines: string[], bomInput?: BomInput) {
  if (bomInput?.mpn?.trim()) {
    return normalizeAnchorValue(bomInput.mpn);
  }

  for (const line of lines) {
    const anchor = readSingleModelAnchor(line);

    if (anchor) {
      return anchor;
    }
  }

  const specificModelLine = lines.find((line) => looksLikeSpecificModelAnchor(line));

  return specificModelLine ? normalizeAnchorValue(specificModelLine) : null;
}

function extractAlignedVoltageField(lines: string[], modelStartIndex: number) {
  for (let index = modelStartIndex - 1; index >= 0 && index >= modelStartIndex - 12; index -= 1) {
    const line = lines[index];
    const match = line.match(HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN);

    if (!match) {
      continue;
    }

    const parsed = normalizeNumber(match[1]);

    if (parsed === null) {
      return null;
    }

    return createField<number>('extracted', `${match[1]} kVdc`, Number(parsed.toFixed(3)), line, 0.9);
  }

  return null;
}

function extractAlignedCapacitanceField(lines: string[], modelStartIndex: number, modelCount: number, anchorOffset: number) {
  const values: Array<{ line: string; value: number }> = [];

  for (let index = modelStartIndex - 1; index >= 0 && values.length < modelCount; index -= 1) {
    const parsed = parseBareDecimalLine(lines[index]);

    if (parsed === null || parsed <= 0) {
      if (values.length > 0 && !isFamilyCatalogSectionLine(lines[index]) && !HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN.test(lines[index])) {
        break;
      }

      continue;
    }

    values.push({ line: lines[index], value: parsed });
  }

  if (values.length !== modelCount) {
    return null;
  }

  const ordered = values.reverse();
  const selected = ordered[anchorOffset];

  if (!selected) {
    return null;
  }

  return createField<number>(
    'extracted',
    `${selected.value} uF`,
    Number(selected.value.toFixed(6)),
    ordered.map((entry) => entry.line).join(' | '),
    0.9,
  );
}

function inferDimensionUnit(lines: string[], modelStartIndex: number) {
  for (let index = modelStartIndex - 1; index >= 0 && index >= modelStartIndex - 20; index -= 1) {
    if (/inches?/i.test(lines[index])) {
      return 'inches';
    }

    if (/\bmm\b/i.test(lines[index])) {
      return 'mm';
    }
  }

  return null;
}

function extractAlignedDimensionsField(lines: string[], modelEndIndex: number, modelCount: number, anchorOffset: number, modelStartIndex: number) {
  const tokenLines: string[] = [];
  const numericTokens: number[] = [];

  for (let index = modelEndIndex + 1; index < lines.length && numericTokens.length < modelCount * 3; index += 1) {
    const parsedTokens = parseNumericTokensLine(lines[index]);

    if (!parsedTokens || parsedTokens.length === 0) {
      if (numericTokens.length > 0 && !/^(?:max\.?|prf|ipeak)$/i.test(lines[index])) {
        break;
      }

      continue;
    }

    tokenLines.push(lines[index]);
    numericTokens.push(...parsedTokens);
  }

  if (numericTokens.length < modelCount * 3) {
    return null;
  }

  const start = anchorOffset * 3;
  const triple = numericTokens.slice(start, start + 3);

  if (triple.length < 3) {
    return null;
  }

  const unit = inferDimensionUnit(lines, modelStartIndex);
  const rendered = `${triple[0]} x ${triple[1]} x ${triple[2]}${unit ? ` ${unit}` : ''}`;

  return createField<string>('extracted', rendered, rendered, tokenLines.join(' | '), 0.9);
}

function alignSingleModelTableFields(lines: string[], bomInput?: BomInput): SingleModelAlignedFields | null {
  const anchor = resolveSingleModelAnchor(lines, bomInput);

  if (!anchor) {
    return null;
  }

  const directAnchorIndex = lines.findIndex((line) => normalizeAnchorValue(line) === anchor);
  const anchorIndex = directAnchorIndex >= 0 ? directAnchorIndex : lines.findIndex((line) => readSingleModelAnchor(line) === anchor);

  if (anchorIndex === -1) {
    return {
      anchor,
      ratedVoltageKv: null,
      capacitanceUf: null,
      dimensions: null,
    };
  }

  let modelStartIndex = anchorIndex;
  let modelEndIndex = anchorIndex;

  while (modelStartIndex > 0 && looksLikeCatalogModelCode(lines[modelStartIndex - 1])) {
    modelStartIndex -= 1;
  }

  while (modelEndIndex < lines.length - 1 && looksLikeCatalogModelCode(lines[modelEndIndex + 1])) {
    modelEndIndex += 1;
  }

  const modelLines = lines.slice(modelStartIndex, modelEndIndex + 1).filter((line) => looksLikeCatalogModelCode(line));
  const anchorOffset = modelLines.findIndex((line) => normalizeAnchorValue(line) === anchor);

  if (anchorOffset === -1 || modelLines.length < 1) {
    return {
      anchor,
      ratedVoltageKv: null,
      capacitanceUf: null,
      dimensions: null,
    };
  }

  return {
    anchor,
    ratedVoltageKv: extractAlignedVoltageField(lines, modelStartIndex),
    capacitanceUf: extractAlignedCapacitanceField(lines, modelStartIndex, modelLines.length, anchorOffset),
    dimensions: extractAlignedDimensionsField(lines, modelEndIndex, modelLines.length, anchorOffset, modelStartIndex),
  };
}

function preferAnchoredField<T>(baseField: ExtractedField<T>, anchoredField: ExtractedField<T> | null) {
  if (!anchoredField) {
    return baseField;
  }

  if (baseField.status === 'missing' || baseField.status === 'conflict') {
    return anchoredField;
  }

  return baseField;
}

function extractFamilyCatalogVoltageConflict(lines: string[]) {
  const candidates = lines
    .map((line) => {
      const match = line.match(HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN);

      if (!match) {
        return null;
      }

      const parsed = normalizeNumber(match[1]);

      if (parsed === null || parsed <= 0) {
        return null;
      }

      return {
        rawValue: `${match[1]} kV`,
        normalizedValue: Number(parsed.toFixed(3)),
        evidenceSnippet: line,
        confidence: 0.68,
      } satisfies Candidate<number>;
    })
    .filter((item): item is Candidate<number> => Boolean(item));

  return buildConflictField(candidates, (value) => formatNumericValue(value, 'kV'), 0.68);
}

function extractFamilyCatalogCapacitanceConflict(lines: string[]) {
  const candidates: Candidate<number>[] = [];
  let inCatalog = false;
  let collectingCapacitanceColumn = false;

  for (const line of lines) {
    if (isFamilyCatalogSectionLine(line)) {
      inCatalog = true;
    }

    if (HV_CAPACITOR_FAMILY_CATALOG_VOLTAGE_ROW_PATTERN.test(line)) {
      collectingCapacitanceColumn = inCatalog;
      continue;
    }

    if (!collectingCapacitanceColumn) {
      continue;
    }

    if (looksLikeCatalogModelCode(line)) {
      collectingCapacitanceColumn = false;
      continue;
    }

    const parsed = parseBareDecimalLine(line);

    if (parsed === null || parsed <= 0) {
      continue;
    }

    candidates.push({
      rawValue: `${line} uF`,
      normalizedValue: Number(parsed.toFixed(6)),
      evidenceSnippet: line,
      confidence: 0.66,
    });
  }

  return buildConflictField(candidates, formatCapacitanceValue, 0.66);
}

function preferCatalogConflict(baseField: ExtractedField<number>, catalogConflict: ExtractedField<number> | null) {
  if (!catalogConflict) {
    return baseField;
  }

  if (baseField.status === 'extracted') {
    return baseField;
  }

  return catalogConflict;
}

function buildMissingNotes(result: Omit<HvCapacitorExtractResult, 'notesMissing'>): MissingNote[] {
  const notes: MissingNote[] = [];

  const fields: Array<[string, ExtractedField<unknown>]> = [
    ['part_name', result.partName],
    ['rated_voltage_kv', result.ratedVoltageKv],
    ['capacitance_uf', result.capacitanceUf],
    ['pulse_current_ka', result.pulseCurrentKa],
    ['dv_dt', result.dvDt],
    ['esr_mohm', result.esrMohm],
    ['cooling_type', result.coolingType],
    ['mounting_style', result.mountingStyle],
    ['dimensions', result.dimensions],
    ['lifecycle_or_pulse_count', result.lifecycleOrPulseCount],
  ];

  for (const [field, value] of fields) {
    if (value.status === 'missing') {
      notes.push({ field, reason: 'not_found' });
    }

    if (value.status === 'conflict') {
      notes.push({ field, reason: 'ambiguous', detail: value.rawValue ?? undefined });
    }

    if (value.status !== 'missing' && value.confidence > 0 && value.confidence < 0.6) {
      notes.push({ field, reason: 'low_confidence', detail: value.rawValue ?? undefined });
    }
  }

  return notes;
}

export function extractHvCapacitor(text: string, bomInput?: BomInput): HvCapacitorExtractResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const partName = extractPartName(lines);
  const category = createField<typeof HV_CAPACITOR_CATEGORY>(
    'inferred',
    HV_CAPACITOR_CATEGORY,
    HV_CAPACITOR_CATEGORY,
    'HV Capacitor only ingest path',
    1,
  );
  const ratedVoltageBase = extractNumericField(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.ratedVoltage],
    parseVoltageToKv,
    (value) => formatNumericValue(value, 'kV'),
  );
  const capacitanceBase = extractNumericField(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.capacitance],
    parseCapacitanceToUf,
    formatCapacitanceValue,
  );
  const ratedVoltageGeneric = preferCatalogConflict(ratedVoltageBase, extractFamilyCatalogVoltageConflict(lines));
  const capacitanceGeneric = preferCatalogConflict(capacitanceBase, extractFamilyCatalogCapacitanceConflict(lines));
  const pulseCurrentKa = extractNumericField(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.pulseCurrent],
    parseCurrentToKa,
    (value) => formatNumericValue(value, 'kA'),
  );
  const dvDt = extractNumericField(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.dvDt],
    parseDvDtToKvPerUs,
    (value) => formatNumericValue(value, 'kV/us'),
  );
  const esrMohm = extractNumericField(
    lines,
    [...HV_CAPACITOR_EXTRACTION_PATTERNS.esr],
    parseResistanceToMohm,
    (value) => formatNumericValue(value, 'mOhm'),
  );
  const coolingType = extractTextField(lines, [...HV_CAPACITOR_EXTRACTION_PATTERNS.cooling], inferCoolingType);
  const mountingStyle = extractTextField(lines, [...HV_CAPACITOR_EXTRACTION_PATTERNS.mounting], inferMountingStyle);
  const dimensionsBase = extractDimensions(lines);
  const lifecycleOrPulseCount = extractLifecycle(lines);
  const alignedFields = alignSingleModelTableFields(lines, bomInput);

  const ratedVoltageKv = preferAnchoredField(ratedVoltageGeneric, alignedFields?.ratedVoltageKv ?? null);
  const capacitanceUf = preferAnchoredField(capacitanceGeneric, alignedFields?.capacitanceUf ?? null);
  const dimensions = preferAnchoredField(dimensionsBase, alignedFields?.dimensions ?? null);

  const withoutNotes = {
    partName,
    category,
    ratedVoltageKv,
    capacitanceUf,
    pulseCurrentKa,
    dvDt,
    esrMohm,
    coolingType,
    mountingStyle,
    dimensions,
    lifecycleOrPulseCount,
  };

  return {
    ...withoutNotes,
    notesMissing: buildMissingNotes(withoutNotes),
  };
}
