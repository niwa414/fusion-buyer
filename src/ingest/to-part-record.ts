import type { PartDocument, PartRecord, TechnicalParameter } from '../domain/types';

import { analyzePart } from '../domain/engine';
import type { NormalizedHvCapacitor } from './types';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
}

function createParameter(label: string, value: string, level: TechnicalParameter['level'], rationale: string): TechnicalParameter {
  return { label, value, level, rationale };
}

function buildDocuments(normalized: NormalizedHvCapacitor): PartDocument[] {
  return [
    {
      kind: 'spec',
      name: normalized.sourceFileName ?? 'Uploaded HV capacitor PDF',
      status: normalized.sourceFileName ? 'available' : 'missing',
    },
    {
      kind: 'bom',
      name: normalized.mpn ? `BOM / manual input (${normalized.mpn})` : 'BOM / manual input',
      status: normalized.partName || normalized.mpn ? 'available' : 'missing',
    },
    {
      kind: 'drawing',
      name: 'Mechanical envelope and mounting details',
      status: normalized.dimensions || (normalized.mountingStyle && normalized.mountingStyle !== 'unknown') ? 'available' : 'missing',
    },
    {
      kind: 'quality',
      name: 'Incoming screening and traceability note',
      status: normalized.lifecycleOrPulseCount ? 'available' : 'missing',
    },
    {
      kind: 'test',
      name: 'Impulse life / electrical acceptance note',
      status: normalized.lifecycleOrPulseCount && normalized.pulseCurrentKa ? 'available' : 'missing',
    },
  ];
}

function buildSummary(normalized: NormalizedHvCapacitor) {
  const voltage = normalized.ratedVoltageKv !== null ? `${normalized.ratedVoltageKv} kV` : 'unknown voltage';
  const capacitance = normalized.capacitanceUf !== null ? `${normalized.capacitanceUf} uF` : 'unknown capacitance';
  const cooling = normalized.coolingType !== 'unknown' ? `${normalized.coolingType}-cooled` : 'cooling not confirmed';

  return `${voltage} HV capacitor at ${capacitance}, ${cooling}, for uploaded sourcing analysis.`;
}

function buildMaterials(normalized: NormalizedHvCapacitor) {
  const baseMaterials = ['Polypropylene film', 'Aluminum'];

  if (normalized.coolingType === 'oil') {
    return [...baseMaterials, 'Dielectric oil'];
  }

  if (normalized.coolingType === 'water') {
    return [...baseMaterials, 'Water-cooled housing'];
  }

  return baseMaterials;
}

function buildProcessNeeds(normalized: NormalizedHvCapacitor) {
  const needs = ['wound film capacitor assembly', 'vacuum impregnation', 'partial discharge screening'];

  if (normalized.coolingType === 'oil') {
    needs.push('hermetic sealing');
  }

  if (normalized.lifecycleOrPulseCount) {
    needs.push('impulse life test');
  }

  return needs;
}

function buildTestNeeds(normalized: NormalizedHvCapacitor) {
  const needs = ['capacitance and dissipation factor report', 'partial discharge report'];

  if (normalized.pulseCurrentKa !== null) {
    needs.push('pulse current validation');
  }

  if (normalized.dvDt !== null) {
    needs.push('dV/dt capability summary');
  }

  if (normalized.esrMohm !== null) {
    needs.push('ESR report');
  }

  if (normalized.lifecycleOrPulseCount) {
    needs.push('sample impulse life data');
  }

  return needs;
}

function buildRiskSignals(normalized: NormalizedHvCapacitor) {
  const signals = [
    normalized.lifecycleOrPulseCount ? null : 'pulse life information missing',
    normalized.pulseCurrentKa !== null ? null : 'pulse current capability not confirmed',
    normalized.coolingType === 'unknown' ? 'cooling path not confirmed' : null,
    !normalized.dimensions && (!normalized.mountingStyle || normalized.mountingStyle === 'unknown')
      ? 'mechanical installation envelope incomplete'
      : null,
  ];

  return signals.filter((item): item is string => Boolean(item));
}

function buildOpenQuestions(normalized: NormalizedHvCapacitor) {
  return normalized.reviewIssues.filter((issue) => !issue.blocking).map((issue) => issue.message);
}

export function toPartRecord(normalized: NormalizedHvCapacitor): PartRecord | null {
  if (normalized.readiness !== 'ready' || !normalized.partName || normalized.ratedVoltageKv === null || normalized.capacitanceUf === null) {
    return null;
  }

  const idSeed = normalized.mpn || normalized.partName;
  const criticalParameters: TechnicalParameter[] = [
    createParameter('Rated voltage', `${normalized.ratedVoltageKv} kV`, 'hard', 'Primary insulation class and supplier fit depend on this.'),
    createParameter('Capacitance', `${normalized.capacitanceUf} uF`, 'hard', 'Sets stored energy and pulse network tuning.'),
  ];

  if (normalized.pulseCurrentKa !== null) {
    criticalParameters.push(
      createParameter('Pulse current', `${normalized.pulseCurrentKa} kA`, 'hard', 'Internal foil design and termination robustness depend on it.'),
    );
  }

  if (normalized.dvDt !== null) {
    criticalParameters.push(createParameter('dV/dt', `${normalized.dvDt} kV/us`, 'hard', 'Fast edge rate drives dielectric and internal geometry requirements.'));
  }

  if (normalized.esrMohm !== null) {
    criticalParameters.push(createParameter('ESR', `${normalized.esrMohm} mOhm`, 'soft', 'Useful for thermal and efficiency comparison across suppliers.'));
  }

  if (normalized.mountingStyle) {
    criticalParameters.push(
      createParameter('Mounting style', normalized.mountingStyle, 'soft', 'Mechanical fit can sometimes be adapted if the electrical core is right.'),
    );
  }

  return {
    id: `ING-CAP-${slugify(idSeed) || 'candidate'}`.toUpperCase(),
    name: normalized.partName,
    category: 'HV Capacitor',
    subsystem: 'Uploaded HV capacitor workflow',
    classification: normalized.mpn ? 'Modified Standard' : 'Custom',
    summary: buildSummary(normalized),
    materials: buildMaterials(normalized),
    targetLeadTimeWeeks: normalized.targetLeadTimeWeeks,
    annualVolume: normalized.annualVolume,
    batchSize: normalized.batchSize,
    qualityTier: normalized.qualityTier,
    criticalParameters,
    processNeeds: buildProcessNeeds(normalized),
    testNeeds: buildTestNeeds(normalized),
    qualityNeeds:
      normalized.qualityTier === 'Pulse Power / Critical'
        ? ['ISO 9001', 'lot traceability', 'partial discharge screening']
        : ['ISO 9001', 'lot traceability'],
    riskSignals: buildRiskSignals(normalized),
    openQuestions: buildOpenQuestions(normalized),
    documents: buildDocuments(normalized),
  };
}

export function analyzeNormalizedHvCapacitor(normalized: NormalizedHvCapacitor) {
  const part = toPartRecord(normalized);

  if (!part) {
    return null;
  }

  return analyzePart(part);
}
