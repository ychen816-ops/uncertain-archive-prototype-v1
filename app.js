const MODEL_URL='https://teachablemachine.withgoogle.com/models/Ia4xB2psu/';
const ARCHIVE=[
  {id:'archive-01',src:'sample.jpg',category:'Shape Imitation'},
  {id:'archive-02',src:'category-faces.jpg',category:'Faces in Things'},
  {id:'archive-03',src:'category-shape.jpg',category:'Shape Imitation'},
  {id:'archive-04',src:'category-material.jpg',category:'Material Illusion'},
  {id:'archive-05',src:'category-perspective.jpg',category:'Forced Perspective'}
];
const DEFINITIONS={
  'faces in things':'A face is perceived in an object or arrangement that does not actually have one.',
  'shape imitation':'One thing copies or resembles the recognizable form of another.',
  'material illusion':'Something appears to be made from a material that it is not.',
  'forced perspective':'Camera angle, distance, or scale makes objects appear differently related in space.'
};
const $=s=>document.querySelector(s);
const revealCanvas=$('#revealCanvas'),revealCtx=revealCanvas.getContext('2d');
const historyCanvas=$('#historyCanvas'),historyCtx=historyCanvas.getContext('2d');
const maskCanvas=document.createElement('canvas'),maskCtx=maskCanvas.getContext('2d');
const imageCanvas=document.createElement('canvas'),imageCtx=imageCanvas.getContext('2d');
let model=null,modelPromise=null,currentItem=null,previousItemId=null,sourceImage=new Image();
let imageLoaded=false,round=0,reveals=[],records=[],introduced=new Set(),locked=true,historyIndex=0;

