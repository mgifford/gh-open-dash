import React, { useMemo, useState } from 'react';
import ProjectsBubble from './ProjectsBubble.jsx';
import ProjectHistory from './ProjectHistory.jsx';

function RepoCard({ repo, hasDescriptor, contributorCompany = {} }) {
  const topContributors = Object.entries(repo.byAuthor || {})
    .map(([author, counts]) => ({ author, total: Object.values(counts).reduce((s, v) => s + v, 0), counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="repo-card">
      <div className="repo-header">
        <div className="repo-name">{repo.repo}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasDescriptor && (
            <span
              title="Publishes a .well-known/open-contributions.json descriptor"
              style={{ fontSize: 14, cursor: 'default' }}
              aria-label="Has open-contributions descriptor"
            >
              📄
            </span>
          )}
          <div className="repo-spdx">{repo.spdx || 'unknown'}</div>
        </div>
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
          {topContributors.map(t => {
            const company = contributorCompany[t.author]?.company;
            return (
              <li key={t.author}>
                {t.author} — {t.total}
                {company && <span className="meta"> ({company})</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function Projects({ data, selectedAuthor = 'all', metric = 'issues_opened', contributorCompany = {} }) {
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [selectedRepo, setSelectedRepo] = useState(null);

  // Build a Set of repos that have an open-contributions descriptor
  const descriptorRepos = useMemo(() => {
    const s = new Set();
    if (data && data.open_contributions) {
      data.open_contributions.forEach(r => { if (r.has_descriptor) s.add(r.repo); });
    }
    return s;
  }, [data && data.open_contributions]);

  const orgs = useMemo(() => {
    const s = new Set();
    if (data && data.repos) {
      data.repos.forEach(r => {
        const parts = (r.repo || '').split('/');
        if (parts[0]) s.add(parts[0]);
      });
    }
    return ['all', ...Array.from(s).sort()];
  }, [data && data.repos]);

  const filtered = useMemo(() => {
    if (!data || !data.repos) return [];
    return data.repos.filter(r => {
      if (orgFilter !== 'all') {
        if (!r.repo.startsWith(orgFilter + '/')) return false;
      }
      if (search && !r.repo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data && data.repos, orgFilter, search]);

  if (!data || !data.repos || data.repos.length === 0) {
    return (
      <div className="projects-empty">No per-repo data present. Run the exporter to include repo aggregates.</div>
    );
  }

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
              return (
                <>
                  <RepoCard repo={repoObj} hasDescriptor={descriptorRepos.has(repoObj.repo)} contributorCompany={contributorCompany} />
                  <div style={{ marginTop: 16 }}>
                    <ProjectHistory repo={repoObj} contributorCompany={contributorCompany} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="projects-grid" style={{ marginTop: 12 }}>
        {filtered.map(r => <div key={r.repo} onClick={() => setSelectedRepo(r.repo)}><RepoCard repo={r} hasDescriptor={descriptorRepos.has(r.repo)} contributorCompany={contributorCompany} /></div>)}
      </div>
    </div>
  );
}
