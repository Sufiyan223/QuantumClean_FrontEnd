import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ProcessingState } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  state: ProcessingState;
  setState: React.Dispatch<React.SetStateAction<ProcessingState>>;
}

export function UploadScreen({ state, setState }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      let data: any[] = [];
      if (file.name.endsWith('.csv')) {
        data = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err),
          });
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else {
        throw new Error('Unsupported file format. Please upload CSV or Excel.');
      }

      if (data.length === 0) {
        throw new Error('The file is empty.');
      }

      if (data.length > 10000) {
        throw new Error('File exceeds the maximum limit of 10,000 rows.');
      }

      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setPreviewData([]);
      setFileName(null);
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const startProcessing = () => {
    setState(prev => ({
      ...prev,
      step: 'PROCESSING',
      data: { ...prev.data, original: previewData }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto mt-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-text-main mb-4">
          Upload Master Data
        </h2>
        <p className="text-lg text-text-muted">
          Upload your raw CSV or Excel file to begin the AI-powered cleansing process.
          Supports up to 10,000 rows.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "glass-panel border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
          isDragging ? "border-primary bg-blue-50/50" : "border-glass-border hover:border-gray-400",
          previewData.length > 0 && "border-green-500 bg-green-50/50"
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={onFileChange}
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
          {previewData.length > 0 ? (
            <FileSpreadsheet className="w-16 h-16 text-green-500 mb-4" />
          ) : (
            <UploadCloud className="w-16 h-16 text-gray-400 mb-4" />
          )}
          <span className="text-xl font-medium text-text-main mb-2">
            {fileName ? fileName : "Drag & drop your file here"}
          </span>
          <span className="text-text-muted">
            or click to browse from your computer
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Upload Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-main">
              Data Preview ({previewData.length} rows)
            </h3>
            <button
              onClick={startProcessing}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
            >
              Start AI Processing
            </button>
          </div>
          <div className="glass-panel overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/40 border-b border-glass-border text-text-muted font-semibold">
                  <tr>
                    {Object.keys(previewData[0] || {}).map((key) => (
                      <th key={key} className="px-4 py-3 whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-white/30 transition-colors">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-4 py-3 whitespace-nowrap text-text-main border-b border-black/5">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 5 && (
              <div className="bg-white/20 px-4 py-3 text-center text-sm text-text-muted border-t border-glass-border">
                Showing 5 of {previewData.length} rows
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
