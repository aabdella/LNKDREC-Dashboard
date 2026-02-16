
'use client';

import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AddCandidate() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setParsedResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setParsedResult(data.candidate);
      setFile(null); // Clear file after success
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Add Candidate</h1>
      <p className="text-slate-500 mb-8">Upload a CV (PDF) to automatically parse and add to the talent pool.</p>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        
        {/* Upload Area */}
        {!parsedResult && (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition cursor-pointer relative">
                <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <CloudArrowUpIcon className="h-12 w-12 text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-700">
                    {file ? file.name : 'Drag & drop or click to upload PDF'}
                </p>
                <p className="text-sm text-slate-400 mt-2">Maximum file size: 5MB</p>
            </div>
        )}

        {/* Selected File & Actions */}
        {file && !parsedResult && (
            <div className="mt-6 flex justify-end gap-3">
                <button 
                    onClick={() => setFile(null)} 
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
                    disabled={loading}
                >
                    Cancel
                </button>
                <button 
                    onClick={handleUpload} 
                    disabled={loading}
                    className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? 'Processing...' : 'Upload & Parse'}
                </button>
            </div>
        )}

        {/* Error Message */}
        {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-center gap-2">
                <XMarkIcon className="h-5 w-5" />
                {error}
            </div>
        )}

        {/* Success / Result View */}
        {parsedResult && (
            <div className="mt-6 animate-fade-in">
                <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-100 mb-6 flex items-center gap-2">
                    <DocumentIcon className="h-5 w-5" />
                    Candidate successfully added!
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{parsedResult.full_name || 'Parsed Candidate'}</h3>
                    <p className="text-slate-500 text-sm mb-4">{parsedResult.title || 'No Title Extracted'}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-semibold text-slate-700">Email:</span> {parsedResult.email || 'N/A'}
                        </div>
                        <div>
                            <span className="font-semibold text-slate-700">Phone:</span> {parsedResult.phone || 'N/A'}
                        </div>
                        <div className="col-span-full">
                            <span className="font-semibold text-slate-700">Summary:</span>
                            <p className="mt-1 text-slate-600 leading-relaxed bg-white p-3 rounded border border-slate-100">
                                {parsedResult.match_reason || 'No summary generated.'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <button 
                            onClick={() => { setParsedResult(null); setFile(null); }}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition font-medium"
                        >
                            Upload Another
                        </button>
                        <a 
                            href="/" 
                            className="px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 transition font-medium"
                        >
                            Go to Candidates
                        </a>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
