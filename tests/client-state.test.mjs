import test from 'node:test';
import assert from 'node:assert/strict';
import { compactQueue, mergePendingEvents, canSelectDate, renderableDays } from '../scripts/client-state.mjs';

test('offline save/delete updates merged list and cancels unsent add', () => {
  const event = { id:'offline-1', date:'2026-07-20', category:'play', start:'09:00', end:'', memo:'offline' };
  let state = compactQueue([], { action:'save', event });
  assert.equal(state.queued, true);
  assert.deepEqual(mergePendingEvents([], state.queue).map(e => e.id), ['offline-1']);
  state = compactQueue(state.queue, { action:'delete', id:'offline-1', date:'2026-07-20' });
  assert.equal(state.queued, true);
  assert.deepEqual(state.queue, []);
  assert.deepEqual(mergePendingEvents([], state.queue), []);
});

test('401-retained operation excludes secrets and is removed after successful resend', () => {
  const event = { id:'auth-1', date:'2026-07-20', category:'snack', start:'15:00', end:null, memo:'再ログイン後' };
  const state = compactQueue([], { action:'save', event, password:'nope', apiKey:'nope', invite_code:'nope' });
  assert.equal(state.queued, false);
  const retained = compactQueue([], { action:'save', event });
  assert.equal(retained.queue.length, 1);
  assert.doesNotMatch(JSON.stringify(retained.queue), /password|apiKey|invite_code|nope/);
  const afterSuccess = retained.queue.filter(x => JSON.stringify(x) !== JSON.stringify(retained.queue[0]));
  assert.deepEqual(afterSuccess, []);
});

test('pending delete hides server event until resend succeeds', () => {
  const server = [{ id:'server-1', category:'play', start:'09:00' }, { id:'server-2', category:'bath', start:'19:00' }];
  const { queue } = compactQueue([], { action:'delete', id:'server-1', date:'2026-07-20' });
  assert.deepEqual(mergePendingEvents(server, queue).map(e => e.id), ['server-2']);
});

test('future dates are disabled and direct selection is rejected', () => {
  assert.equal(canSelectDate('2026-07-20', '2026-07-20'), true);
  assert.equal(canSelectDate('2026-07-19', '2026-07-20'), true);
  assert.equal(canSelectDate('2026-07-21', '2026-07-20'), false);
  const days = renderableDays(2026, 6, '2026-07-20');
  assert.equal(days.find(d => d.key === '2026-07-20').disabled, false);
  assert.equal(days.find(d => d.key === '2026-07-21').disabled, true);
});
