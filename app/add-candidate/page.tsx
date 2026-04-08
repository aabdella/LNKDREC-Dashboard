'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  CheckIcon,
  UserPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface PendingForm {
  id: string;
  file: File | null;
  formData: any;
  unvettedId: string | null;
  saving: boolean;
  savingError: string;
  uploadError: string;
  expanded: boolean;
  uploadProgress: 'idle' | 'loading' | 'done' | 'error';
}

let formCounter = 0;
const newFormId = () => `form-${++formCounter}-${Date.now()}`;

const EMPTY_FORM = () => ({
  full_name: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  years_experience_total: 0,
  linkedin_url: '',
  portfolio_url: '',
  match_reason: '',
  source: 'PDF Upload',
  status: 'New',
  match_score: 10,
  technologies: [],
  tools: [],
  work_history: [],
  resume_url: '',
  resume_text: '',
  lnkd_notes: '',
});

export default function AddCandidate() {
  const router = useRouter();
  const [pendingForms, setPendingForms] = useState<PendingForm[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Upload ────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    addNewForms(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addNewForms = (files: File[]) => {
    const newForms: PendingForm[] = files.map((file) => ({
      id: newFormId(),
      file,
      formData: EMPTY_FORM(),
      unvettedId: null,
      saving: false,
      savingError: '',
      uploadError: '',
      expanded: true,
      uploadProgress: 'idle',
    }));
    setPendingForms((prev) => [...prev, ...newForms]);
    newForms.forEach((form) => uploadFile(form.id, form.file!));
  };

  const uploadFile = async (formId: string, file: File) => {
    setPendingForms((prev) =>
      prev.map((f) =>
        f.id === formId ? { ...f, uploadProgress: 'loading' as const, uploadError: '' } : f
      )
    );

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      const response = await fetch('/api/upload-cv', { method: 'POST', body: uploadData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      const { candidate, table } = await response.json();

      setPendingForms((prev) =>
        prev.map((f) =>
          f.id === formId
            ? {
                ...f,
                formData: {
                  full_name: candidate.full_name || '',
                  title: candidate.title || '',
                  email: candidate.email || '',
                  phone: candidate.phone || '',
                  location: candidate.location || '',
                  years_experience_total: candidate.years_experience_total || 0,
                  linkedin_url: candidate.linkedin_url || '',
                  portfolio_url: candidate.portfolio_url || '',
                  match_reason: candidate.match_reason || '',
                  source: 'PDF Upload',
                  status: 'New',
                  match_score: candidate.match_score || 10,
                  resume_url: candidate.resume_url || '',
                  resume_text: candidate.resume_text || '',
                  lnkd_notes: candidate.lnkd_notes || '',
                  technologies: [],
                  tools: [],
                  work_history: [],
                },
                unvettedId: table === 'unvetted' ? candidate.id : null,
                uploadProgress: 'done' as const,
              }
            : f
        )
      );
    } catch (err: any) {
      setPendingForms((prev) =>
        prev.map((f) =>
          f.id === formId
            ? { ...f, uploadProgress: 'error' as const, uploadError: err.message || 'Upload failed' }
            : f
        )
      );
    }
  };

  const retryUpload = (formId: string) => {
    const form = pendingForms.find((f) => f.id === formId);
    if (form?.file) uploadFile(formId, form.file);
  };

  // ─── Per-form actions ────────────────────────────────────────

  const handleInputChange = (formId: string, field: string, value: any) => {
    setPendingForms((prev) =>
      prev.map((f) =>
        f.id === formId ? { ...f, formData: { ...f.formData, [field]: value } } : f
      )
    );
  };

  const toggleExpand = (formId: string) => {
    setPendingForms((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, expanded: !f.expanded } : f))
    );
  };

  const removeForm = (formId: string) => {
    setPendingForms((prev) => prev.filter((f) => f.id !== formId));
  };

  const handleManualEntry = () => {
    const form: PendingForm = {
      id: newFormId(),
      file: null,
      formData: { ...EMPTY_FORM(), source: 'Manual Entry' },
      unvettedId: null,
      saving: false,
      savingError: '',
      uploadError: '',
      expanded: true,
      uploadProgress: 'done',
    };
    setPendingForms((prev) => [...prev, form]);
  };

  const saveForm = async (formId: string) => {
    const form = pendingForms.find((f) => f.id === formId);
    if (!form) return;
    setPendingForms((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, saving: true, savingError: '' } : f))
    );
    try {
      const { data: insertedCandidate, error: insertError } = await supabase
        .from('candidates').insert(form.formData).select().single();
      if (insertError) throw insertError;
      if (insertedCandidate.resume_text) {
        fetch('/api/enrich-candidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_id: insertedCandidate.id, resume_text: insertedCandidate.resume_text }),
        }).catch((err) => console.error('Background enrichment failed:', err));
      }
      if (form.unvettedId) {
        await supabase.from('unvetted').delete().eq('id', form.unvettedId);
      }
      // Remove from stack (Option A)
      setPendingForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err: any) {
      setPendingForms((prev) =>
        prev.map((f) =>
          f.id === formId ? { ...f, saving: false, savingError: err.message || 'Save failed' } : f
        )
      );
    }
  };

  // ─── Batch actions ──────────────────────────────────────────

  const saveAll = async () => {
    const toSave = pendingForms.filter((f) => f.uploadProgress === 'done');
    await Promise.all(toSave.map((f) => saveForm(f.id)));
  };

  const discardAll = () => setPendingForms([]);

  // ─── Helpers ────────────────────────────────────────────────

  const completedCount = pendingForms.filter((f) => f.uploadProgress === 'done').length;
  const loadingCount = pendingForms.filter((f) => f.uploadProgress === 'loading').length;
  const errorCount = pendingForms.filter((f) => f.uploadProgress === 'error').length;
  const canSaveAll = completedCount > 0 && loadingCount === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Candidates</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingForms.length === 0
              ? 'Upload CVs or add candidates manually'
              : `${completedCount} ready · ${loadingCount} uploading · ${errorCount} failed`}
          </p>
        </div>
        {pendingForms.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={discardAll}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Discard All
            </button>
            <button
              onClick={saveAll}
              disabled={!canSaveAll}
              className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg hover:bg-zinc-800 transition disabled:opacity-40 flex items-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Save All ({completedCount})
            </button>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div
          className="border-2 border-dashed border-slate-300 rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileChange} className="hidden" />
          <CloudArrowUpIcon className="h-10 w-10 text-slate-400 mb-3" />
          <p className="text-base font-medium text-slate-700">Drop PDFs here or click to upload — multiple files supported</p>
          <p className="text-sm text-slate-400 mt-2">Maximum file size: 5MB per file</p>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-grow h-px bg-slate-100" />
          <span className="text-slate-400 text-sm font-medium">OR</span>
          <div className="flex-grow h-px bg-slate-100" />
        </div>
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleManualEntry}
            className="flex items-center gap-2 px-6 py-3 border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition shadow-sm"
          >
            <UserPlusIcon className="h-5 w-5" />
            Add Candidate Manually
          </button>
        </div>
      </div>

      {/* Pending Forms */}
      {pendingForms.length > 0 && (
        <div className="space-y-4">
          {pendingForms.map((form, idx) => (
            <FormCard
              key={form.id}
              form={form}
              index={idx + 1}
              onInputChange={handleInputChange}
              onToggleExpand={toggleExpand}
              onRemove={removeForm}
              onSave={saveForm}
              onRetry={retryUpload}
            />
          ))}
        </div>
      )}

      {pendingForms.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <DocumentIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No candidates pending — upload a CV to get started</p>
        </div>
      )}
    </div>
  );
}

