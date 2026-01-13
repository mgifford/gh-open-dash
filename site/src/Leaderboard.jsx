import React from 'react';

function Leaderboard({ items, onSelectAuthor, selectedAuthor }) {
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
            {topItems.map((item, index) => (
              <tr 
                key={item.author} 
                className={selectedAuthor === item.author ? 'selected' : ''}
                onClick={() => onSelectAuthor(item.author)}
                style={{ cursor: 'pointer' }}
              >
                <td>{index + 1}</td>
                <td className="author-cell">{item.author}</td>
                <td className="num">{item.count}</td>
              </tr>
            ))}
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
