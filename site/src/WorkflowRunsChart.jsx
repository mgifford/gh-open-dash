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

function WorkflowRunsChart({ data, weeks }) {
  const chartData = useMemo(() => {
    if (!data || !data.workflow_runs || data.workflow_runs.length === 0) {
      return null;
    }

    const weekSet = new Set(weeks || []);

    // Aggregate total run count per week
    const weekTotals = {};
    for (const row of data.workflow_runs) {
      if (weeks && weekSet.size > 0 && !weekSet.has(row.week_start)) continue;
      weekTotals[row.week_start] = (weekTotals[row.week_start] || 0) + row.run_count;
    }

    const sortedWeeks = Object.keys(weekTotals).sort();
    if (sortedWeeks.length === 0) return null;

    // Build top-N workflow breakdown for stacked bars
    const workflowTotals = {};
    for (const row of data.workflow_runs) {
      if (weeks && weekSet.size > 0 && !weekSet.has(row.week_start)) continue;
      workflowTotals[row.workflow_name] = (workflowTotals[row.workflow_name] || 0) + row.run_count;
    }

    const topWorkflows = Object.entries(workflowTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const palette = [
      'rgba(0, 90, 156, 0.75)',
      'rgba(16, 124, 16, 0.75)',
      'rgba(168, 0, 0, 0.75)',
      'rgba(255, 140, 0, 0.75)',
      'rgba(107, 92, 255, 0.75)',
      'rgba(0, 164, 180, 0.75)',
      'rgba(93, 64, 55, 0.75)',
      'rgba(100, 100, 100, 0.75)',
    ];

    const datasets = topWorkflows.map((wf, i) => ({
      label: wf,
      data: sortedWeeks.map(w => {
        const match = data.workflow_runs.find(r => r.week_start === w && r.workflow_name === wf);
        return match ? match.run_count : 0;
      }),
      backgroundColor: palette[i % palette.length],
      borderWidth: 0,
      stack: 'stack',
    }));

    // Add "Other" stack if there are more workflows than shown
    if (Object.keys(workflowTotals).length > topWorkflows.length) {
      const otherData = sortedWeeks.map(w => {
        const weekRows = data.workflow_runs.filter(r => r.week_start === w && !topWorkflows.includes(r.workflow_name));
        return weekRows.reduce((sum, r) => sum + r.run_count, 0);
      });
      datasets.push({
        label: 'Other',
        data: otherData,
        backgroundColor: 'rgba(180, 180, 180, 0.6)',
        borderWidth: 0,
        stack: 'stack',
      });
    }

    return { labels: sortedWeeks, datasets };
  }, [data, weeks]);

  if (!chartData) {
    return (
      <div className="chart-placeholder">
        No workflow run data available yet. Enable <code>collectWorkflowRuns</code> in{' '}
        <code>scripts/config.json</code> and re-run the data pipeline.
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'GitHub Actions Workflow Runs by Week',
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: '340px' }}>
      <Bar
        options={options}
        data={chartData}
        aria-label="Stacked bar chart showing GitHub Actions workflow runs per week"
        role="img"
      />
      <p className="visually-hidden">
        GitHub Actions workflow runs by week.
        {chartData.labels.map((week, i) => {
          const total = chartData.datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0);
          return ` Week of ${week}: ${total} run${total !== 1 ? 's' : ''}.`;
        })}
      </p>
    </div>
  );
}

export default WorkflowRunsChart;
