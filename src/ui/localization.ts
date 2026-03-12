import type { PartDocument, PartRecord, RecommendationLevel, SchemaGroup } from '../domain/types';
import type { CardReadiness, IngestStatus, NormalizedHvCapacitor } from '../ingest/types';

export type Language = 'en' | 'zh';

export interface LocalizedNavItem {
  id: 'project' | 'parts' | 'suppliers' | 'risks' | 'exports';
  label: string;
  note: string;
}

export interface LocalizedRiskAxis {
  key: 'singleSource' | 'longLead' | 'specClarity' | 'processMaturity' | 'qualitySystem';
  label: string;
}

const navItemsByLanguage: Record<Language, LocalizedNavItem[]> = {
  en: [
    { id: 'project', label: 'Project Board', note: 'program pulse' },
    { id: 'parts', label: 'Part Detail', note: 'engineering to sourcing' },
    { id: 'suppliers', label: 'Supplier Profiles', note: 'capability lens' },
    { id: 'risks', label: 'Risk Board', note: 'critical path view' },
    { id: 'exports', label: 'Export Center', note: 'report outputs' },
  ],
  zh: [
    { id: 'project', label: '项目总览', note: '项目脉冲面板' },
    { id: 'parts', label: '零件详情', note: '工程到采购' },
    { id: 'suppliers', label: '供应商画像', note: '能力视图' },
    { id: 'risks', label: '风险看板', note: '关键路径视角' },
    { id: 'exports', label: '导出中心', note: '报告输出' },
  ],
};

const riskAxesByLanguage: Record<Language, LocalizedRiskAxis[]> = {
  en: [
    { key: 'singleSource', label: 'Single source' },
    { key: 'longLead', label: 'Long lead' },
    { key: 'specClarity', label: 'Spec clarity' },
    { key: 'processMaturity', label: 'Process maturity' },
    { key: 'qualitySystem', label: 'Quality system' },
  ],
  zh: [
    { key: 'singleSource', label: '单一来源' },
    { key: 'longLead', label: '长交期' },
    { key: 'specClarity', label: '规格清晰度' },
    { key: 'processMaturity', label: '工艺成熟度' },
    { key: 'qualitySystem', label: '质量体系' },
  ],
};

const projectInfoByLanguage = {
  en: {
    eyebrow: 'Chosen wedge',
    clusterLabel: 'Cluster',
    customerLabel: 'Customer profile',
    operatingModelLabel: 'Operating model',
    operatingModelValue: 'Rules first, human in the loop',
    title: 'Pulse Power Intelligence Desk',
    cluster: 'Pulse power components for advanced energy systems',
    customer: 'Demo program for fusion / pulsed-power adjacent sourcing',
    objective:
      'Translate engineering documents into sourcing-ready part cards, supplier shortlists, RFQ packs, and risk calls.',
  },
  zh: {
    eyebrow: '当前切口',
    clusterLabel: '器件簇',
    customerLabel: '目标客户画像',
    operatingModelLabel: '运行方式',
    operatingModelValue: '规则优先，人工在环',
    title: '脉冲功率采购 Intelligence 工作台',
    cluster: '面向先进能源系统的脉冲功率器件',
    customer: '聚变 / 脉冲功率相邻场景的演示项目',
    objective: '把工程文档翻译成可采购的零件卡、供应商 shortlist、RFQ 包和风险判断。',
  },
} as const;

const recommendationLabels: Record<Language, Record<RecommendationLevel, string>> = {
  en: {
    lead: 'Lead',
    backup: 'Backup',
    adjacent: 'Adjacent',
    watchlist: 'Watchlist',
  },
  zh: {
    lead: '主推荐',
    backup: '备选',
    adjacent: '相邻迁移',
    watchlist: '观察',
  },
};

