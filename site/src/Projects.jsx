import React, { useMemo, useState } from 'react';
import ProjectsBubble from './ProjectsBubble.jsx';

function RepoCard({ repo }) {
  const topContributors = Object.entries(repo.byAuthor || {})
    .map(([author, counts]) => ({ author, total: Object.values(counts).reduce((s, v) => s + v, 0), counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="repo-card">
      <div className="repo-header">
        <div className="repo-name">{repo.repo}</div>
        <div className="repo-spdx">{repo.spdx || 'unknown'}</div>
      </div>
      <div className="repo-totals">
        <span>PRs opened: {repo.totals.prs_opened}</span>
        <span>PRs merged: {repo.totals.prs_merged}</span>
        <span>Issues opened: {repo.totals.issues_opened}</span>
        <span>Commits: {repo.totals.commits}</span>
      </div>
      <div className="repo-top">
        <strong>Top contributors:</strong>
        <ul>
          {topContributors.map(t => (
            <li key={t.author}>{t.author} — {t.total}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Projects({ data, selectedAuthor = 'all', metric = 'issues_opened' }) {
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [selectedRepo, setSelectedRepo] = useState(null);

  if (!data || !data.repos || data.repos.length === 0) {
    return (
      <div className="projects-empty">No per-repo data present. Run the exporter to include repo aggregates.</div>
    );
  }

  const orgs = useMemo(() => {
    const s = new Set();
    data.repos.forEach(r => {
      const parts = (r.repo || '').split('/');
      if (parts[0]) s.add(parts[0]);
    });
    return ['all', ...Array.from(s).sort()];
  }, [data.repos]);

  const filtered = useMemo(() => {
    return data.repos.filter(r => {
      if (orgFilter !== 'all') {
        if (!r.repo.startsWith(orgFilter + '/')) return false;
      }
      if (search && !r.repo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.repos, orgFilter, search]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Search:
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="repo name" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          Org:
          <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}>
            {orgs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        {selectedRepo && <div style={{ marginLeft: 'auto' }}>Selected: <strong>{selectedRepo}</strong></div>}
      </div>

      <ProjectsBubble repos={filtered} selectedAuthor={selectedAuthor} metric={metric} onRepoClick={setSelectedRepo} />

      {selectedRepo && (
        <div style={{ marginTop: 12 }}>
          <h3>Repository details</h3>
          <div>
            {(() => {
              const repoObj = data.repos.find(r => r.repo === selectedRepo);
              if (!repoObj) return <div>Repository data not found.</div>;
              return <RepoCard repo={repoObj} />;
            })()}
          </div>
        </div>
      )}

      <div className="projects-grid" style={{ marginTop: 12 }}>
        {filtered.map(r => <div key={r.repo} onClick={() => setSelectedRepo(r.repo)}><RepoCard repo={r} /></div>)}
      </div>
    </div>
  );
}
