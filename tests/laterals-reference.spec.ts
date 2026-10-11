import {test,expect} from '@playwright/test';
import {existsSync,readFileSync} from 'node:fs';
import {createSession} from '../src/model';
import {prepareExistingSession} from '../src/training';
import type {Data} from '../src/model';
const history={format:'beast-log-history' as const,version:1 as const,files:[{name:'fixture.txt',text:'Bloque 7\nSemana 5\nDia A\n1. Elevaciones laterales -> 8-10(+0) 12kg 8(+fallo) CONTROLAR, 5(+0) bajada\n2. Press inclinado con mancuernas -> 30kg 4(+0) // 24kg 7(+0)\nDia B\n1. Elevaciones laterales -> 14kg 11(+0), 8(+0)'}]};
test('A6 toma laterales de A5, corrige la precarga guardada y respeta ediciones y series realizadas',()=>{
 const data:Data={version:1,sessions:[],weights:[],history};
 const fresh=createSession(7,6,'A','2026-10-11',data);expect(fresh.exercises[0].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[12,8],[12,5]]);expect(fresh.exercises[1].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[30,4],[24,7]]);
 const wrong=structuredClone(fresh);wrong.prefillVersion=2;
 wrong.exercises[0].sets.forEach((s,i)=>{const value={...s.left,weight:14,reps:i===0?11:8,failure:false};s.left={...value};s.right={...value};s.previous={left:{...value},right:{...value},split:false,label:'Bloque 7 · semana 5 · día B'};});
 const fixed=prepareExistingSession({...data,sessions:[wrong]},wrong);expect(fixed.exercises[0].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[12,8],[12,5]]);expect(fixed.id).toBe(wrong.id);expect(fixed.startedAt).toBe(wrong.startedAt);expect(fixed.exercises[1]).toEqual(wrong.exercises[1]);
 wrong.exercises[0].sets[0].left.weight=18;wrong.exercises[0].sets[1].done=true;
 const preserved=prepareExistingSession({...data,sessions:[wrong]},wrong);expect(preserved.exercises[0].sets[0].left.weight).toBe(18);expect(preserved.exercises[0].sets[1]).toEqual(wrong.exercises[0].sets[1]);
 const finished={...wrong,finished:true};expect(prepareExistingSession({...data,sessions:[finished]},finished)).toBe(finished);
});
test('el original privado confirma 16 kg, 8 y 5 reps de A5 para A6',()=>{
 const path='docs/sources/Gym 7.txt';test.skip(!existsSync(path),'Histórico privado no disponible');
 const data:Data={version:1,sessions:[],weights:[],history:{format:'beast-log-history',version:1,files:[{name:'Gym 7.txt',text:readFileSync(path,'utf8')}]}};
 const session=createSession(7,6,'A','2026-10-11',data);
 expect(session.exercises[0].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[16,8],[16,5]]);expect(session.exercises[0].sets[0].previous?.label).toBe('Bloque 7 · semana 5 · día A');expect(session.exercises[1].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[34,4],[28,7]]);expect(session.exercises[2].sets.map(s=>[s.left.weight,s.left.reps])).toEqual([[32,8],[32,7]]);
});
