import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { test, expect, vi, describe, afterEach } from 'vitest';
import WeeklyChart from '../WeeklyChart.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return { Line: (props) => React.createElement('div', { 'data-testid': 'chart' }) };
});

afterEach(() => {
  cleanup();
});

const chartData = {
  labels: ['w1','w2'],
  datasets: [
    { label: 'All Contributors', data: [1,2], borderColor: '#005a9c', backgroundColor: 'rgba(0,90,156,0.5)' }
  ]
};

describe('WeeklyChart', () => {
  test('renders WeeklyChart container without crashing', () => {
    render(<WeeklyChart data={chartData} />);
    expect(screen.getByTestId('chart')).toBeDefined();
  });

  test('container has chart-container class', () => {
    const { container } = render(<WeeklyChart data={chartData} />);
    expect(container.firstChild.classList.contains('chart-container')).toBe(true);
  });

  test('container has 300px height style', () => {
    const { container } = render(<WeeklyChart data={chartData} />);
    expect(container.firstChild.style.height).toBe('300px');
  });

  test('renders with multiple datasets', () => {
    const multiData = {
      labels: ['w1', 'w2', 'w3'],
      datasets: [
        { label: 'All Contributors', data: [1, 2, 3] },
        { label: 'Staff', data: [0, 1, 2] },
        { label: 'Community', data: [1, 1, 1] },
      ],
    };
    render(<WeeklyChart data={multiData} />);
    expect(screen.getByTestId('chart')).toBeDefined();
  });

  test('renders with empty labels and datasets arrays', () => {
    const emptyData = { labels: [], datasets: [] };
    render(<WeeklyChart data={emptyData} />);
    expect(screen.getByTestId('chart')).toBeDefined();
  });

  test('renders with a single data point', () => {
    const singleData = {
      labels: ['2025-12-01'],
      datasets: [{ label: 'All Contributors', data: [5] }],
    };
    render(<WeeklyChart data={singleData} />);
    expect(screen.getByTestId('chart')).toBeDefined();
  });

  test('renders with many weeks of data', () => {
    const manyWeeks = {
      labels: Array.from({ length: 52 }, (_, i) => `week-${i + 1}`),
      datasets: [
        {
          label: 'All Contributors',
          data: Array.from({ length: 52 }, (_, i) => i * 2),
        },
      ],
    };
    render(<WeeklyChart data={manyWeeks} />);
    expect(screen.getByTestId('chart')).toBeDefined();
  });
});
