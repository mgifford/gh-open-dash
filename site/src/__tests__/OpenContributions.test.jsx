import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { test, expect, describe, afterEach } from 'vitest';
import OpenContributions from '../OpenContributions.jsx';

afterEach(() => {
  cleanup();
});

describe('OpenContributions', () => {
  test('shows no-data message when no data provided', () => {
    render(<OpenContributions />);
    expect(screen.getByText(/No open-contributions data available/i)).toBeDefined();
  });

  test('shows no-data message when data has no open_contributions property', () => {
    render(<OpenContributions data={{}} />);
    expect(screen.getByText(/No open-contributions data available/i)).toBeDefined();
  });

  test('shows no-data message when open_contributions array is empty', () => {
    render(<OpenContributions data={{ open_contributions: [] }} />);
    expect(screen.getByText(/No open-contributions data available/i)).toBeDefined();
  });

  test('no-data state mentions how to enable collection', () => {
    render(<OpenContributions />);
    expect(screen.getByText(/collectOpenContributions/i)).toBeDefined();
  });

  test('shows count of repos that publish a descriptor', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: { version: '1.0' } },
        { repo: 'org/repo-b', has_descriptor: false },
        { repo: 'org/repo-c', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.getByText(/1 of 3 tracked repos publish/i)).toBeDefined();
  });

  test('shows checkmark emoji for repos with a descriptor', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
      ],
    };
    render(<OpenContributions data={data} />);
    const listItems = document.querySelectorAll('li');
    expect(listItems.length).toBeGreaterThan(0);
    expect(listItems[0].textContent).toContain('✅');
  });

  test('shows empty square emoji for repos without a descriptor when all are shown', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    const toggle = screen.getByRole('button', { name: /Show all 2 checked repos/i });
    fireEvent.click(toggle);
    const listItems = document.querySelectorAll('li');
    const noDescriptorItem = Array.from(listItems).find(li => li.textContent.includes('org/repo-b'));
    expect(noDescriptorItem.textContent).toContain('⬜');
  });

  test('shows message when none of the tracked repos have a descriptor', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: false },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.getByText(/None of the tracked repositories currently publish/i)).toBeDefined();
  });

  test('shows toggle button when some repos lack descriptors', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.getByRole('button', { name: /Show all 2 checked repos/i })).toBeDefined();
  });

  test('does not show toggle button when all repos have descriptors', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: true },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.queryByRole('button', { name: /Show all/i })).toBeNull();
  });

  test('toggle button reveals repos without descriptors when clicked', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    // repo-b is hidden initially
    expect(screen.queryByText('org/repo-b')).toBeNull();
    const toggle = screen.getByRole('button', { name: /Show all 2 checked repos/i });
    fireEvent.click(toggle);
    expect(screen.getByText('org/repo-b')).toBeDefined();
  });

  test('toggle button text changes to collapse after expanding', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    const toggle = screen.getByRole('button', { name: /Show all 2 checked repos/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Show only repos with descriptors/i })).toBeDefined();
  });

  test('clicking toggle a second time re-hides repos without descriptors', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
        { repo: 'org/repo-b', has_descriptor: false },
      ],
    };
    render(<OpenContributions data={data} />);
    const toggle = screen.getByRole('button', { name: /Show all 2 checked repos/i });
    fireEvent.click(toggle); // expand
    fireEvent.click(screen.getByRole('button', { name: /Show only repos with descriptors/i })); // collapse
    expect(screen.queryByText('org/repo-b')).toBeNull();
  });

  test('shows View button for repos that have a descriptor object', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: { version: '1.0' } },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.getByRole('button', { name: /View/i })).toBeDefined();
  });

  test('does not show View button for repos without a descriptor object', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: null },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.queryByRole('button', { name: /View/i })).toBeNull();
  });

  test('View button expands descriptor detail', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: { version: '1.0' } },
      ],
    };
    render(<OpenContributions data={data} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByText('version:')).toBeDefined();
  });

  test('View button label changes to Hide after clicking', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: { version: '1.0' } },
      ],
    };
    render(<OpenContributions data={data} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByRole('button', { name: /Hide/i })).toBeDefined();
  });

  test('Hide button collapses descriptor detail', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true, descriptor: { version: '1.0' } },
      ],
    };
    render(<OpenContributions data={data} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hide/i }));
    expect(screen.queryByText('version:')).toBeNull();
  });

  test('descriptor detail renders object values as JSON', () => {
    const data = {
      open_contributions: [
        {
          repo: 'org/repo-a',
          has_descriptor: true,
          descriptor: { contacts: [{ name: 'Admin', email: 'admin@example.com' }] },
        },
      ],
    };
    render(<OpenContributions data={data} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByText(/Admin/)).toBeDefined();
  });

  test('singular form used when there is exactly one repo', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
      ],
    };
    render(<OpenContributions data={data} />);
    expect(screen.getByText(/1 of 1 tracked repo publishes/i)).toBeDefined();
  });

  test('includes link to the open-contributions spec', () => {
    const data = {
      open_contributions: [
        { repo: 'org/repo-a', has_descriptor: true },
      ],
    };
    render(<OpenContributions data={data} />);
    const specLink = document.querySelector('a[href*="open-contributions-descriptor"]');
    expect(specLink).not.toBeNull();
  });
});
