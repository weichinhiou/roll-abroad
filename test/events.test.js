import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../src/engine.js";
const json = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),"utf8"));
const board=await json("board"), events=await json("events"), checkpoints=(await json("checkpoints")).checkpoints;
const data={checkpoints};
const byId=new Map(events.cards.map(c=>[c.id,c]));

function play(seed) {
  let s=E.initialState({seed}),policy=E.initialState({seed:`${seed}-choices`});
  for(let step=0;step<100 && s.status!=="done";step++) {
    if(s.status==="ready") {
      s=E.applyMove(E.rollDie(s),board);
      const sq=board.squares.find(q=>q.n===s.pos);
      s=sq.kind==="milestone"?E.checkpointAt(s,board,data):E.drawCard(s,board,events,sq);
      if(s.pendingEvent) {
        const card=byId.get(s.pendingEvent.id);
        assert.equal(s.pendingEvent.deck,card.deck);
        assert.ok(card.route==="both" || card.route===s.route,`${card.id} 路線錯誤`);
      }
    } else {
      const block=s.pendingEvent||s.pendingCheckpoint;
      assert.ok(block,`無法繼續：${seed}`);
      policy=E.rollDie(policy);
      s=E.applyChoice(s,block,block.choices[policy.rng%block.choices.length],data);
    }
    for(const k of E.RES_KEYS) assert.ok(s.res[k]>=0&&s.res[k]<=10);
    assert.ok(s.res.knowledge>=0);
  }
  assert.equal(s.status,"done",`死局：${seed}`);
  assert.equal(s.pos,24);
  assert.ok(s.ending);
  return s;
}

test("36 張事件 ID 唯一，選項效果與所有連鎖目標有效",()=>{
  assert.equal(events.cards.length,36);
  assert.equal(byId.size,36);
  const keys=new Set(["time","money","energy","knowledge","penalty","flagLoss"]);
  for(const c of events.cards){
    assert.ok(["chance","fate"].includes(c.deck));assert.ok(c.choices.length>=2);
    for(const ch of c.choices){
      if(ch.chain) assert.ok(byId.has(ch.chain),`${c.id} 指向不存在的 ${ch.chain}`);
      for(const k of Object.keys(ch.effects||{}))assert.ok(keys.has(k));
    }
  }
});

test("口報問答只在口報前情之後出現，兩個選項都排入後續",()=>{
  let s=E.initialState({seed:"oral-qa",route:"oral"});
  assert.equal(E.isEligible(byId.get("S04b"),s),false);
  for(const ch of byId.get("S04").choices){
    const next=E.applyChoice(s,byId.get("S04"),ch,data);
    const drawn=E.drawCard(next,board,events,board.squares[14]);
    assert.equal(drawn.pendingEvent.id,"S04b");
  }
});

test("1,000 局：死局 0、36 張都抽得到、路線正確、資源合法",t=>{
  const seen=new Set(),endings={},routes={},rolls=[];
  for(let i=0;i<1000;i++){
    const s=play(`events-36-${i}`);s.drawn.forEach(id=>seen.add(id));
    endings[s.ending.id]=(endings[s.ending.id]||0)+1;
    routes[s.route]=(routes[s.route]||0)+1;rolls.push(s.rolls);
  }
  assert.deepEqual([...seen].sort(),[...byId.keys()].sort());
  assert.deepEqual(play("repeat-events"),play("repeat-events"));
  const mean=rolls.reduce((a,b)=>a+b,0)/1000;
  assert.ok(mean>=10&&mean<=15);
  t.diagnostic(JSON.stringify({games:1000,deadlocks:0,cards:seen.size,endings,routes,meanRolls:mean,minRolls:Math.min(...rolls),maxRolls:Math.max(...rolls)}));
});
