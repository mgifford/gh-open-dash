import React from 'react';

function Leaderboard({ items, onSelectAuthor, selectedAuthor, staffSet }) {
  // Show top 25
  const topItems = items.slice(0, 25);

  return (
    <div className="leaderboard">
      {topItems.length === 0 ? (
        <p>No activity found in this period.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Author</th>
              <th className="num">Count</th>
            </tr>
          </thead>
          <tbody>
            {topItems.map((item, index) => {
              const isStaff = staffSet && staffSet.has(item.author.toLowerCase());
              return (
                <tr
                  key={item.author}
                  className={selectedAuthor === item.author ? 'selected' : ''}
                  onClick={() => onSelectAuthor(item.author)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{index + 1}</td>
                  <td className="author-cell">
                    {item.author}
                    {staffSet && (
                      <span
                        className={`contributor-badge contributor-badge--${isStaff ? 'staff' : 'community'}`}
                        aria-label={isStaff ? 'Org member' : 'Community contributor'}
                        title={isStaff ? 'Org member' : 'Community contributor'}
                      >
                        {isStaff ? '🏢' : '🌍'}
                      </span>
                    )}
                  </td>
                  <td className="num">{item.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {items.length > 25 && (
        <p className="more-info">...and {items.length - 25} more.</p>
      )}
    </div>
  );
}

export default Leaderboard;
