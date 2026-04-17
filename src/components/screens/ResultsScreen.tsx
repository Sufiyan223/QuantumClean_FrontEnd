import React, { useState, useMemo } from 'react';
import { ProcessingState, DuplicateGroup } from '../../types';
import { Download, LayoutGrid, ListFilter, Copy, Star, ArrowRight, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  state: ProcessingState;
  setState: React.Dispatch<React.SetStateAction<ProcessingState>>;
}

type TabKey = 'STANDARDIZATION' | 'EXTRACTION' | 'DUPLICATES';

export function ResultsScreen({ state, setState }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('STANDARDIZATION');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // ─── Export ───
  const exportData = (data: any[], filename: string) => {
    const flat = data.map(row => {
      const out: any = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === 'object' ? JSON.stringify(v) : v;
      }
      return out;
    });
    const worksheet = XLSX.utils.json_to_sheet(flat);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportGoldenRecords = () => {
    const goldens = state.data.duplicateGroups.map(g => g.golden_record);
    exportData(goldens, 'QuantumClean_golden_records');
  };

  // ─── Stats ───
  const stats = useMemo(() => ({
    original: state.data.original.length,
    standardized: state.data.standardized.length,
    filtered: state.progress.filtering.removed,
    cleaned: state.data.cleaned.length,
    extracted: state.data.extracted.length,
    groups: state.data.duplicateGroups.length,
    goldenRecords: state.data.duplicateGroups.length,
  }), [state]);

  // ─── Standardization Tab: side-by-side comparison ───
  const renderStandardizationTab = () => {
    const original = state.data.original;
    const standardized = state.data.standardized;

    const descField = findDescriptionField(original[0]);

    if (!standardized.length) {
      return <div className="p-8 text-center text-gray-500">No standardized data available</div>;
    }

    return (
      <div className="space-y-0">
        {/* Stats bar */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 flex items-center gap-6 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm text-text-muted">Original: <strong className="text-text-main">{stats.original}</strong></span>
          </div>
          <ArrowRight className="w-4 h-4 text-text-muted" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-sm text-text-muted">Standardized: <strong className="text-text-main">{stats.standardized}</strong></span>
          </div>
          {stats.filtered > 0 && (
            <>
              <ArrowRight className="w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm text-amber-700 font-medium">{stats.filtered} invalid removed</span>
              </div>
            </>
          )}
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 border-b border-glass-border text-text-muted font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3 bg-red-50/50">Original Description</th>
                <th className="px-4 py-3 bg-green-50/50">Standardized Description</th>
                <th className="px-4 py-3">UoM</th>
                <th className="px-4 py-3">Material Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {standardized.map((row, i) => {
                const origRow = original[i] || {};
                const origDesc = origRow[descField] || '';
                const stdDesc = row[descField] || row['Material description'] || '';
                const changed = origDesc !== stdDesc;

                return (
                  <tr key={i} className="hover:bg-white/30 transition-colors">
                    <td className="px-4 py-3 text-text-muted text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row['Material'] || row['material'] || ''}</td>
                    <td className={`px-4 py-3 ${changed ? 'bg-red-50/30' : ''}`}>
                      <span className={changed ? 'text-red-600 line-through' : 'text-text-main'}>
                        {origDesc}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${changed ? 'bg-green-50/30' : ''}`}>
                      <span className={changed ? 'text-green-700 font-medium' : 'text-text-main'}>
                        {stdDesc}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row['Base Unit of Measure'] || row['base_unit_of_measure'] || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row['Material Type description'] || row['material_type_description'] || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Extraction Tab: dynamic attribute columns ───
  const renderExtractionTab = () => {
    const data = state.data.extracted;
    if (!data.length) return <div className="p-8 text-center text-gray-500">No extracted data available</div>;

    // Separate original fields from extracted fields
    const allKeys = new Set<string>();
    data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
    
    const extractedKeys = Array.from(allKeys).filter(k => k.startsWith('extracted_'));
    const coreKeys = ['Material', 'Material description', 'Material Type description', 'Material Group description'];
    const displayCoreKeys = coreKeys.filter(k => allKeys.has(k));

    return (
      <div className="space-y-0">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 flex items-center gap-6 border-b border-glass-border">
          <span className="text-sm text-text-muted">
            Records processed: <strong className="text-text-main">{data.length}</strong>
          </span>
          <span className="text-sm text-text-muted">
            Attributes extracted: <strong className="text-purple-600">{extractedKeys.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/40 border-b border-glass-border text-text-muted font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                {displayCoreKeys.map(key => (
                  <th key={key} className="px-4 py-3 whitespace-nowrap">{key}</th>
                ))}
                {extractedKeys.map(key => (
                  <th key={key} className="px-4 py-3 whitespace-nowrap bg-purple-50/50">
                    <span className="text-purple-600">
                      {key.replace('extracted_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-white/30 transition-colors">
                  <td className="px-4 py-3 text-text-muted text-xs">{i + 1}</td>
                  {displayCoreKeys.map(key => (
                    <td key={key} className="px-4 py-3 whitespace-nowrap text-text-main">
                      {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '—')}
                    </td>
                  ))}
                  {extractedKeys.map(key => (
                    <td key={key} className="px-4 py-3 whitespace-nowrap bg-purple-50/20">
                      {row[key] ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-xs font-medium">
                          {String(row[key])}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Duplicates Tab: Groups + Golden Record ───
  const renderDuplicatesTab = () => {
    const groups = state.data.duplicateGroups;
    const allDupData = state.data.duplicates;
    
    if (groups.length === 0 && allDupData.length === 0) {
      return <div className="p-8 text-center text-gray-500">No duplicate data available</div>;
    }

    // If we have groups, show the rich view
    if (groups.length > 0) {
      return (
        <div className="space-y-0">
          {/* Summary bar */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 flex items-center gap-6 border-b border-glass-border">
            <span className="text-sm text-text-muted">
              Duplicate Groups: <strong className="text-amber-700">{groups.length}</strong>
            </span>
            <span className="text-sm text-text-muted">
              Golden Records: <strong className="text-green-600">{groups.length}</strong>
            </span>
            <div className="ml-auto">
              <button
                onClick={exportGoldenRecords}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Star className="w-3.5 h-3.5" />
                Export Golden Records
              </button>
            </div>
          </div>

          {/* Groups */}
          <div className="divide-y divide-glass-border">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.group_id;
              const descField = findDescriptionField(group.golden_record);

              return (
                <div key={group.group_id} className="bg-white/20">
                  {/* Group header */}
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.group_id)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-white/30 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-bold text-sm shrink-0">
                      {group.group_id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-main">
                        {group.records.length} records in group
                      </div>
                      <div className="text-sm text-text-muted truncate">
                        Golden: {group.golden_record[descField] || group.golden_record['Material description'] || 'N/A'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <Star className="w-3 h-3" /> Golden Record
                      </span>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
                    </div>
                  </button>

                  {/* Expanded: Comparison + Golden */}
                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-4">
                      {/* Golden Record highlight */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-green-700 text-sm">Golden Record (Best Merge)</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Object.entries(group.golden_record).map(([key, val]) => {
                            if (val === null || val === undefined || val === '') return null;
                            return (
                              <div key={key} className="text-xs">
                                <span className="text-green-600 font-medium">{key}:</span>{' '}
                                <span className="text-text-main">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Comparison table */}
                      <div className="overflow-x-auto rounded-xl border border-glass-border">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-white/60 border-b border-glass-border text-text-muted font-semibold">
                            <tr>
                              <th className="px-3 py-2">Record</th>
                              {Object.keys(group.records[0] || {}).slice(0, 8).map(key => (
                                <th key={key} className="px-3 py-2 whitespace-nowrap">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100/50">
                            {group.records.map((rec, ri) => (
                              <tr key={ri} className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-3 py-2 text-text-muted font-mono">#{ri + 1}</td>
                                {Object.keys(group.records[0] || {}).slice(0, 8).map(key => (
                                  <td key={key} className="px-3 py-2 whitespace-nowrap text-text-main">
                                    {typeof rec[key] === 'object' ? JSON.stringify(rec[key]) : String(rec[key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Fallback: flat table if no groups
    return renderFlatTable(allDupData);
  };

  // ─── Flat table fallback ───
  const renderFlatTable = (data: any[]) => {
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">No data available</div>;
    const headers = Object.keys(data[0] || {});
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/40 border-b border-glass-border text-text-muted font-semibold sticky top-0">
            <tr>
              {headers.map((key) => (
                <th key={key} className="px-4 py-3 whitespace-nowrap">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/30 transition-colors">
                {headers.map((key, j) => {
                  const val = row[key];
                  return (
                    <td key={j} className="px-4 py-3 whitespace-nowrap text-text-main border-b border-black/5">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getExportData = (): any[] => {
    switch (activeTab) {
      case 'STANDARDIZATION': return state.data.standardized;
      case 'EXTRACTION': return state.data.extracted;
      case 'DUPLICATES': return state.data.duplicates;
      default: return [];
    }
  };

  const getRecordCount = (): number => {
    switch (activeTab) {
      case 'STANDARDIZATION': return state.data.standardized.length;
      case 'EXTRACTION': return state.data.extracted.length;
      case 'DUPLICATES': return state.data.duplicates.length;
      default: return 0;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-main">Cleansing Results</h2>
          <p className="text-sm text-text-muted mt-1">
            {stats.original} records processed → {stats.cleaned} valid → {stats.groups} duplicate groups found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setState(prev => ({ ...prev, step: 'UPLOAD' }))}
            className="flex items-center gap-2 bg-white/50 border border-glass-border hover:bg-white/70 text-text-muted px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            New Upload
          </button>
          <button
            onClick={() => exportData(getExportData(), `QuantumClean_${activeTab.toLowerCase()}`)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export {activeTab.toLowerCase().replace('_', ' ')}
          </button>
        </div>
      </div>

      <div className="glass-panel flex flex-col flex-1 overflow-hidden">
        <div className="flex border-b border-glass-border">
          <button
            onClick={() => setActiveTab('STANDARDIZATION')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'STANDARDIZATION' ? 'border-primary text-primary bg-white/40' : 'border-transparent text-text-muted hover:text-text-main hover:bg-white/20'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Standardization
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{stats.standardized}</span>
          </button>
          <button
            onClick={() => setActiveTab('EXTRACTION')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'EXTRACTION' ? 'border-primary text-primary bg-white/40' : 'border-transparent text-text-muted hover:text-text-main hover:bg-white/20'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Attribute Extraction
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{stats.extracted}</span>
          </button>
          <button
            onClick={() => setActiveTab('DUPLICATES')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'DUPLICATES' ? 'border-primary text-primary bg-white/40' : 'border-transparent text-text-muted hover:text-text-main hover:bg-white/20'
            }`}
          >
            <Copy className="w-4 h-4" />
            Duplicates & Golden Record
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{stats.groups} groups</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-transparent">
          {activeTab === 'STANDARDIZATION' && renderStandardizationTab()}
          {activeTab === 'EXTRACTION' && renderExtractionTab()}
          {activeTab === 'DUPLICATES' && renderDuplicatesTab()}
        </div>
        
        <div className="bg-white/20 border-t border-glass-border px-4 py-3 text-sm text-text-muted flex justify-between">
          <span>Showing {getRecordCount()} records</span>
          <span>QuantumClean AI Pipeline</span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function findDescriptionField(record: any): string {
  if (!record) return 'Material description';
  const candidates = [
    'Material description', 'material_description', 'Description',
    'description', 'service_description', 'Material Description',
    'Short Text', 'Name', 'name'
  ];
  for (const field of candidates) {
    if (record[field] !== undefined) return field;
  }
  return 'Material description';
}
