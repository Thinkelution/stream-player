import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import ChannelList from './components/ChannelList';
import VideoPlayer from './components/VideoPlayer';
import EPGGuide from './components/EPGGuide';
import Settings from './components/Settings';

function App() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('streamPlayerConfig');
    if (stored) {
      setConfig(JSON.parse(stored));
      fetchPlaylist(JSON.parse(stored));
      fetchEPG(JSON.parse(stored));
    } else {
      fetchPlaylist();
      fetchEPG();
    }
  }, []);

  const getM3uUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_M3U_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/get.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}&type=m3u_plus&output=mpegts`;
    }
    return cfg.m3uUrl || process.env.REACT_APP_M3U_URL;
  };

  const getEpgUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_EPG_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/xmltv.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}`;
    }
    return cfg.epgUrl || process.env.REACT_APP_EPG_URL;
  };

  const fetchPlaylist = async (cfg = null) => {
    try {
      setLoading(true);
      const m3uUrl = getM3uUrl(cfg);
      if (!m3uUrl) throw new Error('No M3U URL configured');

      let m3uContent;

      if (window.electronAPI) {
        m3uContent = await window.electronAPI.fetchM3U(m3uUrl);
      } else {
        const response = await axios.get(m3uUrl);
        m3uContent = response.data;
      }

      const parsed = parseM3U(m3uContent);
      setChannels(parsed);
      if (parsed.length > 0) setSelectedChannel(parsed[0]);
      setError(null);
    } catch (err) {
      setError('Failed to load playlist: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEPG = async (cfg = null) => {
    try {
      const epgUrl = getEpgUrl(cfg);
      if (!epgUrl) {
        console.log('No EPG URL configured');
        return;
      }

      let epgContent;

      if (window.electronAPI) {
        epgContent = await window.electronAPI.fetchEPG(epgUrl);
      } else {
        const response = await axios.get(epgUrl);
        epgContent = response.data;
      }

      const parsed = parseEPG(epgContent);
      setEpgData(parsed);
    } catch (err) {
      console.error('Failed to load EPG:', err);
    }
  };

  const parseM3U = (content) => {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/,(.+)$/);
        const nameMatch = line.match(/tvg-name="([^"]+)"/);
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);

        currentChannel = {
          name: nameMatch ? nameMatch[1] : (match ? match[1] : 'Unknown'),
          logo: logoMatch ? logoMatch[1] : '',
          group: groupMatch ? groupMatch[1] : 'Other',
          url: '',
        };
      } else if (line && !line.startsWith('#') && currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
    return channels;
  };

  const parseEPG = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const epg = {};

    const programmes = xmlDoc.querySelectorAll('programme');
    programmes.forEach((prog) => {
      const channel = prog.getAttribute('channel');
      const start = prog.getAttribute('start');
      const stop = prog.getAttribute('stop');
      const titleElem = prog.querySelector('title');
      const descElem = prog.querySelector('desc');

      if (!epg[channel]) epg[channel] = [];
      epg[channel].push({
        start,
        stop,
        title: titleElem ? titleElem.textContent : 'N/A',
        description: descElem ? descElem.textContent : '',
      });
    });

    return epg;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>StreamPlayer</h1>
        <div className="header-buttons">
          <button onClick={() => setSettingsOpen(true)} className="btn-settings">
            ⚙ Settings
          </button>
          <button onClick={() => fetchPlaylist()} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(cfg) => {
          setConfig(cfg);
          setSettingsOpen(false);
          fetchPlaylist(cfg);
          fetchEPG(cfg);
        }}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="app-container">
        <div className="player-section">
          {selectedChannel && (
            <>
              <VideoPlayer channel={selectedChannel} />
              <EPGGuide channel={selectedChannel} epgData={epgData} />
            </>
          )}
        </div>

        <aside className="sidebar">
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelect={setSelectedChannel}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
