const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
function setup({ consent = true, permission = 'granted', expires = Date.now() + 3600000 } = {}) {
  const db = new DatabaseSync(':memory:');
  const sqlite = { execAsync: async s => db.exec(s), runAsync: async (s,...p) => db.prepare(s).run(...p),
    getFirstAsync: async (s,...p) => db.prepare(s).get(...p) ?? null, getAllAsync: async (s,...p) => db.prepare(s).all(...p) };
  const tokens = new Map([['mobileToken','driver-token']]);
  const calls = []; let task, running = false, offline = false;
  const origin = Date.now() - 100000;
  const modules = {
    'expo-task-manager': { defineTask(name, fn) { task = fn; } },
    'expo-location': { Accuracy: { High: 6 }, requestForegroundPermissionsAsync: async () => ({status:permission}),
      requestBackgroundPermissionsAsync: async () => ({status:permission}), hasStartedLocationUpdatesAsync: async () => running,
      startLocationUpdatesAsync: async () => { running = true; calls.push('device:start'); },
      stopLocationUpdatesAsync: async () => { running = false; calls.push('device:stop'); } },
    'expo-sqlite': { openDatabaseAsync: async () => sqlite },
    'expo-secure-store': { getItemAsync: async k => tokens.get(k), setItemAsync: async (k,v) => tokens.set(k,v), deleteItemAsync: async k => tokens.delete(k) },
    'react-native': { Alert: { alert: (title, body, buttons) => buttons[consent ? 1 : 0].onPress() } },
    './locationTask': { stopBackgroundLocation: async () => {} },
    '../api/client': { authFetch: async (url,options) => {
      const body = JSON.parse(options.body); calls.push(body.action);
      if (offline) throw new Error('offline');
      return { ok: true, json: async () => body.action === 'start' ? { session: { id:'s1', startedAt:new Date(origin).toISOString(), expiresAt:new Date(expires).toISOString() } } : {ok:true} };
    } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/learningTask.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports, require: n => { if (!modules[n]) throw new Error(n); return modules[n]; }, AbortController, setTimeout, clearTimeout });
  return { api:exports, calls, tokens, setOffline: v => offline=v,
    send: samples => task({data:{locations:samples.map(([seconds,lat=38,speed=0])=>({timestamp:origin+seconds*1000,coords:{latitude:lat,longitude:27,accuracy:8,speed}}))}}) };
}
test('declining disclosure never starts recording or a server session', async () => {
  const s=setup({consent:false}); await s.api.beginLearning('bus'); assert.deepEqual(s.calls,[]);
});
test('missing permission cannot silently create a recording', async () => {
  const s=setup({permission:'denied'}); await assert.rejects(s.api.beginLearning('bus')); assert.deepEqual(s.calls,[]);
});
test('moving samples use 3 seconds, stationary samples 15 seconds', async () => {
  const s=setup(); await s.api.beginLearning('bus'); s.setOffline(true);
  await s.send([[1],[4],[16],[19,38.0001,3],[20,38.0002,3],[22,38.0003,3]]);
  assert.equal((await s.api.recordingStatus()).pending,4);
});
test('offline finish stops collection and preserves points for retry', async () => {
  const s=setup(); await s.api.beginLearning('bus'); s.setOffline(true); await s.send([[1],[16]]);
  await assert.rejects(s.api.finishLearning());
  const state=await s.api.recordingStatus(); assert.equal(state.running,false); assert.equal(state.pending,2); assert.ok(state.state.endedAt);
  await s.send([[30]]); assert.equal((await s.api.recordingStatus()).pending,2);
  s.setOffline(false); await s.api.finishLearning(); const done=await s.api.recordingStatus();
  assert.equal(done.state,null); assert.equal(done.pending,0); assert.equal(s.calls.at(-1),'finish');
});
test('expired session stops and captures no new locations', async () => {
  const s=setup({expires:Date.now()-1}); await s.api.beginLearning('bus'); await s.api.recordingStatus();
  assert.equal((await s.api.recordingStatus()).running,false);
});
test('account change stops recording instead of collecting for another driver', async () => {
  const s=setup(); await s.api.beginLearning('bus'); s.tokens.set('mobileToken','other-driver'); await s.send([[1]]);
  const state=await s.api.recordingStatus(); assert.equal(state.running,false); assert.equal(state.pending,0);
});
