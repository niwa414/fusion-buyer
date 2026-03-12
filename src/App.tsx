import { startTransition, useState, type ChangeEvent, type ReactNode } from 'react';

import { projectInfo, suppliers } from './domain/data';
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

const demoAnalyses = analyzeAllParts();
const demoMetrics = buildProjectMetrics();

const navItems: { id: NavigationView; label: string; note: string }[] = [
  { id: 'project', label: 'Project Board', note: 'program pulse' },
  { id: 'parts', label: 'Part Detail', note: 'engineering to sourcing' },
  { id: 'suppliers', label: 'Supplier Profiles', note: 'capability lens' },
  { id: 'risks', label: 'Risk Board', note: 'critical path view' },
  { id: 'exports', label: 'Export Center', note: 'report outputs' },
];

type RiskAxisKey = 'singleSource' | 'longLead' | 'specClarity' | 'processMaturity' | 'qualitySystem';

const riskAxes: { key: RiskAxisKey; label: string }[] = [
  { key: 'singleSource', label: 'Single source' },
  { key: 'longLead', label: 'Long lead' },
  { key: 'specClarity', label: 'Spec clarity' },
  { key: 'processMaturity', label: 'Process maturity' },
  { key: 'qualitySystem', label: 'Quality system' },
];

function recommendationLabel(value: RecommendationLevel) {
  switch (value) {
    case 'lead':
      return 'Lead';
    case 'backup':
      return 'Backup';
    case 'adjacent':
      return 'Adjacent';
    default:
      return 'Watchlist';
  }
}

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

