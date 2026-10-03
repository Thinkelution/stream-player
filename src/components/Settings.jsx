import React, { useState, useEffect } from 'react';
import '../styles/Settings.css';

function Settings({ isOpen, onClose, onSave }) {
  const [configMode, setConfigMode] = useState('xtream'); // 'xtream' or 'm3u'
  const [xtreamServer, setXtreamServer] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [fontSize, setFontSize] = useState('compact');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('streamPlayerConfig');
    if (stored) {
      const config = JSON.parse(stored);
      setConfigMode(config.configMode || 'xtream');
      setXtreamServer(config.xtreamServer || '');
      setXtreamUser(config.xtreamUser || '');
      setXtreamPass(config.xtreamPass || '');
      setM3uUrl(config.m3uUrl || '');
      setEpgUrl(config.epgUrl || '');
      setFontSize(config.fontSize || 'compact');
    }
  }, [isOpen]);

  const handleSave = () => {
    setSaving(true);
    const config = {
      configMode,
      xtreamServer,
      xtreamUser,
      xtreamPass,
      m3uUrl,
      epgUrl,
      fontSize,
    };
    localStorage.setItem('streamPlayerConfig', JSON.stringify(config));
    setTimeout(() => {
      setSaving(false);
      onSave(config);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* Config Mode Selection */}
          <div className="config-mode">
            <label>Source Type</label>
            <div className="mode-buttons">
              <button
                className={`mode-btn ${configMode === 'xtream' ? 'active' : ''}`}
                onClick={() => setConfigMode('xtream')}
              >
                Xtream/Stream King
              </button>
              <button
                className={`mode-btn ${configMode === 'm3u' ? 'active' : ''}`}
                onClick={() => setConfigMode('m3u')}
              >
                M3U URL
              </button>
            </div>
          </div>

          {/* Xtream Configuration */}
          {configMode === 'xtream' && (
            <div className="config-section">
              <div className="form-group">
                <label>Server URL</label>
                <input
                  type="text"
                  placeholder="https://your-provider.example"
                  value={xtreamServer}
                  onChange={(e) => setXtreamServer(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Your username"
                  value={xtreamUser}
                  onChange={(e) => setXtreamUser(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={xtreamPass}
                  onChange={(e) => setXtreamPass(e.target.value)}
                />
              </div>

              <div className="info-text">
                The app will automatically construct M3U and EPG URLs from these credentials.
              </div>
            </div>
          )}

          {/* M3U Configuration */}
          {configMode === 'm3u' && (
            <div className="config-section">
              <div className="form-group">
                <label>M3U Playlist URL</label>
                <input
                  type="text"
                  placeholder="http://your-service.com/get.php?username=USER&password=PASS&type=m3u_plus&output=mpegts"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* EPG Configuration */}
          <div className="config-section">
            <div className="form-group">
              <label>EPG URL (Optional)</label>
              <input
                type="text"
                placeholder="http://your-service.com/xmltv.php?username=USER&password=PASS"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="config-section">
            <div className="form-group">
              <label>Text Size</label>
              <div className="mode-buttons compact-toggle">
                <button
                  className={`mode-btn ${fontSize === 'compact' ? 'active' : ''}`}
                  onClick={() => setFontSize('compact')}
                >
                  Compact
                </button>
                <button
                  className={`mode-btn ${fontSize === 'large' ? 'active' : ''}`}
                  onClick={() => setFontSize('large')}
                >
                  Larger
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save & Reload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
