import type { PartRecord } from '../domain/types';

export type IngestStatus = 'ok' | 'empty_text_layer' | 'parse_error' | 'scanned_or_unsupported';

export type FieldStatus = 'extracted' | 'inferred' | 'missing' | 'conflict';

export type ReviewReason = 'not_found' | 'ambiguous' | 'unit_conflict' | 'low_confidence' | 'required_missing' | 'family_catalog_ambiguous';

export type CardReadiness = 'ready' | 'draft';

export type CoolingType = 'air' | 'oil' | 'water' | 'passive' | 'unknown';

export type MountingStyle = 'stud' | 'busbar' | 'chassis' | 'clamp' | 'unknown';

export interface IngestResult {
  status: IngestStatus;
  text: string;
  pageCount: number;
  warnings: string[];
  fileName: string;
}

export interface PreprocessedTextResult {
  text: string;
  applied: boolean;
  notes: string[];
}

export interface ExtractedField<T> {
  rawValue: string | null;
  normalizedValue: T | null;
  evidenceSnippet: string | null;
  confidence: number;
  status: FieldStatus;
}

export interface MissingNote {
  field: string;
  reason: ReviewReason;
  detail?: string;
}

export interface BomInput {
  partName?: string;
  manufacturer?: string;
  mpn?: string;
  quantity?: string;
  ratedVoltageKv?: string;
  capacitanceUf?: string;
  mountingStyle?: string;
  dimensions?: string;
  targetLeadTimeWeeks?: string;
  annualVolume?: string;
  batchSize?: string;
  qualityTier?: PartRecord['qualityTier'];
  notes?: string;
}

export interface HvCapacitorExtractResult {
  partName: ExtractedField<string>;
  category: ExtractedField<'HV Capacitor'>;
  ratedVoltageKv: ExtractedField<number>;
  capacitanceUf: ExtractedField<number>;
  pulseCurrentKa: ExtractedField<number>;
  dvDt: ExtractedField<number>;
  esrMohm: ExtractedField<number>;
  coolingType: ExtractedField<CoolingType>;
  mountingStyle: ExtractedField<MountingStyle>;
  dimensions: ExtractedField<string>;
  lifecycleOrPulseCount: ExtractedField<string>;
  notesMissing: MissingNote[];
}

export interface ReviewIssue {
  field: string;
  reason: ReviewReason;
  message: string;
  blocking: boolean;
}

export interface FieldCalibrationRow {
  field: string;
  rawValue: string | null;
  normalizedValue: unknown;
  extractedNormalizedValue: unknown;
  status: FieldStatus;
  confidence: number;
  evidenceSnippet: string | null;
  reviewIssues: string[];
}

export interface RequiredFieldCheck {
  field: string;
  satisfied: boolean;
  detail: string;
}

export interface ReviewSummary {
  readiness: CardReadiness;
  blockingIssues: string[];
  missingFields: string[];
  conflictFields: string[];
  requiredFields: RequiredFieldCheck[];
}

export interface CalibrationFieldSummary {
  extractedFieldCount: number;
  missingFieldCount: number;
  conflictFieldCount: number;
  lowConfidenceFieldCount: number;
  requiredFieldsSatisfied: string[];
  requiredFieldsUnsatisfied: string[];
}

export interface HvCapacitorExpectedTemplate {
  partName: string | null;
  ratedVoltageKv: number | null;
  capacitanceUf: number | null;
  pulseCurrentKa: number | null;
  dvDt: number | null;
  esrMohm: number | null;
  coolingType: CoolingType | null;
  mountingStyle: MountingStyle | null;
  dimensions: string | null;
  lifecycleOrPulseCount: string | null;
  readiness: CardReadiness;
}

export interface NormalizedHvCapacitor {
  sourceFileName: string | null;
  category: 'HV Capacitor';
  partName: string | null;
  manufacturer: string | null;
  mpn: string | null;
  quantity: string | null;
  ratedVoltageKv: number | null;
  capacitanceUf: number | null;
  pulseCurrentKa: number | null;
  dvDt: number | null;
  esrMohm: number | null;
  coolingType: CoolingType;
  mountingStyle: MountingStyle | null;
  dimensions: string | null;
  lifecycleOrPulseCount: string | null;
  targetLeadTimeWeeks: number;
  annualVolume: number;
  batchSize: string;
  qualityTier: PartRecord['qualityTier'];
  notes: string | null;
  missingNotes: MissingNote[];
  reviewIssues: ReviewIssue[];
  readiness: CardReadiness;
}

export interface IngestPipelineResult {
  ingest: IngestResult;
  extracted: HvCapacitorExtractResult | null;
  normalized: NormalizedHvCapacitor | null;
}