function RecommendationPill(props: { value: RecommendationLevel }) {
  return <span className={`recommendation-pill ${props.value}`}>{recommendationLabel(props.value)}</span>;
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
      title: 'Part analysis report',
      filename: 'part-analysis-report.md',
      description: 'Structured requirement cards, shortlist preview, and per-part risk.',
      content: createPartAnalysisReport(),
    },
    {
      title: 'Supplier shortlist',
      filename: 'supplier-shortlist.md',
      description: 'Ranked supplier pool with reasons and gaps.',
      content: createSupplierShortlist(),
    },
    {
      title: 'RFQ pack',
      filename: 'rfq-pack.md',
      description: 'Send-ready RFQ sections generated from structured data.',
      content: createRFQPack(),
    },
    {
      title: 'Project risk report',
      filename: 'project-risk-report.md',
      description: 'Program-level risk summary and recommended actions.',
      content: createProjectRiskReport(),
    },
    {
      title: 'Supplier capability dump',
      filename: 'supplier-capability-dump.md',
      description: 'Current demo supplier library and metadata.',
      content: createSupplierCapabilityDump(),
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
      setIngestError(error instanceof Error ? error.message : 'Failed to ingest the PDF.');
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
        warnings: effectiveText ? ['Using manual text input without a PDF upload.'] : ['Paste text or upload a PDF to continue.'],
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
    const sampleIngest: IngestResult = {
      status: 'ok',
      text: sample.text,
      pageCount: 1,
      warnings: [`Loaded demo sample: ${sample.label} (${sample.statusLabel}).`],
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
          <span className="section-eyebrow">Chosen wedge</span>
          <h1>{projectInfo.title}</h1>
          <p>{projectInfo.objective}</p>
        </div>

        <div className="hero-panels">
          <div className="hero-panel">
            <span>Cluster</span>
            <strong>{projectInfo.cluster}</strong>
          </div>
          <div className="hero-panel">
            <span>Customer profile</span>
            <strong>{projectInfo.customer}</strong>
          </div>
          <div className="hero-panel">
            <span>Operating model</span>
            <strong>Rules first, human in the loop</strong>
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
            <MetricCard label="Analyzed parts" value={metrics.totalParts} hint="Current demo package" />
            <MetricCard label="High-risk parts" value={metrics.highRiskCount} hint="Any axis >= 4" />
            <MetricCard label="Single-source parts" value={metrics.singleSourceCount} hint="Lead source concentration" />
            <MetricCard label="Need more information" value={metrics.needsInfoCount} hint="Open questions or missing docs" />
            <MetricCard label="RFQ-ready parts" value={metrics.rfqReadyCount} hint="Complete file package today" />
          </div>

          <div className="two-column">
            <Section title="Action queue" eyebrow="Program focus">
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
                        {part.id} · {part.name}
                      </strong>
                      <p>{risk.explanation[0]}</p>
                    </div>
                    <span className={`risk-badge ${maxRisk(risk) >= 4 ? 'high' : 'mid'}`}>risk {maxRisk(risk)}/5</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="What this MVP locks down" eyebrow="Scope discipline">
              <div className="scope-copy">
                <p>Part card schema, supplier capability schema, RFQ template, and five-axis risk model are all explicit.</p>
                <p>
                  This first cut avoids ERP integration, quoting automation, pricing logic, and approval workflow. It focuses on
                  judgment support.
                </p>
              </div>
            </Section>
          </div>

          <Section title="Field blueprint" eyebrow="Data backbone">
            <div className="blueprint-grid">
              <SchemaBlock title="Part schema" groups={partSchema} />
              <SchemaBlock title="Supplier schema" groups={supplierSchema} />
              <SchemaBlock title="Risk schema" groups={riskSchema} />
              <SchemaBlock title="RFQ schema" groups={rfqSchema} />
            </div>
          </Section>

          <Section title="HV Capacitor Ingest" eyebrow="Real document to card">
            <div className="two-column ingest-layout">
              <div className="ingest-panel">
                <p className="muted">
                  V1 ingest is intentionally narrow: one PDF plus light BOM/manual context, HV capacitor only, no OCR.
                </p>

                <div className="demo-sample-block">
                  <span className="meta-label">Demo samples</span>
                  <div className="demo-sample-grid">
                    {demoIngestSamples.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        className={`demo-sample-button ${selectedDemoSampleId === sample.id ? 'active' : ''}`}
                        onClick={() => loadDemoSample(sample.id)}
                      >
                        <div>
                          <strong>{sample.label}</strong>
                          <p>{sample.note}</p>
                        </div>
                        <span className={`risk-badge ${sample.statusTone}`}>{sample.statusLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="input-group">
                  <span className="meta-label">Upload PDF</span>
                  <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
                </label>

                <div className="ingest-status-row">
                  <span className={`risk-badge ${ingestResult?.status === 'ok' ? 'low' : 'mid'}`}>
                    {isIngesting ? 'parsing' : ingestResult?.status ?? 'idle'}
                  </span>
                  <small>{ingestResult ? `${ingestResult.fileName} · ${ingestResult.pageCount} pages` : 'No file loaded yet'}</small>
                </div>

                {ingestError ? <p className="error-copy">{ingestError}</p> : null}

                <div className="form-grid">
                  <label className="input-group">
                    <span className="meta-label">Part name</span>
                    <input value={bomInput.partName ?? ''} onChange={(event) => handleBomInputChange('partName', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Manufacturer</span>
                    <input value={bomInput.manufacturer ?? ''} onChange={(event) => handleBomInputChange('manufacturer', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">MPN</span>
                    <input value={bomInput.mpn ?? ''} onChange={(event) => handleBomInputChange('mpn', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Quantity / batch</span>
                    <input value={bomInput.quantity ?? ''} onChange={(event) => handleBomInputChange('quantity', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Voltage kV</span>
                    <input value={bomInput.ratedVoltageKv ?? ''} onChange={(event) => handleBomInputChange('ratedVoltageKv', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Capacitance uF</span>
                    <input value={bomInput.capacitanceUf ?? ''} onChange={(event) => handleBomInputChange('capacitanceUf', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Mounting style</span>
                    <input value={bomInput.mountingStyle ?? ''} onChange={(event) => handleBomInputChange('mountingStyle', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Dimensions</span>
                    <input value={bomInput.dimensions ?? ''} onChange={(event) => handleBomInputChange('dimensions', event.target.value)} />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Target lead weeks</span>
                    <input
                      value={bomInput.targetLeadTimeWeeks ?? ''}
                      onChange={(event) => handleBomInputChange('targetLeadTimeWeeks', event.target.value)}
                    />
                  </label>
                  <label className="input-group">
                    <span className="meta-label">Annual volume</span>
                    <input value={bomInput.annualVolume ?? ''} onChange={(event) => handleBomInputChange('annualVolume', event.target.value)} />
                  </label>
                </div>

                <div className="button-row">
                  <button type="button" className="primary-button" onClick={runHvCapacitorIngest}>
                    Generate part card
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
                      Open generated card
                    </button>
                  ) : null}
                </div>

                {normalizedResult ? (
                  <div className="ingest-summary">
                    <div>
                      <span className="meta-label">Readiness</span>
                      <strong>{normalizedResult.readiness}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Review issues</span>
                      <strong>{normalizedResult.reviewIssues.length}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Generated card</span>
                      <strong>{generatedAnalysis ? 'ready in workbench' : 'draft / insufficient extraction'}</strong>
                    </div>
                  </div>
                ) : null}

                {ingestReviewSummary ? (
                  <div className="review-summary-card">
                    <h3>Review summary</h3>
                    <div className="summary-grid">
                      <div>
                        <span className="meta-label">Key fields</span>
                        <ul className="bullet-list">
                          <li>part_name: {normalizedResult?.partName ?? 'missing'}</li>
                          <li>
                            rated_voltage_kv:{' '}
                            {normalizedResult?.ratedVoltageKv !== null && normalizedResult?.ratedVoltageKv !== undefined
                              ? `${normalizedResult.ratedVoltageKv} kV`
                              : 'missing'}
                          </li>
                          <li>
                            capacitance_uf:{' '}
                            {normalizedResult?.capacitanceUf !== null && normalizedResult?.capacitanceUf !== undefined
                              ? `${normalizedResult.capacitanceUf} uF`
                              : 'missing'}
                          </li>
                          <li>dimensions: {normalizedResult?.dimensions ?? 'missing'}</li>
                        </ul>
                      </div>
                      <div>
                        <span className="meta-label">Blocking issues</span>
                        <ListBlock
                          items={ingestReviewSummary.blockingIssues}
                          emptyLabel="No blocking issues. This card can move forward."
                        />
                      </div>
                      <div>
                        <span className="meta-label">Missing fields</span>
                        <ListBlock items={ingestReviewSummary.missingFields} emptyLabel="No missing fields in current extractor pass." />
                      </div>
                      <div>
                        <span className="meta-label">Conflict fields</span>
                        <ListBlock items={ingestReviewSummary.conflictFields} emptyLabel="No conflicting field values found." />
                      </div>
                      <div>
                        <span className="meta-label">Required fields</span>
                        <ul className="bullet-list">
                          {ingestReviewSummary.requiredFields.map((field) => (
                            <li key={field.field}>
                              {field.satisfied ? '[ok]' : '[missing]'} {field.field}: {field.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ingest-panel">
                <h3>Source text preview</h3>
                <p className="muted">
                  If the PDF has no useful text layer, paste the extracted text here and rerun the HV capacitor extractor.
                </p>
                <textarea
                  value={manualText}
                  onChange={(event) => {
                    setSelectedDemoSampleId(null);
                    setManualText(event.target.value);
                  }}
                  placeholder="PDF text appears here. You can also paste manual text for unsupported PDFs."
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
              <JsonPreview title="Extract Result JSON" value={extractResult ?? { status: 'pending' }} />
              <JsonPreview title="Normalized Result JSON" value={normalizedResult ?? { status: 'pending' }} />
            </div>

            {normalizedResult ? (
              <div className="two-column">
                <Section title="Review queue" eyebrow="Human in the loop" className="nested-section">
                  <ListBlock
                    items={normalizedResult.reviewIssues.map(
                      (issue) => `${issue.blocking ? '[blocker]' : '[review]'} ${issue.field}: ${issue.message}`,
                    )}
                    emptyLabel="No review issues on this normalized card."
                  />
                </Section>

                <Section title="Required fields gate" eyebrow="Readiness rule" className="nested-section">
                  <ListBlock
                    items={[
                      'part_name',
                      'rated_voltage_kv',
                      'capacitance_uf',
                      'mounting_style or dimensions',
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
            <Section title="Parts" eyebrow="Current package">
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
                    <p>{part.name}</p>
                    <small>{part.category}</small>
                  </button>
                ))}
              </div>
            </Section>
          </aside>

          <div className="page-stack">
            <Section title={`${selectedAnalysis.part.id} · ${selectedAnalysis.part.name}`} eyebrow="Structured requirement card">
              <p className="lead-copy">{selectedAnalysis.part.summary}</p>
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Category</span>
                  <strong>{selectedAnalysis.part.category}</strong>
                </div>
                <div>
                  <span className="meta-label">Quality tier</span>
                  <strong>{selectedAnalysis.part.qualityTier}</strong>
                </div>
                <div>
                  <span className="meta-label">Target lead</span>
                  <strong>{selectedAnalysis.part.targetLeadTimeWeeks} weeks</strong>
                </div>
                <div>
                  <span className="meta-label">Annual volume</span>
                  <strong>{selectedAnalysis.part.annualVolume}</strong>
                </div>
              </div>
              <div className="document-grid">
                {selectedAnalysis.part.documents.map((document) => (
                  <div key={document.name} className={`document-card ${document.status}`}>
                    <span>{document.kind}</span>
                    <strong>{document.name}</strong>
                  </div>
                ))}
              </div>
            </Section>

            <div className="two-column">
              <Section title="Technical boundaries" eyebrow="Engineer to sourcing">
                <div className="parameter-grid">
                  {selectedAnalysis.part.criticalParameters.map((parameter) => (
                    <div key={parameter.label} className={`parameter-card ${parameter.level}`}>
                      <span>{parameter.level}</span>
                      <strong>{parameter.label}</strong>
                      <p>{parameter.value}</p>
                      <small>{parameter.rationale}</small>
                    </div>
                  ))}
                </div>
                <div className="detail-columns">
                  <div>
                    <h3>Process needs</h3>
                    <TagList items={selectedAnalysis.part.processNeeds} />
                  </div>
                  <div>
                    <h3>Tests</h3>
                    <TagList items={selectedAnalysis.part.testNeeds} />
                  </div>
                  <div>
                    <h3>Quality</h3>
                    <TagList items={selectedAnalysis.part.qualityNeeds} />
                  </div>
                </div>
              </Section>

              <Section title="Risk radar" eyebrow="Program friction">
                <div className="risk-stack">
                  {riskAxes.map((axis) => (
                    <RiskScale key={axis.key} label={axis.label} value={selectedAnalysis.risk[axis.key]} />
                  ))}
                </div>
                <div className="detail-columns">
                  <div>
                    <h3>Why</h3>
                    <ListBlock items={selectedAnalysis.risk.explanation} />
                  </div>
                  <div>
                    <h3>Suggested actions</h3>
                    <ListBlock items={selectedAnalysis.risk.actions} />
                  </div>
                </div>
              </Section>
            </div>

            <Section title="Supplier candidate pool" eyebrow="Rule-based shortlist">
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Supplier</th>
                      <th>Score</th>
                      <th>Recommendation</th>
                      <th>Why it fits</th>
                      <th>Gaps</th>
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
                          <RecommendationPill value={match.recommendation} />
                        </td>
                        <td>{match.reasons.join(' ')}</td>
                        <td>{match.missingConditions.join(' ') || 'No major gaps in this ruleset.'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <div className="two-column">
              <Section title="RFQ pack" eyebrow="Buyer-ready output">
                <div className="rfq-block">
                  <div>
                    <h3>Summary</h3>
                    <p>{selectedAnalysis.rfq.summary}</p>
                  </div>
                  <div>
                    <h3>Key parameters</h3>
                    <ListBlock items={selectedAnalysis.rfq.keyParameters} />
                  </div>
                  <div>
                    <h3>Checklist</h3>
                    <ListBlock items={selectedAnalysis.rfq.confirmChecklist} />
                  </div>
                  <div>
                    <h3>Clarifications</h3>
                    <ListBlock items={selectedAnalysis.rfq.clarificationQuestions} />
                  </div>
                  <div>
                    <h3>Tests and acceptance</h3>
                    <ListBlock items={selectedAnalysis.rfq.testsAndAcceptance} />
                  </div>
                  <div>
                    <h3>File list</h3>
                    <ListBlock items={selectedAnalysis.rfq.fileList} />
                  </div>
                </div>
              </Section>

              <Section title="Human in the loop" eyebrow="Manual override">
                <p className="muted">
                  AI extracts structure and proposes a shortlist. Engineering and sourcing still need a place to lock down final
                  interpretation.
                </p>
                <textarea
                  value={notesByPart[selectedAnalysis.part.id] ?? ''}
                  onChange={(event) =>
                    setNotesByPart((current) => ({
                      ...current,
                      [selectedAnalysis.part.id]: event.target.value,
                    }))
                  }
                  placeholder="Record sourcing judgement, approved substitutions, or supplier-specific caveats."
                />
              </Section>
            </div>
          </div>
        </main>
      ) : null}

      {view === 'suppliers' ? (
        <main className="workspace-layout">
          <aside className="side-rail">
            <Section title="Supplier library" eyebrow="Demo capability pool">
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
                    <small>{supplier.fitCategories.join(' / ')}</small>
                  </button>
                ))}
              </div>
            </Section>
          </aside>

          <div className="page-stack">
            <Section title={selectedSupplier.name} eyebrow="Capability profile">
              <div className="meta-grid">
                <div>
                  <span className="meta-label">Region</span>
                  <strong>{selectedSupplier.region}</strong>
                </div>
                <div>
                  <span className="meta-label">Prototype lead</span>
                  <strong>{selectedSupplier.prototypeLeadTimeWeeks} weeks</strong>
                </div>
                <div>
                  <span className="meta-label">Production lead</span>
                  <strong>{selectedSupplier.productionLeadTimeWeeks} weeks</strong>
                </div>
                <div>
                  <span className="meta-label">Typical lot</span>
                  <strong>{selectedSupplier.typicalLot}</strong>
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>Industries</h3>
                  <TagList items={selectedSupplier.industries} />
                </div>
                <div>
                  <h3>Fit categories</h3>
                  <TagList items={selectedSupplier.fitCategories} />
                </div>
                <div>
                  <h3>Stage capability</h3>
                  <TagList items={selectedSupplier.stageCapabilities} />
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>Process tags</h3>
                  <TagList items={selectedSupplier.processTags} />
                </div>
                <div>
                  <h3>Material tags</h3>
                  <TagList items={selectedSupplier.materialTags} />
                </div>
                <div>
                  <h3>Quality systems</h3>
                  <TagList items={selectedSupplier.qualitySystems} />
                </div>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>Strengths</h3>
                  <ListBlock items={selectedSupplier.strengths} />
                </div>
                <div>
                  <h3>Cautions</h3>
                  <ListBlock items={selectedSupplier.cautions} />
                </div>
                <div>
                  <h3>Envelope</h3>
                  <p>{selectedSupplier.sizeEnvelope}</p>
                </div>
              </div>
            </Section>

            <Section title="Best-fit parts" eyebrow="Where to use this supplier">
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
                        {part.id} · {part.name}
                      </strong>
                      <p>{match.reasons.join(' ')}</p>
                    </div>
                    <div className="list-row-meta">
                      <ScorePill score={match.score} />
                      <span className={`risk-badge ${maxRisk(risk) >= 4 ? 'high' : 'mid'}`}>risk {maxRisk(risk)}/5</span>
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
          <Section title="Critical path board" eyebrow="Per-risk sorting">
            <div className="risk-board-grid">
              {riskAxes.map((axis) => (
                <div key={axis.key} className="risk-board-column">
                  <div className="risk-board-header">
                    <h3>{axis.label}</h3>
                    <small>ranked high to low</small>
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
                          <p>{part.name}</p>
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
            <Section title="Program actions" eyebrow="What to do next">
              <div className="stack-list">
                {topActionQueue.map(({ part, risk }) => (
                  <div key={part.id} className="action-card">
                    <strong>
                      {part.id} · {part.name}
                    </strong>
                    <ListBlock items={risk.actions} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Risk model notes" eyebrow="MVP logic">
              <div className="scope-copy">
                <p>Scores are deterministic and auditable. They come from shortlist depth, lead-time fit, spec completeness, process coverage, and quality evidence.</p>
                <p>The point is not perfect prediction. The point is to surface where engineering and sourcing need to intervene before RFQ churn starts.</p>
              </div>
            </Section>
          </div>
        </main>
      ) : null}

      {view === 'exports' ? (
        <main className="page-stack">
          <Section title="Export center" eyebrow="Shareable outputs">
            <div className="export-grid">
              {exportCards.map((card) => (
                <div key={card.filename} className="export-card">
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                  <button type="button" className="primary-button" onClick={() => downloadText(card.filename, card.content)}>
                    Download
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
