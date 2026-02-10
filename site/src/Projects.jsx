import React from 'react';
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
  if (!data || !data.repos || data.repos.length === 0) {
    return (
      <div className="projects-empty">No per-repo data present. Run the exporter to include repo aggregates.</div>
    );
  }

  return (
    <div>
      <ProjectsBubble repos={data.repos} selectedAuthor={selectedAuthor} metric={metric} />
      <div className="projects-grid">
        {data.repos.map(r => <RepoCard key={r.repo} repo={r} />)}
      </div>
    </div>
  );
}