const categoryLabels: Record<Language, Record<PartRecord['category'], string>> = {
  en: {
    'HV Capacitor': 'HV Capacitor',
    'Power Semiconductor Module': 'Power Semiconductor Module',
    'HV Connector & Cable': 'HV Connector & Cable',
    'Insulation & Dielectric': 'Insulation & Dielectric',
    'Pulse Power Assembly': 'Pulse Power Assembly',
  },
  zh: {
    'HV Capacitor': '高压电容',
    'Power Semiconductor Module': '功率半导体模块',
    'HV Connector & Cable': '高压连接器与线缆',
    'Insulation & Dielectric': '绝缘与介质件',
    'Pulse Power Assembly': '脉冲功率总成',
  },
};

const qualityTierLabels: Record<Language, Record<PartRecord['qualityTier'], string>> = {
  en: {
    Industrial: 'Industrial',
    'Advanced Hardware': 'Advanced Hardware',
    'Pulse Power / Critical': 'Pulse Power / Critical',
  },
  zh: {
    Industrial: '工业级',
    'Advanced Hardware': '先进硬件',
    'Pulse Power / Critical': '脉冲功率 / 关键件',
  },
};

const documentKindLabels: Record<Language, Record<PartDocument['kind'], string>> = {
  en: {
    drawing: 'drawing',
    spec: 'spec',
    bom: 'bom',
    quality: 'quality',
    test: 'test',
  },
  zh: {
    drawing: '图纸',
    spec: '规格',
    bom: 'BOM',
    quality: '质量',
    test: '测试',
  },
};

const parameterLevelLabels: Record<Language, Record<'hard' | 'soft', string>> = {
  en: {
    hard: 'hard',
    soft: 'soft',
  },
  zh: {
    hard: '硬约束',
    soft: '软约束',
  },
};

const readinessLabels: Record<Language, Record<CardReadiness, string>> = {
  en: {
    ready: 'ready',
    draft: 'draft',
  },
  zh: {
    ready: '就绪',
    draft: '草稿',
  },
};

const ingestStatusLabels: Record<Language, Record<IngestStatus | 'idle' | 'parsing', string>> = {
  en: {
    ok: 'ok',
    empty_text_layer: 'empty_text_layer',
    parse_error: 'parse_error',
    scanned_or_unsupported: 'scanned_or_unsupported',
    idle: 'idle',
    parsing: 'parsing',
  },
  zh: {
    ok: '已载入',
    empty_text_layer: '无文本层',
    parse_error: '解析失败',
    scanned_or_unsupported: '扫描件 / 不支持',
    idle: '未载入',
    parsing: '解析中',
  },
};

const fieldLabels: Record<Language, Record<string, string>> = {
  en: {
    part_name: 'part_name',
    rated_voltage_kv: 'rated_voltage_kv',
    capacitance_uf: 'capacitance_uf',
    pulse_current_ka: 'pulse_current_ka',
    dv_dt: 'dv_dt',
    esr_mohm: 'esr_mohm',
    cooling_type: 'cooling_type',
    mounting_style: 'mounting_style',
    dimensions: 'dimensions',
    lifecycle_or_pulse_count: 'lifecycle_or_pulse_count',
    mounting_style_or_dimensions: 'mounting_style_or_dimensions',
    mounting_envelope: 'mounting_envelope',
    category: 'category',
  },
  zh: {
    part_name: '零件名称',
    rated_voltage_kv: '额定电压',
    capacitance_uf: '电容量',
    pulse_current_ka: '脉冲电流',
    dv_dt: 'dV/dt',
    esr_mohm: 'ESR',
    cooling_type: '冷却方式',
    mounting_style: '安装方式',
    dimensions: '尺寸',
    lifecycle_or_pulse_count: '寿命 / 脉冲次数',
    mounting_style_or_dimensions: '安装方式或尺寸',
    mounting_envelope: '安装包络',
    category: '类别',
  },
};

const schemaTitleZh: Record<string, string> = {
  Identity: '身份信息',
  'Commercial Envelope': '商务边界',
  'Technical Boundaries': '技术边界',
  'Execution Risk': '执行风险',
  Fit: '匹配',
  Capability: '能力',
  Execution: '执行',
  'Risk Notes': '风险备注',
  'Risk Axes': '风险维度',
  'RFQ Sections': 'RFQ 模块',
};

