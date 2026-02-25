/**
 * Ecosyste.ms API Collector
 * 
 * Collects repository health metrics, dependencies, and community data
 * from the Ecosyste.ms APIs to enhance the transparency dashboard.
 * 
 * Ecosyste.ms provides:
 * - Repository health scores and maintenance status
 * - Dependency analysis and security info
 * - Cross-repository contributor analysis
 * - Package ecosystem integration
 * - Community engagement metrics
 */

const ECOSYSTEMS_BASE_URLS = {
  repos: 'https://repos.ecosyste.ms/api/v1',
  issues: 'https://issues.ecosyste.ms/api/v1',
  commits: 'https://commits.ecosyste.ms/api/v1',
  packages: 'https://packages.ecosyste.ms/api/v1'
};

const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'gh-open-dash/1.0'
        }
      });
      
      if (res.ok) {
        return await res.json();
      }
      
      if (res.status === 404) {
        // Not found is expected for some repos
        return null;
      }
      
      if (res.status === 429) {
        // Rate limited, wait longer
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        continue;
      }
      
      console.warn(`Failed to fetch ${url}: ${res.status}`);
      return null;
    } catch (err) {
      console.warn(`Error fetching ${url}: ${err.message}`);
      if (i === retries - 1) return null;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  return null;
}

/**
 * Get repository data from Ecosyste.ms repos API
 */
export async function getRepositoryData(owner, repo) {
  const url = `${ECOSYSTEMS_BASE_URLS.repos}/hosts/GitHub/repositories/${owner}/${repo}`;
  const data = await fetchWithRetry(url);
  
  if (!data) return null;
  
  return {
    repo: `${owner}/${repo}`,
    health_score: data.health_percentage || null,
    maintenance_status: data.status || null,
    last_synced_at: data.last_synced_at || null,
    archived: data.archived || false,
    fork: data.fork || false,
    pushed_at: data.pushed_at || null,
    dependency_count: data.dependencies_count || 0,
    dependent_repos_count: data.dependent_repos_count || 0,
    language: data.language || null,
    license: data.license || null,
    topics: data.topics || []
  };
}

/**
 * Get repository issue statistics from Ecosyste.ms issues API
 */
export async function getRepositoryIssueStats(owner, repo) {
  const url = `${ECOSYSTEMS_BASE_URLS.issues}/hosts/GitHub/repositories/${owner}/${repo}`;
  const data = await fetchWithRetry(url);
  
  if (!data) return null;
  
  return {
    repo: `${owner}/${repo}`,
    total_issues: data.issues_count || 0,
    open_issues: data.open_issues_count || 0,
    closed_issues: data.closed_issues_count || 0,
    avg_time_to_close: data.avg_time_to_close_issue || null,
    avg_comments_per_issue: data.avg_comments_per_issue || null
  };
}

/**
 * Get author issue statistics from Ecosyste.ms issues API
 */
export async function getAuthorIssueStats(username) {
  const url = `${ECOSYSTEMS_BASE_URLS.issues}/hosts/GitHub/authors/${username}`;
  const data = await fetchWithRetry(url);
  
  if (!data) return null;
  
  return {
    author: username,
    total_issues_opened: data.issues_opened_count || 0,
    total_issues_commented: data.issues_commented_count || 0,
    total_prs_opened: data.pull_requests_opened_count || 0,
    repositories_contributed: data.repositories_count || 0
  };
}

/**
 * Get repository commit statistics from Ecosyste.ms commits API
 */
export async function getRepositoryCommitStats(owner, repo) {
  const url = `${ECOSYSTEMS_BASE_URLS.commits}/hosts/GitHub/repositories/${owner}/${repo}`;
  const data = await fetchWithRetry(url);
  
  if (!data) return null;
  
  return {
    repo: `${owner}/${repo}`,
    total_commits: data.commits_count || 0,
    total_committers: data.committers_count || 0,
    avg_commits_per_week: data.avg_commits_per_week || null,
    last_commit_at: data.last_commit_at || null
  };
}

/**
 * Collect Ecosyste.ms data for a list of repositories
 */
