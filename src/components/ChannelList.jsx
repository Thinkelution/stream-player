import React, { useState, useMemo } from 'react';

function ChannelList({ channels, selectedChannel, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const groups = useMemo(() => {
    const groupSet = new Set(['All']);
    channels.forEach((ch) => groupSet.add(ch.group));
    return Array.from(groupSet);
  }, [channels]);

  const filtered = useMemo(() => {
    return channels.filter((ch) => {
      const matchesSearch = ch.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'All' || ch.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchTerm, selectedGroup]);

  return (
    <div className="channel-list">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search channels..."
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
            {group}
          </button>
        ))}
      </div>

      <div className="channels">
        {filtered.map((channel, idx) => (
          <div
            key={idx}
            className={`channel-item ${selectedChannel === channel ? 'active' : ''}`}
            onClick={() => onSelect(channel)}
          >
            {channel.logo && <img src={channel.logo} alt={channel.name} />}
            <span>{channel.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChannelList;
