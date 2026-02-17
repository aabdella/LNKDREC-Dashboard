'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function AddCandidate() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [unvettedId, setUnvettedId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: uploadData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { candidate, table } = await response.json();
      
      // Populate form with extracted data
      setFormData({
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
        resume_url: candidate.resume_url,
        resume_text: candidate.resume_text,
        lnkd_notes: candidate.lnkd_notes || '',
        technologies: [], // Default empty arrays for complex fields
        tools: [],
        work_history: []
      });
      
      if (table === 'unvetted') {
          setUnvettedId(candidate.id);
      }
      
      setShowForm(true);
      setFile(null); // Clear file input
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
        // 1. Insert into main candidates table
        const { error: insertError } = await supabase
            .from('candidates')
            .insert(formData);

        if (insertError) throw insertError;

        // 2. Delete from unvetted if it exists there
        if (unvettedId) {
            await supabase.from('unvetted').delete().eq('id', unvettedId);
        }

        // 3. Success & Redirect
        alert('Candidate saved successfully!');
        router.push('/'); // Redirect to main list
        
    } catch (err: any) {
        console.error('Save error:', err);
        setError('Failed to save candidate: ' + err.message);
        setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
      setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Add Candidate</h1>
      
      {!showForm ? (
          <>
            <p className="text-slate-500 mb-8">Upload a CV (PDF) to automatically parse and review before adding to the talent pool.</p>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                {/* Upload Area */}
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

                {/* Selected File & Actions */}
                {file && (
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
            </div>
          </>
      ) : (
          <form onSubmit={handleSave} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="bg-green-100 p-2 rounded-full text-green-600">
                      <CheckCircleIcon className="h-6 w-6" />
                  </div>
                  <div>
                      <h2 className="text-lg font-bold text-slate-900">Review & Save Candidate</h2>
                      <p className="text-sm text-slate-500">Extracted from PDF. Please verify details.</p>
                  </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-center gap-2">
                    <XMarkIcon className="h-5 w-5" />
                    {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Full Name */}
                  <div className="col-span-full md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input 
                          type="text" 
                          required
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.full_name}
                          onChange={e => handleInputChange('full_name', e.target.value)}
                      />
                  </div>

                   {/* Title */}
                   <div className="col-span-full md:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                      <input 
                          type="text" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.title}
                          onChange={e => handleInputChange('title', e.target.value)}
                          placeholder="e.g. Graphic Designer"
                      />
                  </div>

                  {/* Email */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input 
                          type="email" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.email}
                          onChange={e => handleInputChange('email', e.target.value)}
                      />
                  </div>

                  {/* Phone */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input 
                          type="text" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.phone}
                          onChange={e => handleInputChange('phone', e.target.value)}
                      />
                  </div>
                  
                  {/* Location */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                      <input 
                          type="text" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.location}
                          onChange={e => handleInputChange('location', e.target.value)}
                      />
                  </div>

                   {/* Years Exp */}
                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
                      <input 
                          type="number" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.years_experience_total}
                          onChange={e => handleInputChange('years_experience_total', parseInt(e.target.value) || 0)}
                      />
                  </div>

                  {/* LinkedIn */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                      <input 
                          type="url" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.linkedin_url}
                          onChange={e => handleInputChange('linkedin_url', e.target.value)}
                          placeholder="https://linkedin.com/in/..."
                      />
                  </div>

                  {/* Portfolio */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio URL</label>
                      <input 
                          type="url" 
                          className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none"
                          value={formData.portfolio_url}
                          onChange={e => handleInputChange('portfolio_url', e.target.value)}
                          placeholder="https://behance.net/..."
                      />
                  </div>
              </div>

              {/* Match Reason / Summary */}
              <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Summary / Notes</label>
                  <textarea 
                      className="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-black outline-none min-h-[100px]"
                      value={formData.match_reason}
                      onChange={e => handleInputChange('match_reason', e.target.value)}
                      placeholder="Candidate summary or notes..."
                  ></textarea>
              </div>

              {/* Hidden Fields for Resume URL/Text */}
              <input type="hidden" value={formData.resume_url || ''} />

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                      type="button"
                      onClick={() => setShowForm(false)} 
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
                  >
                      Cancel
                  </button>
                  <button 
                      type="submit" 
                      disabled={saving}
                      className="px-6 py-2 bg-black text-white font-semibold rounded-md hover:bg-zinc-800 transition disabled:opacity-50 flex items-center gap-2"
                  >
                      {saving ? 'Saving...' : 'Save Candidate'}
                  </button>
              </div>
          </form>
      )}
    </div>
  );
}
