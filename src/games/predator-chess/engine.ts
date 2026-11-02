export type Color = 'w' | 'b';
export type Kind = 'k'|'p'|'n'|'b'|'r'|'q'|'x';
export type Piece = { c: Color; t: Kind; id: string; moved?: boolean };
export type Move = { from: number; to: number; ep?: number; castle?: number; promote?: Kind };
export type State = { board: (Piece|null)[]; turn: Color; ep: number|null; swept: Record<Color,string[]>; log: string[]; result: string|null; quiet: number; positions: Record<string,number> };
export const other = (c: Color): Color => c==='w'?'b':'w';
export const side = (c: Color) => c==='w'?'White':'Black';
export const square = (i: number) => 'abcdefgh'[i%8]+(8-Math.floor(i/8));
const row = (i: number) => Math.floor(i/8);
const col = (i: number) => i%8;
const prey = (p: Piece) => ['p','n','b'].includes(p.t);
export function initial(): State {
 const board: (Piece|null)[] = Array(64).fill(null);
 for(const c of ['b','w'] as Color[]) {
  const r=c==='w'?7:0, p=c==='w'?6:1;
  'rnbxkbnr'.split('').forEach((t,f)=>board[r*8+f]={c,t:t as Kind,id:c+square(r*8+f)});
  for(let f=0;f<8;f++) board[p*8+f]={c,t:'p',id:c+square(p*8+f)};
 }
 const s: State={board,turn:'w',ep:null,swept:{w:[],b:[]},log:[],result:null,quiet:0,positions:{}};
 s.positions[key(s)]=1; return s;
}
export function attacked(b: State['board'], target: number, by: Color): boolean {
 return b.some((p,i)=>{
  if(!p||p.c!==by) return false;
  const dr=row(target)-row(i), dc=col(target)-col(i), a=Math.abs(dr),d=Math.abs(dc);
  if(p.t==='p') return dr===(by==='w'?-1:1)&&d===1;
  if(p.t==='n') return a*d===2;
  if(p.t==='k') return Math.max(a,d)===1;
  if(!(dr||dc)|| !((['r','q','x'].includes(p.t)&&(dr===0||dc===0))||(['b','q','x'].includes(p.t)&&a===d))) return false;
  const step=Math.sign(dr)*8+Math.sign(dc);
  for(let j=i+step;j!==target;j+=step) if(b[j]) return false;
  return true;
 });
}
export function inCheck(s: State,c: Color) { const k=s.board.findIndex(p=>p?.c===c&&p.t==='k'); return k<0||attacked(s.board,k,other(c)); }
function pseudo(s: State, i: number): Move[] {
 const p=s.board[i]; if(!p) return [];
 const out: Move[]=[];
 const add=(to:number,extra:Partial<Move>={})=>{ const q=s.board[to]; if(q?.c===p.c||q?.t==='k')return; if(p.t==='p'&&(row(to)===0||row(to)===7)) for(const promote of ['q','r','b','n'] as Kind[])out.push({from:i,to,...extra,promote}); else out.push({from:i,to,...extra}); };
 if(p.t==='p') {
  const d=p.c==='w'?-1:1, next=i+d*8;
  if(next>=0&&next<64&&!s.board[next]) {add(next);if(row(i)===(p.c==='w'?6:1)&&!s.board[i+d*16])add(i+d*16);}
  for(const f of [-1,1]) if(col(i)+f>=0&&col(i)+f<8&&row(i)+d>=0&&row(i)+d<8) {
   const to=next+f;
   if(s.board[to]?.c===other(p.c))add(to);
   else if(to===s.ep&&s.board[i+f]?.t==='p'&&s.board[i+f]?.c===other(p.c))add(to,{ep:i+f});
  }
 } else if(p.t==='n'||p.t==='k') {
  const ds=p.t==='n'?[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for(const [dr,dc] of ds)if(row(i)+dr>=0&&row(i)+dr<8&&col(i)+dc>=0&&col(i)+dc<8)add(i+dr*8+dc);
  if(p.t==='k'&&!p.moved&&i===(p.c==='w'?60:4)&&!inCheck(s,p.c))for(const f of [0,7]) {
   const rook=row(i)*8+f, rp=s.board[rook], d=f===0?-1:1;
   if(rp?.t!=='r'||rp.c!==p.c||rp.moved)continue;
   let clear=true;for(let j=i+d;j!==rook;j+=d)if(s.board[j])clear=false;
   const b=s.board.slice();b[i]=null;b[i+d]=p;
   if(clear&&!attacked(b,i+d,other(p.c)))add(i+d*2,{castle:rook});
  }
 } else {
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].filter(([dr,dc])=>p.t==='r'?dr===0||dc===0:p.t==='b'?dr!==0&&dc!==0:true);
  for(const [dr,dc] of dirs)for(let r=row(i)+dr,c=col(i)+dc;r>=0&&r<8&&c>=0&&c<8;r+=dr,c+=dc){const to=r*8+c;add(to);if(s.board[to])break;}
 }
 return out;
}
function applyBoard(s: State,m: Move): State {
 const n: State={...s,board:s.board.map(p=>p?{...p}:null),swept:{w:[...s.swept.w],b:[...s.swept.b]},log:[...s.log],positions:{...s.positions}};
 const p=n.board[m.from]!;n.board[m.to]={...p,t:m.promote||p.t,moved:true};n.board[m.from]=null;
 if(m.ep!==undefined)n.board[m.ep]=null;
 if(m.castle!==undefined){const to=(m.from+m.to)/2;n.board[to]={...n.board[m.castle]!,moved:true};n.board[m.castle]=null;}
 n.ep=p.t==='p'&&Math.abs(m.to-m.from)===16?(m.to+m.from)/2:null;return n;
}
export function respawns(s: State, m: Move): number[] {
 const victim=s.board[m.to], p=s.board[m.from]!;
 if(victim?.t!=='x'||p.t==='k')return [];
 const n=applyBoard(s,m), out:number[]=[];
 n.board.forEach((q,i)=>{if(!q){n.board[i]={...victim,moved:true};if(!inCheck(n,p.c))out.push(i);n.board[i]=null;}});return out;
}
export function legal(s: State): { moves: Move[]; forced: boolean } {
 if(s.result)return {moves:[],forced:false};
 const moves:Move[]=[];
 s.board.forEach((p,i)=>{if(p?.c===s.turn)for(const m of pseudo(s,i)) {
  const victim=s.board[m.to];
  if(victim?.t==='x'&&p.t!=='k') {if(respawns(s,m).length)moves.push(m);}
  else if(!inCheck(applyBoard(s,m),s.turn))moves.push(m);
 }});
 const forced=moves.filter(m=>s.board[m.from]?.t==='x'&&!!s.board[m.to]&&prey(s.board[m.to]!));
 return {moves:forced.length?forced:moves,forced:forced.length>0};
}
function key(s:State){return JSON.stringify([s.board.map(p=>p?[p.c,p.t,(['k','r'].includes(p.t)&&!p.moved)?1:0]:null),s.turn,s.ep,s.swept]);}
export function play(s:State,m:Move,random= Math.random):State {
 if(!legal(s).moves.some(a=>JSON.stringify(a)===JSON.stringify(m)))throw Error('Illegal move');
 const p=s.board[m.from]!, victim=s.board[m.to]|| (m.ep!==undefined?s.board[m.ep]:null);
 const n=applyBoard(s,m); let suffix='';
 if(victim?.t==='x') {
  if(p.t==='k')n.result=`${side(p.c)} wins — king captures Predator.`;
  else {const options=respawns(s,m);const at=options[Math.min(options.length-1,Math.floor(random()*options.length))];n.board[at]={...victim,moved:true};suffix=` · ${side(victim.c)} Predator respawns at ${square(at)}`;}
 }
 if(p.t==='x'&&victim&&originalPrey(victim)) {
  n.swept[p.c].push(victim.id);
  if(n.swept[p.c].length===12)n.result=`${side(p.c)} wins — Predator sweep!`;
 }
 n.log.push(`${side(p.c)}: ${p.t==='x'?'Predator':p.t.toUpperCase()} ${square(m.from)}${victim?' × ':' → '}${square(m.to)}${m.promote?' = '+m.promote.toUpperCase():''}${suffix}`);
 n.turn=other(s.turn);n.quiet=(p.t==='p'||victim)?0:s.quiet+1;
 const k=key(n);n.positions[k]=(n.positions[k]||0)+1;
 if(!n.result&&!legal(n).moves.length)n.result=inCheck(n,n.turn)?'Draw — checkmate (this variant requires a Predator win).':'Draw — stalemate.';
 if(!n.result&&(n.quiet>=100||n.positions[k]>=3))n.result=n.quiet>=100?'Draw — 50 moves without a pawn move or capture.':'Draw — threefold repetition.';
 return n;
}
function originalPrey(p:Piece){return /^[wb][a-h][27]$/.test(p.id)||/^[wb][bcfg][18]$/.test(p.id);}
