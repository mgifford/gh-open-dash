import React, { useState } from 'react';
import { parseOrgInput, saveOrgOverride, clearOrgOverride } from './orgUtils.js';

function OrgSelector({ currentOrg, defaultOrg, onOrgChange }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  
  const isCustomOrg = currentOrg !== defaultOrg;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const parsed = parseOrgInput(input);
    if (!parsed) {
      setError('Invalid organization format. Try: openplus or https://github.com/openplus');
      return;
    }
    
    // Save to localStorage and trigger change
    if (saveOrgOverride(parsed)) {
      setInput('');
      if (onOrgChange) {
        onOrgChange(parsed);
      }
    } else {
      setError('Failed to save organization');
    }
  };
  
  const handleReset = () => {
    clearOrgOverride();
    setInput('');
    setError('');
    if (onOrgChange) {
      onOrgChange(defaultOrg);
    }
  };
  
  return (
    <div style={{
      marginTop: '32px',
      padding: '20px',
      backgroundColor: '#f9f9f9',
      borderRadius: '8px',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1.1em' }}>
        Choose Organization
      </h3>
      
      <div style={{ marginBottom: '12px', color: '#666', fontSize: '0.95em' }}>
        Current organization: <strong>{currentOrg}</strong>
        {isCustomOrg && (
          <span style={{ marginLeft: '8px', color: '#107c10' }}>
            (custom)
          </span>
        )}
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError('');
            }}
            placeholder="Enter org name or URL..."
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '1em',
              border: error ? '1px solid #e81123' : '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
            aria-label="Organization name or URL"
            aria-describedby="org-help org-error"
          />
          {error && (
            <div id="org-error" style={{ color: '#e81123', fontSize: '0.9em', marginTop: '4px' }}>
              {error}
            </div>
          )}
        </div>
        
        <button
          type="submit"
          className="org-selector-button primary"
        >
          Apply
        </button>
        
        {isCustomOrg && (
          <button
            type="button"
            onClick={handleReset}
            className="org-selector-button secondary"
            aria-label="Reset to default organization"
          >
            Reset
          </button>
        )}
      </form>
      
      <div id="org-help" style={{ fontSize: '0.85em', color: '#666' }}>
        Examples: <code>openplus</code> or <code>https://github.com/openplus</code>
        <br />
        The selected organization is reflected in the URL (<code>?org=</code>) and saved in browser
        storage. Note: the dashboard displays pre-generated data — to see metrics for a different
        org you need to run the data pipeline for that org and redeploy.
      </div>
    </div>
  );
}

export default OrgSelector;
