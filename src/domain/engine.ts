import { parts, suppliers } from './data';
import type { PartRecord, RFQPackage, RecommendationLevel, RiskScore, SupplierMatch, SupplierRecord } from './types';

const categoryIndustryMap: Record<PartRecord['category'], string[]> = {
  'HV Capacitor': ['Pulse Power', 'Power Electronics', 'Rail / Traction'],
  'Power Semiconductor Module': ['Power Electronics', 'EV / Traction', 'Industrial Drives'],
  'HV Connector & Cable': ['Pulse Power', 'Medical Imaging', 'Aerospace'],
  'Insulation & Dielectric': ['Power Electronics', 'Aerospace', 'Scientific Equipment'],
  'Pulse Power Assembly': ['Pulse Power', 'Power Electronics', 'Industrial Drives'],
};

function intersection(left: string[], right: string[]) {
  return left.filter((item) => right.includes(item));
}

function difference(left: string[], right: string[]) {
  return left.filter((item) => !right.includes(item));
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function scoreIndustryFit(part: PartRecord, supplier: SupplierRecord) {
  const priorities = categoryIndustryMap[part.category];

  if (supplier.industries.includes(priorities[0])) {
    return 8;
  }

  if (supplier.industries.includes(priorities[1])) {
    return 6;
  }

  if (supplier.industries.includes(priorities[2])) {
    return 4;
  }

  return 1;
}

function recommendationForScore(score: number): RecommendationLevel {
  if (score >= 82) {
    return 'lead';
  }

  if (score >= 70) {
    return 'backup';
  }

  if (score >= 58) {
    return 'adjacent';
  }

  return 'watchlist';
}

export function matchSupplier(part: PartRecord, supplier: SupplierRecord): SupplierMatch {
  const reasons: string[] = [];
  const missingConditions: string[] = [];
  let score = 0;

  if (supplier.fitCategories.includes(part.category)) {
    score += 18;
    reasons.push(`Native fit for ${part.category.toLowerCase()} work.`);
  } else {
    missingConditions.push(`No proven category history for ${part.category}.`);
  }

  const processCoverage = intersection(part.processNeeds, supplier.processTags);
  const missingProcesses = difference(part.processNeeds, supplier.processTags);
  score += Math.round((processCoverage.length / part.processNeeds.length) * 42);

  if (processCoverage.length > 0) {
    reasons.push(`Covers ${processCoverage.length}/${part.processNeeds.length} critical processes in the current workflow.`);
  }

  if (missingProcesses.length > 0) {
    missingConditions.push(`Missing process coverage: ${missingProcesses.join(', ')}.`);
  }

  const materialCoverage = intersection(part.materials, supplier.materialTags);
  score += Math.round((materialCoverage.length / part.materials.length) * 12);
  if (materialCoverage.length > 0) {
    reasons.push(`Material compatibility includes ${materialCoverage.join(', ')}.`);
  } else {
    missingConditions.push('Material stack is not yet proven.');
  }

  const qualityCoverage = intersection(part.qualityNeeds, supplier.qualitySystems);
  score += Math.round((qualityCoverage.length / part.qualityNeeds.length) * 12);
  if (qualityCoverage.length > 0) {
    reasons.push(`Quality system overlap: ${qualityCoverage.join(', ')}.`);
  } else {
    missingConditions.push('Quality controls need explicit confirmation.');
  }

  const industryScore = scoreIndustryFit(part, supplier);
  score += industryScore;
  if (industryScore >= 6) {
    reasons.push(`Industry adjacency is strong for ${supplier.industries[0]} programs.`);
  }

  const leadDelta = supplier.prototypeLeadTimeWeeks - part.targetLeadTimeWeeks;
  if (leadDelta <= 0) {
    score += 10;
    reasons.push(`Prototype lead time meets the ${part.targetLeadTimeWeeks}-week target.`);
  } else if (leadDelta <= 2) {
    score += 6;
    missingConditions.push(`Lead time is slightly outside target at ${supplier.prototypeLeadTimeWeeks} weeks.`);
  } else {
    missingConditions.push(`Lead time misses target by ${leadDelta} weeks.`);
  }

  score = Math.min(score, 100);

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    score,
    recommendation: recommendationForScore(score),
    reasons: unique(reasons).slice(0, 4),
    missingConditions: unique(missingConditions).slice(0, 4),
    contactOrder: 0,
  };
}

