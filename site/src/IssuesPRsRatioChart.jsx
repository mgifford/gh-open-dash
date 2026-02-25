import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function IssuesPRsRatioChart({ data, weeks, selectedAuthor = 'all' }) {
  if (!data || !weeks || weeks.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  const seriesData = data.series || [];
  const filteredSeries = seriesData.filter(s => weeks.includes(s.week_start));

  const issuesData = [];
  const prsData = [];
  
  filteredSeries.forEach(week => {
    let issuesCount = 0;
    let prsCount = 0;
    
    if (selectedAuthor === 'all') {
      // Sum across all authors
      Object.values(week.byAuthor || {}).forEach(metrics => {
        issuesCount += metrics.issues_opened || 0;
        prsCount += metrics.prs_opened || 0;
      });
    } else {
      // Single author
      const metrics = week.byAuthor?.[selectedAuthor] || {};
      issuesCount = metrics.issues_opened || 0;
      prsCount = metrics.prs_opened || 0;
    }
    
    issuesData.push(issuesCount);
    prsData.push(prsCount);
  });

  const chartData = {
    labels: weeks,
    datasets: [
      {
        label: 'Issues Opened',
        data: issuesData,
        borderColor: 'rgb(168, 0, 0)',
        backgroundColor: 'rgba(168, 0, 0, 0.12)',
        borderWidth: 2,
        pointStyle: 'diamond',
        pointRadius: 4,
        tension: 0.2,
      },
      {
        label: 'PRs Opened',
        data: prsData,
        borderColor: 'rgb(0, 90, 156)',
        backgroundColor: 'rgba(0, 90, 156, 0.12)',
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: 4,
        tension: 0.2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Issues vs PRs Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Line options={options} data={chartData} />
    </div>
  );
}

export default IssuesPRsRatioChart;
