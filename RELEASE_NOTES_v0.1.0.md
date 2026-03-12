# Fusion Buyer MVP v0.1.0

Initial open-source release of the `HV Capacitor` procurement intelligence MVP.

## What this release proves

- A narrow `HV Capacitor` ingest path can convert text into a structured sourcing card.
- Readiness is gated explicitly: single-model samples can become `ready`, while ambiguous multi-model inputs stay `draft`.
- The same rule-based path now works across at least two different vendor document styles.

## Included in v0.1.0

- React + Vite workbench with five views:
  - `Project Board`
  - `Part Detail`
  - `Supplier Profiles`
  - `Risk Board`
  - `Export Center`
- HV capacitor ingest pipeline:
  - PDF text extraction
  - text preprocessing
  - field extraction
  - normalization
  - readiness gating
  - conversion into the existing part/risk/RFQ workflow
- Field-level observability and real-sample calibration tools:
  - `npm run validate:ingest`
  - `npm run calibrate:ingest`
- Regression assets:
  - 2 `ready` single-model fixtures
  - 1 hard-case family-catalog `draft` fixture
  - golden normalized outputs for regression validation
- Lightweight demo sample loader in the ingest panel for stable live demos

## Key ready-sample milestones

### Ready sample A

- Fixture: `src/ingest/fixtures/hv-capacitor-single-model-anchor.txt`
- Locked outputs:
  - `part_name = KVX01S104K0T`
  - `rated_voltage_kv = 1`
  - `capacitance_uf = 0.1`
  - `dimensions = 1.81 x 1.47 x 0.17 inches`
  - `readiness = ready`

### Ready sample B

- Fixture: `src/ingest/fixtures/hv-capacitor-exxelia-ready.txt`
- Locked outputs:
  - `part_name = Snubber Capacitor with Axial Leads`
  - `rated_voltage_kv = 3`
  - `capacitance_uf = 0.047`
  - `dimensions = 12.0 x 19.0 x 46.0 mm`
  - `readiness = ready`

### Hard-case draft

- Fixture: `src/ingest/fixtures/hv-capacitor-family-catalog-ambiguous.txt`
- Expected outcome:
  - family-catalog ambiguity remains visible
  - extractor does not force a false single-value card
  - output stays `draft` with actionable guidance

## Explicit non-goals in v0.1.0

- No backend
- No database
- No OCR
- No multi-category ingest
- No general parser
- No agent-style automation
- No live supplier master or ERP/PLM integration

## Demo positioning

This release is a judgment-support prototype, not an ordering system. The value is in:

- translating engineering text into sourcing-ready structure
- surfacing ambiguity instead of guessing
- keeping supplier/risk/RFQ outputs explainable

## Suggested next step

Pressure-test the same V1 path on another different-source `kV-class` single-model sample before expanding scope or polishing P2 behaviors.
