'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function BackfillPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (msg: string) => setLogs(prev => [...prev, msg]);

  async function runBackfill() {
    setLoading(true);
    log('Starting backfill...');

    try {
        // 1. Fetch Candidates (limit to 50 for safety)
        const { data: candidates, error } = await supabase
            .from('candidates')
            .select('id, resume_text, full_name, technologies, tools')
            .eq('source', 'PDF Upload')
            .not('resume_text', 'is', null);

        if (error) throw error;
        
        log(`Found ${candidates?.length || 0} candidates.`);

        if (!candidates) return;

        // Tech & Tools Keywords
        const commonTech = ['React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL', 'NoSQL', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Ruby'];
        const commonTools = ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Trello', 'Slack', 'Git', 'GitHub', 'GitLab', 'Linear'];

        let updatedCount = 0;

        for (const candidate of candidates) {
            const text = candidate.resume_text || '';
            let needsUpdate = false;
            
            // Only update if currently empty
            const currentTech = candidate.technologies || [];
            const currentTools = candidate.tools || [];
            
            let newTech = [...currentTech];
            let newTools = [...currentTools];

            if (currentTech.length === 0) {
                const foundTech = commonTech
                    .filter(t => new RegExp(`\b${t}\b`, 'i').test(text))
                    .map(t => ({ name: t, years: 1 }));
                if (foundTech.length > 0) {
                    newTech = foundTech;
                    needsUpdate = true;
                }
            }

            if (currentTools.length === 0) {
                const foundTools = commonTools
                    .filter(t => new RegExp(`\b${t}\b`, 'i').test(text))
                    .map(t => ({ name: t, years: 1 }));
                if (foundTools.length > 0) {
                    newTools = foundTools;
                    needsUpdate = true;
                }
            }

            // Simple Work History Parser
            const historyRegex = /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}\s*[-–to]\s*(Present|Now|\d{4}))/gi;
            const work_history: any[] = [];
            let match;
            
            // Reset regex index
            historyRegex.lastIndex = 0;
            
            while ((match = historyRegex.exec(text)) !== null) {
                const start = Math.max(0, match.index - 50);
                const end = Math.min(text.length, match.index + 100);
                const context = text.substring(start, end).replace(/\s+/g, ' ').trim();
                work_history.push({ company: 'Unknown', title: context, years: 1 });
                if (work_history.length >= 3) break; 
            }

            if (needsUpdate || (work_history.length > 0 && (!candidate.work_history || candidate.work_history.length === 0))) {
                log(`Enriching ${candidate.full_name}...`);
                
                const { error: updateError } = await supabase
                    .from('candidates')
                    .update({
                        technologies: newTech,
                        tools: newTools,
                        work_history: work_history
                    })
                    .eq('id', candidate.id);
                
                if (updateError) log(`Error: ${updateError.message}`);
                else updatedCount++;
            }
        }

        log(`Backfill complete. Updated ${updatedCount} candidates.`);

    } catch (e: any) {
        log(`Error: ${e.message}`);
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Admin Backfill Tool</h1>
      <button 
        onClick={runBackfill} 
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded mb-6 disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Start Enrichment Backfill'}
      </button>

      <div className="bg-slate-100 p-4 rounded h-96 overflow-y-auto font-mono text-xs">
        {logs.map((l, i) => <div key={i}>{l}</div>)}
        {logs.length === 0 && <span className="text-slate-400">Logs will appear here...</span>}
      </div>
    </div>
  );
}
