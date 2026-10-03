import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';

const ROW_HEIGHT = 60;
const OVERSCAN = 8;

function ChannelList({ channels, selectedChannel, onSelect, favorites, onToggleFavorite, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const getChannelKey = (channel) => `${channel.name}|${channel.group}|${channel.url}`;
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const isFavorite = (channel) => favoriteSet.has(getChannelKey(channel));

  const groups = useMemo(() => {
    const groupSet = new Set(['All', 'Favorites']);
    channels.forEach((ch) => groupSet.add(ch.group));
    return Array.from(groupSet).filter((group) => group !== 'Favorites' || favorites.length > 0);
  }, [channels, favorites.length]);

  const indexedChannels = useMemo(() => {
    return channels.map((channel) => ({
      channel,
      key: getChannelKey(channel),
      searchName: channel.name.toLowerCase(),
    }));
  }, [channels]);

  const filtered = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return indexedChannels.filter(({ channel: ch, key, searchName }) => {
      const matchesSearch = !normalizedSearch || searchName.includes(normalizedSearch);
      const matchesGroup = selectedGroup === 'All'
        || (selectedGroup === 'Favorites' && favoriteSet.has(key))
        || ch.group === selectedGroup;
      return matchesSearch && matchesGroup;
    }).map(({ channel }) => channel);
  }, [indexedChannels, deferredSearchTerm, selectedGroup, favoriteSet]);

  useEffect(() => {
    setScrollTop(0);
  }, [deferredSearchTerm, selectedGroup]);

  const virtualRows = useMemo(() => {
    const visibleCount = Math.ceil((viewportHeight || 1) / ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(filtered.length, startIndex + visibleCount + OVERSCAN * 2);

    return {
      startIndex,
      rows: filtered.slice(startIndex, endIndex),
      topPad: startIndex * ROW_HEIGHT,
      bottomPad: Math.max(0, (filtered.length - endIndex) * ROW_HEIGHT),
    };
  }, [filtered, scrollTop, viewportHeight]);

  const groupLabel = (group) => {
    if (group === 'All') return `All ${channels.length}`;
    if (group === 'Favorites') return `Favorites ${favorites.length}`;
    return group;
  };

  return (
    <div className="channel-list">
      <div className="sidebar-header">
        <div>
          <h2>Channels</h2>
          <p>{filtered.length} showing</p>
        </div>
        {loading && <span className="mini-spinner" aria-label="Loading channels" />}
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search channels"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="group-filter">
        {groups.map((group) => (
          <button
            key={group}
            className={`group-btn ${selectedGroup === group ? 'active' : ''}`}
            onClick={() => setSelectedGroup(group)}
          >
            {groupLabel(group)}
          </button>
        ))}
      </div>

      <div
        className="channels"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={(node) => {
          if (node && node.clientHeight !== viewportHeight) setViewportHeight(node.clientHeight);
        }}
      >
        {loading && channels.length === 0 ? (
          <div className="channel-list-loading">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </div>
        ) : filtered.length > 0 ? (
          <>
            {virtualRows.topPad > 0 && <div style={{ height: virtualRows.topPad }} />}
            {virtualRows.rows.map((channel) => (
              <div
                key={getChannelKey(channel)}
                className={`channel-item ${selectedChannel === channel ? 'active' : ''}`}
                onClick={() => onSelect(channel)}
              >
                <div className="channel-logo-frame">
                  {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
                </div>
                <div className="channel-copy">
                  <span className="channel-name">{channel.name}</span>
                  <span className="channel-group">{channel.group}</span>
                </div>
                <button
                  className={`favorite-btn ${isFavorite(channel) ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(channel);
                  }}
                  title={isFavorite(channel) ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={isFavorite(channel) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite(channel) ? '★' : '☆'}
                </button>
              </div>
            ))}
            {virtualRows.bottomPad > 0 && <div style={{ height: virtualRows.bottomPad }} />}
          </>
        ) : (
          <div className="empty-list">
            <strong>No channels found</strong>
            <span>Try a different search or category.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelList;
