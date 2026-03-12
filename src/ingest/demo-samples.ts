import familyCatalogText from './fixtures/hv-capacitor-family-catalog-ambiguous.txt?raw';
import exxeliaReadyText from './fixtures/hv-capacitor-exxelia-ready.txt?raw';
import singleModelAnchorText from './fixtures/hv-capacitor-single-model-anchor.txt?raw';

export interface DemoIngestSample {
  id: string;
  label: string;
  fileName: string;
  statusLabel: 'ready' | 'draft / ambiguous';
  statusTone: 'low' | 'mid';
  note: string;
  text: string;
}

export const demoIngestSamples: DemoIngestSample[] = [
  {
    id: 'single-model-anchor',
    label: 'Ready sample A',
    fileName: 'hv-capacitor-single-model-anchor.txt',
    statusLabel: 'ready',
    statusTone: 'low',
    note: 'Same-order table alignment with a single catalog anchor.',
    text: singleModelAnchorText,
  },
  {
    id: 'exxelia-ready',
    label: 'Ready sample B',
    fileName: 'hv-capacitor-exxelia-ready.txt',
    statusLabel: 'ready',
    statusTone: 'low',
    note: 'Cross-source single-model spec card from Exxelia.',
    text: exxeliaReadyText,
  },
  {
    id: 'family-catalog-ambiguous',
    label: 'Hard case draft',
    fileName: 'hv-capacitor-family-catalog-ambiguous.txt',
    statusLabel: 'draft / ambiguous',
    statusTone: 'mid',
    note: 'Family catalog ambiguity that should stay draft.',
    text: familyCatalogText,
  },
];
