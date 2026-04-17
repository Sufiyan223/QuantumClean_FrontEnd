export type Step = 'UPLOAD' | 'PROCESSING' | 'RESULTS';

export interface DuplicateGroup {
  group_id: string;
  records: any[];
  golden_record: any;
}

export interface ProcessingState {
  step: Step;
  progress: {
    standardization: { completed: number; total: number };
    filtering: { removed: number; kept: number };
    extraction: { completed: number; total: number };
    duplicates: { completed: number; total: number };
    currentStage: 'STANDARDIZATION' | 'FILTERING' | 'EXTRACTION' | 'DUPLICATES' | 'DONE' | 'ERROR';
    error?: string;
  };
  data: {
    original: any[];
    standardized: any[];
    cleaned: any[];
    extracted: any[];
    duplicates: any[];
    duplicateGroups: DuplicateGroup[];
  };
}