export function buildMatches(part: PartRecord) {
  const ranked = suppliers
    .map((supplier) => matchSupplier(part, supplier))
    .filter((match) => match.score >= 45)
    .sort((left, right) => right.score - left.score)
    .map((match, index) => ({ ...match, contactOrder: index + 1 }));

  return ranked;
}

function scoreSingleSource(matches: SupplierMatch[]) {
  const viable = matches.filter((match) => match.score >= 70).length;

  if (viable <= 1) {
    return 5;
  }

  if (viable === 2) {
    return 4;
  }

  if (viable === 3) {
    return 3;
  }

  if (viable === 4) {
    return 2;
  }

  return 1;
}

function scoreLongLead(part: PartRecord, matches: SupplierMatch[]) {
  const bestLead = Math.min(
    ...matches
      .map((match) => suppliers.find((supplier) => supplier.id === match.supplierId)?.prototypeLeadTimeWeeks ?? Infinity)
      .filter((value) => Number.isFinite(value)),
  );

  if (!Number.isFinite(bestLead)) {
    return 5;
  }

  const leadGap = bestLead - part.targetLeadTimeWeeks;
  const specializationPenalty = part.processNeeds.length >= 5 ? 1 : 0;

  if (leadGap > 3) {
    return 5;
  }

  if (leadGap > 1) {
    return Math.min(5, 4 + specializationPenalty);
  }

  if (leadGap === 1) {
    return 3 + specializationPenalty;
  }

  return Math.max(1, 2 + specializationPenalty - 1);
}

function scoreSpecClarity(part: PartRecord) {
  const missingDocs = part.documents.filter((document) => document.status === 'missing').length;
  const hardParameters = part.criticalParameters.filter((parameter) => parameter.level === 'hard').length;
  const raw = 1 + missingDocs + Math.min(2, part.openQuestions.length) + (hardParameters >= 3 ? 1 : 0);

  return Math.min(5, raw);
}

function scoreProcessMaturity(part: PartRecord, matches: SupplierMatch[]) {
  const deepCoverage = matches.filter((match) => match.missingConditions.every((item) => !item.startsWith('Missing process coverage')));
  const partialCoverage = matches.filter(
    (match) => match.missingConditions.some((item) => item.startsWith('Missing process coverage')) && match.score >= 58,
  );

  if (deepCoverage.length <= 1) {
    return 5;
  }

  if (deepCoverage.length === 2) {
    return 4;
  }

  if (partialCoverage.length > 3) {
    return 2;
  }

  return part.processNeeds.length >= 5 ? 3 : 2;
}

function scoreQualitySystem(part: PartRecord, matches: SupplierMatch[]) {
  const qualified = matches.filter((match) =>
    match.missingConditions.every(
      (item) => !item.includes('Quality controls need explicit confirmation') && !item.includes('Material stack is not yet proven'),
    ),
  ).length;

  if (part.qualityTier === 'Pulse Power / Critical' && qualified <= 1) {
    return 5;
  }

  if (qualified <= 2) {
    return 4;
  }

  if (qualified <= 3) {
    return 3;
  }

  return 2;
}

