import { startTransition, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';

import { suppliers } from './domain/data';
import { analyzeAllParts, buildProjectMetrics } from './domain/engine';
import {
  createPartAnalysisReport,
  createProjectRiskReport,
  createRFQPack,
  createSupplierCapabilityDump,
  createSupplierShortlist,
} from './domain/export';
import { partSchema, rfqSchema, riskSchema, supplierSchema } from './domain/schema';
import type { NavigationView, PartRecord, RecommendationLevel, RiskScore, SchemaGroup, SupplierMatch } from './domain/types';
import { demoIngestSamples } from './ingest/demo-samples';
import { extractHvCapacitor } from './ingest/extract-hv-capacitor';
import { normalizeHvCapacitor } from './ingest/normalize-hv-capacitor';
import { buildReviewSummary } from './ingest/observability';
import { ingestPdfFile } from './ingest/pdf';
import { preprocessHvCapacitorText } from './ingest/preprocess-hv-capacitor-text';
import { analyzeNormalizedHvCapacitor } from './ingest/to-part-record';
import type { BomInput, HvCapacitorExtractResult, IngestResult, NormalizedHvCapacitor } from './ingest/types';
import {
  appCopy,
  formatRequiredFieldDetail,
  getDefaultLanguage,
  getDemoSampleCopy,
  getExportCardCopy,
  getNavItems,
  getProjectInfoCopy,
  getRiskAxes,
  localizeKnownPartName,
  localizeKnownPartSummary,
  localizeSchemaGroups,
  translateCategory,
  translateDocumentKind,
  translateFieldName,
  translateIngestStatus,
  translateParameterLevel,
  translateQualityTier,
  translateReadiness,
  translateRecommendation,
  translateReviewMessage,
  type Language,
} from './ui/localization';

const demoAnalyses = analyzeAllParts();
const demoMetrics = buildProjectMetrics();

type RiskAxisKey = 'singleSource' | 'longLead' | 'specClarity' | 'processMaturity' | 'qualitySystem';

function maxRisk(risk: RiskScore) {
  return Math.max(risk.singleSource, risk.longLead, risk.specClarity, risk.processMaturity, risk.qualitySystem);
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function MetricCard(props: { label: string; value: string | number; hint: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{props.label}</span>
      <strong className="metric-value">{props.value}</strong>
      <p className="metric-hint">{props.hint}</p>
    </div>
  );
}

function Section(props: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`section-card ${props.className ?? ''}`.trim()}>
      {props.eyebrow ? <span className="section-eyebrow">{props.eyebrow}</span> : null}
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

function ScorePill(props: { score: number }) {
  const tone = props.score >= 82 ? 'high' : props.score >= 70 ? 'good' : props.score >= 58 ? 'mid' : 'low';

  return <span className={`score-pill ${tone}`}>{props.score}</span>;
}

function RecommendationPill(props: { value: RecommendationLevel; language: Language }) {
  return <span className={`recommendation-pill ${props.value}`}>{translateRecommendation(props.value, props.language)}</span>;
}

function RiskScale(props: { label: string; value: number }) {
  const tone = props.value >= 4 ? 'high' : props.value >= 3 ? 'mid' : 'low';

  return (
    <div className="risk-scale">
      <div className="risk-scale-label">
        <span>{props.label}</span>
        <strong>{props.value}/5</strong>
      </div>
      <div className="risk-bar">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={`risk-segment ${index < props.value ? tone : ''}`} />
        ))}
      </div>
    </div>
  );
}