const schemaDescriptionZh: Record<string, string> = {
  'Engineering context used to bucket the request and route it to the right supplier class.': '用于归类需求并路由到合适供应商类型的工程上下文。',
  'Inputs sourcing needs before any supplier search starts.': '在开始寻源之前先明确采购边界输入。',
  'Separates hard constraints from parameters that can be negotiated.': '区分硬约束和可协商参数。',
  'Captures what usually creates RFQ churn and supplier failure modes.': '沉淀最容易引发 RFQ 来回扯皮和供应商失效的因素。',
  'Supplier segmentation for first-pass matching.': '用于初筛匹配的供应商分层。',
  'Manufacturing and material constraints used to reject or advance a source.': '用于推进或淘汰供应商的制造与材料约束。',
  'Signals whether the supplier can prototype or scale.': '判断供应商是只能打样还是可以放量。',
  'Operational context that should show up during shortlist review.': '在 shortlist 评审时必须看到的运营背景。',
  'Five scores are enough for an MVP if each one is explained and tied to action.': '只要每个维度都可解释并能对应动作，MVP 用五个分数就够了。',
  'Generated package that purchasing can send without reworking the technical content.': '采购可直接发出的询价包，不需要重新加工技术内容。',
};

const demoSampleCopy = {
  en: {
    'single-model-anchor': {
      label: 'Ready sample A',
      note: 'Same-order table alignment with a single catalog anchor.',
      statusLabel: 'ready',
    },
    'exxelia-ready': {
      label: 'Ready sample B',
      note: 'Cross-source single-model spec card from Exxelia.',
      statusLabel: 'ready',
    },
    'family-catalog-ambiguous': {
      label: 'Hard case draft',
      note: 'Family catalog ambiguity that should stay draft.',
      statusLabel: 'draft / ambiguous',
    },
  },
  zh: {
    'single-model-anchor': {
      label: '就绪样本 A',
      note: '单一 catalog anchor + 同序列表格对齐。',
      statusLabel: '就绪',
    },
    'exxelia-ready': {
      label: '就绪样本 B',
      note: '来自 Exxelia 的跨来源单型号规格卡。',
      statusLabel: '就绪',
    },
    'family-catalog-ambiguous': {
      label: '疑难草稿',
      note: 'family catalog 歧义，应该保持 draft。',
      statusLabel: '草稿 / 歧义',
    },
  },
} as const;

const exportCardCopy = {
  en: {
    'part-analysis-report.md': {
      title: 'Part analysis report',
      description: 'Structured requirement cards, shortlist preview, and per-part risk.',
    },
    'supplier-shortlist.md': {
      title: 'Supplier shortlist',
      description: 'Ranked supplier pool with reasons and gaps.',
    },
    'rfq-pack.md': {
      title: 'RFQ pack',
      description: 'Send-ready RFQ sections generated from structured data.',
    },
    'project-risk-report.md': {
      title: 'Project risk report',
      description: 'Program-level risk summary and recommended actions.',
    },
    'supplier-capability-dump.md': {
      title: 'Supplier capability dump',
      description: 'Current demo supplier library and metadata.',
    },
  },
  zh: {
    'part-analysis-report.md': {
      title: '零件分析报告',
      description: '结构化需求卡、shortlist 预览和单件风险。',
    },
    'supplier-shortlist.md': {
      title: '供应商 shortlist',
      description: '带理由和缺口说明的排序供应商池。',
    },
    'rfq-pack.md': {
      title: 'RFQ 包',
      description: '基于结构化数据生成、可直接发送的 RFQ 模块。',
    },
    'project-risk-report.md': {
      title: '项目风险报告',
      description: '项目级风险摘要和建议动作。',
    },
    'supplier-capability-dump.md': {
      title: '供应商能力快照',
      description: '当前 demo 供应商库及其元数据。',
    },
  },
} as const;

const knownPartNameZhById: Record<string, string> = {
  'CAP-001': '25 kV 脉冲放电电容',
  'SEM-017': '3.3 kV 快开关功率模块',
  'CON-009': '60 kV 脉冲电缆线束',
  'INS-004': '支撑绝缘件套装',
  'ASM-022': '层压脉冲母排总成',
};

