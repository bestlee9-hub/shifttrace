export const LIMIT = 100;
export const SAMPLE = [
 '08:21:00.120 INFO Cycle A17 began; fixture confirmed ready',
 '08:21:02.418 WARN Stage pressure feedback did not reach its target',
 '08:21:02.661 ERROR Inspection sequence canceled after pressure verification failed',
 '08:21:02.703 ERROR Line controller reported downstream inspection stopped',
 '08:21:06.113 INFO Operator acknowledged cycle A17 alarms',
 '11:46:00.127 INFO Cycle B09 began after station reset',
 '11:46:04.485 WARN Detector frame arrived late',
 '11:46:05.025 ERROR Sequence stopped after frame timeout',
 '11:46:05.140 INFO No controller trace was captured for cycle B09'
].join('\n');
export function parse(input){
  return input.slice(0,24000).split(/\r?\n/).filter(x=>x.trim()).slice(0,LIMIT).map((line,i)=>({id:i+1,line}));
}
export const sampleResult = {
  incidents:[
    {title:'Pressure verification stopped cycle A17',first:[2],alarms:[3,4],cause:'Not established. The feedback failed verification; the log does not identify the physical cause.',checks:'Compare pressure feedback with fixture output states for A17 and check the sensor trace.'},
    {title:'Frame timeout stopped cycle B09',first:[7],alarms:[8],cause:'Not established. No controller trace was captured; do not link this restart to cycle A17.',checks:'Collect the detector and controller traces for B09 and compare the expected frame timing.'}
  ]
};
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export function verify(result, events) {
  if (!result || !Array.isArray(result.incidents)) throw new Error('The response did not have the expected format. Try a shorter log.');
  const valid=new Set(events.map(e=>e.id));
  const ids=arr=>Array.isArray(arr)?[...new Set(arr.filter(x=>Number.isInteger(x)&&valid.has(x)))].slice(0,12):[];
  return result.incidents.slice(0,8).flatMap((i)=>{
    if (!i || typeof i!=='object') return [];
    const first=ids(i.first);
    const alarms=ids(i.alarms).filter(x=>!first.includes(x));
    const title=clip(i.title,170);
    if (!title || !first.length) return [];
    return [{title,first,alarms,cause:clip(i.cause,480)||'Not established.',checks:clip(i.checks,480)||'Compare the cited events against the equipment trace.'}];
  });
}
export function fallback(events) {
  if(events.map(e=>e.line).join('\n')===SAMPLE) return sampleResult;
  const matches=events.filter(e=>/\b(WARN(?:ING)?|ERROR|FAULT|ALARM|FATAL)\b/i.test(e.line));
  return {incidents:matches.slice(0,8).map((e)=>({title:'Flagged log event '+e.id,first:[e.id],alarms:[],cause:'Not established. Sample mode flags words only and does not infer causation.',checks:'Compare this event with adjacent log entries and equipment state before assigning a cause.'}))};
}
