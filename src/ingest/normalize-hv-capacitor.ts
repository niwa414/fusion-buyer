import type {
  BomInput,
  CardReadiness,
  CoolingType,
  ExtractedField,
  HvCapacitorExtractResult,
  MissingNote,
  MountingStyle,
  NormalizedHvCapacitor,
  ReviewIssue,
} from './types';
import {
  hasFamilyCatalogHints,
  HV_CAPACITOR_MOUNTING_STYLE_KEYWORDS,
  inferKeywordValue,
  looksLikeSpecificModelAnchor,
} from './hv-capacitor-rules';

function parseNumberInput(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/,/g, '').trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMountingStyleInput(value?: string): MountingStyle | null {
  if (!value) {
    return null;
  }

  return inferKeywordValue(value, HV_CAPACITOR_MOUNTING_STYLE_KEYWORDS) ?? 'unknown';
}

function hasUsableValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined && value !== '';
}

function mergeText(manualValue: string | undefined, extracted: ExtractedField<string>) {
  if (manualValue && manualValue.trim()) {
    return manualValue.trim();
  }

  return extracted.normalizedValue;
}

function mergeNumber(manualValue: string | undefined, extracted: ExtractedField<number>) {
  const parsedManual = parseNumberInput(manualValue);

  if (parsedManual !== null) {
    return parsedManual;
  }

  return extracted.normalizedValue;
}

function mergeMountingStyle(manualValue: string | undefined, extracted: ExtractedField<MountingStyle>) {
  const parsedManual = normalizeMountingStyleInput(manualValue);

  if (parsedManual !== null) {
    return parsedManual;
  }

  return extracted.normalizedValue;
}

function createIssue(field: string, reason: ReviewIssue['reason'], message: string, blocking = false): ReviewIssue {
  return { field, reason, message, blocking };
}

function reviewFieldLabel(field: string) {
  switch (field) {
    case 'rated_voltage_kv':
      return 'rated voltage';
    case 'capacitance_uf':
      return 'capacitance';
    default:
      return field;
  }
}

function countConflictCandidates(rawValue: string | null) {
  if (!rawValue) {
    return 0;
  }

  return rawValue
    .replace(/^candidates:\s*/i, '')
    .split(/\s*,\s*/)
    .map((value) => value.trim())
    .filter(Boolean).length;
}

function hasSingleModelAnchor(partName: string | null, bomInput: BomInput) {
  return Boolean(bomInput.mpn?.trim()) || Boolean((bomInput.partName && looksLikeSpecificModelAnchor(bomInput.partName)) || (partName && looksLikeSpecificModelAnchor(partName)));
}

function isFamilyCatalogConflict(field: string, value: ExtractedField<unknown>, partName: string | null, bomInput: BomInput) {
  if (!['rated_voltage_kv', 'capacitance_uf'].includes(field) || value.status !== 'conflict') {
    return false;
  }

  if (hasSingleModelAnchor(partName, bomInput)) {
    return false;
  }

  const candidateCount = countConflictCandidates(value.rawValue);
  const evidence = `${value.rawValue ?? ''} ${value.evidenceSnippet ?? ''}`;

  return candidateCount >= 2 || hasFamilyCatalogHints(evidence);
}

export function getCardReadiness(normalized: Pick<NormalizedHvCapacitor, 'partName' | 'ratedVoltageKv' | 'capacitanceUf' | 'mountingStyle' | 'dimensions'>): CardReadiness {
  const hasMountEnvelope = (normalized.mountingStyle && normalized.mountingStyle !== 'unknown') || normalized.dimensions;

  if (!normalized.partName || normalized.ratedVoltageKv === null || normalized.capacitanceUf === null || !hasMountEnvelope) {
    return 'draft';
  }

  return 'ready';
}

function mergeMissingNotes(extracted: HvCapacitorExtractResult, reviewIssues: ReviewIssue[]): MissingNote[] {
  const notes = [...extracted.notesMissing];

  for (const issue of reviewIssues) {
    if (issue.reason === 'required_missing' || issue.reason === 'low_confidence' || issue.reason === 'family_catalog_ambiguous') {
      notes.push({
        field: issue.field,
        reason: issue.reason,
        detail: issue.message,
      });
    }
  }

  return notes;
}

