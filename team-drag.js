// Long press starts reordering; a quick swipe still pans the bracket.
export function installTeamDrag({onDrop,onError=()=>{}}){
 let gesture=null,suppressUntil=0,frame=0;
 const position=element=>{const [tid,index,side]=element.dataset.teamDrop.split('|');return {tid,index:Number(index),side:Number(side)};};
 const same=(a,b)=>a.tid===b.tid&&a.index===b.index&&a.side===b.side;
 const clear=()=>{
  if(!gesture)return;clearTimeout(gesture.timer);cancelAnimationFrame(frame);frame=0;
  gesture.source.classList.remove('team-held');gesture.target?.classList.remove('team-drop-target');
  gesture.ghost?.remove();gesture.hint?.remove();document.body.classList.remove('team-dragging');
  try{if(gesture.source.hasPointerCapture(gesture.id))gesture.source.releasePointerCapture(gesture.id);}catch{}
  gesture=null;
 };
 const targetAt=()=>{
  const element=document.elementFromPoint(gesture.x,gesture.y)?.closest('[data-team-drop]');
  const to=element?position(element):null;
  if(!to||to.tid!==gesture.from.tid||same(gesture.from,to))return null;
  return element;
 };
 function paint(){
  if(!gesture?.active)return;
  const g=gesture,box=g.viewport.getBoundingClientRect(),edge=42;
  const velocity=(point,min,max)=>point<min+edge?-Math.min(15,(min+edge-point)/4):point>max-edge?Math.min(15,(point-max+edge)/4):0;
  if(g.x>=box.left-20&&g.x<=box.right+20&&g.y>=box.top-20&&g.y<=box.bottom+20){g.viewport.scrollLeft+=velocity(g.x,box.left,box.right);g.viewport.scrollTop+=velocity(g.y,box.top,box.bottom);}
  g.ghost.style.left=`${Math.max(4,Math.min(innerWidth-230,g.x-70))}px`;g.ghost.style.top=`${Math.max(4,g.y-82)}px`;
  const target=targetAt();if(target!==g.target){g.target?.classList.remove('team-drop-target');g.target=target;target?.classList.add('team-drop-target');}
  const hint=target?(target.hasAttribute('data-drag-team')?'Laat los om teams te wisselen':'Laat los om het team te verplaatsen'):'Sleep naar een team of een lege plek';if(g.hint.textContent!==hint)g.hint.textContent=hint;
  frame=requestAnimationFrame(paint);
 }
 const activate=()=>{
  if(!gesture)return;const g=gesture;g.active=true;suppressUntil=Infinity;
  document.body.classList.add('team-dragging');g.source.classList.add('team-held');
  const ghost=document.createElement('div');ghost.className='team-drag-ghost';ghost.setAttribute('aria-hidden','true');
  const badge=g.source.querySelector('.badge');if(badge)ghost.append(badge.cloneNode(true));
  const label=document.createElement('span');label.textContent=g.source.querySelector('[title]')?.title||'Team verplaatsen';ghost.append(label);document.body.append(ghost);g.ghost=ghost;
  const hint=document.createElement('div');hint.className='team-drag-hint';hint.setAttribute('role','status');document.body.append(hint);g.hint=hint;
  try{navigator.vibrate?.(15);}catch{}paint();
 };
 document.addEventListener('pointerdown',event=>{
  if(event.isPrimary)suppressUntil=0;
  if(!event.isPrimary){if(gesture){suppressUntil=Infinity;clear();}return;}
  const source=event.target.closest('.tree-team[data-drag-team]');if(!source||event.button!==0||gesture)return;
  const viewport=source.closest('.tree-viewport');if(!viewport)return;
  gesture={id:event.pointerId,source,viewport,from:position(source),x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,active:false,panning:false};
  try{source.setPointerCapture(event.pointerId);}catch{}
  gesture.timer=setTimeout(activate,420);
 },true);
 document.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;const g=gesture;g.x=event.clientX;g.y=event.clientY;
  if(!g.active&&!g.panning&&Math.hypot(g.x-g.startX,g.y-g.startY)>9){clearTimeout(g.timer);g.panning=true;}
  if(g.active||g.panning){event.preventDefault();suppressUntil=Infinity;}
  if(g.panning){g.viewport.scrollLeft=g.left-(g.x-g.startX);g.viewport.scrollTop=g.top-(g.y-g.startY);}
 },{capture:true,passive:false});
 document.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;const g=gesture;
  g.x=event.clientX;g.y=event.clientY;
  const target=g.active?targetAt():null;const to=target?position(target):null;const from=g.from;
  if(g.active||g.panning){event.preventDefault();suppressUntil=Infinity;}
  clear();if(to)Promise.resolve(onDrop(from,to)).catch(onError);
 },true);
 document.addEventListener('pointercancel',()=>{if(gesture){suppressUntil=Infinity;clear();}},true);
 document.addEventListener('click',event=>{if(event.detail>0&&Date.now()<suppressUntil&&event.target.closest('.tree-viewport')){suppressUntil=0;event.preventDefault();event.stopImmediatePropagation();}},true);
 document.addEventListener('contextmenu',event=>{if(event.target.closest('.tree-team[data-drag-team]'))event.preventDefault();});
 document.addEventListener('dragstart',event=>{if(event.target.closest('.tree-team'))event.preventDefault();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){suppressUntil=Infinity;clear();}});
 window.addEventListener('blur',()=>{if(gesture){suppressUntil=Infinity;clear();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
}
