import { useCallback, useEffect, useRef, useState } from 'react';

export default function usePictureInPicture(videoRef, source, isFullscreen, stopped = false) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(false);
  const supported = Boolean(document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function');

  const exit = useCallback(async () => {
    if (document.pictureInPictureElement === videoRef.current) await document.exitPictureInPicture();
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    generation.current += 1;
    setError('');
    setBusy(false);
    setActive(document.pictureInPictureElement === video);
    const updateReady = () => setReady(Boolean(!stopped && video && video.readyState >= 1 && video.videoWidth > 0));
    const enter = () => setActive(true);
    const leave = () => setActive(false);
    updateReady();
    video?.addEventListener('loadedmetadata', updateReady);
    video?.addEventListener('loadeddata', updateReady);
    video?.addEventListener('resize', updateReady);
    video?.addEventListener('emptied', updateReady);
    video?.addEventListener('enterpictureinpicture', enter);
    video?.addEventListener('leavepictureinpicture', leave);
    return () => {
      generation.current += 1;
      video?.removeEventListener('loadedmetadata', updateReady);
      video?.removeEventListener('loadeddata', updateReady);
      video?.removeEventListener('resize', updateReady);
      video?.removeEventListener('emptied', updateReady);
      video?.removeEventListener('enterpictureinpicture', enter);
      video?.removeEventListener('leavepictureinpicture', leave);
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
    };
  }, [videoRef, source, stopped]);

  useEffect(() => {
    if (isFullscreen) exit().catch(() => setError('Unable to close Picture-in-Picture. Close its floating window and try again.'));
  }, [isFullscreen, exit]);

  const toggle = useCallback(async () => {
    const video = videoRef.current;
    if (!video || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const request = generation.current;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        // Request immediately in the click gesture, before awaiting Electron IPC.
        await video.requestPictureInPicture();
        if (generation.current !== request) {
          if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
          return;
        }
        if (window.electronAPI?.setFullscreen) await window.electronAPI.setFullscreen(false);
        else if (document.fullscreenElement) await document.exitFullscreen();
      }
    } catch (err) {
      if (generation.current === request) setError('Picture-in-Picture could not open or close. Try again once the video is playing.');
    } finally {
      pending.current = false;
      if (generation.current === request) {
        setBusy(false);
        setActive(document.pictureInPictureElement === video);
      }
    }
  }, [videoRef]);

  return { active, ready, busy, error, supported, toggle, exit };
}
