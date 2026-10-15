import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import usePictureInPicture from './usePictureInPicture';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, pip, request, exit;
function Harness({ source = 'one', full = false, stopped = false }) {
  const ref = useRef(null);
  pip = usePictureInPicture(ref, source, full, stopped);
  return <video ref={ref} />;
}
const render = async props => { await act(async () => root.render(<Harness {...props} />)); };
const toggle = async () => { await act(async () => pip.toggle()); };
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, writable: true, value: null });
  Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { configurable: true, get: () => 4 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
  request = jest.fn(function () { document.pictureInPictureElement = this; this.dispatchEvent(new Event('enterpictureinpicture')); return Promise.resolve({}); });
  HTMLVideoElement.prototype.requestPictureInPicture = request;
  exit = jest.fn(async () => { const video = document.pictureInPictureElement; document.pictureInPictureElement = null; video?.dispatchEvent(new Event('leavepictureinpicture')); });
  document.exitPictureInPicture = exit;
  window.electronAPI = { setFullscreen: jest.fn(async () => false) };
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); delete window.electronAPI; });

test('opens from the user gesture, leaves fullscreen, and toggles off', async () => {
  await render({ full: true });
  expect(pip.ready).toBe(true);
  await toggle();
  expect(request).toHaveBeenCalledTimes(1);
  expect(window.electronAPI.setFullscreen).toHaveBeenCalledWith(false);
  expect(pip.active).toBe(true);
  await toggle(); expect(pip.active).toBe(false);
});
test('native PiP close updates state', async () => {
  await render(); await toggle(); await act(async () => exit()); expect(pip.active).toBe(false);
});
test('switching streams and stopping close PiP', async () => {
  await render(); await toggle(); await render({ source: 'two' }); expect(exit).toHaveBeenCalledTimes(1);
  await toggle(); await render({ source: 'two', stopped: true }); expect(exit).toHaveBeenCalledTimes(2); expect(pip.ready).toBe(false);
});
test('entering fullscreen closes PiP', async () => {
  await render(); await toggle(); await render({ full: true }); expect(pip.active).toBe(false);
});
test('failure leaves playback alone and permits retry', async () => {
  request.mockRejectedValueOnce(new Error('denied')); await render(); await toggle();
  expect(pip.error).toContain('Picture-in-Picture'); expect(pip.busy).toBe(false);
  await toggle(); expect(pip.active).toBe(true); expect(pip.error).toBe('');
});
test('a pending request cannot leave a stale PiP window after a source change', async () => {
  let complete;
  request.mockImplementation(function () { const video = this; return new Promise(resolve => { complete = () => { document.pictureInPictureElement = video; resolve({}); }; }); });
  await render(); let task; act(() => { task = pip.toggle(); });
  await render({ source: 'two' });
  await act(async () => { complete(); await task; });
  expect(document.pictureInPictureElement).toBeNull(); expect(pip.busy).toBe(false);
});
test('unsupported runtimes do not expose a PiP control', async () => {
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: false });
  await render(); expect(pip.supported).toBe(false);
});
