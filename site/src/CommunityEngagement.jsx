import React from 'react';

/**
 * CommunityEngagement - Shows community engagement metrics from Ecosyste.ms
 * 
 * Displays key metrics about issue activity, response times, and community health
 */
function CommunityEngagement({ data }) {
  if (!data || !data.ecosystems || !data.ecosystems.issue_stats || data.ecosystems.issue_stats.length === 0) {
    return (
      <div className="chart-container">
        <h3>👥 Community Engagement Metrics</h3>
        <p className="no-data">
          No Ecosyste.ms community data available yet.
        </p>
      </div>
    );
  }

  const issueStats = data.ecosystems.issue_stats;
  const commitStats = data.ecosystems.commit_stats || [];
  const repoData = data.ecosystems.repositories || [];

  // Calculate aggregate metrics
  const totalIssues = issueStats.reduce((sum, r) => sum + (r.total_issues || 0), 0);
  const totalOpenIssues = issueStats.reduce((sum, r) => sum + (r.open_issues || 0), 0);
  const totalClosedIssues = issueStats.reduce((sum, r) => sum + (r.closed_issues || 0), 0);

  // Calculate average time to close (weighted by number of closed issues)
  let totalWeightedTime = 0;
  let totalClosedWithTime = 0;
  issueStats.forEach(r => {
    if (r.avg_time_to_close && r.closed_issues > 0) {
      totalWeightedTime += r.avg_time_to_close * r.closed_issues;
      totalClosedWithTime += r.closed_issues;
    }
  });
  const avgTimeToClose = totalClosedWithTime > 0 ? totalWeightedTime / totalClosedWithTime : null;

  // Calculate average comments per issue
  let totalWeightedComments = 0;
  let totalIssuesWithComments = 0;
  issueStats.forEach(r => {
    if (r.avg_comments_per_issue && r.total_issues > 0) {
      totalWeightedComments += r.avg_comments_per_issue * r.total_issues;
      totalIssuesWithComments += r.total_issues;
    }
  });
  const avgCommentsPerIssue = totalIssuesWithComments > 0 ? totalWeightedComments / totalIssuesWithComments : null;

  // Calculate total commits and committers
  const totalCommits = commitStats.reduce((sum, r) => sum + (r.total_commits || 0), 0);
  const totalCommitters = commitStats.reduce((sum, r) => sum + (r.total_committers || 0), 0);

  // Calculate average health score
  const reposWithHealth = repoData.filter(r => r.health_score !== null);
  const avgHealthScore = reposWithHealth.length > 0
    ? reposWithHealth.reduce((sum, r) => sum + r.health_score, 0) / reposWithHealth.length
    : null;

  // Format time to close
  const formatTimeToClose = (hours) => {
    if (!hours) return 'N/A';
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h`;
  };

  return (
    <div className="chart-container">
      <h3>👥 Community Engagement Metrics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '20px' }}>
        
        <div className="metric-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="metric-value">{totalIssues.toLocaleString()}</div>
          <div className="metric-label">Total Issues</div>
          <div className="metric-detail">
            {totalOpenIssues.toLocaleString()} open · {totalClosedIssues.toLocaleString()} closed
          </div>
        </div>

        {avgTimeToClose !== null && (
          <div className="metric-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <div className="metric-value">{formatTimeToClose(avgTimeToClose)}</div>
            <div className="metric-label">Avg Time to Close</div>
            <div className="metric-detail">Issue response time</div>
          </div>
        )}

        {avgCommentsPerIssue !== null && (
          <div className="metric-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <div className="metric-value">{avgCommentsPerIssue.toFixed(1)}</div>
            <div className="metric-label">Comments per Issue</div>
            <div className="metric-detail">Engagement level</div>
          </div>
        )}

        {totalCommits > 0 && (
          <div className="metric-card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <div className="metric-value">{totalCommits.toLocaleString()}</div>
            <div className="metric-label">Total Commits</div>
            <div className="metric-detail">{totalCommitters} committers</div>
          </div>
        )}

        {avgHealthScore !== null && (
          <div className="metric-card" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            <div className="metric-value">{avgHealthScore.toFixed(0)}%</div>
            <div className="metric-label">Avg Health Score</div>
            <div className="metric-detail">Repository health</div>
          </div>
        )}

      </div>

      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Top Repositories by Activity</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Repository</th>
              <th style={{ padding: '8px' }}>Issues</th>
              <th style={{ padding: '8px' }}>Avg Comments</th>
              <th style={{ padding: '8px' }}>Health</th>
            </tr>
          </thead>
          <tbody>
            {issueStats
              .sort((a, b) => (b.total_issues || 0) - (a.total_issues || 0))
              .slice(0, 10)
              .map((repo, idx) => {
                const repoInfo = repoData.find(r => r.repo === repo.repo);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{repo.repo.split('/')[1] || repo.repo}</td>
                    <td style={{ padding: '8px' }}>
                      {repo.total_issues}
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '5px' }}>
                        ({repo.open_issues} open)
                      </span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      {repo.avg_comments_per_issue ? repo.avg_comments_per_issue.toFixed(1) : 'N/A'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {repoInfo?.health_score ? (
                        <span style={{ 
                          color: repoInfo.health_score >= 80 ? '#107c10' : 
                                 repoInfo.health_score >= 50 ? '#ffc107' : '#e81123'
                        }}>
                          {repoInfo.health_score}%
                        </span>
                      ) : 'N/A'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
        <p>Community engagement data provided by Ecosyste.ms</p>
      </div>
    </div>
  );
}

export default CommunityEngagement;
