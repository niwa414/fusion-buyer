import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

import { extractHvCapacitor } from '../src/ingest/extract-hv-capacitor';
import { normalizeHvCapacitor } from '../src/ingest/normalize-hv-capacitor';
import {
  buildCalibrationFieldSummary,
  buildFieldCalibrationRows,
  buildNormalizedFieldRecord,
  buildReviewSummary,
  getLowConfidenceFields,
} from '../src/ingest/observability';
import { finalizePdfTextIngest } from '../src/ingest/pdf';
import { preprocessHvCapacitorText } from '../src/ingest/preprocess-hv-capacitor-text';
import type {
  CalibrationFieldSummary,
  HvCapacitorExpectedTemplate,
  NormalizedHvCapacitor,
} from '../src/ingest/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(here, '../src/ingest/fixtures');
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const defaultFixtures = [
  'hv-capacitor-ready-alpha.txt',
  'hv-capacitor-ready-beta.txt',
  'hv-capacitor-draft-missing.txt',
];

interface CliOptions {
  emitExpectedTemplate: boolean;
  outputPath: string | null;
  sampleInputs: string[];
}

interface ExpectedFieldComparison {
  field: string;
  expectedValue: unknown;
  actualValue: unknown;
  matches: boolean;
}

interface ExpectedComparison {
  expectedPath: string;
  mismatchFields: string[];
  fieldComparisons: ExpectedFieldComparison[];
  unknownExpectedKeys: string[];
}

interface CalibrationResult {
  samplePath: string;
  fileName: string;
  ingestStatus: string;
  readiness: NormalizedHvCapacitor['readiness'];
  preprocessApplied: boolean;
  preprocessNotes: string[];
  summary: CalibrationFieldSummary;
  requiredFieldStatus: ReturnType<typeof buildReviewSummary>['requiredFields'];
  blockingIssues: string[];
  suggestions: string[];
  lowConfidenceFields: string[];
  fieldRows: ReturnType<typeof buildFieldCalibrationRows>;
  normalizedResult: NormalizedHvCapacitor;
  expectedTemplate?: HvCapacitorExpectedTemplate;
  expectedComparison: ExpectedComparison | null;
}

function parseArgs(argv: string[]): CliOptions {
  const sampleInputs: string[] = [];
  let emitExpectedTemplate = false;
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--emit-expected-template') {
      emitExpectedTemplate = true;
      continue;
    }

    if (value === '--out') {
      outputPath = argv[index + 1] ? path.resolve(process.cwd(), argv[index + 1]) : null;
      index += 1;
      continue;
    }

    sampleInputs.push(value);
  }

  return {
    emitExpectedTemplate,
    outputPath,
    sampleInputs,
  };
}

function resolveSamplePath(input: string) {
  if (path.isAbsolute(input)) {
    return input;
  }

  const fixtureCandidate = path.join(fixtureRoot, input);

  if (existsSync(fixtureCandidate)) {
    return fixtureCandidate;
  }

  return path.resolve(process.cwd(), input);
}

function resolveExpectedPath(samplePath: string) {
  const parsed = path.parse(samplePath);

  return path.join(parsed.dir, `${parsed.name}.expected.json`);
}

function getNormalizedPropertyRecord(normalized: NormalizedHvCapacitor) {
  return {
    sourceFileName: normalized.sourceFileName,
    category: normalized.category,
    partName: normalized.partName,
    manufacturer: normalized.manufacturer,
    mpn: normalized.mpn,
    quantity: normalized.quantity,
    ratedVoltageKv: normalized.ratedVoltageKv,
    capacitanceUf: normalized.capacitanceUf,
    pulseCurrentKa: normalized.pulseCurrentKa,
    dvDt: normalized.dvDt,
    esrMohm: normalized.esrMohm,
    coolingType: normalized.coolingType,
    mountingStyle: normalized.mountingStyle,
    dimensions: normalized.dimensions,
    lifecycleOrPulseCount: normalized.lifecycleOrPulseCount,
    targetLeadTimeWeeks: normalized.targetLeadTimeWeeks,
    annualVolume: normalized.annualVolume,
    batchSize: normalized.batchSize,
    qualityTier: normalized.qualityTier,
    notes: normalized.notes,
    missingNotes: normalized.missingNotes,
    reviewIssues: normalized.reviewIssues,
    readiness: normalized.readiness,
  };
}

