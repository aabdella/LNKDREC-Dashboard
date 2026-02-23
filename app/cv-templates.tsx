// cv-templates.tsx — PDF template components using @react-pdf/renderer
// This file is only ever imported client-side (via dynamic import in CVExportModal)

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// ── Types ──────────────────────────────────────────────────────────────────
type WorkHistory = {
  company: string;
  title: string;
  start_date?: string;
  end_date?: string;
  years?: number;
  brief?: string;
};

type Candidate = {
  full_name: string;
  title: string;
  location: string;
  years_experience_total?: number;
  years_experience?: number;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  skills?: string[];
  technologies?: { name: string; years: number }[];
  tools?: { name: string; years: number }[];
  work_history?: WorkHistory[];
  match_reason?: string;
  match_score?: number;
  status?: string;
  brief?: string;
  education?: string;
  courses_certificates?: string;
};

type Privacy = {
  linkedin: boolean;
  portfolio: boolean;
  email: boolean;
  phone: boolean;
};

type TemplateProps = {
  candidate: Candidate;
  privacy: Privacy;
  logoBase64: string;
  vetting?: Record<string, any> | null;
  egpRate?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function getAllSkills(candidate: Candidate): string[] {
  return [
    ...(candidate.technologies?.map((t) => t.name) || []),
    ...(candidate.tools?.map((t) => t.name) || []),
    ...(candidate.skills || []),
  ];
}

// Convert EGP salary to USD. If value looks like it's already USD (< 5000), return as-is.
function formatSalary(raw: any, egpRate: number): string {
  const val = Number(raw);
  if (!val) return '—';
  // Heuristic: if value < 5000 it's likely already in USD
  if (val < 5000) {
    return `$${val.toLocaleString()}`;
  }
  const usd = Math.round(val / egpRate);
  return `$${usd.toLocaleString()} (~EGP ${val.toLocaleString()})`;
}

// ── TEMPLATE A: Clean Minimal ───────────────────────────────────────────────
const stylesA = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  contactLine: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 2,
  },
  logo: {
    width: 60,
    height: 40,
    objectFit: 'contain',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  infoChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 16,
  },
  skillChip: {
    backgroundColor: '#eef2ff',
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 9,
    color: '#4338ca',
  },
  workEntry: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  workRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workCompany: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  workJobTitle: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Helvetica-Oblique',
  },
  workDates: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'right',
  },
  matchBox: {
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  matchText: {
    fontSize: 9,
    color: '#3730a3',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#cbd5e1',
  },
  section: {
    marginBottom: 16,
  },
  vettingBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  vettingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 6,
  },
  vettingLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Helvetica-Bold',
  },
  vettingValue: {
    fontSize: 9,
    color: '#334155',
  },
  benefitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  benefitChip: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    color: '#15803d',
  },
  aboutText: {
    fontSize: 9.5,
    color: '#334155',
    lineHeight: 1.5,
  },
  educationText: {
    fontSize: 9.5,
    color: '#334155',
    lineHeight: 1.5,
  },
  coursesText: {
    fontSize: 9.5,
    color: '#334155',
    lineHeight: 1.5,
  },
  workBrief: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Helvetica-Oblique',
    marginTop: 3,
    lineHeight: 1.5,
  },
});

