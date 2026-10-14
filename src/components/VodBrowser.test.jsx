import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VodBrowser from './VodBrowser';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = props => act(() => root.render(<VodBrowser channels={[]} type="series" {...props} />));
const click = label => act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes(label)).click());

test('browses seasons and plays the chosen episode, not the first episode', () => {
  const onPlay = jest.fn();
  const episodes = [
    { season: 1, episodeNumber: 1, episodeTitle: 'Pilot', url: 'one.mp4' },
    { season: 2, episodeNumber: 3, episodeTitle: 'Finale', url: 'finale.mp4' },
  ];
  render({ detail: { channel: { name: 'Example' }, episodes }, onPlay });
  expect(container.textContent).toContain('Pilot');
  const select = container.querySelector('select');
  act(() => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.textContent).not.toContain('Pilot');
  click('Finale');
  expect(onPlay).toHaveBeenCalledWith(episodes[1]);
});

test('movie browser filters the catalog and selects the requested movie', () => {
  const onSelect = jest.fn();
  const movie = { contentType: 'movie', name: 'Movie Two', group: 'Drama', streamId: 2 };
  render({ type: 'movie', channels: [movie, { contentType: 'live', name: 'Live' }], onSelect });
  expect(container.textContent).toContain('1 titles');
  click('Movie Two');
  expect(onSelect).toHaveBeenCalledWith(movie);
});

test('failed series requests offer retry and back navigation', () => {
  const onRetry = jest.fn();
  const onBack = jest.fn();
  render({ detail: { channel: { name: 'Example' }, error: 'No episodes' }, onRetry, onBack });
  click('Retry'); click('Back');
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onBack).toHaveBeenCalledTimes(1);
});
