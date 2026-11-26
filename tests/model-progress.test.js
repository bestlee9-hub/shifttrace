import test from 'node:test';
import assert from 'node:assert/strict';
import { modelProgress, preparationView, createDevicePreparation } from '../src/model-progress.js';

test('only exactly full normalized progress displays 100%', () => {
  assert.deepEqual([0, 0.29, 0.995, 0.9999999999999999, 1].map(modelProgress), [0,29,99,99,100]);
  assert.deepEqual([undefined, '1', NaN, Infinity, -1, 1.01].map(modelProgress), [null,null,null,null,null,null]);
});

test('real 100% is distinct from readiness and is not overwritten by stale progress', async () => {
  let emit, resolve, available = 'downloading';
  const statuses=[];
  const ctl=createDevicePreparation(()=>available, onProgress=>{
    emit=onProgress;
    return new Promise(r=>{resolve=r;});
  });
  ctl.observe(state=>statuses.push(state));
  const run=ctl.start();
  assert.equal(typeof emit,'function'); // Initialization started synchronously in the click stack.
  assert.equal(ctl.start(),run);
  emit(.995);
  assert.equal(statuses.at(-1).percent,99);
  emit(1);
  assert.deepEqual(statuses.at(-1),{phase:'preparing',percent:100});
  assert.deepEqual(preparationView(statuses.at(-1)),{
    label:'Download complete (100%) · preparing model…',kind:'info',busy:true,value:null
  });
  emit(.6);
  assert.equal(statuses.at(-1).phase,'preparing');
  available='available';
  resolve();
  await run;
  assert.deepEqual(statuses.at(-1),{phase:'ready',percent:100});
  emit(.9);
  assert.equal(statuses.at(-1).phase,'ready');
});

test('no progress event remains indeterminate and does not invent 100%', async () => {
  let available='downloading', resolve, state;
  const ctl=createDevicePreparation(()=>available, ()=>new Promise(r=>{resolve=r;}));
  ctl.observe(s=>{state=s;});
  const run=ctl.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(state,{phase:'downloading',percent:null});
  assert.match(preparationView(state).label,/not reported a percentage/);
  available='available';
  resolve();
  await run;
  assert.deepEqual(state,{phase:'ready',percent:null});
  assert.doesNotMatch(preparationView(state).label,/100%/);
});

test('SDK no-op resolution cannot claim readiness if local model is unavailable', async () => {
  let state;
  const ctl=createDevicePreparation(()=> 'unavailable', async()=>{});
  ctl.observe(s=>{state=s;});
  await ctl.start();
  assert.deepEqual(state,{phase:'unavailable',percent:null});
});

test('failed preparation can be retried, independent of analysis', async () => {
  let state, attempts=0;
  const ctl=createDevicePreparation(()=> 'available', async emit=>{
    if (++attempts===1) { emit(1); throw Error('private failure context'); }
  });
  ctl.observe(s=>{state=s;});
  await ctl.start();
  assert.equal(state.phase,'error');
  assert.match(preparationView(state).label,/100%.*failed/);
  assert.doesNotMatch(preparationView(state).label,/private failure context/);
  await ctl.start();
  assert.equal(state.phase,'ready');
  assert.equal(state.percent,null);
});
