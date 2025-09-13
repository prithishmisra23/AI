const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (serve project root)
app.use(express.static(path.resolve('.')));

// Supabase client
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
const splitList = (v) => (typeof v === 'string' ? v.split(/[;,/|\n]+/).map(s => s.trim()).filter(Boolean) : []);
const words = (v) => (typeof v === 'string' ? v.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean) : []);

function getField(obj, names, fallback = '') {
  for (const n of names) {
    if (obj[n] != null) return obj[n];
    // try case-insensitive and space-insensitive access
    const key = Object.keys(obj).find(k => k.toLowerCase().replace(/\s+/g, '') === n.toLowerCase().replace(/\s+/g, ''));
    if (key) return obj[key];
  }
  return fallback;
}

function scoreCompany(student, company, { query = '', filters = [] }) {
  const matchedOn = [];
  let score = 0;

  const companyName = getField(company, ['company name', 'Company', 'company'], '');
  const role = getField(company, ['Role', 'role', 'designation', 'title'], '');
  const degree = getField(company, ['Degree', 'degree'], '');
  const languages = getField(company, ['Languages', 'languages', 'language'], '');
  const skills = getField(company, ['Skills', 'skills', 'skill'], '');
  const specialisation = getField(company, ['Specialisation', 'specialisation', 'specialization'], '');
  const domain = getField(company, ['Domain', 'domain'], '');

  const qWords = words(query);
  const roleWords = words(role);
  const nameWords = words(companyName);

  // Query/Title relevance
  if (qWords.length) {
    const overlap = qWords.filter(w => roleWords.includes(w) || nameWords.includes(w));
    if (overlap.length) {
      score += 20 + overlap.length * 5;
      matchedOn.push(`query:${overlap.join(',')}`);
    }
  }

  // Selected filters relevance (simple includes on concatenated
  if (Array.isArray(filters) && filters.length) {
    const hay = lower([degree, languages, skills, specialisation, domain, role].join(' '));
    const hits = filters.filter(f => hay.includes(lower(f)));
    if (hits.length) {
      score += hits.length * 6;
      matchedOn.push(`filters:${hits.slice(0,4).join(',')}`);
    }
  }

  // Student profile weighted matching
  const studentSkills = splitList(student.skills || '');
  const studentLangs = splitList(student.languages || '');
  const companySkills = splitList(skills);
  const companyLangs = splitList(languages);

  // Degree exact
  if (student.degree && degree && lower(student.degree) === lower(degree)) {
    score += 12; matchedOn.push('degree');
  }

  // Specialisation exact
  if (student.specialisation && specialisation && lower(student.specialisation) === lower(specialisation)) {
    score += 10; matchedOn.push('specialisation');
  }

  // Domain exact
  if (student.domain && domain && lower(student.domain) === lower(domain)) {
    score += 10; matchedOn.push('domain');
  }

  // Skills overlap (weighted by overlap size)
  if (studentSkills.length && companySkills.length) {
    const overlap = studentSkills.map(s => lower(s)).filter(s => companySkills.map(c => lower(c)).includes(s));
    if (overlap.length) {
      score += Math.min(30, overlap.length * 6);
      matchedOn.push(`skills:${overlap.slice(0,5).join(',')}`);
    }
  }

  // Languages overlap
  if (studentLangs.length && companyLangs.length) {
    const overlap = studentLangs.map(s => lower(s)).filter(s => companyLangs.map(c => lower(c)).includes(s));
    if (overlap.length) {
      score += Math.min(12, overlap.length * 4);
      matchedOn.push(`languages:${overlap.join(',')}`);
    }
  }

  // Academic/experience soft boosts
  const projects = Number(student.projects || 0) || 0;
  const expMonths = Number(student.experience || 0) || 0;
  const comps = Number(student.competitions || 0) || 0;
  score += Math.min(8, Math.floor(projects / 2));
  score += Math.min(10, Math.floor(expMonths / 6));
  score += Math.min(6, Math.floor(comps / 3));

  return {
    score,
    matchedOn,
    companyName: companyName || '',
    role: role || '',
    degree,
    languages,
    skills,
    specialisation,
    domain,
  };
}

async function fetchCompanies() {
  if (supabase) {
    const tableNames = ['companies', 'Companies', 'company', 'Company', 'CompaniesData'];
    for (const t of tableNames) {
      const { data, error } = await supabase.from(t).select('*').limit(5000);
      if (!error && Array.isArray(data) && data.length) return { data };
    }
  }
  // Fallback to local CSV if Supabase not configured or empty
  try {
    const csvPath = path.resolve('Companies.csv');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    if (Array.isArray(records) && records.length) return { data: records };
  } catch (e) {
    // ignore and return error below
  }
  return { data: [], error: new Error('No companies dataset found (Supabase/CSV)') };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, supabaseConfigured: Boolean(supabase) });
});

app.get('/api/match', async (req, res) => {
  const { title = '', degree = '', language = '', skill = '', specialisation = '', domain = '' } = req.query;
  const { data, error } = await fetchCompanies();
  if (error) return res.status(500).json({ error: error.message });

  const filters = [degree, language, skill, specialisation, domain].filter(Boolean);
  const student = { degree, languages: language, skills: skill, specialisation, domain };

  const scored = data.map(c => ({ company: c, s: scoreCompany(student, c, { query: title, filters }) }))
    .filter(x => x.s.score > 0)
    .sort((a,b) => b.s.score - a.s.score)
    .slice(0, 50)
    .map(x => ({
      company: x.s.companyName || getField(x.company, ['Company', 'company'], ''),
      role: x.s.role,
      matchPercent: Math.min(100, Math.round((x.s.score / 100) * 100)),
      matchedOn: x.s.matchedOn,
      degree: x.s.degree,
      languages: x.s.languages,
      skills: x.s.skills,
      specialisation: x.s.specialisation,
      domain: x.s.domain,
    }));

  res.json({ matches: scored });
});

app.post('/api/allocate', async (req, res) => {
  const { query = '', selectedFilters = [], profile = {} } = req.body || {};
  const { data, error } = await fetchCompanies();
  if (error) return res.status(500).json({ error: error.message });

  const student = {
    degree: profile.degree || '',
    languages: profile.languages || '',
    skills: profile.skills || '',
    specialisation: profile.specialisation || profile.specialization || '',
    domain: profile.domain || '',
    projects: profile.projects || 0,
    experience: profile.experience || 0,
    competitions: profile.competitions || 0,
  };

  const scored = data.map(c => ({ company: c, s: scoreCompany(student, c, { query, filters: selectedFilters }) }))
    .filter(x => x.s.score > 0)
    .sort((a,b) => b.s.score - a.s.score)
    .slice(0, 50)
    .map(x => ({
      company: x.s.companyName || getField(x.company, ['Company', 'company'], ''),
      role: x.s.role,
      score: x.s.score,
      matchedOn: x.s.matchedOn,
      degree: x.s.degree,
      languages: x.s.languages,
      skills: x.s.skills,
      specialisation: x.s.specialisation,
      domain: x.s.domain,
    }));

  res.json({ matches: scored });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
