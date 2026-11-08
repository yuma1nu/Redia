import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlan,validatePlanView} from '../src/shared/plans.ts';
import {barGeometry,insertPlan,monthBands,timelineRange,timelineResize,timelineWindowDays,timelineDayLabels,groupPlanRows} from '../src/shared/timeline.ts';

test('all-theme groups follow theme order, retain row order, omit empty groups and keep undated/unassigned rows',()=>{
  const a=emptyPlan('A','a'),b=emptyPlan('B','b'),c=emptyPlan('C','a'),none=emptyPlan('none');
  const rows=[b,a,none,c],before=JSON.stringify(rows);
  const groups=groupPlanRows(rows,[{id:'a',name:'Theme A'},{id:'empty',name:'Empty'},{id:'b',name:'Theme B'}]);
  assert.deepEqual(groups.map(g=>[g.id,g.rows.map(r=>r.id)]),[['a',[a.id,c.id]],['b',[b.id]],[null,[none.id]]]);assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(groupPlanRows([],[]),[]);
});

test('calendar selection includes both endpoints, handles reverse dragging and bounds, and respects leap years',()=>{
  assert.deepEqual(timelineRange('2024-02-27',3,1,7),{start:'2024-02-28',end:'2024-03-01'});
  assert.deepEqual(timelineRange('2026-11-01',2,2,30),{start:'2026-11-03',end:'2026-11-03'});
  assert.deepEqual(timelineRange('2026-11-01',-2,999,4),{start:'2026-11-01',end:'2026-11-04'});
  assert.deepEqual(monthBands('2024-02-28',4),[{offset:0,days:2,label:'2024-02'},{offset:2,days:2,label:'2024-03'}]);
});
test('single bars and resize gestures retain all hidden comparison data and page associations',()=>{
  const row={...emptyPlan('行'),start:'2026-11-03',end:null,baselineStart:'2026-10-01',baselineEnd:'2026-10-05',actualStart:'2026-10-03',actualEnd:'2026-10-07'};
  const resized=timelineResize(row,2,'end');assert.equal(resized.start,'2026-11-03');assert.equal(resized.end,'2026-11-05');
  assert.deepEqual({...resized,start:row.start,end:row.end},row);
  assert.deepEqual(barGeometry(row,'2026-11-01',20,34),{left:68,width:34,outside:false});assert.equal(barGeometry({...row,start:null},'2026-11-01',20,34),undefined);
  assert.equal(barGeometry({...row,start:'2026-12-01'},'2026-11-01',20,34)?.outside,true);
  const second=emptyPlan('後の行'),added=emptyPlan('挿入する行');assert.deepEqual(insertPlan([row,second],added,row.id).map(row=>row.id),[row.id,added.id,second.id]);
});
test('legacy plan view defaults to expanded titles and validates persisted collapse state',()=>{
  const old={theme:'all',query:'',selectedId:null,compare:true,scale:'week',from:'2026-11-01',scrollLeft:0,scrollTop:0};
  assert.equal(validatePlanView(old).listCollapsed,false);assert.equal(validatePlanView({...old,listCollapsed:true}).listCollapsed,true);assert.throws(()=>validatePlanView({...old,listCollapsed:'true'}));
  assert.equal(validatePlanView({...old,scale:'day'}).scale,'week');assert.equal(validatePlanView({...old,scale:'quarter'}).scale,'quarter');
});
test('timeline windows fit two weeks, one or three calendar months and show only Mondays when dates are dense',()=>{
  assert.equal(timelineWindowDays('2026-11-01','week'),14);assert.equal(timelineWindowDays('2024-02-01','month'),29);
  assert.equal(timelineWindowDays('2026-01-31','month'),28);assert.equal(timelineWindowDays('2026-11-07','quarter'),92);
  assert.equal(timelineWindowDays('9999-12-31','quarter'),1);
  assert.equal(timelineDayLabels('2026-11-01',30,30).length,30);
  assert.deepEqual(timelineDayLabels('2026-11-01',14,10).map(day=>day.date),['2026-11-02','2026-11-09']);
  assert.ok(timelineDayLabels('2026-11-01',92,100,true).every(day=>day.weekday===1));
});
