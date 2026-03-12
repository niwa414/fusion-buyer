export type NavigationView = 'project' | 'parts' | 'suppliers' | 'risks' | 'exports';

export type ConstraintLevel = 'hard' | 'soft';

export type RecommendationLevel = 'lead' | 'backup' | 'adjacent' | 'watchlist';

export type DocumentStatus = 'available' | 'missing';

export interface TechnicalParameter {
  label: string;
  value: string;
  level: ConstraintLevel;
  rationale: string;
}

export interface PartDocument {
  kind: 'drawing' | 'spec' | 'bom' | 'quality' | 'test';
  name: string;
  status: DocumentStatus;
}

export interface PartRecord {
  id: string;
  name: string;
  category: 'HV Capacitor' | 'Power Semiconductor Module' | 'HV Connector & Cable' | 'Insulation & Dielectric' | 'Pulse Power Assembly';
  subsystem: string;
  classification: 'Standard' | 'Modified Standard' | 'Custom';
  summary: string;
  materials: string[];
  targetLeadTimeWeeks: number;
  annualVolume: number;
  batchSize: string;
  qualityTier: 'Industrial' | 'Advanced Hardware' | 'Pulse Power / Critical';
  criticalParameters: TechnicalParameter[];
  processNeeds: string[];
  testNeeds: string[];
  qualityNeeds: string[];
  riskSignals: string[];
  openQuestions: string[];
  documents: PartDocument[];
}

export interface SupplierRecord {
  id: string;
  name: string;
  region: string;
  industries: string[];
  fitCategories: PartRecord['category'][];
  processTags: string[];
  materialTags: string[];
  qualitySystems: string[];
  stageCapabilities: string[];
  prototypeLeadTimeWeeks: number;
  productionLeadTimeWeeks: number;
  sizeEnvelope: string;
  typicalLot: string;
  strengths: string[];
  cautions: string[];
}

export interface SupplierMatch {
  supplierId: string;
  supplierName: string;
  score: number;
  recommendation: RecommendationLevel;
  reasons: string[];
  missingConditions: string[];
  contactOrder: number;
}

export interface RiskScore {
  singleSource: number;
  longLead: number;
  specClarity: number;
  processMaturity: number;
  qualitySystem: number;
  explanation: string[];
  actions: string[];
}

export interface RFQPackage {
  partId: string;
  summary: string;
  keyParameters: string[];
  confirmChecklist: string[];
  clarificationQuestions: string[];
  deliveryRequirements: string[];
  testsAndAcceptance: string[];
  fileList: string[];
}

export interface SchemaGroup {
  title: string;
  description: string;
  fields: string[];
}
