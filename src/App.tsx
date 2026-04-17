/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { UploadScreen } from './components/screens/UploadScreen';
import { ProcessingScreen } from './components/screens/ProcessingScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { ConfigModal } from './components/screens/ConfigModal';
import { ProcessingState } from './types';

export default function App() {
  const [showConfig, setShowConfig] = useState(false);
  const [state, setState] = useState<ProcessingState>({
    step: 'UPLOAD',
    progress: {
      standardization: { completed: 0, total: 0 },
      extraction: { completed: 0, total: 0 },
      duplicates: { completed: 0, total: 0 },
      currentStage: 'STANDARDIZATION',
    },
    data: {
      original: [],
      standardized: [],
      extracted: [],
      duplicates: [],
    },
  });

  return (
    <div className="min-h-screen font-sans flex flex-col">
      <header className="glass-panel h-[70px] flex items-center justify-between px-6 mx-4 mt-4 mb-2 shrink-0 z-10">
        <div className="flex items-center gap-2.5 font-extrabold text-[20px] tracking-tight text-primary">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl leading-none">Q</span>
          </div>
          <span className="text-primary">Quantum<span className="text-text-main">Clean</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-text-muted font-medium">
            Master Data Cleansing
          </div>
          <button onClick={() => setShowConfig(true)} className="p-2 hover:bg-black/5 rounded-lg transition-colors" title="Configuration">
            <Settings className="w-5 h-5 text-text-muted" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col">
        {state.step === 'UPLOAD' && (
          <UploadScreen state={state} setState={setState} />
        )}
        {state.step === 'PROCESSING' && (
          <ProcessingScreen state={state} setState={setState} />
        )}
        {state.step === 'RESULTS' && (
          <ResultsScreen state={state} setState={setState} />
        )}
      </main>

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
}

