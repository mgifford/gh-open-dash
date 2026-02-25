import React, { useMemo } from 'react';
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

function PRMetricsChart({ data, weeks, selectedAuthor = 'all' }) {
  const chartData = useMemo(() => {
    if (!data || !data.pr_details || !weeks || weeks.length === 0) {
      return null;
    }

    const prDetails = data.pr_details || [];
    const filteredPRs = prDetails.filter(pr => weeks.includes(pr.week_start));

    // Group by week and calculate averages
    const weeklyStats = {};
    
    weeks.forEach(week => {
      weeklyStats[week] = {
        mergeTimes: [],
        sizes: []
      };
    });

    filteredPRs.forEach(pr => {
      if (selectedAuthor !== 'all' && pr.author !== selectedAuthor) {
        return;
      }

      const weekStats = weeklyStats[pr.week_start];
      if (!weekStats) return;

      // Only include merge times for PRs that were actually merged
      if (pr.merge_time_hours !== null && pr.was_merged) {
        weekStats.mergeTimes.push(pr.merge_time_hours);
      }

      // Include size for all PRs
      if (pr.total_changes > 0) {
        weekStats.sizes.push(pr.total_changes);
      }
    });

    // Calculate averages
    const avgMergeTimes = [];
    const avgSizes = [];

    weeks.forEach(week => {
      const stats = weeklyStats[week];
      
      const avgMergeTime = stats.mergeTimes.length > 0
        ? stats.mergeTimes.reduce((a, b) => a + b, 0) / stats.mergeTimes.length
        : null;
      
      const avgSize = stats.sizes.length > 0
        ? stats.sizes.reduce((a, b) => a + b, 0) / stats.sizes.length
        : null;

      avgMergeTimes.push(avgMergeTime);
      avgSizes.push(avgSize);
    });

    return {
      labels: weeks,
      datasets: [
        {
          label: 'Avg Merge Time (hours)',
          data: avgMergeTimes,
          borderColor: 'rgb(107, 92, 255)',
          backgroundColor: 'rgba(107, 92, 255, 0.12)',
          borderWidth: 2,
          pointStyle: 'circle',
          pointRadius: 4,
          tension: 0.2,
          yAxisID: 'y',
        },
        {
          label: 'Avg PR Size (lines changed)',
          data: avgSizes,
          borderColor: 'rgb(0, 120, 212)',
          backgroundColor: 'rgba(0, 120, 212, 0.12)',
          borderWidth: 2,
          pointStyle: 'rect',
          pointRadius: 4,
          tension: 0.2,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data, weeks, selectedAuthor]);

  if (!chartData) {
    return <div className="chart-placeholder">No PR details available yet. Data will appear after collection runs.</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'PR Merge Time & Size Trends',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Hours to Merge'
        },
        beginAtZero: true,
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Lines Changed'
        },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Line options={options} data={chartData} />
    </div>
  );
}

export default PRMetricsChart;