function SchemaBlock(props: { title: string; groups: SchemaGroup[] }) {
  return (
    <div className="schema-block">
      <div className="schema-header">
        <h3>{props.title}</h3>
      </div>
      <div className="schema-grid">
        {props.groups.map((group) => (
          <div key={group.title} className="schema-card">
            <strong>{group.title}</strong>
            <p>{group.description}</p>
            <ul>
              {group.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagList(props: { items: string[] }) {
  return (
    <div className="tag-list">
      {props.items.map((item) => (
        <span key={item} className="tag">
          {item}
        </span>
      ))}
    </div>
  );
}

function ListBlock(props: { items: string[]; emptyLabel?: string }) {
  if (props.items.length === 0) {
    return <p className="muted">{props.emptyLabel ?? 'No items.'}</p>;
  }

  return (
    <ul className="bullet-list">
      {props.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function JsonPreview(props: { title: string; value: unknown }) {
  return (
    <div className="json-preview">
      <h3>{props.title}</h3>
      <pre>{JSON.stringify(props.value, null, 2)}</pre>
    </div>
  );
}

function deriveMetrics(entries: ReturnType<typeof analyzeAllParts>) {
  return {
    totalParts: entries.length,
    highRiskCount: entries.filter(
      ({ risk }) => Math.max(risk.singleSource, risk.longLead, risk.specClarity, risk.processMaturity, risk.qualitySystem) >= 4,
    ).length,
    singleSourceCount: entries.filter(({ risk }) => risk.singleSource >= 4).length,
    needsInfoCount: entries.filter(({ risk }) => risk.specClarity >= 4).length,
    rfqReadyCount: entries.filter(({ part }) => part.documents.every((document) => document.status === 'available')).length,
  };
}

const defaultBomInput: BomInput = {
  qualityTier: 'Pulse Power / Critical',
};

function App() {
  const [language, setLanguage] = useState<Language>(getDefaultLanguage);
  const [view, setView] = useState<NavigationView>('project');
  const [selectedPartId, setSelectedPartId] = useState(demoAnalyses[0].part.id);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0].id);
  const [notesByPart, setNotesByPart] = useState<Record<string, string>>({});
  const [bomInput, setBomInput] = useState<BomInput>(defaultBomInput);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [manualText, setManualText] = useState('');
  const [selectedDemoSampleId, setSelectedDemoSampleId] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<HvCapacitorExtractResult | null>(null);
  const [normalizedResult, setNormalizedResult] = useState<NormalizedHvCapacitor | null>(null);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<ReturnType<typeof analyzeNormalizedHvCapacitor>>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('fusion-buyer-language', language);
  }, [language]);

  const copy = appCopy[language];
  const navItems = getNavItems(language);
  const riskAxes = getRiskAxes(language) as { key: RiskAxisKey; label: string }[];
  const projectCopy = getProjectInfoCopy(language);
  const localizedPartSchema = localizeSchemaGroups(partSchema, language);
  const localizedSupplierSchema = localizeSchemaGroups(supplierSchema, language);
  const localizedRiskSchema = localizeSchemaGroups(riskSchema, language);
  const localizedRfqSchema = localizeSchemaGroups(rfqSchema, language);

  const analyses = generatedAnalysis ? [generatedAnalysis, ...demoAnalyses] : demoAnalyses;
  const metrics = generatedAnalysis
    ? deriveMetrics(analyses)
    : {
        ...demoMetrics,
      };

  const selectedAnalysis = analyses.find((entry) => entry.part.id === selectedPartId) ?? analyses[0];
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? suppliers[0];

  const supplierPartFits = analyses
    .map(({ part, matches, risk }) => ({
      part,
      risk,
      match: matches.find((item) => item.supplierId === selectedSupplier.id),
    }))
    .filter((entry): entry is { part: PartRecord; risk: RiskScore; match: SupplierMatch } => Boolean(entry.match))
    .sort((left, right) => right.match.score - left.match.score);

  const exportCards = [
    {
      filename: 'part-analysis-report.md',
      content: createPartAnalysisReport(),
      ...getExportCardCopy('part-analysis-report.md', language, {
        title: 'Part analysis report',
        description: 'Structured requirement cards, shortlist preview, and per-part risk.',
      }),
    },
    {
      filename: 'supplier-shortlist.md',
      content: createSupplierShortlist(),
      ...getExportCardCopy('supplier-shortlist.md', language, {
        title: 'Supplier shortlist',
        description: 'Ranked supplier pool with reasons and gaps.',
      }),
    },
    {
      filename: 'rfq-pack.md',
      content: createRFQPack(),
      ...getExportCardCopy('rfq-pack.md', language, {
        title: 'RFQ pack',
        description: 'Send-ready RFQ sections generated from structured data.',
      }),
    },
    {
      filename: 'project-risk-report.md',
      content: createProjectRiskReport(),
      ...getExportCardCopy('project-risk-report.md', language, {
        title: 'Project risk report',
        description: 'Program-level risk summary and recommended actions.',
      }),
    },
    {
      filename: 'supplier-capability-dump.md',
      content: createSupplierCapabilityDump(),
      ...getExportCardCopy('supplier-capability-dump.md', language, {
        title: 'Supplier capability dump',
        description: 'Current demo supplier library and metadata.',
      }),
    },
  ];

  const topActionQueue = [...analyses]
    .sort((left, right) => maxRisk(right.risk) - maxRisk(left.risk))
    .slice(0, 4);

  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsIngesting(true);
    setIngestError(null);
    setSelectedDemoSampleId(null);
    setExtractResult(null);
    setNormalizedResult(null);
    setGeneratedAnalysis(null);

    try {
      const result = await ingestPdfFile(file);

      setIngestResult(result);
      setManualText(result.text);
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : language === 'zh' ? 'PDF 导入失败。' : 'Failed to ingest the PDF.');
    } finally {
      setIsIngesting(false);
      event.target.value = '';
    }
  }

  function handleBomInputChange(key: keyof BomInput, value: string) {
    setSelectedDemoSampleId(null);
    setBomInput((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyHvCapacitorIngest(effectiveText: string, sourceIngest: IngestResult, bomContext: BomInput) {
    if (!effectiveText) {
      setIngestResult(sourceIngest);
      setManualText(effectiveText);
      setExtractResult(null);
      setNormalizedResult(null);
      setGeneratedAnalysis(null);
      return;
    }

    const preprocessed = preprocessHvCapacitorText(effectiveText);
    const extracted = extractHvCapacitor(preprocessed.text, bomContext);
    const normalized = normalizeHvCapacitor(extracted, bomContext, sourceIngest.fileName);
    const analysis = analyzeNormalizedHvCapacitor(normalized);

    setIngestResult({
      ...sourceIngest,
      text: effectiveText,
      status: sourceIngest.status === 'parse_error' ? 'parse_error' : 'ok',
    });
    setManualText(effectiveText);
    setExtractResult(extracted);
    setNormalizedResult(normalized);
    setGeneratedAnalysis(analysis);

    if (analysis) {
      startTransition(() => {
        setSelectedPartId(analysis.part.id);
      });
    }
  }

  function runHvCapacitorIngest() {
    const effectiveText = manualText.trim();
    const fallbackIngest =
      ingestResult ??
      ({
        status: effectiveText ? 'ok' : 'empty_text_layer',
        text: effectiveText,
        pageCount: 0,
        warnings: effectiveText
          ? [language === 'zh' ? '未上传 PDF，当前使用手工文本输入。' : 'Using manual text input without a PDF upload.']
          : [language === 'zh' ? '请粘贴文本或上传 PDF 后继续。' : 'Paste text or upload a PDF to continue.'],
        fileName: 'manual-text',
      } satisfies IngestResult);

    applyHvCapacitorIngest(effectiveText, fallbackIngest, bomInput);
  }

  function loadDemoSample(sampleId: string) {
    const sample = demoIngestSamples.find((item) => item.id === sampleId);

    if (!sample) {
      return;
    }

    const nextBomInput = { ...defaultBomInput };
    const demoCopy = getDemoSampleCopy(sample.id, language);
    const sampleIngest: IngestResult = {
      status: 'ok',
      text: sample.text,
      pageCount: 1,
      warnings: [
        language === 'zh'
          ? `已载入演示样本：${demoCopy.label}（${demoCopy.statusLabel}）。`
          : `Loaded demo sample: ${sample.label} (${sample.statusLabel}).`,
      ],
      fileName: sample.fileName,
    };

    setSelectedDemoSampleId(sample.id);
    setIngestError(null);
    setBomInput(nextBomInput);
    applyHvCapacitorIngest(sample.text, sampleIngest, nextBomInput);
  }

  const ingestWarnings = ingestResult?.warnings ?? [];
  const ingestReviewSummary = extractResult && normalizedResult ? buildReviewSummary(extractResult, normalizedResult) : null;

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />

      <header className="hero">
        <div className="hero-copy">
          <div className="hero-topline">
            <span className="section-eyebrow">{projectCopy.eyebrow}</span>
            <div className="language-toggle" aria-label={copy.language}>
              <button
                type="button"
                className={`language-chip ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`language-chip ${language === 'zh' ? 'active' : ''}`}
                onClick={() => setLanguage('zh')}
              >
                中文
              </button>
            </div>
          </div>
          <h1>{projectCopy.title}</h1>
          <p>{projectCopy.objective}</p>
        </div>

        <div className="hero-panels">
          <div className="hero-panel">
            <span>{projectCopy.clusterLabel}</span>
            <strong>{projectCopy.cluster}</strong>
          </div>
          <div className="hero-panel">
            <span>{projectCopy.customerLabel}</span>
            <strong>{projectCopy.customer}</strong>
          </div>
          <div className="hero-panel">
            <span>{projectCopy.operatingModelLabel}</span>
            <strong>{projectCopy.operatingModelValue}</strong>
          </div>
        </div>
      </header>

      <nav className="top-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-chip ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.note}</small>
          </button>
        ))}
      </nav>

      {view === 'project' ? (
        <main className="page-stack">
          <div className="metric-grid">
            <MetricCard label={copy.metrics.analyzedParts} value={metrics.totalParts} hint={copy.metrics.currentDemoPackage} />
            <MetricCard label={copy.metrics.highRiskParts} value={metrics.highRiskCount} hint={copy.metrics.axisAtLeast4} />
            <MetricCard label={copy.metrics.singleSourceParts} value={metrics.singleSourceCount} hint={copy.metrics.leadSourceConcentration} />
            <MetricCard
              label={copy.metrics.needMoreInformation}
              value={metrics.needsInfoCount}
              hint={copy.metrics.openQuestionsOrMissingDocs}
            />
            <MetricCard label={copy.metrics.rfqReadyParts} value={metrics.rfqReadyCount} hint={copy.metrics.completeFilePackageToday} />
          </div>

          <div className="two-column">
            <Section title={copy.project.actionQueue} eyebrow={copy.project.programFocus}>
              <div className="stack-list">
                {topActionQueue.map(({ part, risk }) => (
                  <button
                    key={part.id}
                    type="button"
                    className="list-row"
                    onClick={() => {
                      setSelectedPartId(part.id);
                      setView('parts');
                    }}
                    >
                      <div>
                        <strong>
                          {part.id} · {localizeKnownPartName(part, language)}
                        </strong>
                        <p>{risk.explanation[0]}</p>
                      </div>
                      <span className={`risk-badge ${maxRisk(risk) >= 4 ? 'high' : 'mid'}`}>
                        {copy.project.riskShort} {maxRisk(risk)}/5
                      </span>
                    </button>
                  ))}
              </div>
            </Section>

            <Section title={copy.project.mvpLocksDown} eyebrow={copy.project.scopeDiscipline}>
              <div className="scope-copy">
                <p>{copy.project.scopeParagraphOne}</p>
                <p>{copy.project.scopeParagraphTwo}</p>
              </div>
            </Section>
          </div>

          <Section title={copy.project.fieldBlueprint} eyebrow={copy.project.dataBackbone}>
            <div className="blueprint-grid">
              <SchemaBlock title={copy.project.partSchema} groups={localizedPartSchema} />
              <SchemaBlock title={copy.project.supplierSchema} groups={localizedSupplierSchema} />
              <SchemaBlock title={copy.project.riskSchema} groups={localizedRiskSchema} />
              <SchemaBlock title={copy.project.rfqSchema} groups={localizedRfqSchema} />
            </div>
          </Section>

          <Section title={copy.project.ingestTitle} eyebrow={copy.project.realDocumentToCard}>
            <div className="two-column ingest-layout">
              <div className="ingest-panel">
                <p className="muted">{copy.project.ingestScope}</p>

                <div className="demo-sample-block">
                  <span className="meta-label">{copy.project.demoSamples}</span>
                  <div className="demo-sample-grid">
                    {demoIngestSamples.map((sample) => (
                      (() => {
                        const sampleCopy = getDemoSampleCopy(sample.id, language);

                        return (
                          <button
                            key={sample.id}
                            type="button"
                            className={`demo-sample-button ${selectedDemoSampleId === sample.id ? 'active' : ''}`}
                            onClick={() => loadDemoSample(sample.id)}
                          >
                            <div>
                              <strong>{sampleCopy.label}</strong>
                              <p>{sampleCopy.note}</p>
                            </div>
                            <span className={`risk-badge ${sample.statusTone}`}>{sampleCopy.statusLabel}</span>
                          </button>
                        );
                      })()
                    ))}
                  </div>
                </div>

                <label className="input-group">
                  <span className="meta-label">{copy.project.uploadPdf}</span>
                  <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
                </label>

                <div className="ingest-status-row">
                  <span className={`risk-badge ${ingestResult?.status === 'ok' ? 'low' : 'mid'}`}>
                    {translateIngestStatus(isIngesting ? 'parsing' : ingestResult?.status ?? 'idle', language)}
                  </span>
                  <small>
                    {ingestResult
                      ? `${ingestResult.fileName} · ${ingestResult.pageCount} ${language === 'zh' ? '页' : 'pages'}`
                      : copy.project.noFileLoaded}
                  </small>
                </div>

                {ingestError ? <p className="error-copy">{ingestError}</p> : null}

                <div className="form-grid">
                  <label className="input-group">
                    <span className="meta-label">{copy.project.partName}</span>
                    <input value={bomInput.partName ?? ''} onChange={(event) => handleBomInputChange('partName', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.manufacturer}</span>
                    <input value={bomInput.manufacturer ?? ''} onChange={(event) => handleBomInputChange('manufacturer', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.mpn}</span>
                    <input value={bomInput.mpn ?? ''} onChange={(event) => handleBomInputChange('mpn', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.quantityBatch}</span>
                    <input value={bomInput.quantity ?? ''} onChange={(event) => handleBomInputChange('quantity', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.voltageKv}</span>
                    <input value={bomInput.ratedVoltageKv ?? ''} onChange={(event) => handleBomInputChange('ratedVoltageKv', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.capacitanceUf}</span>
                    <input value={bomInput.capacitanceUf ?? ''} onChange={(event) => handleBomInputChange('capacitanceUf', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.mountingStyle}</span>
                    <input value={bomInput.mountingStyle ?? ''} onChange={(event) => handleBomInputChange('mountingStyle', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.dimensions}</span>
                    <input value={bomInput.dimensions ?? ''} onChange={(event) => handleBomInputChange('dimensions', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.targetLeadWeeks}</span>
                    <input
                      value={bomInput.targetLeadTimeWeeks ?? ''}
                      onChange={(event) => handleBomInputChange('targetLeadTimeWeeks', event.target.value)}
                    />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">{copy.project.annualVolume}</span>
                    <input value={bomInput.annualVolume ?? ''} onChange={(event) => handleBomInputChange('annualVolume', event.target.value)} />
                  </label>
                </div>

                <div className="button-row">
                  <button type="button" className="primary-button" onClick={runHvCapacitorIngest}>
                    {copy.project.generatePartCard}
                  </button>
                  {generatedAnalysis ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        startTransition(() => {
                          setSelectedPartId(generatedAnalysis.part.id);
                          setView('parts');
                        })
                      }
                    >
                      {copy.project.openGeneratedCard}
                    </button>
                  ) : null}
                </div>

                {normalizedResult ? (
                  <div className="ingest-summary">
                    <div>
                      <span className="meta-label">{copy.project.readiness}</span>
                      <strong>{translateReadiness(normalizedResult.readiness, language)}</strong>
                    </div>
                    <div>
                      <span className="meta-label">{copy.project.reviewIssues}</span>
                      <strong>{normalizedResult.reviewIssues.length}</strong>
                    </div>
                    <div>
                      <span className="meta-label">{copy.project.generatedCard}</span>
                      <strong>{generatedAnalysis ? copy.project.readyInWorkbench : copy.project.draftInsufficientExtraction}</strong>
                    </div>
                  </div>
                ) : null}

                {ingestReviewSummary ? (
                  <div className="review-summary-card">
                    <h3>{copy.project.reviewSummary}</h3>
                    <div className="summary-grid">
                      <div>
                        <span className="meta-label">{copy.project.keyFields}</span>
                        <ul className="bullet-list">
                          <li>{translateFieldName('part_name', language)}: {normalizedResult?.partName ?? copy.common.missing}</li>
                          <li>
                            {translateFieldName('rated_voltage_kv', language)}:{' '}
                            {normalizedResult?.ratedVoltageKv !== null && normalizedResult?.ratedVoltageKv !== undefined
                              ? `${normalizedResult.ratedVoltageKv} kV`
                              : copy.common.missing}
                          </li>
                          <li>
                            {translateFieldName('capacitance_uf', language)}:{' '}
                            {normalizedResult?.capacitanceUf !== null && normalizedResult?.capacitanceUf !== undefined
                              ? `${normalizedResult.capacitanceUf} uF`
                              : copy.common.missing}
                          </li>
                          <li>{translateFieldName('dimensions', language)}: {normalizedResult?.dimensions ?? copy.common.missing}</li>
                        </ul>
                      </div>
                      <div>
                        <span className="meta-label">{copy.project.blockingIssues}</span>
                        <ListBlock
                          items={ingestReviewSummary.blockingIssues.map((issue) => translateReviewMessage(issue, language))}
                          emptyLabel={translateReviewMessage('No blocking issues. This card can move forward.', language)}
                        />
                      </div>
                      <div>
                        <span className="meta-label">{copy.project.missingFields}</span>
                        <ListBlock
                          items={ingestReviewSummary.missingFields.map((field) => translateFieldName(field, language))}
                          emptyLabel={translateReviewMessage('No missing fields in current extractor pass.', language)}
                        />
                      </div>
                      <div>
                        <span className="meta-label">{copy.project.conflictFields}</span>
                        <ListBlock
                          items={ingestReviewSummary.conflictFields.map((field) => translateFieldName(field, language))}
                          emptyLabel={translateReviewMessage('No conflicting field values found.', language)}
                        />
                      </div>
                      <div>
                        <span className="meta-label">{copy.project.requiredFields}</span>
                        <ul className="bullet-list">
                          {ingestReviewSummary.requiredFields.map((field) => (
                            <li key={field.field}>
                              {field.satisfied ? copy.common.ok : copy.common.missing} {translateFieldName(field.field, language)}:{' '}
                              {normalizedResult
                                ? formatRequiredFieldDetail(field.field, normalizedResult, language, field.satisfied)
                                : field.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ingest-panel">
                <h3>{copy.project.sourceTextPreview}</h3>
                <p className="muted">{copy.project.sourceTextHelp}</p>
                <textarea
                  value={manualText}
                  onChange={(event) => {
                    setSelectedDemoSampleId(null);
                    setManualText(event.target.value);
                  }}
                  placeholder={copy.project.sourceTextPlaceholder}
                />
                {ingestWarnings.length > 0 ? (
                  <div className="warning-list">
                    {ingestWarnings.map((warning) => (
                      <span key={warning} className="warning-pill">
                        {warning}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="json-grid">
              <JsonPreview title={copy.project.extractJson} value={extractResult ?? { status: copy.project.pending }} />
              <JsonPreview title={copy.project.normalizedJson} value={normalizedResult ?? { status: copy.project.pending }} />
            </div>

            {normalizedResult ? (
              <div className="two-column">
                <Section title={copy.project.reviewQueue} eyebrow={copy.project.humanInLoop} className="nested-section">
                  <ListBlock
                    items={normalizedResult.reviewIssues.map(
                      (issue) =>
                        `${issue.blocking ? copy.project.reviewIssuePrefixBlocker : copy.project.reviewIssuePrefixReview} ${translateFieldName(issue.field, language)}: ${translateReviewMessage(issue.message, language)}`,
                    )}
                    emptyLabel={translateReviewMessage('No review issues on this normalized card.', language)}
                  />
                </Section>

                <Section title={copy.project.requiredFieldsGate} eyebrow={copy.project.readinessRule} className="nested-section">
                  <ListBlock
                    items={[
                      translateFieldName('part_name', language),
                      translateFieldName('rated_voltage_kv', language),
                      translateFieldName('capacitance_uf', language),
                      language === 'zh' ? '安装方式或尺寸' : 'mounting_style or dimensions',
                    ]}
                  />
                </Section>
              </div>
            ) : null}
          </Section>
        </main>
      ) : null}

      {view === 'parts' ? (
        <main className="workspace-layout">
          <aside className="side-rail">
            <Section title={copy.parts.parts} eyebrow={copy.parts.currentPackage}>
              <div className="selector-list">
                {analyses.map(({ part, risk }) => (
                  <button
                    key={part.id}
                    type="button"
                    className={`selector-card ${selectedPartId === part.id ? 'active' : ''}`}
                    onClick={() => setSelectedPartId(part.id)}
                  >
                    <span className="selector-topline">
                      <strong>{part.id}</strong>
                      <span className={`risk-badge ${maxRisk(risk) >= 4 ? 'high' : 'mid'}`}>{maxRisk(risk)}/5</span>
                    </span>
                    <p>{localizeKnownPartName(part, language)}</p>
                    <small>{translateCategory(part.category, language)}</small>
                  </button>
                ))}
              </div>
            </Section>
          </aside>

          <div className="page-stack">
            <Section
              title={`${selectedAnalysis.part.id} · ${localizeKnownPartName(selectedAnalysis.part, language)}`}
              eyebrow={copy.parts.structuredRequirementCard}
            >
              <p className="lead-copy">{localizeKnownPartSummary(selectedAnalysis.part, language)}</p>
              <div className="meta-grid">
                <div>
                  <span className="meta-label">{copy.parts.category}</span>
                  <strong>{translateCategory(selectedAnalysis.part.category, language)}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.parts.qualityTier}</span>
                  <strong>{translateQualityTier(selectedAnalysis.part.qualityTier, language)}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.parts.targetLead}</span>
                  <strong>{selectedAnalysis.part.targetLeadTimeWeeks} {copy.parts.weeks}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.parts.annualVolume}</span>
                  <strong>{selectedAnalysis.part.annualVolume}</strong>
                </div>
              </div>
              <div className="document-grid">
                {selectedAnalysis.part.documents.map((document) => (
                  <div key={document.name} className={`document-card ${document.status}`}>
                    <span>{translateDocumentKind(document.kind, language)}</span>
                    <strong>{document.name}</strong>
                  </div>
                ))}
              </div>
            </Section>

            <div className="two-column">
              <Section title={copy.parts.technicalBoundaries} eyebrow={copy.parts.engineerToSourcing}>
                <div className="parameter-grid">
                  {selectedAnalysis.part.criticalParameters.map((parameter) => (
                    <div key={parameter.label} className={`parameter-card ${parameter.level}`}>
                      <span>{translateParameterLevel(parameter.level, language)}</span>
                      <strong>{parameter.label}</strong>
                      <p>{parameter.value}</p>
                      <small>{parameter.rationale}</small>
                    </div>
                  ))}
                </div>
                <div className="detail-columns">
                  <div>
                    <h3>{copy.parts.processNeeds}</h3>
                    <TagList items={selectedAnalysis.part.processNeeds} />
                  </div>
                  <div>
                    <h3>{copy.parts.tests}</h3>
                    <TagList items={selectedAnalysis.part.testNeeds} />
                  </div>
                  <div>
                    <h3>{copy.parts.quality}</h3>
                    <TagList items={selectedAnalysis.part.qualityNeeds} />
                  </div>
                </div>
              </Section>

              <Section title={copy.parts.riskRadar} eyebrow={copy.parts.programFriction}>
                <div className="risk-stack">
                  {riskAxes.map((axis) => (
                    <RiskScale key={axis.key} label={axis.label} value={selectedAnalysis.risk[axis.key]} />
                  ))}
                </div>
                <div className="detail-columns">
                  <div>
                    <h3>{copy.parts.why}</h3>
                    <ListBlock items={selectedAnalysis.risk.explanation} />
                  </div>
                  <div>
                    <h3>{copy.parts.suggestedActions}</h3>
                    <ListBlock items={selectedAnalysis.risk.actions} />
                  </div>
                </div>
              </Section>
            </div>

            <Section title={copy.parts.supplierCandidatePool} eyebrow={copy.parts.ruleBasedShortlist}>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>{copy.parts.order}</th>
                      <th>{copy.parts.supplier}</th>
                      <th>{copy.parts.score}</th>
                      <th>{copy.parts.recommendation}</th>
                      <th>{copy.parts.whyItFits}</th>
                      <th>{copy.parts.gaps}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalysis.matches.slice(0, 6).map((match) => (
                      <tr key={match.supplierId}>
                        <td>{match.contactOrder}</td>
                        <td>
                          <button
                            type="button"
                            className="table-link"
                            onClick={() => {
                              setSelectedSupplierId(match.supplierId);
                              setView('suppliers');
                            }}
                          >
                            {match.supplierName}
                          </button>
                        </td>
                        <td>
                          <ScorePill score={match.score} />
                        </td>
                        <td>
                          <RecommendationPill value={match.recommendation} language={language} />
                        </td>
                        <td>{match.reasons.join(' ')}</td>
                        <td>{match.missingConditions.join(' ') || copy.parts.noMajorGaps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="two-column">
              <Section title={copy.parts.rfqPack} eyebrow={copy.parts.buyerReadyOutput}>
                <div className="rfq-block">
                  <div>
                    <h3>{copy.parts.summary}</h3>
                    <p>{selectedAnalysis.rfq.summary}</p>
                  </div>
                  <div>
                    <h3>{copy.parts.keyParameters}</h3>
                    <ListBlock items={selectedAnalysis.rfq.keyParameters} />
                  </div>
                  <div>
                    <h3>{copy.parts.checklist}</h3>
                    <ListBlock items={selectedAnalysis.rfq.confirmChecklist} />
                  </div>
                  <div>
                    <h3>{copy.parts.clarifications}</h3>
                    <ListBlock items={selectedAnalysis.rfq.clarificationQuestions} />
                  </div>
                  <div>
                    <h3>{copy.parts.testsAndAcceptance}</h3>
                    <ListBlock items={selectedAnalysis.rfq.testsAndAcceptance} />
                  </div>
                  <div>
                    <h3>{copy.parts.fileList}</h3>
                    <ListBlock items={selectedAnalysis.rfq.fileList} />
                  </div>
                </div>
              </Section>

              <Section title={copy.parts.manualOverride} eyebrow={copy.project.humanInLoop}>
                <p className="muted">{copy.parts.humanLoopText}</p>
                <textarea
                  value={notesByPart[selectedAnalysis.part.id] ?? ''}
                  onChange={(event) =>
                    setNotesByPart((current) => ({
                      ...current,
                      [selectedAnalysis.part.id]: event.target.value,
                    }))
                  }
                  placeholder={copy.parts.humanLoopPlaceholder}
                />
              </Section>
            </div>
          </div>
        </main>
      ) : null}

      {view === 'suppliers' ? (
        <main className="workspace-layout">
          <aside className="side-rail">
            <Section title={copy.suppliers.supplierLibrary} eyebrow={copy.suppliers.demoCapabilityPool}>
              <div className="selector-list">
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    className={`selector-card ${selectedSupplierId === supplier.id ? 'active' : ''}`}
                    onClick={() => setSelectedSupplierId(supplier.id)}
                  >
                    <span className="selector-topline">
                      <strong>{supplier.id}</strong>
                      <small>{supplier.region}</small>
                    </span>
                    <p>{supplier.name}</p>
                    <small>{supplier.fitCategories.map((category) => translateCategory(category, language)).join(' / ')}</small>
                  </button>
                ))}
              </div>
            </Section>
          </aside>

          <div className="page-stack">
            <Section title={selectedSupplier.name} eyebrow={copy.suppliers.capabilityProfile}>
              <div className="meta-grid">
                <div>
                  <span className="meta-label">{copy.suppliers.region}</span>
                  <strong>{selectedSupplier.region}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.suppliers.prototypeLead}</span>
                  <strong>{selectedSupplier.prototypeLeadTimeWeeks} {copy.parts.weeks}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.suppliers.productionLead}</span>
                  <strong>{selectedSupplier.productionLeadTimeWeeks} {copy.parts.weeks}</strong>
                </div>
                <div>
                  <span className="meta-label">{copy.suppliers.typicalLot}</span>
                  <strong>{selectedSupplier.typicalLot}</strong>
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>{copy.suppliers.industries}</h3>
                  <TagList items={selectedSupplier.industries} />
                </div>
                <div>
                  <h3>{copy.suppliers.fitCategories}</h3>
                  <TagList items={selectedSupplier.fitCategories.map((category) => translateCategory(category, language))} />
                </div>
                <div>
                  <h3>{copy.suppliers.stageCapability}</h3>
                  <TagList items={selectedSupplier.stageCapabilities} />
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>{copy.suppliers.processTags}</h3>
                  <TagList items={selectedSupplier.processTags} />
                </div>
                <div>
                  <h3>{copy.suppliers.materialTags}</h3>
                  <TagList items={selectedSupplier.materialTags} />
                </div>
                <div>
                  <h3>{copy.suppliers.qualitySystems}</h3>
                  <TagList items={selectedSupplier.qualitySystems} />
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>{copy.suppliers.strengths}</h3>
                  <ListBlock items={selectedSupplier.strengths} />
                </div>
                <div>
                  <h3>{copy.suppliers.cautions}</h3>
                  <ListBlock items={selectedSupplier.cautions} />
                </div>
                <div>
                  <h3>{copy.suppliers.envelope}</h3>
                  <p>{selectedSupplier.sizeEnvelope}</p>
                </div>
              </div>
            </Section>

            <Section title={copy.suppliers.bestFitParts} eyebrow={copy.suppliers.whereToUseThisSupplier}>
              <div className="stack-list">
                {supplierPartFits.map(({ part, match, risk }) => (
                  <button
                    key={part.id}
                    type="button"
                    className="list-row"
                    onClick={() => {
                      setSelectedPartId(part.id);
                      setView('parts');
                    }}
                    >
                      <div>
                        <strong>
                          {part.id} · {localizeKnownPartName(part, language)}
                        </strong>
                        <p>{match.reasons.join(' ')}</p>
                      </div>
                      <div className="list-row-meta">
                        <ScorePill score={match.score} />
                        <span className={`risk-badge ${maxRisk(risk) >= 4 ? 'high' : 'mid'}`}>{copy.project.riskShort} {maxRisk(risk)}/5</span>
                      </div>
                    </button>
                ))}
              </div>
            </Section>
          </div>
        </main>
      ) : null}

      {view === 'risks' ? (
        <main className="page-stack">
          <Section title={copy.risks.criticalPathBoard} eyebrow={copy.risks.perRiskSorting}>
            <div className="risk-board-grid">
              {riskAxes.map((axis) => (
                <div key={axis.key} className="risk-board-column">
                  <div className="risk-board-header">
                    <h3>{axis.label}</h3>
                    <small>{copy.risks.rankedHighToLow}</small>
                  </div>
                  {analyses
                    .slice()
                    .sort((left, right) => right.risk[axis.key] - left.risk[axis.key])
                    .map(({ part, risk }) => (
                      <button
                        key={`${axis.key}-${part.id}`}
                        type="button"
                        className="risk-board-item"
                        onClick={() => {
                          setSelectedPartId(part.id);
                          setView('parts');
                        }}
                      >
                        <div>
                          <strong>{part.id}</strong>
                          <p>{localizeKnownPartName(part, language)}</p>
                        </div>
                        <span className={`risk-badge ${risk[axis.key] >= 4 ? 'high' : risk[axis.key] >= 3 ? 'mid' : 'low'}`}>
                          {risk[axis.key]}/5
                        </span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </Section>

          <div className="two-column">
            <Section title={copy.risks.programActions} eyebrow={copy.risks.whatToDoNext}>
              <div className="stack-list">
                {topActionQueue.map(({ part, risk }) => (
                  <div key={part.id} className="action-card">
                    <strong>
                      {part.id} · {localizeKnownPartName(part, language)}
                    </strong>
                    <ListBlock items={risk.actions} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title={copy.risks.riskModelNotes} eyebrow={copy.risks.mvpLogic}>
              <div className="scope-copy">
                <p>{copy.risks.modelNoteOne}</p>
                <p>{copy.risks.modelNoteTwo}</p>
              </div>
            </Section>
          </div>
        </main>
      ) : null}

      {view === 'exports' ? (
        <main className="page-stack">
          <Section title={copy.exports.exportCenter} eyebrow={copy.exports.shareableOutputs}>
            <div className="export-grid">
              {exportCards.map((card) => (
                <div key={card.filename} className="export-card">
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                  <button type="button" className="primary-button" onClick={() => downloadText(card.filename, card.content)}>
                    {copy.exports.download}
                  </button>
                  <pre>{card.content.split('\n').slice(0, 10).join('\n')}</pre>
                </div>
              ))}
            </div>
          </Section>
        </main>
      ) : null}
    </div>
  );
}

export default App;
