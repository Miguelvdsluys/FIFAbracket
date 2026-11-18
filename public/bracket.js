// Match coordinates follow the existing tournament indices; no reseeding occurs.
export function bracketLayout(t){
 const cardWidth=180,cardHeight=104,gap=44,depth=t.rounds.length-1;
 const width=48+(depth*2+1)*cardWidth+depth*2*gap;
 const height=Math.max(350,(t.rounds[0].length/2)*140+120);
 const nodes=[],headers=[];
 for(let r=0;r<t.rounds.length;r++){
  const round=t.rounds[r];
  if(r===depth){nodes.push({round:r,index:0,side:'final',x:(width-cardWidth)/2,y:(height-cardHeight)/2});continue;}
  const count=round.length/2;
  for(const side of ['left','right']){
   const x=side==='left'?24+r*(cardWidth+gap):width-24-cardWidth-r*(cardWidth+gap);
   headers.push({round:r,side,x});
   for(let local=0;local<count;local++)nodes.push({round:r,index:local+(side==='right'?count:0),side,x,y:60+(local+.5)*(height-120)/count-cardHeight/2});
  }
 }
 const edges=nodes.filter(n=>n.side!=='final').map(n=>{
  const target=nodes.find(next=>next.round===n.round+1&&next.index===Math.floor(n.index/2));
  const x1=n.side==='left'?n.x+cardWidth:n.x,x2=n.side==='left'?target.x:target.x+cardWidth;
  const y1=n.y+cardHeight/2,y2=target.y+cardHeight/2,middle=(x1+x2)/2;
  return {from:[n.round,n.index],to:[target.round,target.index],path:`M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`};
 });
 return {width,height,cardWidth,cardHeight,nodes,edges,headers};
}

export function linearBracketLayout(t){
 const cardWidth=244,cardHeight=126,gap=100,top=80;
 const height=Math.max(400,t.rounds[0].length*180+100);
 const width=32+t.rounds.length*cardWidth+(t.rounds.length-1)*gap;
 const nodes=[],headers=[];
 t.rounds.forEach((round,r)=>{const x=16+r*(cardWidth+gap);headers.push({round:r,side:'left',x});round.forEach((m,i)=>nodes.push({round:r,index:i,side:r===t.rounds.length-1?'final':'left',x,y:top+(i+.5)*(height-100)/round.length-cardHeight/2}));});
 const edges=nodes.filter(n=>n.round<t.rounds.length-1).map(n=>{const target=nodes.find(next=>next.round===n.round+1&&next.index===Math.floor(n.index/2));const x1=n.x+cardWidth,x2=target.x,y1=n.y+cardHeight/2,y2=target.y+cardHeight/2;return {from:[n.round,n.index],to:[target.round,target.index],path:`M ${x1} ${y1} H ${(x1+x2)/2} V ${y2} H ${x2}`};});
 return {width,height,cardWidth,cardHeight,nodes,edges,headers};
}
