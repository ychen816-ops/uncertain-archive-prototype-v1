// Replace this with the complete Teachable Machine URL, ending in a slash.
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/Ia4xB2psu/';
const labels = ['Faces in Things','Shape Imitation','Material Illusion','Forced Perspective','Uncertain'];
const categoryCards = [
  {name:'Faces in Things',image:'category-faces.jpg',definition:'A non-human object appears to contain a face, even though no face was intentionally made.',clue:'Look for eye-like pairs, a central nose shape, and a mouth-like line. This is visual pareidolia.'},
  {name:'Shape Imitation',image:'category-shape.jpg',definition:'One object borrows the recognizable outline or form of a completely different thing.',clue:'Focus on silhouette and structure. Ask what else the object’s overall shape resembles.'},
  {name:'Material Illusion',image:'category-material.jpg',definition:'An object looks as if it is made from one material, while it is actually made from another.',clue:'Compare what the surface suggests with how you expect that material to bend, weigh, or feel.'},
  {name:'Forced Perspective',image:'category-perspective.jpg',definition:'Camera angle, distance, and scale make separate objects appear to touch or change size.',clue:'Look for an unlikely size relationship or interaction created by the exact viewpoint.'}
];
const roundText = [
  ['Tear open the first clue.','Click anywhere on the covered image.'],
  ['Expose another piece.','Choose a new spot. The machine will read more of the image.'],
  ['Make the opening larger.','One more tear may change both answers.'],
  ['Reveal the whole image.','Click once more to remove what remains.']
];
const radii = [.12,.19,.29,1];
const $ = s => document.querySelector(s);
let image = new Image(), imageSrc = 'sample.jpg', pendingImage = 'sample.jpg', round = 0, tears = [], records = [], model = null, boardReady = false, roundLocked = false, guideIndex = 0, dragStart = null;
const canvas = $('#revealCanvas'), ctx = canvas.getContext('2d'), maskCanvas = document.createElement('canvas'), maskCtx = maskCanvas.getContext('2d');

