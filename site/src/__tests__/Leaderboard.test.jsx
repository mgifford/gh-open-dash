import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, vi, describe, afterEach } from 'vitest';
import Leaderboard from '../Leaderboard.jsx';

afterEach(() => {
  cleanup();
});

const sampleItems = [
  { author: 'alice', count: 10 },
  { author: 'bob', count: 5 },
  { author: 'carol', count: 3 },
];

describe('Leaderboard', () => {
  test('shows no activity message when items list is empty', () => {
    render(<Leaderboard items={[]} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(screen.getByText(/No activity found in this period/i)).toBeDefined();
  });

  test('does not render a table when items list is empty', () => {
    const { container } = render(<Leaderboard items={[]} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(container.querySelector('table')).toBeNull();
  });

  test('renders table rows with author and count', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
    expect(screen.getByText('carol')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    // count 3 and rank 3 both appear — use getAllByText
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  test('renders rank numbers starting from 1', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    expect(rows[0].cells[0].textContent).toBe('1');
    expect(rows[1].cells[0].textContent).toBe('2');
    expect(rows[2].cells[0].textContent).toBe('3');
  });

  test('shows staff badge for org members when staffSet is provided', () => {
    const staffSet = new Set(['alice']);
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} staffSet={staffSet} />);
    const staffBadges = document.querySelectorAll('.contributor-badge--staff');
    expect(staffBadges.length).toBe(1);
    expect(staffBadges[0].getAttribute('aria-label')).toBe('Org member');
  });

  test('shows community badge for non-staff members when staffSet is provided', () => {
    const staffSet = new Set(['alice']);
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} staffSet={staffSet} />);
    const communityBadges = document.querySelectorAll('.contributor-badge--community');
    expect(communityBadges.length).toBe(2); // bob and carol
    expect(communityBadges[0].getAttribute('aria-label')).toBe('Community contributor');
  });

  test('does not show any badges when staffSet is not provided', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(document.querySelectorAll('.contributor-badge').length).toBe(0);
  });

  test('adds selected CSS class to the selected author row', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor="alice" />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    const aliceRow = Array.from(rows).find(r => r.textContent.includes('alice'));
    expect(aliceRow.classList.contains('selected')).toBe(true);
  });

  test('does not add selected class to non-selected rows', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor="alice" />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    const bobRow = Array.from(rows).find(r => r.textContent.includes('bob') && !r.textContent.includes('alice'));
    expect(bobRow.classList.contains('selected')).toBe(false);
  });

  test('calls onSelectAuthor with author name when row is clicked', () => {
    const onSelectAuthor = vi.fn();
    render(<Leaderboard items={sampleItems} onSelectAuthor={onSelectAuthor} selectedAuthor={null} />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    fireEvent.click(rows[0]);
    expect(onSelectAuthor).toHaveBeenCalledWith('alice');
  });

  test('calls onSelectAuthor with correct author when second row is clicked', () => {
    const onSelectAuthor = vi.fn();
    render(<Leaderboard items={sampleItems} onSelectAuthor={onSelectAuthor} selectedAuthor={null} />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    fireEvent.click(rows[1]);
    expect(onSelectAuthor).toHaveBeenCalledWith('bob');
  });

  test('limits display to 25 items even when more are provided', () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => ({ author: `user${i}`, count: 30 - i }));
    render(<Leaderboard items={manyItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    const rows = document.querySelectorAll('.leaderboard tbody tr');
    expect(rows.length).toBe(25);
  });

  test('shows "and N more" message when items exceed 25', () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => ({ author: `user${i}`, count: 30 - i }));
    render(<Leaderboard items={manyItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(screen.getByText(/and 5 more/i)).toBeDefined();
  });

  test('does not show "and more" message when items are 25 or fewer', () => {
    render(<Leaderboard items={sampleItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(screen.queryByText(/and.*more/i)).toBeNull();
  });

  test('does not show "and more" message when items are exactly 25', () => {
    const exactItems = Array.from({ length: 25 }, (_, i) => ({ author: `user${i}`, count: 25 - i }));
    render(<Leaderboard items={exactItems} onSelectAuthor={() => {}} selectedAuthor={null} />);
    expect(screen.queryByText(/and.*more/i)).toBeNull();
  });

  test('staff badge uses case-insensitive matching for author name', () => {
    // staffSet stores lowercase names; component lowercases author before checking
    const staffSet = new Set(['alice']); // lowercase
    const itemsWithUpperCase = [{ author: 'Alice', count: 5 }]; // uppercase in data
    render(<Leaderboard items={itemsWithUpperCase} onSelectAuthor={() => {}} selectedAuthor={null} staffSet={staffSet} />);
    const staffBadges = document.querySelectorAll('.contributor-badge--staff');
    expect(staffBadges.length).toBe(1);
  });
});
