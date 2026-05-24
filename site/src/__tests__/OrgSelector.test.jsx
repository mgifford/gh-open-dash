import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OrgSelector from '../OrgSelector.jsx';

describe('OrgSelector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render with current org', () => {
    render(<OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />);
    expect(screen.getByText(/Current organization:/)).toBeDefined();
    expect(screen.getByText(/civicactions/)).toBeDefined();
  });

  it('should pre-fill input with the current org from URL or localStorage', () => {
    render(<OrgSelector currentOrg="chaoss" defaultOrg="civicactions" />);
    const input = screen.getByRole('textbox');
    expect(input.value).toBe('chaoss');
  });

  it('should pre-fill input with default org when org matches default', () => {
    render(<OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />);
    const input = screen.getByRole('textbox');
    expect(input.value).toBe('civicactions');
  });

  it('should show custom indicator when org differs from default', () => {
    const { container } = render(<OrgSelector currentOrg="openplus" defaultOrg="civicactions" />);
    expect(container.textContent).toContain('openplus');
    expect(container.textContent).toContain('(custom)');
  });

  it('should not show custom indicator when org matches default', () => {
    const { container } = render(<OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />);
    expect(container.textContent).not.toContain('(custom)');
  });

  it('should show reset button only when using custom org', () => {
    const { container: container1 } = render(
      <OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />
    );
    expect(container1.textContent).not.toContain('Reset');
    
    const { container: container2 } = render(
      <OrgSelector currentOrg="openplus" defaultOrg="civicactions" />
    );
    expect(container2.textContent).toContain('Reset');
  });

  it('should show error for invalid input', () => {
    const { container } = render(<OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />);
    
    const input = screen.getByRole('textbox');
    const applyButton = screen.getByRole('button', { name: /Apply/ });
    
    fireEvent.change(input, { target: { value: 'invalid org!' } });
    fireEvent.click(applyButton);
    
    expect(container.textContent).toContain('Invalid organization format');
  });

  it('should call onOrgChange with parsed org on valid submit', () => {
    const onOrgChange = vi.fn();
    render(
      <OrgSelector 
        currentOrg="civicactions" 
        defaultOrg="civicactions" 
        onOrgChange={onOrgChange}
      />
    );
    
    const input = screen.getByRole('textbox');
    const applyButton = screen.getByRole('button', { name: /Apply/ });
    
    fireEvent.change(input, { target: { value: 'openplus' } });
    fireEvent.click(applyButton);
    
    expect(onOrgChange).toHaveBeenCalledWith('openplus');
  });

  it('should parse and submit GitHub URLs', () => {
    const onOrgChange = vi.fn();
    render(
      <OrgSelector 
        currentOrg="civicactions" 
        defaultOrg="civicactions" 
        onOrgChange={onOrgChange}
      />
    );
    
    const input = screen.getByRole('textbox');
    const applyButton = screen.getByRole('button', { name: /Apply/ });
    
    fireEvent.change(input, { target: { value: 'https://github.com/openplus' } });
    fireEvent.click(applyButton);
    
    expect(onOrgChange).toHaveBeenCalledWith('openplus');
  });


  it('should cache a valid GitHub URL org in localStorage for future visits', () => {
    const onOrgChange = vi.fn();
    render(
      <OrgSelector 
        currentOrg="civicactions" 
        defaultOrg="civicactions" 
        onOrgChange={onOrgChange}
      />
    );

    const input = screen.getByRole('textbox');
    const applyButton = screen.getByRole('button', { name: /Apply/ });

    fireEvent.change(input, { target: { value: 'https://github.com/chaoss' } });
    fireEvent.click(applyButton);

    expect(onOrgChange).toHaveBeenCalledWith('chaoss');
    expect(localStorage.getItem('gh-open-dash-org')).toBe('chaoss');
  });

  it('should call onOrgChange with default org on reset', () => {
    const onOrgChange = vi.fn();
    const { container } = render(
      <OrgSelector 
        currentOrg="openplus" 
        defaultOrg="civicactions" 
        onOrgChange={onOrgChange}
      />
    );
    
    const buttons = container.querySelectorAll('button');
    const resetButton = Array.from(buttons).find(btn => btn.textContent.includes('Reset'));
    expect(resetButton).toBeDefined();
    
    fireEvent.click(resetButton);
    
    expect(onOrgChange).toHaveBeenCalledWith('civicactions');
  });

  it('should clear error when input changes', () => {
    const { container } = render(<OrgSelector currentOrg="civicactions" defaultOrg="civicactions" />);
    
    const input = screen.getByRole('textbox');
    const applyButton = screen.getByRole('button', { name: /Apply/ });
    
    // Trigger error
    fireEvent.change(input, { target: { value: 'invalid org!' } });
    fireEvent.click(applyButton);
    expect(container.textContent).toContain('Invalid organization format');
    
    // Change input again
    fireEvent.change(input, { target: { value: 'validorg' } });
    expect(container.textContent).not.toContain('Invalid organization format');
  });
});