function show(id){['intro','guide','test','result'].forEach(x=>$('#'+x).classList.toggle('active',x===id));scrollTo(0,0)}
function setupHomepageReveal(){
  const intro=$('#intro'),frost=$('#frostLayer'),cursor=$('#revealCursor');
  const move=e=>{const b=intro.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;frost.style.setProperty('--x',`${x}px`);frost.style.setProperty('--y',`${y}px`);frost.style.setProperty('--spot','180px');cursor.style.left=`${x}px`;cursor.style.top=`${y}px`;intro.classList.add('is-revealing')};
  intro.addEventListener('pointermove',move);intro.addEventListener('pointerenter',move);intro.addEventListener('pointerleave',()=>{frost.style.setProperty('--spot','0px');intro.classList.remove('is-revealing')});
}
function openGuide(){guideIndex=0;renderGuide();show('guide')}
function renderGuide(){
  $('#guideCount').textContent=`${String(guideIndex+1).padStart(2,'0')} / 04`;$('#guideDots').innerHTML=categoryCards.map((_,i)=>`<i class="${i===guideIndex?'active':''}"></i>`).join('');
  $('#cardStack').innerHTML=categoryCards.map((c,i)=>{const offset=i-guideIndex;return `<article class="study-card${i===guideIndex?' active-card':''}" data-index="${i}" style="z-index:${20-Math.abs(offset)};opacity:${Math.abs(offset)>2?0:1};transform:translateX(${offset*22}px) translateY(${Math.abs(offset)*12}px) scale(${1-Math.abs(offset)*.045}) rotate(${offset*1.5}deg)"><div class="study-face study-front"><img src="${c.image}" alt="Example of ${c.name}"><div class="study-label"><div><span>0${i+1} / CATEGORY</span><h3>${c.name}</h3></div><small class="flip-hint">TAP TO FLIP ↻</small></div></div><div class="study-face study-back"><span class="definition-number">0${i+1} / DEFINITION</span><div><h3>${c.name}</h3><p>${c.definition}</p></div><div class="visual-clue"><b>VISUAL CLUE</b><span>${c.clue}</span></div></div></article>`}).join('');bindGuideCard();
}
function moveGuide(direction){guideIndex=(guideIndex+direction+categoryCards.length)%categoryCards.length;renderGuide()}
function bindGuideCard(){const card=$('.study-card.active-card');if(!card)return;card.addEventListener('click',()=>{if(!dragStart)card.classList.toggle('flipped')});card.addEventListener('pointerdown',e=>{dragStart={x:e.clientX,moved:false};card.setPointerCapture(e.pointerId);card.classList.add('dragging')});card.addEventListener('pointermove',e=>{if(!dragStart)return;const dx=e.clientX-dragStart.x;if(Math.abs(dx)>5)dragStart.moved=true;card.style.transform=`translateX(${dx}px) rotate(${dx*.025}deg)`});card.addEventListener('pointerup',e=>{if(!dragStart)return;const dx=e.clientX-dragStart.x,moved=dragStart.moved;card.classList.remove('dragging');dragStart=null;if(Math.abs(dx)>80){moveGuide(dx<0?1:-1)}else{renderGuide();if(!moved)setTimeout(()=>$('.study-card.active-card')?.classList.toggle('flipped'),0)}})}
function setupChoices(){
  $('#humanChoices').innerHTML=labels.map(l=>`<label class="human-choice"><input type="radio" name="human" value="${l}"><span>${l}</span></label>`).join('');
  document.querySelectorAll('input[name=human]').forEach(el=>el.addEventListener('change',()=>handleHumanChoice(el.value)));
}
async function loadModel(){
  if(!MODEL_URL||MODEL_URL.includes('[...')){model=null;$('#modelState').textContent='MODEL LINK NEEDED';return}
  try{model=await tmImage.load(MODEL_URL+'model.json',MODEL_URL+'metadata.json');$('#modelState').textContent='MODEL CONNECTED';$('#modelState').classList.add('live')}
  catch(e){model=null;$('#modelState').textContent='MODEL COULD NOT LOAD'}
}
function begin(src){
  imageSrc=src;round=0;tears=[];records=[];boardReady=false;window.currentMachine=null;$('#resultImage').src=src;$('#paperCover span').textContent='LOADING IMAGE…';show('test');image=new Image();
  image.onload=()=>{resizeCanvas();draw();boardReady=true;$('#paperCover span').textContent='CLICK TO TEAR';updateRound()};image.src=src;
}
function resizeCanvas(){const b=$('#imageBoard').getBoundingClientRect();canvas.width=maskCanvas.width=Math.round(b.width*devicePixelRatio);canvas.height=maskCanvas.height=Math.round(b.height*devicePixelRatio)}
function coverImage(){const cw=canvas.width,ch=canvas.height,ir=image.width/image.height,cr=cw/ch;let dw,dh,dx,dy;if(ir>cr){dh=ch;dw=dh*ir;dx=(cw-dw)/2;dy=0}else{dw=cw;dh=dw/ir;dx=0;dy=(ch-dh)/2}return{dw,dh,dx,dy}}
function jaggedPath(t,scale=1){const p=new Path2D(),n=28,r=t.r*scale;p.moveTo(t.x+r,t.y);for(let i=1;i<=n;i++){const a=Math.PI*2*i/n,j=1+Math.sin(i*9.73+t.seed)*.11;p.lineTo(t.x+Math.cos(a)*r*j,t.y+Math.sin(a)*r*j)}p.closePath();return p}
function draw(skipFibers=false){
  const{dw,dh,dx,dy}=coverImage();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#ececec';ctx.fillRect(0,0,canvas.width,canvas.height);if(!tears.length)return;
  const mask=new Path2D();tears.forEach(t=>mask.addPath(jaggedPath(t)));maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);maskCtx.fillStyle='#fff';maskCtx.fill(mask,'nonzero');drawUnifiedEdge(mask);ctx.save();ctx.clip(mask,'nonzero');ctx.drawImage(image,dx,dy,dw,dh);ctx.restore();if(!skipFibers)drawOuterFibers();
}
function drawUnifiedEdge(mask){
  const d=devicePixelRatio,edge=7*d;ctx.save();ctx.shadowColor='rgba(0,0,0,.32)';ctx.shadowBlur=14*d;ctx.shadowOffsetX=2*d;ctx.shadowOffsetY=5*d;ctx.drawImage(maskCanvas,0,0);ctx.restore();ctx.save();for(let i=0;i<24;i++){const a=Math.PI*2*i/24;ctx.drawImage(maskCanvas,Math.cos(a)*edge,Math.sin(a)*edge)}ctx.drawImage(maskCanvas,0,0);ctx.restore();
}
function drawOuterFibers(){
  const d=devicePixelRatio,pixels=maskCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height).data;ctx.save();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.2*d;tears.forEach(t=>{for(let i=0;i<24;i++){const a=Math.PI*2*i/24+.08*Math.sin(i*4.7+t.seed),j=1+.09*Math.sin(i*8.13+t.seed),r=t.r*j,x=t.x+Math.cos(a)*r,y=t.y+Math.sin(a)*r,testX=Math.round(x+Math.cos(a)*10*d),testY=Math.round(y+Math.sin(a)*10*d);if(testX<0||testY<0||testX>=maskCanvas.width||testY>=maskCanvas.height)continue;if(pixels[(testY*maskCanvas.width+testX)*4+3]>20)continue;const len=(4+7*Math.abs(Math.sin(i*3.31+t.seed)))*d;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke()}});ctx.restore();
}
function animateTear(t,target){let start;const step=ts=>{if(!start)start=ts;const p=Math.min(1,(ts-start)/520);t.r=target*(1-Math.pow(1-p,3));draw(p<1);if(p<1)requestAnimationFrame(step);else readyForHuman()};requestAnimationFrame(step)}
function makeShards(x,y){for(let i=0;i<16;i++){const s=document.createElement('i');s.className='tear-shard';s.style.left=x+'px';s.style.top=y+'px';s.style.width=(8+Math.random()*24)+'px';s.style.height=(10+Math.random()*28)+'px';s.style.clipPath=`polygon(${Math.random()*25}% 0,100% ${Math.random()*35}%,${55+Math.random()*40}% 100%,0 ${55+Math.random()*40}%)`;const a=Math.random()*Math.PI*2,d=30+Math.random()*105;s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');s.style.setProperty('--rot',(Math.random()*360-180)+'deg');$('#imageBoard').appendChild(s);setTimeout(()=>s.remove(),760)}}
async function tearAt(clientX,clientY){
  if(!boardReady||$('#imageBoard').dataset.torn==='yes')return;$('#imageBoard').dataset.torn='yes';$('#imageBoard').classList.add('has-tear','tearing');setTimeout(()=>$('#imageBoard').classList.remove('tearing'),520);const b=$('#imageBoard').getBoundingClientRect(),x=(clientX-b.left)*devicePixelRatio,y=(clientY-b.top)*devicePixelRatio;makeShards(clientX-b.left,clientY-b.top);
  if(round===3){const t={x:canvas.width/2,y:canvas.height/2,r:0,seed:round+4};tears=[t];animateTear(t,Math.hypot(canvas.width,canvas.height))}else{const t={x,y,r:0,seed:round+4};tears.push(t);animateTear(t,Math.min(canvas.width,canvas.height)*radii[round])}$('#roundInstruction').textContent='Opening the paper…';
}
function readyForHuman(){
  $('#humanField').disabled=false;$('#roundInstruction').textContent='Make your choice before the machine is revealed.';$('#machineEmpty').textContent='Your answer comes first. The machine is still hidden.';
}
async function handleHumanChoice(human){
  if(roundLocked)return;roundLocked=true;$('#humanField').disabled=true;$('#continueBtn').innerHTML='MACHINE IS READING… <span>○</span>';$('#roundInstruction').textContent='Your choice is locked. Now the machine can look.';$('#machineEmpty').textContent='Analyzing only the exposed pixels…';
  const machine=await analyze();const top=machine?.[0];records.push({round:round+1,exposed:round===3?'100%':'partial',human,machine:top?.className||'Model not connected',machine_confidence:top?Math.round(top.probability*100):null});
  if(machine)renderPredictions(machine);else $('#machineEmpty').textContent='The model could not return a result.';
  let seconds=3;$('#continueBtn').innerHTML=`NEXT ${round===3?'VIEW':'ROUND'} IN ${seconds} <span>→</span>`;const timer=setInterval(()=>{seconds--;if(seconds>0){$('#continueBtn').innerHTML=`NEXT ${round===3?'VIEW':'ROUND'} IN ${seconds} <span>→</span>`;return}clearInterval(timer);if(round<3){round++;updateRound()}else finish()},1000);
}
async function analyze(){
  if(!model)return null;try{const result=await model.predict(canvas);return result.sort((a,b)=>b.probability-a.probability)}catch(e){$('#modelState').textContent='ANALYSIS FAILED';return null}
}
function renderPredictions(items){$('#machineEmpty').style.display='none';$('#predictions').classList.remove('revealing');void $('#predictions').offsetWidth;$('#predictions').classList.add('revealing');$('#predictions').innerHTML=items.slice(0,4).map(x=>`<div class="prediction"><div class="prediction-top"><span>${x.className}</span><b>${Math.round(x.probability*100)}%</b></div><div class="prediction-track"><i style="width:${x.probability*100}%"></i></div></div>`).join('')}
function updateRound(){
  roundLocked=false;$('#roundNumber').textContent=String(round+1).padStart(2,'0');$('#roundTitle').textContent=roundText[round][0];$('#roundInstruction').textContent=roundText[round][1];$('#progressFill').style.width=((round+1)*25)+'%';$('#imageBoard').dataset.torn='no';$('#imageBoard').classList.toggle('has-tear',tears.length>0);$('#humanField').disabled=true;$('#continueBtn').disabled=true;$('#continueBtn').innerHTML='CHOOSE ONE ABOVE <span>↑</span>';document.querySelectorAll('input[name=human]').forEach(x=>x.checked=false);$('#predictions').classList.remove('revealing');$('#predictions').innerHTML='';$('#machineEmpty').style.display='block';$('#machineEmpty').textContent='The machine is hidden until you make your choice.';
}
$('#imageBoard').addEventListener('click',e=>tearAt(e.clientX,e.clientY));
$('#imageBoard').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const b=e.currentTarget.getBoundingClientRect();tearAt(b.left+b.width/2,b.top+b.height/2)}});
function finish(){
  $('#resultRows').innerHTML=records.map(r=>`<div class="result-row"><span>0${r.round}</span><div class="result-answer"><small>YOU SAW</small><b>${r.human}</b></div><div class="result-answer"><small>MACHINE SAW</small><b>${r.machine}${r.machine_confidence!==null?' · '+r.machine_confidence+'%':''}</b></div></div>`).join('');const changes=records.slice(1).filter((r,i)=>r.human!==records[i].human).length;$('#resultInsight').textContent=changes?`Your answer changed ${changes} time${changes>1?'s':''}. The image stayed the same; the amount of visible information changed the story.`:'You kept the same classification through every reveal. Did more information confirm your first impression—or make it harder to let go?';show('result')
}
$('#sampleBtn').addEventListener('click',()=>begin('sample.jpg'));
$('#fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>begin(reader.result);reader.readAsDataURL(f)});
$('#learnBtn').addEventListener('click',openGuide);$('#prevCard').addEventListener('click',()=>moveGuide(-1));$('#nextCard').addEventListener('click',()=>moveGuide(1));$('#flipCard').addEventListener('click',()=>$('.study-card.active-card')?.classList.toggle('flipped'));$('#beginTestBtn').addEventListener('click',()=>show('intro'));
$('#restartBtn').addEventListener('click',()=>{show('intro');$('#fileInput').value=''});
$('#downloadBtn').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({project:'A Little More',model_url:MODEL_URL||null,records},null,2)],{type:'application/json'}));a.download='a-little-more-results.json';a.click();URL.revokeObjectURL(a.href)});
addEventListener('resize',()=>{if(image.complete&&$('#test').classList.contains('active')){resizeCanvas();draw()}});setupHomepageReveal();setupChoices();loadModel();