const knownPartSummaryZhById: Record<string, string> = {
  'CAP-001': '定制油浸脉冲电容，强调低 ESL、寿命筛选和重复放电工况。',
  'SEM-017': '面向主开关机架的定制快开关模块，关注低封装电感和筛选流程稳定性。',
  'CON-009': '等长高压脉冲线束，带应力释放与 TDR 验收要求。',
  'INS-004': '混合陶瓷与 G10 的支撑绝缘套件，关注爬电距离和装配定位精度。',
  'ASM-022': '低电感层压母排总成，强调峰值电流和介电耐压能力。',
};

export function getDefaultLanguage(): Language {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('fusion-buyer-language');

    if (saved === 'en' || saved === 'zh') {
      return saved;
    }

    if (window.navigator.language.toLowerCase().startsWith('zh')) {
      return 'zh';
    }
  }

  return 'en';
}

export function getNavItems(language: Language) {
  return navItemsByLanguage[language];
}

export function getRiskAxes(language: Language) {
  return riskAxesByLanguage[language];
}

export function getProjectInfoCopy(language: Language) {
  return projectInfoByLanguage[language];
}

export function translateRecommendation(value: RecommendationLevel, language: Language) {
  return recommendationLabels[language][value];
}

export function translateCategory(value: PartRecord['category'], language: Language) {
  return categoryLabels[language][value];
}

export function translateQualityTier(value: PartRecord['qualityTier'], language: Language) {
  return qualityTierLabels[language][value];
}

export function translateDocumentKind(kind: PartDocument['kind'], language: Language) {
  return documentKindLabels[language][kind];
}

export function translateParameterLevel(level: 'hard' | 'soft', language: Language) {
  return parameterLevelLabels[language][level];
}

export function translateReadiness(readiness: CardReadiness, language: Language) {
  return readinessLabels[language][readiness];
}

export function translateIngestStatus(status: IngestStatus | 'idle' | 'parsing', language: Language) {
  return ingestStatusLabels[language][status];
}

export function translateFieldName(field: string, language: Language) {
  return fieldLabels[language][field] ?? field;
}

export function localizeSchemaGroups(groups: SchemaGroup[], language: Language): SchemaGroup[] {
  if (language === 'en') {
    return groups;
  }

  return groups.map((group) => ({
    ...group,
    title: schemaTitleZh[group.title] ?? group.title,
    description: schemaDescriptionZh[group.description] ?? group.description,
  }));
}

export function getDemoSampleCopy(sampleId: string, language: Language) {
  return demoSampleCopy[language][sampleId as keyof typeof demoSampleCopy.en] ?? demoSampleCopy.en['single-model-anchor'];
}

export function getExportCardCopy(
  filename: string,
  language: Language,
  fallback: { title: string; description: string },
) {
  return exportCardCopy[language][filename as keyof typeof exportCardCopy.en] ?? fallback;
}

export function localizeKnownPartName(part: PartRecord, language: Language) {
  if (language === 'en') {
    return part.name;
  }

  return knownPartNameZhById[part.id] ?? part.name;
}

export function localizeKnownPartSummary(part: PartRecord, language: Language) {
  if (language === 'en') {
    return part.summary;
  }

  return knownPartSummaryZhById[part.id] ?? part.summary;
}

const exactReviewMessageZh: Record<string, string> = {
  'Part name is required before generating a formal card.': '生成正式零件卡前必须有零件名称。',
  'Rated voltage is required for HV capacitor matching.': '高压电容匹配必须有额定电压。',
  'Capacitance is required for HV capacitor matching.': '高压电容匹配必须有电容量。',
  'Need either mounting style or dimensions to create a sourcing-ready card.': '要生成可用于寻源的零件卡，必须提供安装方式或尺寸。',
  'No blocking issues. This card can move forward.': '没有阻塞问题，这张卡片可以继续推进。',
  'No missing fields in current extractor pass.': '当前抽取结果没有缺失字段。',
  'No conflicting field values found.': '当前没有检测到字段冲突。',
  'No review issues on this normalized card.': '当前标准化卡片没有 review 问题。',
};