export function buildRisk(part: PartRecord, matches: SupplierMatch[]): RiskScore {
  const singleSource = scoreSingleSource(matches);
  const longLead = scoreLongLead(part, matches);
  const specClarity = scoreSpecClarity(part);
  const processMaturity = scoreProcessMaturity(part, matches);
  const qualitySystem = scoreQualitySystem(part, matches);

  const viable = matches.filter((match) => match.score >= 70);
  const topGap = matches[0]?.missingConditions[0];
  const explanation = unique([
    viable.length <= 2
      ? `${part.id} has only ${viable.length || 0} sourcing paths above the backup threshold.`
      : `${part.id} has a reasonable shortlist, but the top supplier mix is still concentrated.`,
    topGap ? `Most likely RFQ friction: ${topGap}` : 'No major RFQ friction found in the current ruleset.',
    part.documents.some((document) => document.status === 'missing')
      ? 'At least one required supporting document is still missing before release.'
      : 'Document package is mostly complete.',
  ]).slice(0, 3);

  const actions = unique([
    singleSource >= 4 ? 'Qualify one adjacent supplier before PO release.' : 'Keep backup sources warm with a light RFQ.',
    specClarity >= 4 ? 'Close open questions and missing documents before supplier round one.' : 'Lock the current parameter set into the RFQ summary.',
    longLead >= 4 ? 'Pre-reserve capacity or split prototype and production sourcing paths.' : 'Use target lead time as a negotiation anchor in supplier outreach.',
    qualitySystem >= 4 ? 'Add explicit quality evidence requests to the RFQ checklist.' : 'Request representative certificates with the first quote.',
  ]).slice(0, 4);

  return {
    singleSource,
    longLead,
    specClarity,
    processMaturity,
    qualitySystem,
    explanation,
    actions,
  };
}

export function buildRFQ(part: PartRecord, matches: SupplierMatch[]): RFQPackage {
  const topMatches = matches.slice(0, 3);
  const hardParameters = part.criticalParameters
    .filter((parameter) => parameter.level === 'hard')
    .map((parameter) => `${parameter.label}: ${parameter.value}`);

  const clarificationQuestions = unique([
    ...part.openQuestions,
    ...topMatches.flatMap((match) =>
      match.missingConditions
        .filter((condition) => condition.startsWith('Missing process coverage') || condition.startsWith('Quality controls'))
        .map((condition) => `Please confirm mitigation plan: ${condition}`),
    ),
  ]);

  return {
    partId: part.id,
    summary: `${part.name} is a ${part.classification.toLowerCase()} ${part.category.toLowerCase()} for ${part.subsystem}.`,
    keyParameters: [
      ...hardParameters,
      `Target lead time: ${part.targetLeadTimeWeeks} weeks`,
      `Expected annual volume: ${part.annualVolume}`,
      `Batch size: ${part.batchSize}`,
    ],
    confirmChecklist: [
      'Confirm in-house vs sub-tier process ownership.',
      'Confirm production and prototype lead times separately.',
      'Confirm traceability package and certificate format.',
      ...part.documents
        .filter((document) => document.status === 'missing')
        .map((document) => `Customer still owes: ${document.name}`),
    ],
    clarificationQuestions,
    deliveryRequirements: [
      `Need first article within ${part.targetLeadTimeWeeks} weeks from RFQ award.`,
      `Quote prototype lot and steady-state lot for ${part.batchSize}.`,
      'Deliver source inspection and packaging assumptions with quote.',
    ],
    testsAndAcceptance: unique([...part.testNeeds, ...part.qualityNeeds]),
    fileList: part.documents.map((document) => `${document.name} (${document.status})`),
  };
}

export function analyzePart(part: PartRecord) {
  const matches = buildMatches(part);
  const risk = buildRisk(part, matches);
  const rfq = buildRFQ(part, matches);

  return { part, matches, risk, rfq };
}

export function analyzeAllParts() {
  return parts.map((part) => analyzePart(part));
}

export function buildProjectMetrics() {
  const analyses = analyzeAllParts();
  const highRiskCount = analyses.filter(
    ({ risk }) => Math.max(risk.singleSource, risk.longLead, risk.specClarity, risk.processMaturity, risk.qualitySystem) >= 4,
  ).length;
  const singleSourceCount = analyses.filter(({ risk }) => risk.singleSource >= 4).length;
  const needsInfoCount = analyses.filter(({ risk }) => risk.specClarity >= 4).length;

  return {
    totalParts: analyses.length,
    highRiskCount,
    singleSourceCount,
    needsInfoCount,
    rfqReadyCount: analyses.filter(({ part }) => part.documents.every((document) => document.status === 'available')).length,
  };
}
