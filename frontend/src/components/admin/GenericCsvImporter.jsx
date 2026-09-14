import React, { useState, useEffect, useId } from 'react';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  HelpCircle, 
  ShieldCheck 
} from 'lucide-react';
import { parseCsvText, generateCsvTemplate } from '../../utils/csvParser';
import { CSV_ENTITY_SCHEMAS } from '../../config/csvEntitySchemas';

/**
 * Generic CSV Importer Component
 * Reusable across Museums, Galleries, Collections, Exhibitions, Objects, Learning, Stories.
 * 
 * GUARDRAIL ENFORCED: Location & Coordinate fields are 100% excluded.
 */
const GenericCsvImporter = ({
  isOpen,
  onClose,
  entityType,
  existingItems = [],
  createItem,
  updateItem,
  onSuccess,
  defaultContext = {}
}) => {
  const fileInputId = useId();
  const schema = CSV_ENTITY_SCHEMAS[entityType];

  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Preview & Conflicts, 4: Importing & Summary
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  
  // Mapping state: { [csvHeader]: targetFieldKey | '' }
  const [columnMapping, setColumnMapping] = useState({});

  // Processed preview rows: Array<{ id, raw, mappedData, status: 'NEW' | 'DUPLICATE' | 'INVALID', duplicateMatch, action: 'CREATE' | 'UPDATE' | 'SKIP', errors: string[] }>
  const [previewRows, setPreviewRows] = useState([]);

  // Import execution state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);

  // Reset state on open or entity change
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFileName('');
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMapping({});
      setPreviewRows([]);
      setIsImporting(false);
      setImportProgress(0);
      setImportResults(null);
    }
  }, [isOpen, entityType]);

  if (!isOpen || !schema) return null;

  // Handle File Select / Drag-Drop
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const { headers, dataRows } = parseCsvText(text);
      setCsvHeaders(headers);
      setCsvRows(dataRows);

      // Auto-match headers to schema fields
      const autoMapping = {};
      headers.forEach(h => {
        const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedField = schema.fields.find(f => {
          const keyClean = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const labelClean = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
          return hClean === keyClean || hClean === labelClean || hClean.includes(keyClean);
        });
        if (matchedField) {
          autoMapping[h] = matchedField.key;
        } else {
          autoMapping[h] = '';
        }
      });

      setColumnMapping(autoMapping);
      setStep(2);
    };
    reader.readAsText(file);
  };

  // Check required field coverage in mapping
  const mappedFieldKeys = Object.values(columnMapping).filter(Boolean);
  const unmappedRequiredFields = schema.fields
    .filter(f => f.required && !defaultContext[f.key])
    .filter(f => !mappedFieldKeys.includes(f.key));

  // Proceed from Column Mapping to Preview Step
  const generatePreview = () => {
    const processed = csvRows.map((rowCells, rowIndex) => {
      const mappedData = { ...defaultContext };
      const errors = [];

      // Apply mappings
      csvHeaders.forEach((header, colIdx) => {
        const targetKey = columnMapping[header];
        if (targetKey && rowCells[colIdx] !== undefined) {
          let val = rowCells[colIdx];
          const fieldConfig = schema.fields.find(f => f.key === targetKey);
          if (fieldConfig && fieldConfig.type === 'number' && val !== '') {
            val = Number(val);
          }
          mappedData[targetKey] = val;
        }
      });

      // Validate required fields
      schema.fields.forEach(f => {
        if (f.required && (mappedData[f.key] === undefined || mappedData[f.key] === '' || mappedData[f.key] === null)) {
          errors.push(`Missing required field: ${f.label}`);
        }
      });

      // Check for duplicates in existing items
      const primaryVal = mappedData[schema.primaryKeyField];
      let duplicateMatch = null;

      if (primaryVal) {
        const primaryValStr = String(primaryVal).trim().toLowerCase();
        duplicateMatch = existingItems.find(item => {
          const itemVal = item[schema.primaryKeyField] || item.name || item.title;
          if (itemVal && String(itemVal).trim().toLowerCase() === primaryValStr) {
            // Check scope if present (e.g. same museum_id)
            if (schema.scopeField && mappedData[schema.scopeField]) {
              return String(item[schema.scopeField]) === String(mappedData[schema.scopeField]);
            }
            return true;
          }
          if (mappedData.object_code && item.object_code) {
            return String(item.object_code).trim().toLowerCase() === String(mappedData.object_code).trim().toLowerCase();
          }
          return false;
        });
      }

      let status = 'NEW';
      let action = 'CREATE';

      if (errors.length > 0) {
        status = 'INVALID';
        action = 'SKIP';
      } else if (duplicateMatch) {
        status = 'DUPLICATE';
        action = 'SKIP'; // Default duplicate strategy: skip unless chosen
      }

      return {
        rowIndex: rowIndex + 1,
        mappedData,
        status,
        duplicateMatch,
        action,
        errors
      };
    });

    setPreviewRows(processed);
    setStep(3);
  };

  // Global Bulk Duplicate Action Resolver
  const setAllDuplicateActions = (newAction) => {
    setPreviewRows(prev => prev.map(r => {
      if (r.status === 'DUPLICATE') {
        return { ...r, action: newAction };
      }
      return r;
    }));
  };

  // Per-row Action Toggle
  const updateRowAction = (index, newAction) => {
    setPreviewRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], action: newAction };
      return next;
    });
  };

  // Execute Commit
  const handleExecuteImport = async () => {
    setStep(4);
    setIsImporting(true);
    setImportProgress(0);

    const validRows = previewRows.filter(r => r.action !== 'SKIP');
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = previewRows.length - validRows.length;
    let failedCount = 0;
    const logDetails = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        if (row.action === 'CREATE') {
          await createItem(row.mappedData);
          createdCount++;
          logDetails.push({ row: row.rowIndex, status: 'CREATED', name: row.mappedData[schema.primaryKeyField] });
        } else if (row.action === 'UPDATE' && row.duplicateMatch) {
          await updateItem(row.duplicateMatch.id, row.mappedData);
          updatedCount++;
          logDetails.push({ row: row.rowIndex, status: 'UPDATED', name: row.mappedData[schema.primaryKeyField] });
        }
      } catch (err) {
        failedCount++;
        logDetails.push({ row: row.rowIndex, status: 'FAILED', name: row.mappedData[schema.primaryKeyField], error: err.message || 'API Error' });
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setIsImporting(false);
    setImportResults({
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      failed: failedCount,
      logs: logDetails
    });

    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-neutral-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-neutral-900 text-white">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold">Bulk Import {schema.label}</h2>
              <p className="text-xs text-neutral-400">Step {step} of 4 — Content & Metadata Import Only</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-xs font-semibold text-neutral-600">
          <div className={`flex items-center space-x-1.5 ${step === 1 ? 'text-indigo-600 font-bold' : step > 1 ? 'text-emerald-600' : ''}`}>
            <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">1</span>
            <span>Upload CSV</span>
          </div>
          <ArrowRight className="w-4 h-4 mx-3 text-neutral-300" />
          <div className={`flex items-center space-x-1.5 ${step === 2 ? 'text-indigo-600 font-bold' : step > 2 ? 'text-emerald-600' : ''}`}>
            <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">2</span>
            <span>Map Columns</span>
          </div>
          <ArrowRight className="w-4 h-4 mx-3 text-neutral-300" />
          <div className={`flex items-center space-x-1.5 ${step === 3 ? 'text-indigo-600 font-bold' : step > 3 ? 'text-emerald-600' : ''}`}>
            <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">3</span>
            <span>Preview & Conflicts</span>
          </div>
          <ArrowRight className="w-4 h-4 mx-3 text-neutral-300" />
          <div className={`flex items-center space-x-1.5 ${step === 4 ? 'text-indigo-600 font-bold' : ''}`}>
            <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-[10px]">4</span>
            <span>Commit Batch</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* INFO BANNER — Shown on every step */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Flexible Coordinate Import Supported:</strong> Latitude and Longitude columns are optional. If included in your CSV file, coordinates will be populated automatically and validated against museum bounds. If left empty, items land in the manual pin placement queue for map positioning.
            </div>
          </div>

          {/* STEP 1: UPLOAD FILE & TEMPLATE DOWNLOAD */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-neutral-300 hover:border-neutral-400 rounded-2xl p-8 text-center bg-neutral-50 hover:bg-neutral-100/50 transition cursor-pointer relative">
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-neutral-800">Select or Drag CSV File Here</h3>
                <p className="text-xs text-neutral-500 mt-1">Supports standard CSV files (.csv) formatted in UTF-8.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Download className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Need a starting format?</h4>
                    <p className="text-xs text-blue-700">Download a sample CSV template with pre-filled headers for {schema.label}.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => generateCsvTemplate(schema.fields, schema.label)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Download Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING STEP */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Match CSV Columns to {schema.label} Fields</h3>
                  <p className="text-xs text-neutral-500">File: <span className="font-mono text-neutral-700">{fileName}</span> ({csvRows.length} data rows detected)</p>
                </div>
                {unmappedRequiredFields.length > 0 ? (
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                    ⚠️ {unmappedRequiredFields.length} Required field(s) unmapped
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> All Required Fields Mapped
                  </span>
                )}
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-200">
                <div className="bg-neutral-100 px-4 py-2.5 grid grid-cols-2 text-xs font-bold text-neutral-600">
                  <span>CSV Header Column</span>
                  <span>Target {schema.label} Field</span>
                </div>

                {csvHeaders.map((header, idx) => {
                  const currentMappedKey = columnMapping[header] || '';
                  const targetField = schema.fields.find(f => f.key === currentMappedKey);

                  return (
                    <div key={idx} className="px-4 py-3 grid grid-cols-2 items-center gap-4 hover:bg-neutral-50">
                      <div>
                        <div className="font-mono text-xs font-bold text-neutral-900">{header}</div>
                        <div className="text-[11px] text-neutral-400 italic truncate max-w-xs">
                          Sample value: "{csvRows[0]?.[idx] || '—'}"
                        </div>
                      </div>

                      <select
                        value={currentMappedKey}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                        className="w-full text-xs border border-neutral-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Ignore Column --</option>
                        {schema.fields.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.required ? '*' : ''} ({f.key})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {unmappedRequiredFields.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Unmapped required fields: <strong>{unmappedRequiredFields.map(f => f.label).join(', ')}</strong>. Rows missing these will be flagged as invalid.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PREVIEW, VALIDATION & DUPLICATE RESOLUTION */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Preview & Conflict Resolution</h3>
                  <p className="text-xs text-neutral-500">
                    Total: {previewRows.length} | Valid New: {previewRows.filter(r => r.status === 'NEW').length} | Duplicates: {previewRows.filter(r => r.status === 'DUPLICATE').length} | Invalid: {previewRows.filter(r => r.status === 'INVALID').length}
                  </p>
                </div>

                {/* Bulk Duplicate Action Selector */}
                {previewRows.some(r => r.status === 'DUPLICATE') && (
                  <div className="flex items-center space-x-2 bg-neutral-100 p-1.5 rounded-xl border border-neutral-200 text-xs">
                    <span className="font-bold text-neutral-600 px-2">Set Duplicates:</span>
                    <button
                      type="button"
                      onClick={() => setAllDuplicateActions('SKIP')}
                      className="px-2.5 py-1 bg-white shadow-xs rounded-lg text-neutral-700 font-bold hover:bg-neutral-200"
                    >
                      Skip All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllDuplicateActions('UPDATE')}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                    >
                      Update Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllDuplicateActions('CREATE')}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
                    >
                      Create Duplicate
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-100 sticky top-0 text-neutral-600 font-bold border-b border-neutral-200">
                    <tr>
                      <th className="p-3 w-12 text-center">Row</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">{schema.fields.find(f => f.key === schema.primaryKeyField)?.label || 'Title'}</th>
                      <th className="p-3">Mapped Details</th>
                      <th className="p-3 text-right">Action Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className={row.status === 'INVALID' ? 'bg-red-50/50' : row.status === 'DUPLICATE' ? 'bg-amber-50/30' : ''}>
                        <td className="p-3 text-center font-mono text-neutral-400">{row.rowIndex}</td>
                        <td className="p-3 whitespace-nowrap">
                          {row.status === 'NEW' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Valid New
                            </span>
                          )}
                          {row.status === 'DUPLICATE' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              ⚠️ Duplicate Found (ID: {row.duplicateMatch?.id})
                            </span>
                          )}
                          {row.status === 'INVALID' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              ✕ Invalid Row
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-neutral-900">
                          {row.mappedData[schema.primaryKeyField] || '—'}
                        </td>
                        <td className="p-3 text-neutral-600 max-w-xs truncate">
                          {Object.entries(row.mappedData)
                            .filter(([k]) => k !== schema.primaryKeyField)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ') || 'No extra fields'}
                          {row.errors.length > 0 && (
                            <div className="text-red-600 text-[11px] mt-0.5 font-bold">{row.errors.join(', ')}</div>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {row.status === 'INVALID' ? (
                            <span className="text-neutral-400 italic">Skipped</span>
                          ) : (
                            <select
                              value={row.action}
                              onChange={(e) => updateRowAction(idx, e.target.value)}
                              className="text-xs border border-neutral-300 rounded-lg p-1 bg-white font-semibold"
                            >
                              <option value="CREATE">Create New Item</option>
                              {row.duplicateMatch && <option value="UPDATE">Update Existing (ID {row.duplicateMatch.id})</option>}
                              <option value="SKIP">Skip Row</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING & SUMMARY */}
          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              {isImporting ? (
                <div className="space-y-4 max-w-md mx-auto py-8">
                  <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                  <h3 className="text-lg font-bold text-neutral-900">Importing {schema.label}...</h3>
                  <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 font-mono">{importProgress}% Completed</p>
                </div>
              ) : importResults ? (
                <div className="space-y-6 max-w-2xl mx-auto text-left">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h3 className="text-xl font-bold text-emerald-900">Bulk Import Finished!</h3>
                    <p className="text-xs text-emerald-700">Records processed into the {schema.label} database.</p>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-xl font-bold text-emerald-700">{importResults.created}</div>
                      <div className="text-[11px] font-bold text-emerald-800">Created</div>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="text-xl font-bold text-indigo-700">{importResults.updated}</div>
                      <div className="text-[11px] font-bold text-indigo-800">Updated</div>
                    </div>
                    <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl">
                      <div className="text-xl font-bold text-neutral-600">{importResults.skipped}</div>
                      <div className="text-[11px] font-bold text-neutral-700">Skipped</div>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <div className="text-xl font-bold text-red-600">{importResults.failed}</div>
                      <div className="text-[11px] font-bold text-red-800">Errors</div>
                    </div>
                  </div>

                  {importResults.logs.length > 0 && (
                    <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-neutral-50 p-3 font-mono text-xs space-y-1">
                      {importResults.logs.map((log, i) => (
                        <div key={i} className={log.status === 'FAILED' ? 'text-red-600' : log.status === 'UPDATED' ? 'text-indigo-600' : 'text-emerald-700'}>
                          Row {log.row}: [{log.status}] {log.name} {log.error ? `— Error: ${log.error}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-4 bg-neutral-100 border-t border-neutral-200 flex justify-between items-center">
          {step > 1 && step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-200 transition"
            >
              Back
            </button>
          ) : <div />}

          {step === 2 && (
            <button
              type="button"
              onClick={generatePreview}
              disabled={unmappedRequiredFields.length > 0}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-2"
            >
              <span>Preview & Validate</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={previewRows.filter(r => r.action !== 'SKIP').length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-2"
            >
              <span>Import {previewRows.filter(r => r.action !== 'SKIP').length} Record(s)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 4 && !isImporting && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              Done & Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default GenericCsvImporter;
