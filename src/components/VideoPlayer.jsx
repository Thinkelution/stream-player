import React, { useCallback, useEffect, useRef, useState } from 'react';
import HLS from 'hls.js';

const PLAYBACK_START_TIMEOUT_MS = 20000;

function VideoPlayer({ channel, isFavorite, onToggleFavorite }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const startTimerRef = useRef(null);
  const streamSessionRef = useRef(0);
  const stoppedRef = useRef(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);
  const [isStopped, setIsStopped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const isActiveSession = useCallback((sessionId) => streamSessionRef.current === sessionId, []);

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
    setCurrentTime(0);
    setDuration(0);
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
  }, [isActiveSession]);

  const handleVideoProgress = () => {
    const video = videoRef.current;
    if (!video || stoppedRef.current) return;

    if (video.readyState > 0) markPlaybackStarted(streamSessionRef.current);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  };

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
    setCurrentTime(0);
    setDuration(0);

    startTimerRef.current = window.setTimeout(() => {
      reportPlaybackError(
        sessionId,
        'This stream did not start within 20 seconds. Try another channel or refresh the playlist.'
      );
    }, PLAYBACK_START_TIMEOUT_MS);

    if (HLS.isSupported()) {
      const hls = new HLS({
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(HLS.Events.MANIFEST_PARSED, () => {
        if (!isActiveSession(sessionId)) return;

        video.play().catch(() => {
          markPlaybackStarted(sessionId);
        });
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

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
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

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isStopped) {
      setReloadNonce((value) => value + 1);
      return;
    }

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {
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
  };

  const seek = (event) => {
    const video = videoRef.current;
    if (!video || !duration || isStopped) return;

    const nextTime = (Number(event.target.value) / 100) * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const enterFullscreen = () => {
    const videoShell = videoRef.current?.closest('.video-shell');
    if (videoShell?.requestFullscreen) videoShell.requestFullscreen();
  };

  const formatTime = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '0:00';

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const progressValue = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="video-player">
      <div className="player-header">
        <div className="now-playing">
          <div className="channel-logo-large">
            {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
          </div>
          <div>
            <span className="eyebrow">Now playing</span>
            <h2>{channel.name}</h2>
            <p>{channel.group}</p>
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
      <div className="video-shell">
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
          onDurationChange={handleTimeUpdate}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
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
        <div className="player-controls">
          <button type="button" className="control-button primary-control" onClick={togglePlay}>
            {isPlaying && !isStopped ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="control-button stop-control" onClick={() => stopStream(true)} disabled={isStopped}>
            Stop
          </button>
          <span className="time-label">{formatTime(currentTime)}</span>
          <input
            className="seek-slider"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressValue}
            onChange={seek}
            disabled={!duration || isStopped}
            aria-label="Seek stream"
          />
          <span className="time-label">{duration ? formatTime(duration) : 'Live'}</span>
          <button type="button" className="control-button" onClick={toggleMute}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button type="button" className="control-button" onClick={enterFullscreen}>
            Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
