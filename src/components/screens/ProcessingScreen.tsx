import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { ProcessingState, DuplicateGroup } from '../../types';
import { createBatches, processBatches, retryCall, callAgent, filterInvalidRecords } from '../../lib/api';

interface Props {
  state: ProcessingState;
  setState: React.Dispatch<React.SetStateAction<ProcessingState>>;
}

export function ProcessingScreen({ state, setState }: Props) {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const runPipeline = async () => {
      try {
        const inputData = state.data.original;
        
        // ═══════════════════════════════════════════
        // STEP 1: STANDARDIZATION
        // ═══════════════════════════════════════════
        setState(prev => ({ ...prev, progress: { ...prev.progress, currentStage: 'STANDARDIZATION' } }));
        const stdBatches = createBatches(inputData, 30);
        setState(prev => ({ ...prev, progress: { ...prev.progress, standardization: { completed: 0, total: stdBatches.length } } }));
        
        const stdResults = await processBatches<any, any>('STANDARDIZATION', stdBatches, 4, (completed, total) => {
          setState(prev => ({ ...prev, progress: { ...prev.progress, standardization: { completed, total } } }));
        });
        const standardizedData = stdResults.flat();
        setState(prev => ({ ...prev, data: { ...prev.data, standardized: standardizedData } }));

        // ═══════════════════════════════════════════
        // STEP 2: FILTER INVALID RECORDS
        // ═══════════════════════════════════════════
        setState(prev => ({ ...prev, progress: { ...prev.progress, currentStage: 'FILTERING' } }));
        const { valid: cleanedData, removed } = filterInvalidRecords(standardizedData);
        setState(prev => ({ 
          ...prev, 
          progress: { ...prev.progress, filtering: { removed: removed.length, kept: cleanedData.length } },
          data: { ...prev.data, cleaned: cleanedData }
        }));

        // Small delay to show filtering step
        await new Promise(r => setTimeout(r, 800));

        // ═══════════════════════════════════════════
        // STEP 3: ATTRIBUTE EXTRACTION (on cleaned data only)
        // ═══════════════════════════════════════════
        setState(prev => ({ ...prev, progress: { ...prev.progress, currentStage: 'EXTRACTION' } }));
        const attrBatches = createBatches(cleanedData, 30);
        setState(prev => ({ ...prev, progress: { ...prev.progress, extraction: { completed: 0, total: attrBatches.length } } }));
        
        const attrResults = await processBatches<any, any>('ATTRIBUTE_EXTRACTION', attrBatches, 4, (completed, total) => {
          setState(prev => ({ ...prev, progress: { ...prev.progress, extraction: { completed, total } } }));
        });
        const attributeData = attrResults.flat();
        setState(prev => ({ ...prev, data: { ...prev.data, extracted: attributeData } }));

        // ═══════════════════════════════════════════
        // STEP 4: DUPLICATE DETECTION + GOLDEN RECORD (on attribute-enriched data)
        // ═══════════════════════════════════════════
        setState(prev => ({ ...prev, progress: { ...prev.progress, currentStage: 'DUPLICATES' } }));
        
        // Send all data in one batch for cross-record duplicate detection
        const dupBatches = createBatches(attributeData, 50);
        setState(prev => ({ ...prev, progress: { ...prev.progress, duplicates: { completed: 0, total: dupBatches.length } } }));
        
        let allDuplicateGroups: DuplicateGroup[] = [];
        let allDuplicateRecords: any[] = [];

        for (let i = 0; i < dupBatches.length; i++) {
          const dupResult = await retryCall(() => callAgent('DUPLICATE_DETECTION', dupBatches[i]));
          
          // Extract groups from structured response
          if (dupResult && typeof dupResult === 'object' && !Array.isArray(dupResult)) {
            const groups = dupResult.duplicate_groups || [];
            const uniqueRecords = dupResult.unique_records || [];
            
            for (const group of groups) {
              allDuplicateGroups.push({
                group_id: group.group_id || `G${allDuplicateGroups.length + 1}`,
                records: group.records || [],
                golden_record: group.golden_record || (group.records ? group.records[0] : {}),
              });
              allDuplicateRecords.push(...(group.records || []));
            }
            
            // Add unique records with their own metadata
            for (const rec of uniqueRecords) {
              allDuplicateRecords.push({ ...rec, duplicate_group: 'unique', duplicate_confidence: 0, duplicate_reason: 'Unique record' });
            }
          } else if (Array.isArray(dupResult)) {
            // Fallback: agent returned flat array with duplicate_group field
            allDuplicateRecords.push(...dupResult);
            
            // Build groups from flat array
            const groupMap = new Map<string, any[]>();
            for (const rec of dupResult) {
              const gid = String(rec.duplicate_group || 'unique');
              if (!groupMap.has(gid)) groupMap.set(gid, []);
              groupMap.get(gid)!.push(rec);
            }
            for (const [gid, records] of groupMap) {
              if (records.length > 1) {
                allDuplicateGroups.push({
                  group_id: `G${gid}`,
                  records,
                  golden_record: records.reduce((best: any, curr: any) => {
                    const bestFilled = Object.values(best).filter(v => v !== '' && v !== null && v !== undefined).length;
                    const currFilled = Object.values(curr).filter(v => v !== '' && v !== null && v !== undefined).length;
                    return currFilled > bestFilled ? curr : best;
                  }, records[0]),
                });
              }
            }
          }

          setState(prev => ({ ...prev, progress: { ...prev.progress, duplicates: { completed: i + 1, total: dupBatches.length } } }));
        }
        
        setState(prev => ({ 
          ...prev, 
          progress: { ...prev.progress, duplicates: { completed: dupBatches.length, total: dupBatches.length }, currentStage: 'DONE' },
          data: { ...prev.data, duplicates: allDuplicateRecords, duplicateGroups: allDuplicateGroups }
        }));

        // Move to results after a short delay
        setTimeout(() => {
          setState(prev => ({ ...prev, step: 'RESULTS' }));
        }, 1500);

      } catch (error: any) {
        console.error("Pipeline Error:", error);
        setState(prev => ({ 
          ...prev, 
          progress: { ...prev.progress, currentStage: 'ERROR', error: error.message || "An unknown error occurred" } 
        }));
      }
    };

    runPipeline();
  }, [setState, state.data.original]);

  const stages = [
    { id: 'STANDARDIZATION', name: 'Standardization', type: 'batch' as const, progress: state.progress.standardization },
    { id: 'FILTERING', name: 'Invalid Data Filtering', type: 'filter' as const, filtering: state.progress.filtering },
    { id: 'EXTRACTION', name: 'Attribute Extraction', type: 'batch' as const, progress: state.progress.extraction },
    { id: 'DUPLICATES', name: 'Duplicate Detection & Golden Record', type: 'batch' as const, progress: state.progress.duplicates },
  ];

  const getStageStatus = (stageId: string) => {
    const stageOrder = ['STANDARDIZATION', 'FILTERING', 'EXTRACTION', 'DUPLICATES'];
    const stageIndex = stageOrder.indexOf(stageId);
    const currentIndex = stageOrder.indexOf(state.progress.currentStage);
    
    if (state.progress.currentStage === 'ERROR') {
      return stageIndex <= currentIndex ? 'error' : 'pending';
    }
    if (state.progress.currentStage === 'DONE' || stageIndex < currentIndex) {
      return 'done';
    }
    if (stageIndex === currentIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="max-w-3xl mx-auto mt-12 w-full">
      <div className="glass-panel p-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-main mb-2">AI Processing Pipeline</h2>
          <p className="text-text-muted">Please wait while our AI agents clean and structure your data.</p>
        </div>

        <div className="space-y-8">
          {stages.map((stage) => {
            const status = getStageStatus(stage.id);
            let percentage = 0;
            let statusText = '';

            if (stage.type === 'filter') {
              const f = stage.filtering!;
              percentage = status === 'done' || status === 'active' ? 100 : 0;
              statusText = status === 'done' || (status === 'active' && f.kept > 0)
                ? `${f.kept} kept, ${f.removed} removed`
                : 'Pending';
            } else {
              const p = stage.progress!;
              percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              statusText = `${p.completed} / ${p.total} Batches (${percentage}%)`;
            }

            return (
              <div key={stage.id} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {status === 'done' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                    {status === 'active' && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                    {status === 'pending' && <Circle className="w-6 h-6 text-gray-300" />}
                    {status === 'error' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                    <span className={`font-medium ${status === 'active' ? 'text-primary' : status === 'done' ? 'text-text-main' : 'text-text-muted'}`}>
                      {stage.name}
                    </span>
                    {stage.id === 'FILTERING' && status === 'done' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {state.progress.filtering.removed} invalid removed
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-muted">
                    {statusText}
                  </span>
                </div>
                
                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      status === 'error' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {state.progress.error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Processing Failed</h4>
              <p className="text-sm mt-1">{state.progress.error}</p>
              <button 
                onClick={() => setState(prev => ({ ...prev, step: 'UPLOAD' }))}
                className="mt-3 text-sm font-medium underline hover:text-red-800"
              >
                Return to Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