function buildExpectedComparison(samplePath: string, normalized: NormalizedHvCapacitor): ExpectedComparison | null {
  const expectedPath = resolveExpectedPath(samplePath);

  if (!existsSync(expectedPath)) {
    return null;
  }

  const rawExpected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  const expectedRecord = rawExpected.normalizedResult ?? rawExpected.normalized ?? rawExpected;
  const actualFieldRecord = buildNormalizedFieldRecord(normalized);
  const actualPropertyRecord = getNormalizedPropertyRecord(normalized);
  const fieldComparisons: ExpectedFieldComparison[] = [];
  const unknownExpectedKeys: string[] = [];

  for (const [expectedKey, expectedValue] of Object.entries(expectedRecord)) {
    if (expectedKey in actualFieldRecord) {
      const actualValue = actualFieldRecord[expectedKey as keyof typeof actualFieldRecord];
      fieldComparisons.push({
        field: expectedKey,
        expectedValue,
        actualValue,
        matches: isDeepStrictEqual(actualValue, expectedValue),
      });
      continue;
    }

    if (expectedKey in actualPropertyRecord) {
      const actualValue = actualPropertyRecord[expectedKey as keyof typeof actualPropertyRecord];
      fieldComparisons.push({
        field: expectedKey,
        expectedValue,
        actualValue,
        matches: isDeepStrictEqual(actualValue, expectedValue),
      });
      continue;
    }

    unknownExpectedKeys.push(expectedKey);
  }

  return {
    expectedPath,
    mismatchFields: fieldComparisons.filter((comparison) => !comparison.matches).map((comparison) => comparison.field),
    fieldComparisons,
    unknownExpectedKeys,
  };
}

function buildExpectedTemplate(normalized: NormalizedHvCapacitor): HvCapacitorExpectedTemplate {
  return {
    partName: normalized.partName,
    ratedVoltageKv: normalized.ratedVoltageKv,
    capacitanceUf: normalized.capacitanceUf,
    pulseCurrentKa: normalized.pulseCurrentKa,
    dvDt: normalized.dvDt,
    esrMohm: normalized.esrMohm,
    coolingType: normalized.coolingType === 'unknown' ? null : normalized.coolingType,
    mountingStyle: normalized.mountingStyle,
    dimensions: normalized.dimensions,
    lifecycleOrPulseCount: normalized.lifecycleOrPulseCount,
    readiness: normalized.readiness,
  };
}

function buildSuggestions(normalized: NormalizedHvCapacitor) {
  const suggestions = new Set<string>();

  if (normalized.reviewIssues.some((issue) => issue.reason === 'family_catalog_ambiguous')) {
    suggestions.add('Provide BOM/MPN or paste only the single-model parameter block.');
  }

  if (normalized.reviewIssues.some((issue) => issue.field === 'mounting_envelope' && issue.reason === 'required_missing')) {
    suggestions.add('Add a concrete dimensions line or mounting-style line from the target single-model section.');
  }

  return [...suggestions];
}

function calibrateFile(samplePath: string, emitExpectedTemplate: boolean): CalibrationResult {
  const text = readFileSync(samplePath, 'utf8');
  const ingest = finalizePdfTextIngest({
    fileName: path.basename(samplePath),
    pageTexts: [text],
  });
  const preprocessed = preprocessHvCapacitorText(ingest.text);
  const extracted = extractHvCapacitor(preprocessed.text);
  const normalized = normalizeHvCapacitor(extracted, {}, ingest.fileName);
  const reviewSummary = buildReviewSummary(extracted, normalized);
  const fieldRows = buildFieldCalibrationRows(extracted, normalized);
  const observedFieldRows = fieldRows.filter((row) => row.field !== 'category');
  const lowConfidenceFields = getLowConfidenceFields(observedFieldRows, LOW_CONFIDENCE_THRESHOLD);

  const result: CalibrationResult = {
    samplePath,
    fileName: ingest.fileName,
    ingestStatus: ingest.status,
    readiness: normalized.readiness,
    preprocessApplied: preprocessed.applied,
    preprocessNotes: preprocessed.notes,
    summary: buildCalibrationFieldSummary(observedFieldRows, reviewSummary.requiredFields, LOW_CONFIDENCE_THRESHOLD),
    requiredFieldStatus: reviewSummary.requiredFields,
    blockingIssues: reviewSummary.blockingIssues,
    suggestions: buildSuggestions(normalized),
    lowConfidenceFields,
    fieldRows,
    normalizedResult: normalized,
    expectedComparison: buildExpectedComparison(samplePath, normalized),
  };

  if (emitExpectedTemplate) {
    result.expectedTemplate = buildExpectedTemplate(normalized);
  }

  return result;
}

function writeOutputFile(outputPath: string, results: CalibrationResult[]) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const samplePaths = (cli.sampleInputs.length > 0 ? cli.sampleInputs : defaultFixtures).map(resolveSamplePath);
  const results = samplePaths.map((samplePath) => calibrateFile(samplePath, cli.emitExpectedTemplate));
  const payload = JSON.stringify(results, null, 2);

  if (cli.outputPath) {
    writeOutputFile(cli.outputPath, results);
  }

  console.log(payload);
}

main();