function show(id){['intro','experiment','result'].forEach(x=>$('#'+x).classList.toggle('active',x===id));scrollTo(0,0)}
function norm(s=''){return s.trim().toLowerCase()}
function definition(label){return DEFINITIONS[norm(label)]||'A visual pattern learned from the training archive.'}
function setupHome(){
  const intro=$('#intro'),frost=$('#frostLayer'),cursor=$('#revealCursor');
  const move=e=>{const b=intro.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;frost.style.setProperty('--x',x+'px');frost.style.setProperty('--y',y+'px');frost.style.setProperty('--spot','185px');cursor.style.left=x+'px';cursor.style.top=y+'px';intro.classList.add('is-revealing')};
  intro.addEventListener('pointermove',move);intro.addEventListener('pointerenter',move);intro.addEventListener('pointerleave',()=>{frost.style.setProperty('--spot','0px');intro.classList.remove('is-revealing')});
}
async function loadModel(force=false){
  if(model&&!force)return model;if(modelPromise&&!force)return modelPromise;
  $('#modelStatus').textContent='LOADING MODEL';$('#modelStatus').className='model-status';$('#errorState').hidden=true;
  modelPromise=(async()=>{try{
    if(!window.tmImage)throw Error('The image model library did not load.');
    model=await tmImage.load(MODEL_URL+'model.json',MODEL_URL+'metadata.json');
    $('#modelStatus').textContent='MODEL READY';$('#modelStatus').className='model-status ready';return model;
  }catch(e){model=null;$('#modelStatus').textContent='MODEL ERROR';$('#modelStatus').className='model-status error';$('#errorMessage').textContent=e.message||'The model could not load.';$('#errorState').hidden=false;throw e}finally{modelPromise=null}})();
  return modelPromise;
}
function randomItem(){const pool=ARCHIVE.filter(x=>x.id!==previousItemId);return (pool.length?pool:ARCHIVE)[Math.floor(Math.random()*(pool.length||ARCHIVE.length))]}
function begin(){
  currentItem=randomItem();previousItemId=currentItem.id;round=0;reveals=[];records=[];introduced=new Set();locked=true;imageLoaded=false;historyIndex=0;
  $('#imageIndex').textContent=currentItem.id.toUpperCase();$('#waitingState').hidden=false;$('#readingState').hidden=true;$('#errorState').hidden=true;$('#boardPrompt').textContent='LOADING IMAGE';$('#boardPrompt').classList.remove('hidden');show('experiment');updateRound();
  sourceImage=new Image();sourceImage.onload=()=>{imageLoaded=true;resizeExperiment();renderExperiment();$('#boardPrompt').textContent=model?'CLICK ANYWHERE TO REVEAL':'WAITING FOR MODEL';locked=!model};sourceImage.onerror=()=>$('#boardPrompt').textContent='IMAGE COULD NOT LOAD';sourceImage.src=currentItem.src;
  loadModel().then(()=>{if(imageLoaded){locked=false;$('#boardPrompt').textContent='CLICK ANYWHERE TO REVEAL'}}).catch(()=>locked=true);
}
function resizeExperiment(){
  const b=$('#imageBoard').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(b.width*d)),h=Math.max(1,Math.round(b.height*d));
  [revealCanvas,maskCanvas,imageCanvas].forEach(c=>{c.width=w;c.height=h});
}
function coverRect(canvas){
  const cr=canvas.width/canvas.height,ir=sourceImage.naturalWidth/sourceImage.naturalHeight;
  if(ir>cr){const h=canvas.height,w=h*ir;return{x:(canvas.width-w)/2,y:0,w,h}}
  const w=canvas.width,h=w/ir;return{x:0,y:(canvas.height-h)/2,w,h};
}
function noise(seed,i){const v=Math.sin(seed*9283.31+i*78.233)*43758.5453;return v-Math.floor(v)}
function softBlob(ctx,r,scale=1){
  const base=r.radius*scale;
  for(let i=0;i<18;i++){const a=Math.PI*2*i/18,n=noise(r.seed,i),dist=base*(.1+n*.22),rad=base*(.68+noise(r.seed+2,i)*.22),x=r.x+Math.cos(a)*dist,y=r.y+Math.sin(a)*dist,g=ctx.createRadialGradient(x,y,rad*.5,x,y,rad);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.66,'rgba(255,255,255,.98)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2)}
}
function render(target,targetCtx,state,isFull=false,scale=1){
  if(!imageLoaded)return;
  const rx=target.width/revealCanvas.width,ry=target.height/revealCanvas.height,rs=state.map(r=>({...r,x:r.x*rx,y:r.y*ry,radius:r.radius*Math.min(rx,ry)}));
  const m=target===revealCanvas?maskCanvas:document.createElement('canvas'),mc=m.getContext('2d');m.width=target.width;m.height=target.height;mc.clearRect(0,0,m.width,m.height);
  if(isFull){mc.fillStyle='#fff';mc.fillRect(0,0,m.width,m.height)}else rs.forEach(r=>softBlob(mc,r,scale));
  const pic=target===revealCanvas?imageCanvas:document.createElement('canvas'),pc=pic.getContext('2d');pic.width=target.width;pic.height=target.height;pc.clearRect(0,0,pic.width,pic.height);const q=coverRect(target);pc.drawImage(sourceImage,q.x,q.y,q.w,q.h);pc.globalCompositeOperation='destination-in';pc.drawImage(m,0,0);pc.globalCompositeOperation='source-over';
  targetCtx.clearRect(0,0,target.width,target.height);targetCtx.fillStyle='#ececeb';targetCtx.fillRect(0,0,target.width,target.height);targetCtx.drawImage(pic,0,0);
}
function renderExperiment(scale=1){render(revealCanvas,revealCtx,reveals,round===3&&reveals.length>0,scale)}
function updateRound(){
  $('#roundLabel').textContent='ROUND '+String(round+1).padStart(2,'0')+' / 04';$('#progressFill').style.width=(round*25)+'%';$('.waiting-number').textContent=String(round+1).padStart(2,'0');
}
function revealAt(e){
  if(locked||!imageLoaded||!model)return;locked=true;$('#boardPrompt').classList.add('hidden');
  const b=$('#imageBoard').getBoundingClientRect(),x=(e.clientX-b.left)*revealCanvas.width/b.width,y=(e.clientY-b.top)*revealCanvas.height/b.height,min=Math.min(revealCanvas.width,revealCanvas.height);
  if(round<3)reveals.push({x,y,radius:min*[.15,.23,.34][round],seed:Date.now()%100000});
  const start=performance.now(),step=t=>{const p=Math.min(1,(t-start)/650),ease=1-Math.pow(1-p,3);renderExperiment(ease);if(p<1)requestAnimationFrame(step);else analyze()};
  requestAnimationFrame(step);
}
async function analyze(){
  $('#waitingState').hidden=false;$('#waitingState p:last-child').textContent='Reading the visible evidence…';
  try{
    const sorted=[...await model.predict(revealCanvas)].sort((a,b)=>b.probability-a.probability),top=sorted[0],previous=records.at(-1),key=norm(top.className),isNew=!introduced.has(key),full=round===3;
    if(isNew)introduced.add(key);
    records.push({round:round+1,label:top.className,confidence:top.probability,predictions:sorted.map(x=>({className:x.className,probability:x.probability})),reveals:reveals.map(x=>({...x})),full});
    $('#predictionName').textContent=top.className.toUpperCase();$('#predictionConfidence').textContent=Math.round(top.probability*100)+'%';
    $('#predictionChange').textContent=previous?(norm(previous.label)===key?'Still '+top.className:'Changed from '+previous.label):'First reading';
    $('#definitionBox').hidden=!isNew;if(isNew)$('#definitionText').textContent=definition(top.className);
    $('#continueBtn').innerHTML=full?'VIEW THE READING HISTORY <span>→</span>':'CONTINUE REVEALING <span>→</span>';
    $('#waitingState').hidden=true;$('#readingState').hidden=false;$('#progressFill').style.width=((round+1)*25)+'%';
  }catch(e){$('#waitingState').hidden=true;$('#errorMessage').textContent='The model could not read this round. Please retry.';$('#errorState').hidden=false}
}
function next(){
  if(round===3)return showResults();round++;updateRound();$('#readingState').hidden=true;$('#waitingState').hidden=false;$('#waitingState p:last-child').textContent='Choose another area to reveal.';$('#boardPrompt').textContent='CLICK A NEW AREA TO REVEAL';$('#boardPrompt').classList.remove('hidden');locked=false;
}
function resizeHistory(){const b=$('.result-visual').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);historyCanvas.width=Math.max(1,Math.round(b.width*d));historyCanvas.height=Math.max(1,Math.round(Math.min(b.width*.76,610)*d))}
function showResults(){
  show('result');resizeHistory();$('#timeline').innerHTML=records.map((r,i)=>`<button class="timeline-step${i===0?' active':''}" data-round="${i}"><span>0${r.round}</span><b>${r.label}</b><em>${Math.round(r.confidence*100)}%</em></button>`).join('<span class="timeline-arrow">→</span>');
  document.querySelectorAll('.timeline-step').forEach(b=>b.onclick=()=>selectHistory(+b.dataset.round));selectHistory(0);
}
function selectHistory(i){
  historyIndex=i;const r=records[i];if(!r)return;document.querySelectorAll('.timeline-step').forEach((b,n)=>b.classList.toggle('active',n===i));render(historyCanvas,historyCtx,r.reveals,r.full);$('#historyCaption').textContent='This was all the visual information available to the model in Round '+String(r.round).padStart(2,'0')+'.';$('#selectedDefinition').innerHTML=`<span>ROUND ${String(r.round).padStart(2,'0')} · DEFINITION</span><h3>${r.label}</h3><p>${definition(r.label)}</p>`;$('#fullImageBtn').dataset.full='no';$('#fullImageBtn').innerHTML='VIEW THE FULL IMAGE <span>↗</span>';
}
function toggleFull(){
  const r=records[historyIndex],full=$('#fullImageBtn').dataset.full==='yes';
  if(full){render(historyCanvas,historyCtx,r.reveals,r.full);$('#historyCaption').textContent='This was all the visual information available to the model in Round '+String(r.round).padStart(2,'0')+'.';$('#fullImageBtn').innerHTML='VIEW THE FULL IMAGE <span>↗</span>';$('#fullImageBtn').dataset.full='no'}
  else{render(historyCanvas,historyCtx,[],true);$('#historyCaption').textContent='The complete source image.';$('#fullImageBtn').innerHTML='RETURN TO SELECTED ROUND <span>↙</span>';$('#fullImageBtn').dataset.full='yes'}
}
function home(){locked=true;show('intro')}
$('#drawBtn').onclick=begin;$('#tryAgainBtn').onclick=begin;$('#exitBtn').onclick=home;$('#resultExitBtn').onclick=home;$('#continueBtn').onclick=next;$('#fullImageBtn').onclick=toggleFull;
$('#retryBtn').onclick=()=>loadModel(true).then(()=>{if(imageLoaded){locked=false;$('#errorState').hidden=true;$('#boardPrompt').textContent='CLICK ANYWHERE TO REVEAL'}}).catch(()=>{});
$('#aboutBtn').onclick=()=>{const a=$('#aboutText');a.hidden=!a.hidden;$('#aboutBtn span').textContent=a.hidden?'＋':'−'};
$('#imageBoard').onclick=revealAt;$('#imageBoard').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const b=$('#imageBoard').getBoundingClientRect();revealAt({clientX:b.left+b.width/2,clientY:b.top+b.height/2})}};
addEventListener('resize',()=>{if($('#result').classList.contains('active')){resizeHistory();selectHistory(historyIndex)}});
setupHome();loadModel().catch(()=>{});