// ─── Form Card ────────────────────────────────────────────────────────────────

interface FormCardProps {
  form: PendingForm;
  index: number;
  onInputChange: (formId: string, field: string, value: any) => void;
  onToggleExpand: (formId: string) => void;
  onRemove: (formId: string) => void;
  onSave: (formId: string) => void;
  onRetry: (formId: string) => void;
}

function FormCard({ form, index, onInputChange, onToggleExpand, onRemove, onSave, onRetry }: FormCardProps) {
  const { formData, saving, savingError, uploadError, expanded, uploadProgress } = form;
  const isLoading = uploadProgress === 'loading';
  const isError = uploadProgress === 'error';
  const isDone = uploadProgress === 'done';

  const field = (label: string, fieldKey: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-black outline-none"
        value={formData[fieldKey] ?? ''}
        onChange={(e) => onInputChange(form.id, fieldKey, e.target.value)}
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-slate-50 transition"
        onClick={() => onToggleExpand(form.id)}
      >
        <span className="text-xs font-bold text-slate-400 w-5 text-right">{index}</span>

        {isLoading && <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />}
        {isError && <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0"><XMarkIcon className="h-3 w-3 text-white" /></div>}
        {isDone && <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><CheckIcon className="h-3 w-3 text-white" /></div>}

        <div className="flex-grow min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {form.file?.name || formData.full_name || 'New Candidate'}
          </p>
          <p className="text-xs text-slate-400">
            {isLoading && 'Uploading & parsing...'}
            {isError && (uploadError || 'Upload failed')}
            {isDone && (formData.full_name || 'Ready to review')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isLoading && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(form.id); }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
              title="Remove"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          {isError && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(form.id); }}
              className="px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-md transition"
            >
              Retry
            </button>
          )}
          <button className="p-1 text-slate-400">
            {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Form */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {savingError && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <XMarkIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {savingError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div className="col-span-full">{field('Full Name *', 'full_name')}</div>
            <div className="col-span-full">{field('Job Title', 'title')}</div>
            {field('Email', 'email', 'email')}
            {field('Phone', 'phone')}
            {field('Location', 'location')}
            {field('Years of Experience', 'years_experience_total', 'number')}
            {field('LinkedIn URL', 'linkedin_url', 'url', 'https://linkedin.com/in/...')}
            {field('Portfolio URL', 'portfolio_url', 'url', 'https://...')}

            <div className="col-span-full">
              <label className="block text-xs font-medium text-slate-700 mb-1">Summary / Notes</label>
              <textarea
                className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-black outline-none min-h-[80px]"
                value={formData.match_reason}
                onChange={(e) => onInputChange(form.id, 'match_reason', e.target.value)}
                placeholder="Candidate summary or notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => onRemove(form.id)}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            >
              Remove
            </button>
            <button
              onClick={() => onSave(form.id)}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg hover:bg-zinc-800 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}