import { fmt } from '../../lib/format';
import { displayName, hashColor } from '../../lib/platforms';

function RankingRow({ platform, seconds, selected, onSelect, indent }) {
  return (
    <button
      className={`ranking-row ${indent ? 'ranking-row--child' : ''} ${selected === platform ? 'active' : ''}`}
      onClick={() => onSelect(selected === platform ? null : platform)}
    >
      <span className="ranking-dot" style={{ background: hashColor(platform) }} />
      <span className="ranking-name" style={{ color: hashColor(platform) }}>
        {displayName(platform)}
      </span>
      <span className="ranking-leader" />
      <span className="ranking-time">{fmt(seconds)}</span>
    </button>
  );
}

export function AppRanking({ items, selected, onSelect }) {
  if (!items.length) {
    return <p className="insight-empty">No data yet.</p>;
  }
  return (
    <div className="ranking-list">
      {items.map(({ platform, seconds, children }) => (
        <div key={platform} className="ranking-group">
          <RankingRow
            platform={platform} seconds={seconds}
            selected={selected} onSelect={onSelect} indent={false}
          />
          {children && children.length > 0 && (
            <div className="ranking-children">
              {children.map(c => (
                <RankingRow
                  key={c.platform}
                  platform={c.platform} seconds={c.seconds}
                  selected={selected} onSelect={onSelect} indent={true}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RightHeader({ platform, total, onBack }) {
  return (
    <div className="right-header">
      <button className="back-btn" onClick={onBack}>‹ Back</button>
      <span className="right-header-name" style={{ color: hashColor(platform) }}>
        {displayName(platform)}
      </span>
      <span className="right-header-total">{fmt(total)}</span>
    </div>
  );
}
