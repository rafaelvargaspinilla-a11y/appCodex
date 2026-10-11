import type { Result } from './model';
export type PreviousSet={left:Result;right:Result;split:boolean};
const empty=():Result=>({weight:null,reps:null,rir:'',failure:false,partials:null});
export function historicalResults(raw:string,unilateral:boolean):PreviousSet[]{
  let weight:number|null=null,unit='kg';const results:PreviousSet[]=[];
  const state:{pending:{result:Result;side:string}|null}={pending:null};
  const add=(r:Result,side:string)=>{
    if(!unilateral||side==='ambas'){if(state.pending){results.push(single(state.pending.result,state.pending.side));state.pending=null;}results.push(single(r,''));return;}
    if(!state.pending){state.pending={result:r,side};return;}
    if(state.pending.side!==side&&(state.pending.side||side)){
      const left=state.pending.side==='left'||side==='right'?state.pending.result:r;
      const right=state.pending.side==='right'||side==='left'?state.pending.result:r;
      results.push({left:{...left},right:{...right},split:true});state.pending=null;
    }else {results.push(single(state.pending.result,state.pending.side));state.pending={result:r,side};}
  };
  for(let segment of raw.slice(raw.indexOf('->')+2).split('//')){
    segment=segment.trim().replace(/^(?:\d+\s*[-–]\s*\d+\s*\([^)]*\)|AMRAP)\s*/i,'');
    // Special techniques never become ordinary series or feed later inherited loads.
    const special=segment.search(/\bcluster\b|\bdropset\b|\+\s*(?:\d+)?DS\b/i);
    const body=special<0?segment:segment.slice(0,special);
    const token=/(\d+(?:[.,'’]\d+)?)\s*(kg|lbs)\b|(?<![\d–-])(\d+)\s*\(([^)]*)\)\s*(izq(?:uierda)?|dch|derecha|ambas)?/gi;
    for(const m of body.matchAll(token)){
      if(m[1]){weight=Number(m[1].replace(/[,'’]/,'.'));unit=m[2].toLowerCase();continue;}
      // A range such as 6–7 reps or an approximate annotation stays unknown.
      if(/[\d]\s*[-–]\s*$/.test(body.slice(0,m.index))||unit!=='kg')continue;
      const annotation=m[4].trim(),rirMatch=annotation.match(/^\+(\d+)(?:\+(\d+))?$/);
      const normalized=rirMatch?(rirMatch[2]?[rirMatch[1],rirMatch[2]].map(Number).sort((a,b)=>a-b).join('–'):rirMatch[1]):'';
      const rir=/^(|[0-9]|10|0–1|1–2|2–3)$/.test(normalized)?normalized:'';
      const partial=annotation.match(/^\+?(\d+)?\s*parcial(?:es)?$/i);
      const known=!annotation||!!rirMatch||!!partial||/^\+?fallo$/i.test(annotation);
      const r:Result={weight,reps:known?Number(m[3]):null,rir,failure:/fallo/i.test(annotation),partials:partial?Number(partial[1]??1):null};
      const label=m[5]?.toLowerCase()??'';add(r,label.startsWith('izq')?'left':['dch','derecha'].includes(label)?'right':label);
    }
    if(special>=0)break;
  }
  if(state.pending)results.push(single(state.pending.result,state.pending.side));
  return results;
}
function single(r:Result,side:string):PreviousSet{return side?{left:side==='left'?{...r}:empty(),right:side==='right'?{...r}:empty(),split:true}:{left:{...r},right:{...r},split:false};}