export async function collectEcosystemsData(repositories, includeAuthorStats = false) {
  const repoData = [];
  const issueStats = [];
  const commitStats = [];
  const authorStats = new Map();
  
  console.log(`Collecting Ecosyste.ms data for ${repositories.length} repositories...`);
  
  for (let i = 0; i < repositories.length; i++) {
    const repoName = repositories[i];
    const [owner, repo] = repoName.split('/');
    
    if (!owner || !repo) {
      console.warn(`Invalid repo format: ${repoName}`);
      continue;
    }
    
    console.log(`[${i + 1}/${repositories.length}] Fetching data for ${repoName}...`);
    
    // Fetch repository data
    const repoInfo = await getRepositoryData(owner, repo);
    if (repoInfo) {
      repoData.push(repoInfo);
    }
    
    // Fetch issue statistics
    const issueInfo = await getRepositoryIssueStats(owner, repo);
    if (issueInfo) {
      issueStats.push(issueInfo);
    }
    
    // Fetch commit statistics
    const commitInfo = await getRepositoryCommitStats(owner, repo);
    if (commitInfo) {
      commitStats.push(commitInfo);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }
  
  return {
    repositories: repoData,
    issue_stats: issueStats,
    commit_stats: commitStats,
    author_stats: includeAuthorStats ? Array.from(authorStats.values()) : []
  };
}

/**
 * Store Ecosyste.ms data in SQLite database
 */
export function storeEcosystemsData(db, ecosystemsData, timestamp) {
  const insertRepo = db.prepare(`
    INSERT OR REPLACE INTO ecosystems_repos 
    (timestamp, repo, health_score, maintenance_status, archived, dependency_count, 
     dependent_repos_count, language, license, topics) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertIssueStats = db.prepare(`
    INSERT OR REPLACE INTO ecosystems_issue_stats
    (timestamp, repo, total_issues, open_issues, closed_issues, 
     avg_time_to_close, avg_comments_per_issue)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertCommitStats = db.prepare(`
    INSERT OR REPLACE INTO ecosystems_commit_stats
    (timestamp, repo, total_commits, total_committers, avg_commits_per_week, last_commit_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    // Store repository data
    for (const repo of ecosystemsData.repositories) {
      insertRepo.run(
        timestamp,
        repo.repo,
        repo.health_score,
        repo.maintenance_status,
        repo.archived ? 1 : 0,
        repo.dependency_count,
        repo.dependent_repos_count,
        repo.language,
        repo.license,
        JSON.stringify(repo.topics || [])
      );
    }
    
    // Store issue statistics
    for (const stats of ecosystemsData.issue_stats) {
      insertIssueStats.run(
        timestamp,
        stats.repo,
        stats.total_issues,
        stats.open_issues,
        stats.closed_issues,
        stats.avg_time_to_close,
        stats.avg_comments_per_issue
      );
    }
    
    // Store commit statistics
    for (const stats of ecosystemsData.commit_stats) {
      insertCommitStats.run(
        timestamp,
        stats.repo,
        stats.total_commits,
        stats.total_committers,
        stats.avg_commits_per_week,
        stats.last_commit_at
      );
    }
  });
  
  transaction();
  
  console.log(`Stored Ecosyste.ms data: ${ecosystemsData.repositories.length} repos, ` +
    `${ecosystemsData.issue_stats.length} issue stats, ${ecosystemsData.commit_stats.length} commit stats`);
}

/**
 * Create Ecosyste.ms tables in SQLite database
 */
export function createEcosystemsTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ecosystems_repos (
      timestamp TEXT,
      repo TEXT,
      health_score INTEGER,
      maintenance_status TEXT,
      archived INTEGER,
      dependency_count INTEGER,
      dependent_repos_count INTEGER,
      language TEXT,
      license TEXT,
      topics TEXT,
      PRIMARY KEY (timestamp, repo)
    );
    
    CREATE TABLE IF NOT EXISTS ecosystems_issue_stats (
      timestamp TEXT,
      repo TEXT,
      total_issues INTEGER,
      open_issues INTEGER,
      closed_issues INTEGER,
      avg_time_to_close REAL,
      avg_comments_per_issue REAL,
      PRIMARY KEY (timestamp, repo)
    );
    
    CREATE TABLE IF NOT EXISTS ecosystems_commit_stats (
      timestamp TEXT,
      repo TEXT,
      total_commits INTEGER,
      total_committers INTEGER,
      avg_commits_per_week REAL,
      last_commit_at TEXT,
      PRIMARY KEY (timestamp, repo)
    );
    
    CREATE TABLE IF NOT EXISTS ecosystems_author_stats (
      timestamp TEXT,
      author TEXT,
      total_issues_opened INTEGER,
      total_issues_commented INTEGER,
      total_prs_opened INTEGER,
      repositories_contributed INTEGER,
      PRIMARY KEY (timestamp, author)
    );
  `);
  
  console.log('Created Ecosyste.ms tables');
}
