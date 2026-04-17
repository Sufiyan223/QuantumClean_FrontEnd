import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { getConfig, saveConfig, Config } from '../../lib/config';

interface Props {
  onClose: () => void;
}

export function ConfigModal({ onClose }: Props) {
  const [config, setConfig] = useState<Config>(getConfig());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl bg-white/80 p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-main">API Configuration</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-text-main border-b border-glass-border pb-2">Mistral API Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">API Endpoint</label>
              <input 
                type="text" 
                value={config.ENDPOINT}
                onChange={e => setConfig({...config, ENDPOINT: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-glass-border bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">API Key</label>
              <input 
                type="password" 
                value={config.API_KEY}
                onChange={e => setConfig({...config, API_KEY: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-glass-border bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Model</label>
              <input 
                type="text" 
                value={config.MODEL}
                onChange={e => setConfig({...config, MODEL: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-glass-border bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-text-muted mt-1">e.g., mistral-large-latest, mistral-medium-latest, mistral-small-latest</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-glass-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-text-muted hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
