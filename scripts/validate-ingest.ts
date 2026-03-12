import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractHvCapacitor } from '../src/ingest/extract-hv-capacitor';
import { normalizeHvCapacitor } from '../src/ingest/normalize-hv-capacitor';
import { finalizePdfTextIngest } from '../src/ingest/pdf';
import { preprocessHvCapacitorText } from '../src/ingest/preprocess-hv-capacitor-text';
import { toPartRecord } from '../src/ingest/to-part-record';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(here, '../src/ingest/fixtures');
const goldenRoot = path.resolve(here, '../src/ingest/golden');

function readFixture(fileName: string) {
  return readFileSync(path.join(fixtureRoot, fileName), 'utf8');
}

function readGolden(fileName: string) {
  return JSON.parse(readFileSync(path.join(goldenRoot, fileName), 'utf8'));
}

function validateReadyFixture(fileName: string, goldenFileName: string, expectedVoltageKv: number, expectedCapacitanceUf: number) {
  const text = readFixture(fileName);
  const ingest = finalizePdfTextIngest({
    fileName,
    pageTexts: [text],
  });

  assert.equal(ingest.status, 'ok');

  const extracted = extractHvCapacitor(preprocessHvCapacitorText(ingest.text).text);
  const normalized = normalizeHvCapacitor(extracted, {}, fileName);
  const part = toPartRecord(normalized);

  assert.equal(normalized.readiness, 'ready');
  assert.equal(normalized.ratedVoltageKv, expectedVoltageKv);
  assert.equal(normalized.capacitanceUf, expectedCapacitanceUf);
  assert.ok(part);
  assert.deepEqual(normalized, readGolden(goldenFileName));
}

function validateTableHeavyFixture(fileName: string) {
  const text = readFixture(fileName);
  const preprocessed = preprocessHvCapacitorText(text);
  const extracted = extractHvCapacitor(preprocessed.text);
  const normalized = normalizeHvCapacitor(extracted, {}, fileName);

  assert.equal(preprocessed.applied, true);
  assert.notEqual(extracted.partName.status, 'missing');
  assert.ok(normalized.partName);
  assert.ok(!/safety/i.test(normalized.partName));
  assert.notEqual(extracted.ratedVoltageKv.status, 'conflict');
  assert.notEqual(normalized.ratedVoltageKv, null);
  assert.notEqual(extracted.capacitanceUf.status, 'conflict');
  assert.notEqual(normalized.capacitanceUf, null);
  assert.equal(extracted.dimensions.status, 'missing');
  assert.equal(normalized.dimensions, null);
  assert.equal(normalized.readiness, 'draft');
}

function validateFamilyCatalogFixture(fileName: string) {
  const text = readFixture(fileName);
  const preprocessed = preprocessHvCapacitorText(text);
  const extracted = extractHvCapacitor(preprocessed.text);
  const normalized = normalizeHvCapacitor(extracted, {}, fileName);

  assert.notEqual(normalized.partName, 'warranty');
  assert.equal(normalized.dimensions, null);
  assert.equal(extracted.dimensions.status, 'missing');
  assert.equal(extracted.ratedVoltageKv.status, 'conflict');
  assert.equal(extracted.capacitanceUf.status, 'conflict');
  assert.match(extracted.ratedVoltageKv.rawValue ?? '', /^candidates:/i);
  assert.match(extracted.capacitanceUf.rawValue ?? '', /^candidates:/i);
  assert.equal(normalized.readiness, 'draft');
  assert.ok(normalized.reviewIssues.some((issue) => issue.field === 'rated_voltage_kv' && issue.reason === 'family_catalog_ambiguous'));
  assert.ok(normalized.reviewIssues.some((issue) => issue.field === 'capacitance_uf' && issue.reason === 'family_catalog_ambiguous'));
  assert.ok(normalized.reviewIssues.some((issue) => issue.message.includes('Provide BOM/MPN or paste only the single-model parameter block.')));
}

function validateSingleModelAnchorFixture(fileName: string) {
  const text = readFixture(fileName);
  const preprocessed = preprocessHvCapacitorText(text);
  const extracted = extractHvCapacitor(preprocessed.text);
  const normalized = normalizeHvCapacitor(extracted, {}, fileName);
  const part = toPartRecord(normalized);

  assert.equal(normalized.partName, 'KVX01S104K0T');
  assert.equal(normalized.ratedVoltageKv, 1);
  assert.equal(normalized.capacitanceUf, 0.1);
  assert.equal(normalized.dimensions, '1.81 x 1.47 x 0.17 inches');
  assert.equal(extracted.dimensions.status, 'extracted');
  assert.equal(normalized.readiness, 'ready');
  assert.ok(part);
  assert.deepEqual(normalized, readGolden('hv-capacitor-single-model-anchor.normalized.json'));
}

function validateExxeliaReadyFixture(fileName: string) {
  const text = readFixture(fileName);
  const preprocessed = preprocessHvCapacitorText(text);
  const extracted = extractHvCapacitor(preprocessed.text);
  const normalized = normalizeHvCapacitor(extracted, {}, fileName);
  const part = toPartRecord(normalized);

  assert.equal(normalized.partName, 'Snubber Capacitor with Axial Leads');
  assert.equal(normalized.ratedVoltageKv, 3);
  assert.equal(normalized.capacitanceUf, 0.047);
  assert.equal(normalized.dimensions, '12.0 x 19.0 x 46.0 mm');
  assert.equal(normalized.readiness, 'ready');
  assert.ok(part);
  assert.deepEqual(normalized, readGolden('hv-capacitor-exxelia-ready.normalized.json'));
}

function main() {
  validateReadyFixture('hv-capacitor-ready-alpha.txt', 'hv-capacitor-ready-alpha.normalized.json', 25, 22);
  validateReadyFixture('hv-capacitor-ready-beta.txt', 'hv-capacitor-ready-beta.normalized.json', 18, 15);

  const emptyText = finalizePdfTextIngest({
    fileName: 'empty-layer.pdf',
    pageTexts: ['   ', ''],
  });

  assert.equal(emptyText.status, 'empty_text_layer');

  const draftText = readFixture('hv-capacitor-draft-missing.txt');
  const draftExtracted = extractHvCapacitor(preprocessHvCapacitorText(draftText).text);
  const draftNormalized = normalizeHvCapacitor(draftExtracted, {}, 'hv-capacitor-draft-missing.txt');

  assert.equal(draftNormalized.readiness, 'draft');
  assert.equal(toPartRecord(draftNormalized), null);
  assert.deepEqual(draftNormalized, readGolden('hv-capacitor-draft-missing.normalized.json'));
  validateTableHeavyFixture('hv-capacitor-table-heavy-sample2.txt');
  validateFamilyCatalogFixture('hv-capacitor-family-catalog-ambiguous.txt');
  validateSingleModelAnchorFixture('hv-capacitor-single-model-anchor.txt');
  validateExxeliaReadyFixture('hv-capacitor-exxelia-ready.txt');

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        validatedFixtures: [
          'hv-capacitor-ready-alpha.txt',
          'hv-capacitor-ready-beta.txt',
          'hv-capacitor-draft-missing.txt',
          'hv-capacitor-table-heavy-sample2.txt',
          'hv-capacitor-family-catalog-ambiguous.txt',
          'hv-capacitor-single-model-anchor.txt',
          'hv-capacitor-exxelia-ready.txt',
        ],
      },
      null,
      2,
    ),
  );
}

main();