export function translateReviewMessage(message: string, language: Language) {
  if (language === 'en') {
    return message;
  }

  if (exactReviewMessageZh[message]) {
    return exactReviewMessageZh[message];
  }

  const ambiguous = message.match(
    /^Multiple plausible (.+) candidates detected in a family catalog\. Provide BOM\/MPN or paste only the single-model parameter block\.$/i,
  );

  if (ambiguous) {
    return `family catalog 中检测到多个可能的${ambiguous[1] === 'rated voltage' ? '额定电压' : ambiguous[1] === 'capacitance' ? '电容量' : ambiguous[1]}候选值。请提供 BOM/MPN，或只粘贴单一型号的参数区块。`;
  }

  const conflicting = message.match(/^Multiple conflicting values detected for (.+)\.$/i);

  if (conflicting) {
    return `${translateFieldName(conflicting[1], 'zh')}存在多个冲突值。`;
  }

  const lowConfidence = message.match(/^(.+) was extracted with low confidence and should be reviewed\.$/i);

  if (lowConfidence) {
    return `${translateFieldName(lowConfidence[1], 'zh')}的抽取置信度较低，需要人工复核。`;
  }

  return message;
}

export function formatRequiredFieldDetail(
  field: string,
  normalized: NormalizedHvCapacitor,
  language: Language,
  satisfied: boolean,
) {
  if (language === 'en') {
    switch (field) {
      case 'part_name':
        return normalized.partName ? `Captured as "${normalized.partName}".` : 'Missing part name.';
      case 'rated_voltage_kv':
        return normalized.ratedVoltageKv !== null ? `${normalized.ratedVoltageKv} kV` : 'Missing rated voltage.';
      case 'capacitance_uf':
        return normalized.capacitanceUf !== null ? `${normalized.capacitanceUf} uF` : 'Missing capacitance.';
      case 'mounting_style_or_dimensions':
        return normalized.mountingStyle && normalized.mountingStyle !== 'unknown'
          ? `Mounting style: ${normalized.mountingStyle}`
          : normalized.dimensions
            ? `Dimensions: ${normalized.dimensions}`
            : 'Need mounting style or dimensions.';
      default:
        return satisfied ? 'Available.' : 'Missing.';
    }
  }

  switch (field) {
    case 'part_name':
      return normalized.partName ? `已识别为“${normalized.partName}”。` : '缺少零件名称。';
    case 'rated_voltage_kv':
      return normalized.ratedVoltageKv !== null ? `${normalized.ratedVoltageKv} kV` : '缺少额定电压。';
    case 'capacitance_uf':
      return normalized.capacitanceUf !== null ? `${normalized.capacitanceUf} uF` : '缺少电容量。';
    case 'mounting_style_or_dimensions':
      return normalized.mountingStyle && normalized.mountingStyle !== 'unknown'
        ? `安装方式：${normalized.mountingStyle}`
        : normalized.dimensions
          ? `尺寸：${normalized.dimensions}`
          : '需要安装方式或尺寸。';
    default:
      return satisfied ? '已满足。' : '缺失。';
  }
}

