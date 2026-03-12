import type { PreprocessedTextResult } from './types';

const PAGE_MARKER_PATTERN = /^\d+\s+\d+\/\d+$/;
const REPEATED_NOISE_LINES = [
  /please read cautions and warnings/i,
  /important notes at the end of this document/i,
  /^compact\s+[–-]\s+up to/i,
  /^date:\s+/i,
  /^release\s+\d{4}-\d{2}$/i,
];
const SKIP_SECTION_HEADINGS = [
  /^dimensional drawings$/i,
  /^overview of available types$/i,
  /^technical data and ordering codes$/i,
  /^packaging of snap-in capacitors$/i,
  /^cautions and warnings$/i,
  /^product safety$/i,
  /^display of ordering codes for tdk electronics products$/i,
  /^symbols and terms$/i,
  /^important notes$/i,
];
const NOISE_LINE_PATTERNS = [
  /general technical information/i,
  /approx\.\s+packing units/i,
  /packing is pure cardboard/i,
  /^topic safety information/i,
  /^reference chapter/i,
  /^symbol english german/i,
  /^ordering codes for terminal styles/i,
  /^composition of ordering code$/i,
  /^ordering code$/i,
  /^vr\s*\(vdc\)\s+/i,
  /^vr\s*=\s*\d+\s*vdc$/i,
  /^case dimensions d x l \(mm\)$/i,
  /^cr\s*\((?:uF|µF)\)$/i,
  /^note:$/i,
  /^all dimensions are given in mm\.$/i,
];
const DIMENSION_FRAGMENT_NOISE = [
  /^-?\s*\d+\s*lengths available:\s*[\d.\sand]+mm/i,
  /^-?\s*\d+\s*terminals to ensure correct insertion:\s*length\s*[\d.]+\s*mm/i,
  /^-?\s*length up to \d+\s*mm/i,
  /^snap-in terminals\s*\(/i,
];
const SPLIT_TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bV\s+R\b/g, 'VR'],
  [/\bC\s+R\b/g, 'CR'],
  [/\bd\s*V\s*\/\s*d\s*t\b/gi, 'dV/dt'],
  [/\bV\s+D\s+C\b/g, 'VDC'],
  [/\bV\s+DC\b/g, 'VDC'],
  [/(?:µ|μ|u)\s+F\b/g, 'uF'],
  [/rated capacitance/gi, 'Capacitance'],
  [/\btech\s+nical\b/gi, 'technical'],
  [/\u2026/g, '...'],
  [/[\u2502\u2503\u00a6|]+/g, ' '],
];

function normalizeLineWhitespace(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeGlobalText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(//g, '-')
    .replace(//g, '')
    .replace(/|/g, ' ')
    .replace(//g, ' ');
}

function applyTokenReplacements(line: string) {
  return SPLIT_TOKEN_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), line);
}

function normalizeRangeStyleLine(line: string) {
  const voltageNormalized = line.replace(
    /^(rated voltage(?:\s+vr)?)\s+\d+(?:\.\d+)?\s*\.\.\.\s*(\d+(?:\.\d+)?)\s*(kvdc|kvac|kvdc|vac|vdc|kv|v)$/i,
    'Rated voltage $2 $3',
  );

  return voltageNormalized.replace(
    /^(capacitance(?:\s+cr)?)\s+\d+(?:\.\d+)?\s*\.\.\.\s*(\d+(?:\.\d+)?)\s*((?:µ|μ|u)f)$/i,
    'Capacitance $2 $3',
  );
}

export function preprocessHvCapacitorText(text: string): PreprocessedTextResult {
  const notes: string[] = [];
  const normalizedInput = normalizeGlobalText(text);
  const lines = normalizedInput.split('\n').map((line) => normalizeLineWhitespace(applyTokenReplacements(line)));
  const output: string[] = [];
  let skipUntilNextPage = false;
  let removedRepeatedNoise = 0;
  let removedNoiseLines = 0;
  let removedSectionLines = 0;
  let normalizedTokens = normalizedInput === text ? 0 : 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (!skipUntilNextPage && output[output.length - 1] !== '') {
        output.push('');
      }

      continue;
    }

    if (PAGE_MARKER_PATTERN.test(line)) {
      skipUntilNextPage = false;
      continue;
    }

    if (SKIP_SECTION_HEADINGS.some((pattern) => pattern.test(line))) {
      skipUntilNextPage = true;
      removedSectionLines += 1;
      continue;
    }

    if (skipUntilNextPage) {
      removedSectionLines += 1;
      continue;
    }

    if (REPEATED_NOISE_LINES.some((pattern) => pattern.test(line))) {
      removedRepeatedNoise += 1;
      continue;
    }

    if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line)) || DIMENSION_FRAGMENT_NOISE.some((pattern) => pattern.test(line))) {
      removedNoiseLines += 1;
      continue;
    }

    let normalizedLine = line;

    normalizedLine = normalizeRangeStyleLine(normalizedLine);

    if (/^series\/type:\s*/i.test(normalizedLine)) {
      normalizedLine = normalizedLine.replace(/^series\/type:/i, 'Part Name:');
      normalizedTokens += 1;
    }

    if (/^capacitors for pulse applications\s+[a-z0-9-]+$/i.test(normalizedLine)) {
      removedRepeatedNoise += 1;
      continue;
    }

    output.push(normalizedLine);
  }

  while (output[output.length - 1] === '') {
    output.pop();
  }

  if (normalizedTokens > 0) {
    notes.push('Normalized split labels, units, and delimiter noise before extraction.');
  }

  if (removedRepeatedNoise > 0) {
    notes.push(`Removed ${removedRepeatedNoise} repeated header/footer lines.`);
  }

  if (removedSectionLines > 0) {
    notes.push(`Skipped ${removedSectionLines} lines from table-heavy or glossary sections.`);
  }

  if (removedNoiseLines > 0) {
    notes.push(`Removed ${removedNoiseLines} known low-value noise lines.`);
  }

  const preprocessedText = output.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    text: preprocessedText,
    applied: preprocessedText !== text,
    notes,
  };
}
