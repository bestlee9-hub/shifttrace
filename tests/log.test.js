import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMIT, SAMPLE, parse, verify, fallback } from '../src/log.js';
test('fictional shift has two separate incidents and citations sourced directly',()=>{
  const events=parse(SAMPLE), out=verify(fallback(events),events);
  assert.equal(out.length,2);
  assert.deepEqual(out.map(i=>[i.first,i.alarms]),[[[2],[3,4]],[[7],[8]]]);
  assert.match(out[1].cause,/Not established/);
  assert.match(events[6].line,/Detector frame/);
});
test('invalid evidence cannot appear and duplicate evidence is removed',()=>{
  const events=parse('A\nB\nC');
  const out=verify({incidents:[{title:'Observed',first:[1,1,99,'2'],alarms:[1,2,99]},null,{title:'Fabricated',first:[300]}]},events);
  assert.equal(out.length,1);assert.deepEqual(out[0].first,[1]);assert.deepEqual(out[0].alarms,[2]);
});
test('blank, normal, truncated, and malformed input',()=>{
  assert.deepEqual(parse(' \r\n'),[]);
  assert.deepEqual(fallback(parse('08:00 INFO Started')).incidents,[]);
  assert.equal(parse(Array.from({length:200},()=> 'INVALID').join('\n')).length,LIMIT);
  assert.throws(()=>verify({},[]),/expected format/);
});
test('custom log keyword flags are not fabricated follow-ons',()=>{
  const events=parse('08:00 INFO Start\n08:02 ERROR Motion timeout\n08:04 INFO End');
  const out=verify(fallback(events),events);
  assert.equal(out.length,1);
  assert.deepEqual(out[0].first,[2]);assert.deepEqual(out[0].alarms,[]);
});