export const appCopy = {
  en: {
    language: 'Language',
    metrics: {
      analyzedParts: 'Analyzed parts',
      currentDemoPackage: 'Current demo package',
      highRiskParts: 'High-risk parts',
      axisAtLeast4: 'Any axis >= 4',
      singleSourceParts: 'Single-source parts',
      leadSourceConcentration: 'Lead source concentration',
      needMoreInformation: 'Need more information',
      openQuestionsOrMissingDocs: 'Open questions or missing docs',
      rfqReadyParts: 'RFQ-ready parts',
      completeFilePackageToday: 'Complete file package today',
    },
    project: {
      actionQueue: 'Action queue',
      programFocus: 'Program focus',
      riskShort: 'risk',
      mvpLocksDown: 'What this MVP locks down',
      scopeDiscipline: 'Scope discipline',
      scopeParagraphOne: 'Part card schema, supplier capability schema, RFQ template, and five-axis risk model are all explicit.',
      scopeParagraphTwo:
        'This first cut avoids ERP integration, quoting automation, pricing logic, and approval workflow. It focuses on judgment support.',
      fieldBlueprint: 'Field blueprint',
      dataBackbone: 'Data backbone',
      partSchema: 'Part schema',
      supplierSchema: 'Supplier schema',
      riskSchema: 'Risk schema',
      rfqSchema: 'RFQ schema',
      ingestTitle: 'HV Capacitor Ingest',
      realDocumentToCard: 'Real document to card',
      ingestScope: 'V1 ingest is intentionally narrow: one PDF plus light BOM/manual context, HV capacitor only, no OCR.',
      demoSamples: 'Demo samples',
      uploadPdf: 'Upload PDF',
      noFileLoaded: 'No file loaded yet',
      partName: 'Part name',
      manufacturer: 'Manufacturer',
      mpn: 'MPN',
      quantityBatch: 'Quantity / batch',
      voltageKv: 'Voltage kV',
      capacitanceUf: 'Capacitance uF',
      mountingStyle: 'Mounting style',
      dimensions: 'Dimensions',
      targetLeadWeeks: 'Target lead weeks',
      annualVolume: 'Annual volume',
      generatePartCard: 'Generate part card',
      openGeneratedCard: 'Open generated card',
      readiness: 'Readiness',
      reviewIssues: 'Review issues',
      generatedCard: 'Generated card',
      readyInWorkbench: 'ready in workbench',
      draftInsufficientExtraction: 'draft / insufficient extraction',
      reviewSummary: 'Review summary',
      keyFields: 'Key fields',
      blockingIssues: 'Blocking issues',
      missingFields: 'Missing fields',
      conflictFields: 'Conflict fields',
      requiredFields: 'Required fields',
      sourceTextPreview: 'Source text preview',
      sourceTextHelp: 'If the PDF has no useful text layer, paste the extracted text here and rerun the HV capacitor extractor.',
      sourceTextPlaceholder: 'PDF text appears here. You can also paste manual text for unsupported PDFs.',
      extractJson: 'Extract Result JSON',
      normalizedJson: 'Normalized Result JSON',
      pending: 'pending',
      reviewQueue: 'Review queue',
      humanInLoop: 'Human in the loop',
      readinessRule: 'Readiness rule',
      requiredFieldsGate: 'Required fields gate',
      reviewIssuePrefixBlocker: '[blocker]',
      reviewIssuePrefixReview: '[review]',
    },
    parts: {
      parts: 'Parts',
      currentPackage: 'Current package',
      structuredRequirementCard: 'Structured requirement card',
      category: 'Category',
      qualityTier: 'Quality tier',
      targetLead: 'Target lead',
      annualVolume: 'Annual volume',
      weeks: 'weeks',
      technicalBoundaries: 'Technical boundaries',
      engineerToSourcing: 'Engineer to sourcing',
      processNeeds: 'Process needs',
      tests: 'Tests',
      quality: 'Quality',
      riskRadar: 'Risk radar',
      programFriction: 'Program friction',
      why: 'Why',
      suggestedActions: 'Suggested actions',
      supplierCandidatePool: 'Supplier candidate pool',
      ruleBasedShortlist: 'Rule-based shortlist',
      order: 'Order',
      supplier: 'Supplier',
      score: 'Score',
      recommendation: 'Recommendation',
      whyItFits: 'Why it fits',
      gaps: 'Gaps',
      noMajorGaps: 'No major gaps in this ruleset.',
      rfqPack: 'RFQ pack',
      buyerReadyOutput: 'Buyer-ready output',
      summary: 'Summary',
      keyParameters: 'Key parameters',
      checklist: 'Checklist',
      clarifications: 'Clarifications',
      testsAndAcceptance: 'Tests and acceptance',
      fileList: 'File list',
      manualOverride: 'Manual override',
      humanLoopText:
        'AI extracts structure and proposes a shortlist. Engineering and sourcing still need a place to lock down final interpretation.',
      humanLoopPlaceholder: 'Record sourcing judgement, approved substitutions, or supplier-specific caveats.',
    },
    suppliers: {
      supplierLibrary: 'Supplier library',
      demoCapabilityPool: 'Demo capability pool',
      capabilityProfile: 'Capability profile',
      region: 'Region',
      prototypeLead: 'Prototype lead',
      productionLead: 'Production lead',
      typicalLot: 'Typical lot',
      industries: 'Industries',
      fitCategories: 'Fit categories',
      stageCapability: 'Stage capability',
      processTags: 'Process tags',
      materialTags: 'Material tags',
      qualitySystems: 'Quality systems',
      strengths: 'Strengths',
      cautions: 'Cautions',
      envelope: 'Envelope',
      bestFitParts: 'Best-fit parts',
      whereToUseThisSupplier: 'Where to use this supplier',
    },
    risks: {
      criticalPathBoard: 'Critical path board',
      perRiskSorting: 'Per-risk sorting',
      rankedHighToLow: 'ranked high to low',
      programActions: 'Program actions',
      whatToDoNext: 'What to do next',
      riskModelNotes: 'Risk model notes',
      mvpLogic: 'MVP logic',
      modelNoteOne:
        'Scores are deterministic and auditable. They come from shortlist depth, lead-time fit, spec completeness, process coverage, and quality evidence.',
      modelNoteTwo:
        'The point is not perfect prediction. The point is to surface where engineering and sourcing need to intervene before RFQ churn starts.',
    },
    exports: {
      exportCenter: 'Export center',
      shareableOutputs: 'Shareable outputs',
      download: 'Download',
    },
    common: {
      noItems: 'No items.',
      ok: '[ok]',
      missing: '[missing]',
    },
  },
  zh: {
    language: '语言',
    metrics: {
      analyzedParts: '已分析零件',
      currentDemoPackage: '当前 demo 包',
      highRiskParts: '高风险零件',
      axisAtLeast4: '任一维度 >= 4',
      singleSourceParts: '单一来源零件',
      leadSourceConcentration: '主供应来源集中度',
      needMoreInformation: '待补信息',
      openQuestionsOrMissingDocs: '存在开放问题或缺少文件',
      rfqReadyParts: 'RFQ 就绪零件',
      completeFilePackageToday: '当前文件包已齐套',
    },
    project: {
      actionQueue: '行动队列',
      programFocus: '项目重点',
      riskShort: '风险',
      mvpLocksDown: '这个 MVP 固定了什么',
      scopeDiscipline: '范围纪律',
      scopeParagraphOne: '零件卡 schema、供应商能力 schema、RFQ 模板和五维风险模型都已经明确。',
      scopeParagraphTwo: '第一版故意不做 ERP 集成、自动询价、价格逻辑和审批流，核心是判断支持。',
      fieldBlueprint: '字段蓝图',
      dataBackbone: '数据骨架',
      partSchema: '零件 schema',
      supplierSchema: '供应商 schema',
      riskSchema: '风险 schema',
      rfqSchema: 'RFQ schema',
      ingestTitle: 'HV 电容 Ingest',
      realDocumentToCard: '真实文档到零件卡',
      ingestScope: 'V1 ingest 故意收窄：只支持一个 PDF 加轻量 BOM/手填上下文，只做 HV capacitor，不做 OCR。',
      demoSamples: '演示样本',
      uploadPdf: '上传 PDF',
      noFileLoaded: '还没有载入文件',
      partName: '零件名称',
      manufacturer: '制造商',
      mpn: 'MPN',
      quantityBatch: '数量 / 批量',
      voltageKv: '电压 kV',
      capacitanceUf: '电容量 uF',
      mountingStyle: '安装方式',
      dimensions: '尺寸',
      targetLeadWeeks: '目标交期（周）',
      annualVolume: '年用量',
      generatePartCard: '生成零件卡',
      openGeneratedCard: '打开生成卡片',
      readiness: '就绪状态',
      reviewIssues: 'Review 问题数',
      generatedCard: '生成结果',
      readyInWorkbench: '已进入工作台',
      draftInsufficientExtraction: '草稿 / 抽取不足',
      reviewSummary: 'Review 摘要',
      keyFields: '关键字段',
      blockingIssues: '阻塞问题',
      missingFields: '缺失字段',
      conflictFields: '冲突字段',
      requiredFields: '必需字段',
      sourceTextPreview: '源文本预览',
      sourceTextHelp: '如果 PDF 没有可用文本层，把提取出的文本粘贴到这里，再重新运行 HV capacitor extractor。',
      sourceTextPlaceholder: 'PDF 文本会显示在这里。对于不支持的 PDF，也可以直接粘贴手工文本。',
      extractJson: '抽取结果 JSON',
      normalizedJson: '标准化结果 JSON',
      pending: '等待中',
      reviewQueue: 'Review 队列',
      humanInLoop: '人工在环',
      readinessRule: '就绪规则',
      requiredFieldsGate: '必需字段闸门',
      reviewIssuePrefixBlocker: '[阻塞]',
      reviewIssuePrefixReview: '[复核]',
    },
    parts: {
      parts: '零件列表',
      currentPackage: '当前包',
      structuredRequirementCard: '结构化需求卡',
      category: '类别',
      qualityTier: '质量等级',
      targetLead: '目标交期',
      annualVolume: '年用量',
      weeks: '周',
      technicalBoundaries: '技术边界',
      engineerToSourcing: '工程到采购',
      processNeeds: '工艺需求',
      tests: '测试',
      quality: '质量',
      riskRadar: '风险雷达',
      programFriction: '项目摩擦点',
      why: '原因',
      suggestedActions: '建议动作',
      supplierCandidatePool: '供应商候选池',
      ruleBasedShortlist: '基于规则的 shortlist',
      order: '顺序',
      supplier: '供应商',
      score: '分数',
      recommendation: '推荐等级',
      whyItFits: '匹配理由',
      gaps: '缺口',
      noMajorGaps: '当前规则下没有明显缺口。',
      rfqPack: 'RFQ 包',
      buyerReadyOutput: '采购可直接使用的输出',
      summary: '摘要',
      keyParameters: '关键参数',
      checklist: '确认清单',
      clarifications: '澄清问题',
      testsAndAcceptance: '测试与验收',
      fileList: '文件清单',
      manualOverride: '人工修正',
      humanLoopText: 'AI 负责提取结构并提出 shortlist，但工程和采购仍需要明确锁定最终判断。',
      humanLoopPlaceholder: '记录采购判断、批准的替代方案或供应商特定注意事项。',
    },
    suppliers: {
      supplierLibrary: '供应商库',
      demoCapabilityPool: '演示能力池',
      capabilityProfile: '能力画像',
      region: '地区',
      prototypeLead: '打样交期',
      productionLead: '量产交期',
      typicalLot: '典型批量',
      industries: '行业',
      fitCategories: '适配类别',
      stageCapability: '阶段能力',
      processTags: '工艺标签',
      materialTags: '材料标签',
      qualitySystems: '质量体系',
      strengths: '优势',
      cautions: '注意点',
      envelope: '能力包络',
      bestFitParts: '最匹配的零件',
      whereToUseThisSupplier: '这个供应商适合用在哪',
    },
    risks: {
      criticalPathBoard: '关键路径看板',
      perRiskSorting: '按风险维度排序',
      rankedHighToLow: '按高到低排序',
      programActions: '项目动作',
      whatToDoNext: '下一步怎么做',
      riskModelNotes: '风险模型说明',
      mvpLogic: 'MVP 逻辑',
      modelNoteOne: '这些分数是确定性的、可审计的，来自 shortlist 深度、交期匹配、规格完整性、工艺覆盖和质量证据。',
      modelNoteTwo: '目标不是做完美预测，而是在 RFQ 开始来回扯皮之前，把工程和采购需要介入的点提前暴露出来。',
    },
    exports: {
      exportCenter: '导出中心',
      shareableOutputs: '可分享输出',
      download: '下载',
    },
    common: {
      noItems: '暂无内容。',
      ok: '[已满足]',
      missing: '[缺失]',
    },
  },
} as const;
