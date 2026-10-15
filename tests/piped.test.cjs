const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const moduleUnderTest = new Module('piped');
moduleUnderTest._compile(ts.transpileModule(fs.readFileSync('src/api/piped.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, 'piped.js');
const api = moduleUnderTest.exports;
test('extracts valid video IDs without accepting arbitrary URLs', () => {
  assert.equal(api.videoId('/watch?v=abcdefghijk'), 'abcdefghijk');
  assert.equal(api.videoId('abcdefghijk'), 'abcdefghijk');
  assert.equal(api.videoId('/channel/something'), null);
  assert.equal(api.videoId('/watch?v=short'), null);
});
test('prefers HLS, otherwise combined MP4, never silent DASH video', () => {
  const data = { hls: 'hls', videoStreams: [
    { url: 'silent', mimeType: 'video/mp4', videoOnly: true },
    { url: 'combined', mimeType: 'video/mp4', videoOnly: false },
  ], audioStreams: [{ url: 'audio', mimeType: 'audio/mp4' }] };
  assert.equal(api.playbackSource(data, false), 'hls');
  assert.equal(api.playbackSource({ ...data, hls: '' }, false), 'combined');
  assert.equal(api.playbackSource(data, true), 'audio');
  assert.equal(api.playbackSource({ ...data, hls: '', videoStreams: [data.videoStreams[0]] }, false), undefined);
});
test('handles missing playable streams', () => {
  assert.equal(api.playbackSource({ videoStreams: [], audioStreams: [] }, true), undefined);
});
