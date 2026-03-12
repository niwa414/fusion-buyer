import { analyzeAllParts, buildProjectMetrics } from './engine';
import { projectInfo, suppliers } from './data';

function riskRow(label: string, value: number) {
  return `- ${label}: ${value}/5`;
}

export function createPartAnalysisReport() {
  const analyses = analyzeAllParts();

  return [
    `# ${projectInfo.title}`,
    '',
    `Cluster: ${projectInfo.cluster}`,
    `Program: ${projectInfo.customer}`,
    '',
    ...analyses.flatMap(({ part, matches, risk }) => [
      `## ${part.id} - ${part.name}`,
      '',
      part.summary,
      '',
      'Hard constraints:',
      ...part.criticalParameters
        .filter((parameter) => parameter.level === 'hard')
        .map((parameter) => `- ${parameter.label}: ${parameter.value}`),
      '',
      'Top suppliers:',
      ...matches.slice(0, 3).map((match) => `- ${match.contactOrder}. ${match.supplierName} (${match.score})`),
      '',
      'Risk:',
      riskRow('Single source', risk.singleSource),
      riskRow('Long lead', risk.longLead),
      riskRow('Spec clarity', risk.specClarity),
      riskRow('Process maturity', risk.processMaturity),
      riskRow('Quality system', risk.qualitySystem),
      '',
    ]),
  ].join('\n');
}

export function createSupplierShortlist() {
  const analyses = analyzeAllParts();

  return [
    '# Supplier Shortlist',
    '',
    ...analyses.flatMap(({ part, matches }) => [
      `## ${part.id} - ${part.name}`,
      '',
      ...matches.slice(0, 5).map((match) => {
        const reasons = match.reasons.join('; ');
        const gaps = match.missingConditions.length > 0 ? ` Gaps: ${match.missingConditions.join('; ')}` : '';

        return `- ${match.supplierName} | score ${match.score} | ${match.recommendation} | ${reasons}.${gaps}`;
      }),
      '',
    ]),
  ].join('\n');
}

export function createRFQPack() {
  const analyses = analyzeAllParts();

  return [
    '# RFQ Pack',
    '',
    ...analyses.flatMap(({ part, rfq }) => [
      `## ${part.id} - ${part.name}`,
      '',
      rfq.summary,
      '',
      'Key parameters:',
      ...rfq.keyParameters.map((item) => `- ${item}`),
      '',
      'Checklist:',
      ...rfq.confirmChecklist.map((item) => `- ${item}`),
      '',
      'Clarifications:',
      ...rfq.clarificationQuestions.map((item) => `- ${item}`),
      '',
      'Acceptance:',
      ...rfq.testsAndAcceptance.map((item) => `- ${item}`),
      '',
    ]),
  ].join('\n');
}

export function createProjectRiskReport() {
  const analyses = analyzeAllParts();
  const metrics = buildProjectMetrics();

  return [
    '# Project Risk Report',
    '',
    `Total parts: ${metrics.totalParts}`,
    `High risk parts: ${metrics.highRiskCount}`,
    `Single source parts: ${metrics.singleSourceCount}`,
    `Need more information: ${metrics.needsInfoCount}`,
    `RFQ-ready parts: ${metrics.rfqReadyCount}`,
    '',
    ...analyses.flatMap(({ part, risk }) => [
      `## ${part.id} - ${part.name}`,
      '',
      riskRow('Single source', risk.singleSource),
      riskRow('Long lead', risk.longLead),
      riskRow('Spec clarity', risk.specClarity),
      riskRow('Process maturity', risk.processMaturity),
      riskRow('Quality system', risk.qualitySystem),
      '',
      'Actions:',
      ...risk.actions.map((action) => `- ${action}`),
      '',
    ]),
  ].join('\n');
}

export function createSupplierCapabilityDump() {
  return [
    '# Supplier Capability Snapshot',
    '',
    ...suppliers.flatMap((supplier) => [
      `## ${supplier.name}`,
      '',
      `Region: ${supplier.region}`,
      `Industries: ${supplier.industries.join(', ')}`,
      `Categories: ${supplier.fitCategories.join(', ')}`,
      `Prototype lead: ${supplier.prototypeLeadTimeWeeks} weeks`,
      `Production lead: ${supplier.productionLeadTimeWeeks} weeks`,
      '',
    ]),
  ].join('\n');
}
