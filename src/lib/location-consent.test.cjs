const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(choice = 1, cancelOnPermission = false, permission = 'granted') {
  const calls = []; let cancelled = false;
  const location = {
    Accuracy: { Balanced: 1 },
    requestForegroundPermissionsAsync: async () => { calls.push('foreground'); cancelled = cancelOnPermission; return { status: permission }; },
    requestBackgroundPermissionsAsync: async () => { calls.push('background'); return { status: 'granted' }; },
    hasStartedLocationUpdatesAsync: async () => false,
    startLocationUpdatesAsync: async () => { calls.push('start'); },
    stopLocationUpdatesAsync: async () => { calls.push('stop'); },
  };
  const exports = {};
  const modules = {
    'expo-task-manager': { defineTask() {} },
    'expo-location': location,
    'expo-secure-store': {},
    '../api/config': { API_BASE: 'https://example.invalid' },
    'react-native': { Alert: { alert(title, body, buttons, options) {
      calls.push('disclosure');
      assert.match(body, /arka planda/); assert.match(body, /velilerle/);
      if (choice === -1) options.onDismiss(); else buttons[choice].onPress();
    } } },
  };
  const source = ts.transpileModule(fs.readFileSync(`${__dirname}/locationTask.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return { calls, start: () => exports.startBackgroundLocation(() => cancelled) };
}
test('declining disclosure makes no permission or tracking calls', async () => {
  const s = setup(0); await s.start(); assert.deepEqual(s.calls, ['disclosure']);
});
test('dismissing disclosure is not consent', async () => {
  const s = setup(-1); await s.start(); assert.deepEqual(s.calls, ['disclosure']);
});
test('disclosure and consent precede OS permissions and tracking', async () => {
  const s = setup(); await s.start(); assert.deepEqual(s.calls, ['disclosure', 'foreground', 'background', 'start']);
});
test('leaving the screen during permission request prevents tracking', async () => {
  const s = setup(1, true); await s.start(); assert.deepEqual(s.calls, ['disclosure', 'foreground']);
});
test('denied permission does not start background tracking', async () => {
  const s = setup(1, false, 'denied'); await assert.rejects(s.start, /foreground_denied/);
  assert.deepEqual(s.calls, ['disclosure', 'foreground']);
});
