import type { SchemaGroup } from './types';

export const partSchema: SchemaGroup[] = [
  {
    title: 'Identity',
    description: 'Engineering context used to bucket the request and route it to the right supplier class.',
    fields: ['part_id', 'name', 'category', 'subsystem', 'classification'],
  },
  {
    title: 'Commercial Envelope',
    description: 'Inputs sourcing needs before any supplier search starts.',
    fields: ['target_lead_time_weeks', 'annual_volume', 'batch_size', 'quality_tier'],
  },
  {
    title: 'Technical Boundaries',
    description: 'Separates hard constraints from parameters that can be negotiated.',
    fields: ['materials', 'critical_parameters', 'process_needs', 'test_needs'],
  },
  {
    title: 'Execution Risk',
    description: 'Captures what usually creates RFQ churn and supplier failure modes.',
    fields: ['quality_needs', 'risk_signals', 'open_questions', 'documents'],
  },
];

export const supplierSchema: SchemaGroup[] = [
  {
    title: 'Fit',
    description: 'Supplier segmentation for first-pass matching.',
    fields: ['supplier_id', 'region', 'industries', 'fit_categories'],
  },
  {
    title: 'Capability',
    description: 'Manufacturing and material constraints used to reject or advance a source.',
    fields: ['process_tags', 'material_tags', 'size_envelope', 'quality_systems'],
  },
  {
    title: 'Execution',
    description: 'Signals whether the supplier can prototype or scale.',
    fields: ['stage_capabilities', 'prototype_lead_time_weeks', 'production_lead_time_weeks', 'typical_lot'],
  },
  {
    title: 'Risk Notes',
    description: 'Operational context that should show up during shortlist review.',
    fields: ['strengths', 'cautions'],
  },
];

export const riskSchema: SchemaGroup[] = [
  {
    title: 'Risk Axes',
    description: 'Five scores are enough for an MVP if each one is explained and tied to action.',
    fields: [
      'single_source_risk',
      'long_lead_risk',
      'spec_clarity_risk',
      'process_maturity_risk',
      'quality_system_risk',
    ],
  },
];

export const rfqSchema: SchemaGroup[] = [
  {
    title: 'RFQ Sections',
    description: 'Generated package that purchasing can send without reworking the technical content.',
    fields: [
      'summary',
      'key_parameters',
      'confirm_checklist',
      'clarification_questions',
      'delivery_requirements',
      'tests_and_acceptance',
      'file_list',
    ],
  },
];
