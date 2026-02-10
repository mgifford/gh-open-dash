import React from 'react';
import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
import WeeklyChart from '../WeeklyChart.jsx';

vi.mock('react-chartjs-2', () => {
  const React = require('react');
  return { Line: (props) => React.createElement('div', { 'data-testid': 'chart' }) };
});

const chartData = {
  labels: ['w1','w2'],
  datasets: [
    { label: 'All Contributors', data: [1,2], borderColor: '#005a9c', backgroundColor: 'rgba(0,90,156,0.5)' }
  ]
};

test('renders WeeklyChart container without crashing', () => {
  render(<WeeklyChart data={chartData} />);
  // The chart is replaced by a mocked component; assert it appears
  expect(screen.getByTestId('chart')).toBeDefined();
});
