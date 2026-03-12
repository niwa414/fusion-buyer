import type {
  CalibrationFieldSummary,
  FieldCalibrationRow,
  HvCapacitorExtractResult,
  NormalizedHvCapacitor,
  RequiredFieldCheck,
  ReviewSummary,
} from './types';

type ExtractFieldKey =
  | 'partName'
  | 'category'
  | 'ratedVoltageKv'
  | 'capacitanceUf'
  | 'pulseCurrentKa'
  | 'dvDt'
  | 'esrMohm'
  | 'coolingType'
  | 'mountingStyle'
  | 'dimensions'
  | 'lifecycleOrPulseCount';

interface FieldMapping {
  field: string;
  extractKey: ExtractFieldKey;
  readNormalizedValue: (normalized: NormalizedHvCapacitor) => unknown;
  relatedReviewFields?: string[];
}

const fieldMappings: FieldMapping[] = [
  { field: 'part_name', extractKey: 'partName', readNormalizedValue: (normalized) => normalized.partName },
  { field: 'category', extractKey: 'category', readNormalizedValue: (normalized) => normalized.category },
  { field: 'rated_voltage_kv', extractKey: 'ratedVoltageKv', readNormalizedValue: (normalized) => normalized.ratedVoltageKv },
  { field: 'capacitance_uf', extractKey: 'capacitanceUf', readNormalizedValue: (normalized) => normalized.capacitanceUf },
  { field: 'pulse_current_ka', extractKey: 'pulseCurrentKa', readNormalizedValue: (normalized) => normalized.pulseCurrentKa },
  { field: 'dv_dt', extractKey: 'dvDt', readNormalizedValue: (normalized) => normalized.dvDt },
  { field: 'esr_mohm', extractKey: 'esrMohm', readNormalizedValue: (normalized) => normalized.esrMohm },
  { field: 'cooling_type', extractKey: 'coolingType', readNormalizedValue: (normalized) => normalized.coolingType },
  {
    field: 'mounting_style',
    extractKey: 'mountingStyle',
    readNormalizedValue: (normalized) => normalized.mountingStyle,
    relatedReviewFields: ['mounting_envelope'],
  },
  {
    field: 'dimensions',
    extractKey: 'dimensions',
    readNormalizedValue: (normalized) => normalized.dimensions,
    relatedReviewFields: ['mounting_envelope'],
  },
  {
    field: 'lifecycle_or_pulse_count',
    extractKey: 'lifecycleOrPulseCount',
    readNormalizedValue: (normalized) => normalized.lifecycleOrPulseCount,
  },
];

export function buildNormalizedFieldRecord(normalized: NormalizedHvCapacitor) {
  return Object.fromEntries(fieldMappings.map((mapping) => [mapping.field, mapping.readNormalizedValue(normalized)]));
}

export function getRequiredFieldChecks(normalized: NormalizedHvCapacitor): RequiredFieldCheck[] {
  return [
    {
      field: 'part_name',
      satisfied: Boolean(normalized.partName),
      detail: normalized.partName ? `Captured as "${normalized.partName}".` : 'Missing part name.',
    },
    {
      field: 'rated_voltage_kv',
      satisfied: normalized.ratedVoltageKv !== null,
      detail: normalized.ratedVoltageKv !== null ? `${normalized.ratedVoltageKv} kV` : 'Missing rated voltage.',
    },
    {
      field: 'capacitance_uf',
      satisfied: normalized.capacitanceUf !== null,
      detail: normalized.capacitanceUf !== null ? `${normalized.capacitanceUf} uF` : 'Missing capacitance.',
    },
    {
      field: 'mounting_style_or_dimensions',
      satisfied: Boolean((normalized.mountingStyle && normalized.mountingStyle !== 'unknown') || normalized.dimensions),
      detail:
        normalized.mountingStyle && normalized.mountingStyle !== 'unknown'
          ? `Mounting style: ${normalized.mountingStyle}`
          : normalized.dimensions
            ? `Dimensions: ${normalized.dimensions}`
            : 'Need mounting style or dimensions.',
    },
  ];
}

function collectFieldReviewIssues(
  field: string,
  normalized: NormalizedHvCapacitor,
  relatedReviewFields: string[] = [],
) {
  const matchingReviewIssues = normalized.reviewIssues
    .filter((issue) => issue.field === field || relatedReviewFields.includes(issue.field))
    .map((issue) => issue.message);
  const matchingMissingNotes = normalized.missingNotes
    .filter((note) => note.field === field || relatedReviewFields.includes(note.field))
    .map((note) => (note.detail ? `${note.reason}: ${note.detail}` : note.reason));

  return [...new Set([...matchingReviewIssues, ...matchingMissingNotes])];
}

export function buildFieldCalibrationRows(
  extracted: HvCapacitorExtractResult,
  normalized: NormalizedHvCapacitor,
): FieldCalibrationRow[] {
  return fieldMappings.map((mapping) => {
    const extractedField = extracted[mapping.extractKey];

    return {
      field: mapping.field,
      rawValue: extractedField.rawValue,
      normalizedValue: mapping.readNormalizedValue(normalized),
      extractedNormalizedValue: extractedField.normalizedValue,
      status: extractedField.status,
      confidence: extractedField.confidence,
      evidenceSnippet: extractedField.evidenceSnippet,
      reviewIssues: collectFieldReviewIssues(mapping.field, normalized, mapping.relatedReviewFields),
    };
  });
}

export function getLowConfidenceFields(rows: FieldCalibrationRow[], threshold = 0.6) {
  return rows.filter((row) => row.status !== 'missing' && row.confidence > 0 && row.confidence < threshold).map((row) => row.field);
}

export function buildCalibrationFieldSummary(
  rows: FieldCalibrationRow[],
  requiredFields: RequiredFieldCheck[],
  lowConfidenceThreshold = 0.6,
): CalibrationFieldSummary {
  return {
    extractedFieldCount: rows.filter((row) => row.status === 'extracted' || row.status === 'inferred').length,
    missingFieldCount: rows.filter((row) => row.status === 'missing').length,
    conflictFieldCount: rows.filter((row) => row.status === 'conflict').length,
    lowConfidenceFieldCount: getLowConfidenceFields(rows, lowConfidenceThreshold).length,
    requiredFieldsSatisfied: requiredFields.filter((field) => field.satisfied).map((field) => field.field),
    requiredFieldsUnsatisfied: requiredFields.filter((field) => !field.satisfied).map((field) => field.field),
  };
}

export function buildReviewSummary(
  extracted: HvCapacitorExtractResult,
  normalized: NormalizedHvCapacitor,
): ReviewSummary {
  const rows = buildFieldCalibrationRows(extracted, normalized);

  return {
    readiness: normalized.readiness,
    blockingIssues: normalized.reviewIssues.filter((issue) => issue.blocking).map((issue) => issue.message),
    missingFields: rows.filter((row) => row.status === 'missing').map((row) => row.field),
    conflictFields: rows.filter((row) => row.status === 'conflict').map((row) => row.field),
    requiredFields: getRequiredFieldChecks(normalized),
  };
}
