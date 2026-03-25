interface NerWorkerEntity {
  word: string;
  score: number;
  category: string;
  start: number;
  end: number;
}

interface NerWorkerRequest {
  type: 'INIT' | 'DETECT';
  id?: number;
  text?: string;
  labels?: string[];
}

interface NerWorkerPipelineResult {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

declare module './transformers.min.js' {
  export const env: any;
  export function pipeline(task: string, model: string, options?: Record<string, unknown>): Promise<any>;
}
