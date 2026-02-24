import React from 'react';

function WhyOpen({ config }) {
  const whyOpenConfig = config?.transparency?.whyOpen;
  
  if (!whyOpenConfig?.enabled) {
    return null;
  }

  const items = whyOpenConfig?.items || [
    {
      icon: '🌍',
      title: 'Community First',
      description: 'We believe in giving back to the open-source community that has given us so much. Transparency builds trust and fosters collaboration.'
    },
    {
      icon: '📊',
      title: 'Accountability',
      description: 'By sharing our metrics publicly, we hold ourselves accountable to our mission and values, demonstrating our commitment through action.'
    },
    {
      icon: '🚀',
      title: 'Inspire Others',
      description: 'We hope our transparency inspires other organizations to contribute to open source and share their impact with the world.'
    }
  ];

  return (
    <div className="why-open">
      <h2>Why We're Open</h2>
      <div className="why-open-content">
        {items.map((item, index) => (
          <div key={index} className="why-item">
            <h3>{item.icon} {item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WhyOpen;