export function normalizeHvCapacitor(
  extracted: HvCapacitorExtractResult,
  bomInput: BomInput = {},
  sourceFileName: string | null = null,
): NormalizedHvCapacitor {
  const partName = mergeText(bomInput.partName, extracted.partName);
  const ratedVoltageKv = mergeNumber(bomInput.ratedVoltageKv, extracted.ratedVoltageKv);
  const capacitanceUf = mergeNumber(bomInput.capacitanceUf, extracted.capacitanceUf);
  const pulseCurrentKa = extracted.pulseCurrentKa.normalizedValue;
  const dvDt = extracted.dvDt.normalizedValue;
  const esrMohm = extracted.esrMohm.normalizedValue;
  const coolingType = extracted.coolingType.normalizedValue ?? 'unknown';
  const mountingStyle = mergeMountingStyle(bomInput.mountingStyle, extracted.mountingStyle);
  const dimensions = mergeText(bomInput.dimensions, extracted.dimensions);
  const lifecycleOrPulseCount = extracted.lifecycleOrPulseCount.normalizedValue;
  const targetLeadTimeWeeks = parseNumberInput(bomInput.targetLeadTimeWeeks) ?? 16;
  const annualVolume = parseNumberInput(bomInput.annualVolume) ?? Math.max(parseNumberInput(bomInput.quantity) ?? 24, 1);
  const batchSize = bomInput.batchSize?.trim() || (bomInput.quantity?.trim() ? `${bomInput.quantity.trim()} units` : '2-6 units');
  const qualityTier =
    bomInput.qualityTier ??
    (hasUsableValue(pulseCurrentKa) || hasUsableValue(dvDt) || ratedVoltageKv !== null && ratedVoltageKv >= 20
      ? 'Pulse Power / Critical'
      : 'Advanced Hardware');

  const reviewIssues: ReviewIssue[] = [];

  if (!partName) {
    reviewIssues.push(createIssue('part_name', 'required_missing', 'Part name is required before generating a formal card.', true));
  }

  if (ratedVoltageKv === null) {
    reviewIssues.push(createIssue('rated_voltage_kv', 'required_missing', 'Rated voltage is required for HV capacitor matching.', true));
  }

  if (capacitanceUf === null) {
    reviewIssues.push(createIssue('capacitance_uf', 'required_missing', 'Capacitance is required for HV capacitor matching.', true));
  }

  if ((!mountingStyle || mountingStyle === 'unknown') && !dimensions) {
    reviewIssues.push(
      createIssue('mounting_envelope', 'required_missing', 'Need either mounting style or dimensions to create a sourcing-ready card.', true),
    );
  }

  const fieldReviewTargets: Array<[string, ExtractedField<unknown>]> = [
    ['rated_voltage_kv', extracted.ratedVoltageKv],
    ['capacitance_uf', extracted.capacitanceUf],
    ['pulse_current_ka', extracted.pulseCurrentKa],
    ['dv_dt', extracted.dvDt],
    ['esr_mohm', extracted.esrMohm],
    ['cooling_type', extracted.coolingType],
    ['mounting_style', extracted.mountingStyle],
    ['dimensions', extracted.dimensions],
    ['lifecycle_or_pulse_count', extracted.lifecycleOrPulseCount],
  ];

  for (const [field, value] of fieldReviewTargets) {
    if (value.status === 'conflict') {
      if (isFamilyCatalogConflict(field, value, partName, bomInput)) {
        reviewIssues.push(
          createIssue(
            field,
            'family_catalog_ambiguous',
            `Multiple plausible ${reviewFieldLabel(field)} candidates detected in a family catalog. Provide BOM/MPN or paste only the single-model parameter block.`,
            true,
          ),
        );
      } else {
        reviewIssues.push(createIssue(field, 'ambiguous', `Multiple conflicting values detected for ${field}.`, field === 'rated_voltage_kv'));
      }
    }

    if (value.status !== 'missing' && value.confidence > 0 && value.confidence < 0.6) {
      reviewIssues.push(createIssue(field, 'low_confidence', `${field} was extracted with low confidence and should be reviewed.`));
    }
  }

  const readiness = getCardReadiness({
    partName,
    ratedVoltageKv,
    capacitanceUf,
    mountingStyle,
    dimensions,
  });

  return {
    sourceFileName,
    category: 'HV Capacitor',
    partName,
    manufacturer: bomInput.manufacturer?.trim() || null,
    mpn: bomInput.mpn?.trim() || null,
    quantity: bomInput.quantity?.trim() || null,
    ratedVoltageKv,
    capacitanceUf,
    pulseCurrentKa,
    dvDt,
    esrMohm,
    coolingType: (coolingType as CoolingType) ?? 'unknown',
    mountingStyle,
    dimensions,
    lifecycleOrPulseCount,
    targetLeadTimeWeeks,
    annualVolume,
    batchSize,
    qualityTier,
    notes: bomInput.notes?.trim() || null,
    missingNotes: mergeMissingNotes(extracted, reviewIssues),
    reviewIssues,
    readiness,
  };
}
