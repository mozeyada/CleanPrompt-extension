import { pipeline, env } from './transformers.min.js';

// Optimizations for extension environment
env.allowLocalModels = false;
env.allowRemoteModels = false;
env.useBrowserCache = true;

// Disable multi-threading due to some browser limits in extension workers, 
// unless cross-origin isolation is fully enabled.
env.backends.onnx.wasm.numThreads = 1;

let nerPipeline = null;
let isLoaded = false;

// We use a lightweight ONNX NER model here. 
// For full GLiNER zero-shot, we would load 'onnx-community/gliner_medium-v2.1' 
// if supported, or a standard base NER as fallback.
const MODEL_NAME = 'Xenova/bert-base-NER'; 

async function loadModel() {
  if (isLoaded) return;
  try {
    throw new Error('Stage-2 NER is disabled in this local-first build. Use bundled regex detection only.');
    self.postMessage({ type: 'STATUS', status: 'loading' });
    nerPipeline = await pipeline('token-classification', MODEL_NAME, {
      progress_callback: (x) => {
        self.postMessage({ type: 'PROGRESS', data: x });
      }
    });
    isLoaded = true;
    self.postMessage({ type: 'STATUS', status: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message });
  }
}

self.addEventListener('message', async (e) => {
  const { type, id, text, labels } = e.data;

  if (type === 'INIT') {
    await loadModel();
    return;
  }

  if (type === 'DETECT') {
    if (!isLoaded) await loadModel();
    
    try {
      // Run inference
      // The bert-base-NER model detects PER, ORG, LOC, MISC
      // A true GLiNER model would accept `labels` array as the second argument/context.
      const results = await nerPipeline(text, { ignore_labels: ['O'] });
      
      // Transform results into logclean finding format
      // Map B-PER / I-PER etc to generic categories for the demo
      const entities = results.map(r => {
        let cat = 'PII';
        if (r.entity.includes('ORG')) cat = 'Company';
        if (r.entity.includes('LOC')) cat = 'Location';
        
        return {
          word: r.word.replace(/^##/, ''),
          score: r.score,
          category: cat,
          start: r.start,
          end: r.end
        };
      });

      // Post-process to merge adjacent subwords (## tokens)
      const merged = [];
      let current = null;
      for (const ent of entities) {
        if (!current) {
          current = { ...ent };
          continue;
        }
        // If it's a continuation of the same entity (close proximity)
        if (ent.start <= current.end + 1 && ent.category === current.category) {
          current.word += (ent.start === current.end ? '' : ' ') + ent.word;
          current.end = ent.end;
        } else {
          merged.push(current);
          current = { ...ent };
        }
      }
      if (current) merged.push(current);

      self.postMessage({
        type: 'RESULT',
        id,
        findings: merged
      });
    } catch (err) {
      self.postMessage({ type: 'ERROR', id, error: err.message });
    }
  }
});
