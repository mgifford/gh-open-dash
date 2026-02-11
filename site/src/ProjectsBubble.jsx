import React from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, Title);

function scaleRadius(val, maxVal = 1, maxRadius = 72, minRadius = 6) {
  if (!val || val <= 0) return minRadius;
  // scale by sqrt to reduce skew, then normalize by maxVal
  const ratio = Math.sqrt(val) / Math.sqrt(Math.max(1, maxVal));
  const r = Math.round(minRadius + (maxRadius - minRadius) * Math.min(1, ratio));
  return Math.max(minRadius, Math.min(maxRadius, r));
}

export default function ProjectsBubble({ repos = [], selectedAuthor = 'all', metric = 'issues_opened', onRepoClick }) {
  // Build bubble points: x = PR activity, y = Issue activity, r = selected metric count
  const computed = repos.map(r => {
    const byAuthor = r.byAuthor || {};
    let metricValue = 0;
    let prs = 0;
    let issues = 0;
    if (selectedAuthor === 'all') {
      for (const a of Object.keys(byAuthor)) {
        const c = byAuthor[a] || {};
        if (metric === 'comments_total') {
          metricValue += (c.comments_issue || 0) + (c.comments_pr_review || 0) + (c.comments_commit || 0);
        } else {
          metricValue += c[metric] || 0;
        }
        prs += (c.prs_opened || 0) + (c.prs_merged || 0) + (c.prs_closed || 0);
        issues += (c.issues_opened || 0) + (c.issues_closed || 0);
      }
    } else {
      const c = byAuthor[selectedAuthor] || {};
      if (metric === 'comments_total') {
        metricValue = (c.comments_issue || 0) + (c.comments_pr_review || 0) + (c.comments_commit || 0);
      } else {
        metricValue = c[metric] || 0;
      }
      prs = (c.prs_opened || 0) + (c.prs_merged || 0) + (c.prs_closed || 0);
      issues = (c.issues_opened || 0) + (c.issues_closed || 0);
    }
    const parts = (r.repo || '').split('/');
    const org = parts[0] || 'unknown';
    return { repo: r.repo, org, metricValue, prs, issues };
  }).filter(p => p.metricValue > 0 || p.prs > 0 || p.issues > 0);

  const maxMetric = computed.reduce((m, v) => Math.max(m, v.metricValue || 0), 0);

  // color map: organization-specific colors, case-insensitive keys
  const orgColorMap = {
    'civicactions': '#1f77b4',
    'getdkan': '#ff7f0e',
    'httparchive': '#2ca02c'
  };
  const palette = ['#636efa', '#ef553b', '#00cc96', '#ab63fa', '#19d3f3', '#e763fa', '#f4a261'];
  const orgIndexMap = {};

  // group by org
  const groups = {};
  computed.forEach((p, i) => {
    const orgKey = (p.org || 'unknown').toLowerCase();
    if (!groups[orgKey]) groups[orgKey] = [];
    const point = {
      x: p.prs,
      y: p.issues,
      r: scaleRadius(p.metricValue, maxMetric, 48, 6),
      raw: { repo: p.repo, org: p.org, metricValue: p.metricValue, prs: p.prs, issues: p.issues }
    };
    groups[orgKey].push(point);
    if (!(orgKey in orgIndexMap)) {
      orgIndexMap[orgKey] = Object.keys(orgIndexMap).length;
    }
  });

  const datasets = Object.keys(groups).map((orgKey) => {
    const displayOrg = orgKey;
    const baseColor = orgColorMap[orgKey] || palette[orgIndexMap[orgKey] % palette.length];
    return {
      label: displayOrg,
      data: groups[orgKey],
      backgroundColor: baseColor + 'cc',
      borderColor: baseColor,
    };
  });

  const data = { datasets };

  const options = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const p = context.raw.raw || context.raw;
            return `${p.repo}: PRs=${p.prs}, Issues=${p.issues}, Selected=${p.metricValue}`;
          }
        }
      },
      title: { display: true, text: 'Repository contributions (PRs vs Issues)' },
      // hide the verbose legend — it creates too many labels for repositories
      legend: { display: false }
    },
    scales: {
      x: { title: { display: true, text: 'PR activity (count)' }, beginAtZero: true },
      y: { title: { display: true, text: 'Issue activity (count)' }, beginAtZero: true }
    },
    onClick: (evt, elements, chart) => {
      if (!elements || elements.length === 0) return;
      const el = elements[0];
      const ds = chart.data.datasets[el.datasetIndex];
      const point = ds.data[el.index];
      if (point && point.raw && typeof onRepoClick === 'function') {
        onRepoClick(point.raw.repo);
      }
    }
  };

  return (
    <div style={{ height: 360 }}>
      <Bubble data={data} options={options} />
    </div>
  );
}
