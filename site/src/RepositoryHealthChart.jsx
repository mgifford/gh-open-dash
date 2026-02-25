import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * RepositoryHealthChart - Visualizes repository health scores from Ecosyste.ms
 * 
 * Shows health percentage for repositories with color-coding:
 * - Green (80-100%): Healthy
 * - Yellow (50-79%): Needs attention
 * - Red (<50%): Critical
 */
function RepositoryHealthChart({ data }) {
  if (!data || !data.ecosystems || !data.ecosystems.repositories || data.ecosystems.repositories.length === 0) {
    return (
      <div className="chart-container">
        <h3>📊 Repository Health Scores</h3>
        <p className="no-data">
          No Ecosyste.ms data available yet. Enable <code>collectEcosystemsData</code> in <code>scripts/config.json</code> to collect repository health metrics.
        </p>
      </div>
    );
  }

  // Filter repos with health scores and sort by health (lowest first to highlight issues)
  const reposWithHealth = data.ecosystems.repositories
    .filter(r => r.health_score !== null && r.health_score !== undefined)
    .sort((a, b) => a.health_score - b.health_score);

  if (reposWithHealth.length === 0) {
    return (
      <div className="chart-container">
        <h3>📊 Repository Health Scores</h3>
        <p className="no-data">No health score data available</p>
      </div>
    );
  }

  // Take top 20 repos (lowest health scores to highlight issues)
  const displayRepos = reposWithHealth.slice(0, 20);

  const labels = displayRepos.map(r => r.repo.split('/')[1] || r.repo);
  const healthScores = displayRepos.map(r => r.health_score);
  
  // Color code based on health score
  const backgroundColors = healthScores.map(score => {
    if (score >= 80) return 'rgba(16, 124, 16, 0.7)'; // Green - Healthy
    if (score >= 50) return 'rgba(255, 193, 7, 0.7)'; // Yellow - Needs attention
    return 'rgba(232, 17, 35, 0.7)'; // Red - Critical
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Health Score (%)',
        data: healthScores,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Repository Health Scores (via Ecosyste.ms)',
        font: {
          size: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const repo = displayRepos[context.dataIndex];
            const lines = [`Health: ${context.parsed.x}%`];
            if (repo.maintenance_status) {
              lines.push(`Status: ${repo.maintenance_status}`);
            }
            if (repo.language) {
              lines.push(`Language: ${repo.language}`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Health Score (%)',
        },
      },
      y: {
        ticks: {
          autoSkip: false,
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <h3>📊 Repository Health Scores</h3>
      <div style={{ height: `${Math.max(400, displayRepos.length * 25)}px` }}>
        <Bar data={chartData} options={options} />
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <p>
          <span style={{ color: '#107c10' }}>●</span> Healthy (80-100%) · 
          <span style={{ color: '#ffc107' }}> ●</span> Needs Attention (50-79%) · 
          <span style={{ color: '#e81123' }}> ●</span> Critical (&lt;50%)
        </p>
        <p style={{ fontStyle: 'italic' }}>
          Health scores provided by Ecosyste.ms based on repository activity, maintenance, and community health indicators.
        </p>
      </div>
    </div>
  );
}

export default RepositoryHealthChart;
