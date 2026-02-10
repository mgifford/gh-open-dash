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

function scaleRadius(val) {
  if (!val || val <= 0) return 2;
  return Math.min(40, Math.sqrt(val) * 2);
}

export default function ProjectsBubble({ repos = [], selectedAuthor = 'all', metric = 'issues_opened' }) {
export default function ProjectsBubble({ repos = [], selectedAuthor = 'all', metric = 'issues_opened', onRepoClick }) {
  // Build bubble points: x = PR activity, y = Issue activity, r = selected metric count
  const points = repos.map(r => {
    const byAuthor = r.byAuthor || {};
    let metricValue = 0;
    let prs = 0;
    let issues = 0;
    if (selectedAuthor === 'all') {
      for (const a of Object.keys(byAuthor)) {
        const c = byAuthor[a] || {};
        metricValue += c[metric] || 0;
        prs += (c.prs_opened || 0) + (c.prs_merged || 0) + (c.prs_closed || 0);
        issues += (c.issues_opened || 0) + (c.issues_closed || 0);
      }
    } else {
      const c = byAuthor[selectedAuthor] || {};
      metricValue = c[metric] || 0;
      prs = (c.prs_opened || 0) + (c.prs_merged || 0) + (c.prs_closed || 0);
      issues = (c.issues_opened || 0) + (c.issues_closed || 0);
    }
    return {
      x: prs,
      y: issues,
      r: scaleRadius(metricValue),
      raw: { repo: r.repo, metricValue, prs, issues }
    };
  }).filter(p => p.raw.metricValue > 0 || p.x > 0 || p.y > 0);

  const data = {
    datasets: [
      {
        label: 'Repositories',
        data: points,
        backgroundColor: 'rgba(75, 135, 185, 0.7)'
      }
    ]
  };

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
      title: { display: true, text: 'Repository contributions (PRs vs Issues)' }
    },
    scales: {
      x: { title: { display: true, text: 'PR activity (count)' }, beginAtZero: true },
      y: { title: { display: true, text: 'Issue activity (count)' }, beginAtZero: true }
    }
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
