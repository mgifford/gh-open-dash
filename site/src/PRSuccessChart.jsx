import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function PRSuccessChart({ data, weeks, selectedAuthor = 'all' }) {
  if (!data || !weeks || weeks.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  // Calculate PR success rate (merged vs closed without merge)
  const seriesData = data.series || [];
  const filteredSeries = seriesData.filter(s => weeks.includes(s.week_start));

  const merged = [];
  const closedWithoutMerge = [];
  
  filteredSeries.forEach(week => {
    let mergedCount = 0;
    let closedCount = 0;
    
    if (selectedAuthor === 'all') {
      // Sum across all authors
      Object.values(week.byAuthor || {}).forEach(metrics => {
        mergedCount += metrics.prs_merged || 0;
        closedCount += metrics.prs_closed || 0;
      });
    } else {
      // Single author
      const metrics = week.byAuthor?.[selectedAuthor] || {};
      mergedCount = metrics.prs_merged || 0;
      closedCount = metrics.prs_closed || 0;
    }
    
    // Closed without merge = total closed - merged
    const closedWithoutMergeCount = Math.max(0, closedCount - mergedCount);
    
    merged.push(mergedCount);
    closedWithoutMerge.push(closedWithoutMergeCount);
  });

  const chartData = {
    labels: weeks,
    datasets: [
      {
        label: 'PRs Merged',
        data: merged,
        backgroundColor: 'rgba(16, 124, 16, 0.7)',
        borderColor: 'rgb(16, 124, 16)',
        borderWidth: 1,
      },
      {
        label: 'PRs Closed (Not Merged)',
        data: closedWithoutMerge,
        backgroundColor: 'rgba(232, 17, 35, 0.7)',
        borderColor: 'rgb(232, 17, 35)',
        borderWidth: 1,
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
        text: 'PR Success Rate: Merged vs Closed Without Merge',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        ticks: {
          precision: 0
        }
      },
      x: {
        stacked: true,
      }
    }
  };

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Bar options={options} data={chartData} />
    </div>
  );
}

export default PRSuccessChart;
