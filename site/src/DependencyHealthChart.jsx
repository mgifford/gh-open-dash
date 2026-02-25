import React from 'react';
import { Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

/**
 * DependencyHealthChart - Visualizes repository dependencies from Ecosyste.ms
 * 
 * Shows a bubble chart where:
 * - X-axis: Number of dependencies
 * - Y-axis: Number of dependent repositories (reverse dependencies)
 * - Bubble size: Health score
 * - Color: Language
 */
function DependencyHealthChart({ data }) {
  if (!data || !data.ecosystems || !data.ecosystems.repositories || data.ecosystems.repositories.length === 0) {
    return (
      <div className="chart-container">
        <h3>🔗 Repository Dependencies & Impact</h3>
        <p className="no-data">
          No Ecosyste.ms dependency data available yet.
        </p>
      </div>
    );
  }

  // Filter repos with dependency data
  const reposWithDeps = data.ecosystems.repositories.filter(r => 
    (r.dependency_count > 0 || r.dependent_repos_count > 0) && r.health_score !== null
  );

  if (reposWithDeps.length === 0) {
    return (
      <div className="chart-container">
        <h3>🔗 Repository Dependencies & Impact</h3>
        <p className="no-data">No dependency data available</p>
      </div>
    );
  }

  // Group by language and create color mapping
  const languages = [...new Set(reposWithDeps.map(r => r.language).filter(Boolean))];
  const colorMap = {
    'JavaScript': 'rgba(241, 224, 90, 0.7)',
    'TypeScript': 'rgba(0, 122, 204, 0.7)',
    'Python': 'rgba(53, 114, 165, 0.7)',
    'Java': 'rgba(176, 114, 25, 0.7)',
    'Ruby': 'rgba(204, 52, 45, 0.7)',
    'Go': 'rgba(0, 173, 216, 0.7)',
    'PHP': 'rgba(119, 123, 180, 0.7)',
    'C++': 'rgba(243, 75, 125, 0.7)',
    'C#': 'rgba(23, 134, 0, 0.7)',
    'Rust': 'rgba(222, 165, 132, 0.7)',
  };

  const getColor = (language) => {
    return colorMap[language] || 'rgba(128, 128, 128, 0.7)';
  };

  // Create datasets grouped by language
  const datasets = languages.map(lang => {
    const langRepos = reposWithDeps.filter(r => r.language === lang);
    return {
      label: lang,
      data: langRepos.map(r => ({
        x: r.dependency_count || 0,
        y: r.dependent_repos_count || 0,
        r: Math.max(5, (r.health_score || 50) / 5), // Size based on health
        repo: r.repo,
        health: r.health_score,
      })),
      backgroundColor: getColor(lang),
      borderColor: getColor(lang).replace('0.7', '1'),
      borderWidth: 1,
    };
  });

  // Add repos without language
  const reposNoLang = reposWithDeps.filter(r => !r.language);
  if (reposNoLang.length > 0) {
    datasets.push({
      label: 'Other',
      data: reposNoLang.map(r => ({
        x: r.dependency_count || 0,
        y: r.dependent_repos_count || 0,
        r: Math.max(5, (r.health_score || 50) / 5),
        repo: r.repo,
        health: r.health_score,
      })),
      backgroundColor: 'rgba(128, 128, 128, 0.7)',
      borderColor: 'rgba(128, 128, 128, 1)',
      borderWidth: 1,
    });
  }

  const chartData = {
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Repository Dependencies & Impact',
        font: {
          size: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const point = context.raw;
            return [
              `${point.repo}`,
              `Dependencies: ${point.x}`,
              `Dependents: ${point.y}`,
              `Health: ${point.health}%`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'Number of Dependencies',
        },
        beginAtZero: true,
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Number of Dependent Repositories',
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="chart-container">
      <h3>🔗 Repository Dependencies & Impact</h3>
      <div style={{ height: '500px' }}>
        <Bubble data={chartData} options={options} />
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <p style={{ fontStyle: 'italic' }}>
          Bubble size represents health score. Position shows dependency count (X) vs. how many other repos depend on it (Y).
          Data provided by Ecosyste.ms.
        </p>
      </div>
    </div>
  );
}

export default DependencyHealthChart;
