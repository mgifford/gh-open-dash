import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function RepoStarsChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || !data.repo_stars || data.repo_stars.length === 0) {
      return null;
    }

    // Get the latest star count for each repo
    const repoStarsMap = new Map();
    
    data.repo_stars.forEach(entry => {
      const existing = repoStarsMap.get(entry.repo);
      if (!existing || entry.week_start > existing.week_start) {
        repoStarsMap.set(entry.repo, entry);
      }
    });

    // Sort by star count and take top 20
    const sortedRepos = Array.from(repoStarsMap.values())
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 20);

    return {
      labels: sortedRepos.map(r => r.repo.split('/')[1] || r.repo),
      datasets: [
        {
          label: 'GitHub Stars',
          data: sortedRepos.map(r => r.stars),
          backgroundColor: 'rgba(255, 206, 86, 0.7)',
          borderColor: 'rgb(255, 206, 86)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  if (!chartData) {
    return <div className="chart-placeholder">No repository star data available yet. Data will appear after collection runs.</div>;
  }

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
        text: 'Top Repositories by Stars',
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '500px' }}>
      <Bar options={options} data={chartData} />
    </div>
  );
}

export default RepoStarsChart;
