import './style.css';
import { LIMIT, SAMPLE, parse, verify, fallback } from './log.js';
import { isConfigured, analyze, devicePreparation } from './firebase.js';
import { preparationView } from './model-progress.js';

const $=id=>document.getElementById(id);
const logs=$('logs'), mode=$('mode'), status=$('status'), results=$('results'), copy=$('copy'), run=$('run');
const modelPanel=$('model-panel'), modelStatus=$('model-status'), progressBar=$('model-progress'), prepare=$('prepare');
let rev=0, report='';
const el=(type,text,cls)=>Object.assign(document.createElement(type),{textContent:text||'',className:cls||''});
function update(){
  modelPanel.hidden=mode.value!=='hybrid';
  let rows=logs.value.split(/\r?\n/).filter(x=>x.trim()).length;
  $('counts').textContent=rows+' log '+(rows===1?'line':'lines')+(rows>LIMIT?' · Only the first '+LIMIT+' will be analyzed':' · '+LIMIT+' maximum');
  $('privacy').textContent=mode.value==='hybrid'
    ?'Use fictional logs only. If on-device inference is unavailable or not yet ready, the log is sent to Google’s cloud model.'
    :isConfigured?'Sample mode never sends your log anywhere.':'Sample mode is local. Configure Firebase and App Check in .env.local to enable hybrid.';
}
function reset(message='Ready to analyze. Try the fictional sample or paste a log.'){
  rev++;
  run.disabled=false;
  results.replaceChildren();
  status.textContent=message;
  status.dataset.kind='info';
  report='';
  copy.disabled=true;
  update();
}
function draw(incidents,events,source){
  status.dataset.kind='ok';
  status.textContent=source+' · '+incidents.length+' '+(incidents.length===1?'incident':'incidents');
  const byId=new Map(events.map(e=>[e.id,e.line]));
  const reportLines=['Shift handoff', 'Analysis: '+source, 'Verify against original equipment logs.', ''];
  results.replaceChildren();
  if(!incidents.length) results.append(el('p','No supported incidents found in these log lines. This does not establish normal operation.','empty'));
  for(const i of incidents){
    const article=el('article','','incident');
    article.append(el('h3',i.title));
    reportLines.push(i.title);
    for(const [label,ids] of [['First abnormal signal',i.first],['Follow-on alarms',i.alarms]]){
      article.append(el('h4',label));
      reportLines.push(label);
      if(!ids.length){
        article.append(el('p','None identified in the input.','note'));
        reportLines.push('None identified in the input.');
        continue;
      }
      const lines=el('ul','','evidence');
      for(const id of ids){
        const li=el('li');
        li.append(el('span','#'+id,'line-id'),el('code',byId.get(id)));
        lines.append(li);
        reportLines.push('#'+id+' '+byId.get(id));
      }
      article.append(lines);
    }
    for(const [label,body] of [['Cause assessment',i.cause],['Next checks',i.checks]]){
      article.append(el('h4',label),el('p',body));reportLines.push(label+': '+body);
    }
    results.append(article);
    reportLines.push('');
  }
  report=incidents.length?reportLines.join('\n'):'';
  copy.disabled=!report;
}
$('hybrid').disabled=!isConfigured;
mode.value='sample';
devicePreparation.observe(state=>{
  const view=preparationView(state);
  modelStatus.textContent=view.label;
  modelStatus.dataset.kind=view.kind;
  prepare.disabled=view.busy||state.phase==='ready';
  progressBar.hidden=!view.busy;
  if(view.value===null) progressBar.removeAttribute('value');
  else progressBar.value=view.value;
});
prepare.addEventListener('click',()=>{void devicePreparation.start();});
$('sample').addEventListener('click',()=>{logs.value=SAMPLE;reset('Fictional sample loaded. Select Analyze log.');});
$('clear').addEventListener('click',()=>{logs.value='';reset();logs.focus();});
logs.addEventListener('input',()=>reset());
mode.addEventListener('change',()=>reset());
copy.addEventListener('click',()=>{
  if(!report) return;
  const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
  const link=Object.assign(document.createElement('a'),{href:url,download:'shifttrace-handoff.txt'});
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('editor').addEventListener('submit',async e=>{
  e.preventDefault();
  const events=parse(logs.value), selected=mode.value;
  if(!events.length){reset('Add at least one log line first.');status.dataset.kind='error';logs.focus();return;}
  const thisRun=++rev;
  run.disabled=true;copy.disabled=true;report='';results.replaceChildren();status.dataset.kind='info';
  status.textContent='Analyzing…';
  try{
    const {result,source}=selected==='hybrid'?await analyze(events):{result:fallback(events),source:'Local sample · no AI'};
    if(thisRun===rev) draw(verify(result,events),events,source);
  }catch(error){
    if(thisRun!==rev) return;
    status.dataset.kind='error';
    status.textContent='Hybrid analysis did not finish. Verify Firebase and App Check, or switch to sample mode.';
    if(error instanceof SyntaxError) status.textContent='The model did not return a usable handoff. Try a shorter log.';
  }finally{
    if(thisRun===rev){
      run.disabled=false;
      if(!report) copy.disabled=true;
    }
  }
});
logs.value=SAMPLE;
reset('Fictional sample loaded. Select Analyze log.');