export function CVTemplateA({ candidate, privacy, logoBase64, vetting, egpRate = 47 }: TemplateProps) {
  const skills = getAllSkills(candidate);
  const yrs = candidate.years_experience_total || candidate.years_experience || 0;

  return (
    <Document>
      <Page size="A4" style={stylesA.page}>
        {/* Header */}
        <View style={stylesA.header}>
          <View>
            <Text style={stylesA.name}>{candidate.full_name}</Text>
            <Text style={stylesA.jobTitle}>{candidate.title}</Text>
            {privacy.email && candidate.email && (
              <Text style={stylesA.contactLine}>{candidate.email}</Text>
            )}
            {privacy.phone && candidate.phone && (
              <Text style={stylesA.contactLine}>{candidate.phone}</Text>
            )}
            {privacy.linkedin && candidate.linkedin_url && (
              <Text style={stylesA.contactLine}>{candidate.linkedin_url}</Text>
            )}
            {privacy.portfolio && candidate.portfolio_url && (
              <Text style={stylesA.contactLine}>{candidate.portfolio_url}</Text>
            )}
          </View>
          {logoBase64 ? (
            <Image src={logoBase64} style={stylesA.logo} />
          ) : null}
        </View>

        <View style={stylesA.divider} />

        {/* Info Row */}
        <View style={stylesA.infoRow}>
          {candidate.location ? (
            <Text style={stylesA.infoChip}>Location: {candidate.location}</Text>
          ) : null}
          <Text style={stylesA.infoChip}>Experience: {yrs} years</Text>
        </View>

        {/* About */}
        {candidate.brief && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>About</Text>
            <Text style={stylesA.aboutText}>{candidate.brief}</Text>
          </View>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Skills</Text>
            <View style={stylesA.skillsWrap}>
              {skills.map((s, i) => (
                <Text key={i} style={stylesA.skillChip}>{s}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Work History */}
        {candidate.work_history && candidate.work_history.length > 0 && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Work History</Text>
            {candidate.work_history.map((job, i) => (
              <View key={i} style={stylesA.workEntry}>
                <View style={stylesA.workRow}>
                  <View>
                    <Text style={stylesA.workCompany}>{job.company}</Text>
                    <Text style={stylesA.workJobTitle}>{job.title}</Text>
                  </View>
                  <View>
                    <Text style={stylesA.workDates}>
                      {job.start_date || ''} – {job.end_date || ''}
                    </Text>
                    {job.years ? (
                      <Text style={stylesA.workDates}>{job.years} yrs</Text>
                    ) : null}
                  </View>
                </View>
                {job.brief ? (
                  <Text style={stylesA.workBrief}>{job.brief}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {candidate.education && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Education</Text>
            <Text style={stylesA.educationText}>{candidate.education}</Text>
          </View>
        )}

        {/* Courses & Certificates */}
        {candidate.courses_certificates && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Courses &amp; Certificates</Text>
            <Text style={stylesA.coursesText}>{candidate.courses_certificates}</Text>
          </View>
        )}

        {/* Vetting Details */}
        {vetting && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Vetting Details</Text>
            <View style={stylesA.vettingBox}>
              <View style={stylesA.vettingRow}>
                {vetting.english_proficiency ? (
                  <View>
                    <Text style={stylesA.vettingLabel}>English Level</Text>
                    <Text style={stylesA.vettingValue}>{vetting.english_proficiency}</Text>
                  </View>
                ) : null}
                {vetting.work_presence ? (
                  <View>
                    <Text style={stylesA.vettingLabel}>Work Preference</Text>
                    <Text style={stylesA.vettingValue}>{vetting.work_presence}</Text>
                  </View>
                ) : null}
                {vetting.notice_period ? (
                  <View>
                    <Text style={stylesA.vettingLabel}>Notice Period</Text>
                    <Text style={stylesA.vettingValue}>{vetting.notice_period}</Text>
                  </View>
                ) : null}
                {vetting.current_salary ? (
                  <View>
                    <Text style={stylesA.vettingLabel}>Current Salary</Text>
                    <Text style={stylesA.vettingValue}>{formatSalary(vetting.current_salary, egpRate)}</Text>
                  </View>
                ) : null}
                {vetting.expected_salary ? (
                  <View>
                    <Text style={stylesA.vettingLabel}>Expected Salary</Text>
                    <Text style={stylesA.vettingValue}>{formatSalary(vetting.expected_salary, egpRate)}</Text>
                  </View>
                ) : null}
              </View>
              {vetting.benefits && vetting.benefits.length > 0 ? (
                <View>
                  <Text style={stylesA.vettingLabel}>Benefits Required</Text>
                  <View style={stylesA.benefitsWrap}>
                    {vetting.benefits.map((b: string, i: number) => (
                      <Text key={i} style={stylesA.benefitChip}>{b}</Text>
                    ))}
                  </View>
                </View>
              ) : null}
              {vetting.notes ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={stylesA.vettingLabel}>Interview Notes</Text>
                  <Text style={{ ...stylesA.vettingValue, marginTop: 2, lineHeight: 1.4 }}>{vetting.notes}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Match Reason */}
        {candidate.match_reason && (
          <View style={stylesA.section}>
            <Text style={stylesA.sectionTitle}>Why This Candidate</Text>
            <View style={stylesA.matchBox}>
              <Text style={stylesA.matchText}>{candidate.match_reason}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={stylesA.footer}>Presented by LNKDREC.ai</Text>
      </Page>
    </Document>
  );
}

// ── TEMPLATE B: Two-Column Modern ──────────────────────────────────────────
const stylesB = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
    flexDirection: 'row',
  },
  sidebar: {
    width: '35%',
    backgroundColor: '#0f172a',
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 20,
    minHeight: '100%',
  },
  sidebarLogo: {
    width: 60,
    height: 36,
    objectFit: 'contain',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  sidebarName: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  sidebarTitle: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 20,
  },
  sidebarSectionTitle: {
    color: '#94a3b8',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 14,
  },
  sidebarContact: {
    color: '#cbd5e1',
    fontSize: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  sidebarSkill: {
    color: '#e2e8f0',
    fontSize: 8,
    marginBottom: 3,
    paddingLeft: 8,
  },
  content: {
    width: '65%',
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 28,
    backgroundColor: '#ffffff',
  },
  profileLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#eef2ff',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    color: '#4338ca',
  },
  contentSectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  workEntry: {
    marginBottom: 10,
  },
  workRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  workCompany: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  workJobTitle: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Helvetica-Oblique',
  },
  workDates: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'right',
  },
  matchBox: {
    backgroundColor: '#fafafa',
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  matchText: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
  workBrief: {
    fontSize: 8.5,
    color: '#64748b',
    fontFamily: 'Helvetica-Oblique',
    marginTop: 3,
    lineHeight: 1.5,
  },
  aboutText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.5,
  },
  educationText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.5,
  },
  coursesText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.5,
  },
});

export function CVTemplateB({ candidate, privacy, logoBase64, vetting, egpRate = 47 }: TemplateProps) {
  const skills = getAllSkills(candidate);
  const yrs = candidate.years_experience_total || candidate.years_experience || 0;
  const initials = getInitials(candidate.full_name);

  return (
    <Document>
      <Page size="A4" style={stylesB.page}>
        {/* Sidebar */}
        <View style={stylesB.sidebar}>
          {logoBase64 ? (
            <Image src={logoBase64} style={stylesB.sidebarLogo} />
          ) : null}

          {/* Avatar */}
          <View style={stylesB.avatarCircle}>
            <Text style={stylesB.avatarText}>{initials}</Text>
          </View>

          <Text style={stylesB.sidebarName}>{candidate.full_name}</Text>
          <Text style={stylesB.sidebarTitle}>{candidate.title}</Text>

          {/* Contact */}
          <Text style={stylesB.sidebarSectionTitle}>Contact</Text>
          {privacy.email && candidate.email && (
            <Text style={stylesB.sidebarContact}>{candidate.email}</Text>
          )}
          {privacy.phone && candidate.phone && (
            <Text style={stylesB.sidebarContact}>{candidate.phone}</Text>
          )}
          {privacy.linkedin && candidate.linkedin_url && (
            <Text style={stylesB.sidebarContact}>{candidate.linkedin_url}</Text>
          )}
          {privacy.portfolio && candidate.portfolio_url && (
            <Text style={stylesB.sidebarContact}>{candidate.portfolio_url}</Text>
          )}
          {!privacy.email && !privacy.phone && !privacy.linkedin && !privacy.portfolio && (
            <Text style={stylesB.sidebarContact}>Contact info hidden</Text>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <>
              <Text style={stylesB.sidebarSectionTitle}>Skills</Text>
              {skills.slice(0, 14).map((s, i) => (
                <Text key={i} style={stylesB.sidebarSkill}>• {s}</Text>
              ))}
            </>
          )}
        </View>

        {/* Main Content */}
        <View style={stylesB.content}>
          <Text style={stylesB.profileLabel}>Candidate Profile</Text>

          {/* Badges */}
          <View style={stylesB.badgeRow}>
            <Text style={stylesB.badge}>{yrs} Years Exp.</Text>
            {candidate.location ? (
              <Text style={stylesB.badge}>{candidate.location}</Text>
            ) : null}
          </View>

          {/* About */}
          {candidate.brief && (
            <View>
              <Text style={stylesB.contentSectionTitle}>About</Text>
              <Text style={stylesB.aboutText}>{candidate.brief}</Text>
            </View>
          )}

          {/* Work History */}
          {candidate.work_history && candidate.work_history.length > 0 && (
            <View>
              <Text style={stylesB.contentSectionTitle}>Work History</Text>
              {candidate.work_history.map((job, i) => (
                <View key={i} style={stylesB.workEntry}>
                  <View style={stylesB.workRow}>
                    <View>
                      <Text style={stylesB.workCompany}>{job.company}</Text>
                      <Text style={stylesB.workJobTitle}>{job.title}</Text>
                    </View>
                    <View>
                      <Text style={stylesB.workDates}>
                        {job.start_date || ''} – {job.end_date || ''}
                      </Text>
                      {job.years ? (
                        <Text style={stylesB.workDates}>{job.years} yrs</Text>
                      ) : null}
                    </View>
                  </View>
                  {job.brief ? (
                    <Text style={stylesB.workBrief}>{job.brief}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Education */}
          {candidate.education && (
            <View>
              <Text style={stylesB.contentSectionTitle}>Education</Text>
              <Text style={stylesB.educationText}>{candidate.education}</Text>
            </View>
          )}

          {/* Courses & Certificates */}
          {candidate.courses_certificates && (
            <View>
              <Text style={stylesB.contentSectionTitle}>Courses &amp; Certificates</Text>
              <Text style={stylesB.coursesText}>{candidate.courses_certificates}</Text>
            </View>
          )}

          {/* Vetting Details */}
          {vetting && (
            <View>
              <Text style={stylesB.contentSectionTitle}>Vetting Details</Text>
              <View style={{ backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: '#4f46e5', paddingHorizontal: 10, paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 6 }}>
                  {vetting.english_proficiency ? (
                    <View>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>English Level</Text>
                      <Text style={{ fontSize: 9, color: '#334155' }}>{vetting.english_proficiency}</Text>
                    </View>
                  ) : null}
                  {vetting.work_presence ? (
                    <View>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>Work Preference</Text>
                      <Text style={{ fontSize: 9, color: '#334155' }}>{vetting.work_presence}</Text>
                    </View>
                  ) : null}
                  {vetting.notice_period ? (
                    <View>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>Notice Period</Text>
                      <Text style={{ fontSize: 9, color: '#334155' }}>{vetting.notice_period}</Text>
                    </View>
                  ) : null}
                  {vetting.current_salary ? (
                    <View>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>Current Salary</Text>
                      <Text style={{ fontSize: 9, color: '#334155' }}>{formatSalary(vetting.current_salary, egpRate)}</Text>
                    </View>
                  ) : null}
                  {vetting.expected_salary ? (
                    <View>
                      <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>Expected Salary</Text>
                      <Text style={{ fontSize: 9, color: '#334155' }}>{formatSalary(vetting.expected_salary, egpRate)}</Text>
                    </View>
                  ) : null}
                </View>
                {vetting.benefits && vetting.benefits.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {vetting.benefits.map((b: string, i: number) => (
                      <Text key={i} style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, color: '#15803d' }}>{b}</Text>
                    ))}
                  </View>
                ) : null}
                {vetting.notes ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Helvetica-Bold' }}>Interview Notes</Text>
                    <Text style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>{vetting.notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Match Reason */}
          {candidate.match_reason && (
            <View>
              <Text style={stylesB.contentSectionTitle}>Why This Candidate</Text>
              <View style={stylesB.matchBox}>
                <Text style={stylesB.matchText}>{candidate.match_reason}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={stylesB.footer}>Presented by LNKDREC.ai</Text>
      </Page>
    </Document>
  );
}
