import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HLS from 'hls.js';

const PLAYBACK_START_TIMEOUT_MS = 20000;

function VideoPlayer({ channel, channels = [], channelListLabel = 'Channels', fullscreenPrograms = [], selectedChannel, onSelectChannel, isFavorite, onToggleFavorite, getChannelKey }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const startTimerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const drawerTimerRef = useRef(null);
  const streamSessionRef = useRef(0);
  const stoppedRef = useRef(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);
  const [isStopped, setIsStopped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(-1);
  const [captions, setCaptions] = useState([]);
  const [selectedCaption, setSelectedCaption] = useState(-1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [channelDrawerVisible, setChannelDrawerVisible] = useState(false);

  const isActiveSession = useCallback((sessionId) => streamSessionRef.current === sessionId, []);

  const keyForChannel = useCallback((item) => {
    if (!item) return '';
    if (getChannelKey) return getChannelKey(item);
    return `${item.name}|${item.group}|${item.contentType || 'live'}|${item.streamId || item.seriesId || item.url}`;
  }, [getChannelKey]);

  const fullscreenChannels = useMemo(() => {
    if (!channels.length) return [];

    const currentKey = keyForChannel(selectedChannel || channel);
    const currentIndex = Math.max(0, channels.findIndex((item) => keyForChannel(item) === currentKey));
    const start = Math.max(0, currentIndex - 18);
    const end = Math.min(channels.length, currentIndex + 19);
    return channels.slice(start, end);
  }, [channels, selectedChannel, channel, keyForChannel]);


  const destroyHls = useCallback((hls = hlsRef.current) => {
    if (hls) hls.destroy();
    if (hlsRef.current === hls) hlsRef.current = null;
  }, []);

  const resetVideoElement = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.removeAttribute('src');
    video.load();
  }, []);

  const stopStream = useCallback((manual = true) => {
    streamSessionRef.current += 1;
    stoppedRef.current = manual;
    window.clearTimeout(startTimerRef.current);
    destroyHls();
    resetVideoElement();
    setIsBuffering(false);
    setPlaybackError(null);
    setIsPlaying(false);
    setLevels([]);
    setCaptions([]);
    setControlsVisible(true);
    if (manual) setIsStopped(true);
  }, [destroyHls, resetVideoElement]);

  const markPlaybackStarted = useCallback((sessionId) => {
    if (!isActiveSession(sessionId)) return;

    window.clearTimeout(startTimerRef.current);
    setIsBuffering(false);
    setPlaybackError(null);
    setIsStopped(false);
    setIsPlaying(!videoRef.current?.paused);
  }, [isActiveSession]);

  const reportPlaybackError = useCallback((sessionId, message) => {
    if (!isActiveSession(sessionId)) return;

    window.clearTimeout(startTimerRef.current);
    setPlaybackError(message);
    setIsBuffering(false);
    setIsPlaying(false);
    setControlsVisible(true);
  }, [isActiveSession]);

  const handleVideoProgress = () => {
    const video = videoRef.current;
    if (!video || stoppedRef.current) return;

    if (video.readyState > 0) markPlaybackStarted(streamSessionRef.current);
  };

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(controlsTimerRef.current);

    if (!videoRef.current?.paused && !stoppedRef.current && !playbackError) {
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2200);
    }
  }, [playbackError]);


  const showChannelDrawerTemporarily = useCallback(() => {
    setChannelDrawerVisible(true);
    window.clearTimeout(drawerTimerRef.current);
    drawerTimerRef.current = window.setTimeout(() => {
      setChannelDrawerVisible(false);
    }, 2600);
  }, []);

  const handleShellMouseMove = useCallback((event) => {
    showControlsTemporarily();

    if (!isFullscreen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const isInRightEdge = rect.right - event.clientX <= 120;
    const isAboveControlBar = rect.bottom - event.clientY > 92;
    if (isInRightEdge && isAboveControlBar) showChannelDrawerTemporarily();
  }, [isFullscreen, showChannelDrawerTemporarily, showControlsTemporarily]);

  const keepChannelDrawerOpen = useCallback(() => {
    window.clearTimeout(drawerTimerRef.current);
    setChannelDrawerVisible(true);
  }, []);

  const hideChannelDrawerLater = useCallback(() => {
    window.clearTimeout(drawerTimerRef.current);
    drawerTimerRef.current = window.setTimeout(() => {
      setChannelDrawerVisible(false);
    }, 1000);
  }, []);


  useEffect(() => {
    const onFullscreenChange = () => {
      const videoShell = videoRef.current?.closest('.video-shell');
      const fullscreenElement = document.fullscreenElement;
      const nextIsFullscreen = Boolean(videoShell && fullscreenElement === videoShell);
      setIsFullscreen(nextIsFullscreen);
      if (!nextIsFullscreen) setChannelDrawerVisible(false);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.clearTimeout(drawerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!channel || !videoRef.current) return undefined;

    const sessionId = streamSessionRef.current + 1;
    streamSessionRef.current = sessionId;

    const video = videoRef.current;
    const url = channel.url;
    window.clearTimeout(startTimerRef.current);
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();
    stoppedRef.current = false;
    setIsStopped(false);
    setIsBuffering(true);
    setPlaybackError(null);
    setIsPlaying(false);
    setLevels([]);
    setSelectedLevel(-1);
    setCaptions([]);
    setSelectedCaption(-1);
    setControlsVisible(true);

    startTimerRef.current = window.setTimeout(() => {
      reportPlaybackError(
        sessionId,
        'This stream did not start within 20 seconds. Try another channel or refresh the playlist.'
      );
    }, PLAYBACK_START_TIMEOUT_MS);

    const shouldUseHls = HLS.isSupported() && /\.m3u8(?:$|[?#])/i.test(url);

    if (shouldUseHls) {
      const hls = new HLS({
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(HLS.Events.MANIFEST_PARSED, () => {
        if (!isActiveSession(sessionId)) return;

        setLevels(hls.levels || []);
        setCaptions(hls.subtitleTracks || []);
        video.play().catch(() => {
          markPlaybackStarted(sessionId);
        });
      });

      hls.on(HLS.Events.SUBTITLE_TRACKS_UPDATED, () => {
        if (!isActiveSession(sessionId)) return;
        setCaptions(hls.subtitleTracks || []);
      });

      hls.on(HLS.Events.ERROR, (event, data) => {
        if (!isActiveSession(sessionId)) return;

        console.error('HLS error:', data);
        if (data.fatal) {
          reportPlaybackError(sessionId, 'Unable to play this stream. Try another channel or refresh the playlist.');
        }
      });

      return () => {
        if (isActiveSession(sessionId)) streamSessionRef.current += 1;
        window.clearTimeout(startTimerRef.current);
        destroyHls(hls);
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl') || channel.contentType === 'movie' || channel.contentType === 'series') {
      video.src = url;
      video.play().catch(() => markPlaybackStarted(sessionId));

      return () => {
        if (isActiveSession(sessionId)) streamSessionRef.current += 1;
        window.clearTimeout(startTimerRef.current);
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    reportPlaybackError(sessionId, 'This stream format is not supported on this device.');
    return undefined;
  }, [channel, reloadNonce, destroyHls, isActiveSession, markPlaybackStarted, reportPlaybackError]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (isPlaying && !isBuffering && !isStopped && !playbackError) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2200);
    } else {
      window.clearTimeout(controlsTimerRef.current);
      setControlsVisible(true);
    }

    return () => window.clearTimeout(controlsTimerRef.current);
  }, [isPlaying, isBuffering, isStopped, playbackError]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isStopped) {
      setReloadNonce((value) => value + 1);
      return;
    }

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        showControlsTemporarily();
      }).catch(() => {
        setPlaybackError('Unable to resume this stream. Try another channel.');
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
    showControlsTemporarily();
  };

  const changeVolume = (event) => {
    const nextVolume = Number(event.target.value);
    const video = videoRef.current;
    setVolume(nextVolume);
    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
      setIsMuted(video.muted);
    }
    showControlsTemporarily();
  };

  const changeLevel = (event) => {
    const level = Number(event.target.value);
    setSelectedLevel(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
    showControlsTemporarily();
  };

  const changeCaption = (event) => {
    const track = Number(event.target.value);
    setSelectedCaption(track);
    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = track !== -1;
      hlsRef.current.subtitleTrack = track;
    }
    showControlsTemporarily();
  };

  const enterFullscreen = () => {
    const videoShell = videoRef.current?.closest('.video-shell');
    if (videoShell?.requestFullscreen) videoShell.requestFullscreen();
  };

  const typeLabel = channel.contentType === 'movie' ? 'Movie' : channel.contentType === 'series' ? 'Series' : 'Now playing';

  return (
    <div className="video-player">
      <div className="player-header">
        <div className="now-playing">
          <div className="channel-logo-large">
            {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
          </div>
          <div>
            <span className="eyebrow">{typeLabel}</span>
            <h2>{channel.name}</h2>
            <p>{channel.episodeTitle || channel.group}</p>
          </div>
        </div>
        <button
          className={`favorite-action ${isFavorite ? 'active' : ''}`}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★ Favorite' : '☆ Add Favorite'}
        </button>
      </div>
      <div className="video-shell" onMouseMove={handleShellMouseMove} onFocus={showControlsTemporarily}>
        {isBuffering && !isStopped && (
          <div className="video-overlay">
            <div className="spinner" />
            <span>Starting stream</span>
          </div>
        )}
        {isStopped && (
          <div className="video-overlay stopped-overlay">
            <strong>Stream stopped</strong>
            <span>Press Play or select a channel to start streaming again.</span>
          </div>
        )}
        {playbackError && !isStopped && (
          <div className="video-overlay error-overlay">
            <strong>Playback issue</strong>
            <span>{playbackError}</span>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          onLoadedMetadata={() => markPlaybackStarted(streamSessionRef.current)}
          onLoadedData={() => markPlaybackStarted(streamSessionRef.current)}
          onCanPlay={() => markPlaybackStarted(streamSessionRef.current)}
          onPlaying={() => markPlaybackStarted(streamSessionRef.current)}
          onProgress={handleVideoProgress}
          onPlay={() => {
            setIsPlaying(true);
            showControlsTemporarily();
          }}
          onPause={() => {
            setIsPlaying(false);
            setControlsVisible(true);
          }}
          onWaiting={() => {
            if (!stoppedRef.current) setIsBuffering(true);
          }}
          onError={() => {
            if (!stoppedRef.current) {
              reportPlaybackError(
                streamSessionRef.current,
                'Unable to play this stream. Try another channel or refresh the playlist.'
              );
            }
          }}
        />
        {isFullscreen && fullscreenChannels.length > 0 && (
          <div
            className={`fullscreen-channel-drawer ${channelDrawerVisible ? 'visible' : ''}`}
            onMouseEnter={keepChannelDrawerOpen}
            onMouseLeave={hideChannelDrawerLater}
          >
            <div className="fullscreen-drawer-heading">{channelListLabel}</div>
            <div className="fullscreen-drawer-hint">Right edge drawer · ↑ ↓ stays in this list</div>
            <div className="fullscreen-channel-items">
              {fullscreenChannels.map((item) => {
                const active = keyForChannel(item) === keyForChannel(selectedChannel || channel);
                return (
                  <button
                    type="button"
                    key={keyForChannel(item)}
                    className={`fullscreen-channel-item ${active ? 'active' : ''}`}
                    onClick={() => onSelectChannel?.(item)}
                  >
                    <span>{item.name}</span>
                    <small>{item.group}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className={`player-controls ${controlsVisible ? 'visible' : 'is-hidden'}`}>
          <div className="control-left">
            <button type="button" className="icon-control primary-control" onClick={togglePlay} title={isPlaying && !isStopped ? 'Pause' : 'Play'} aria-label={isPlaying && !isStopped ? 'Pause' : 'Play'}>
              {isPlaying && !isStopped ? '⏸' : '▶'}
            </button>
            <button type="button" className="icon-control stop-control" onClick={() => stopStream(true)} disabled={isStopped} title="Stop stream" aria-label="Stop stream">
              ⏹
            </button>
          </div>
          <div className="fullscreen-control-guide" aria-label="Current channel and guide">
            <div className="fullscreen-channel-context">
              <strong>{channel.name}</strong>
              <span>{channel.episodeTitle || channel.group}</span>
            </div>
            {fullscreenPrograms.length > 0 && (
              <div className="fullscreen-guide-strip">
                {fullscreenPrograms.map((program, index) => (
                  <div key={`${program.label}-${program.title}-${index}`} className="fullscreen-guide-item">
                    <span>{program.label}</span>
                    <strong>{program.title}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="control-right">
            <select className="control-select" value={selectedLevel} onChange={changeLevel} title="Bitrate / quality" aria-label="Bitrate / quality">
              <option value={-1}>Auto</option>
              {levels.map((level, index) => (
                <option key={index} value={index}>{level.height ? `${level.height}p` : `Level ${index + 1}`}</option>
              ))}
            </select>
            <select className="control-select" value={selectedCaption} onChange={changeCaption} disabled={!captions.length} title="Closed captions" aria-label="Closed captions">
              <option value={-1}>CC Off</option>
              {captions.map((track, index) => (
                <option key={index} value={index}>{track.name || track.lang || `CC ${index + 1}`}</option>
              ))}
            </select>
            <button type="button" className="icon-control" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input className="volume-slider" type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={changeVolume} aria-label="Volume" />
            <button type="button" className="icon-control" onClick={enterFullscreen} title="Fullscreen" aria-label="Fullscreen">
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
