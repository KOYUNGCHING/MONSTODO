// No dependencies. Exercise the real inline app in a minimal DOM harness.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.textContent='';this.style={setProperty(){}};this.dataset={};this.attributes={};this.hidden=false;this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  append(...nodes){this.children.push(...nodes)}
  prepend(...nodes){this.children.unshift(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(){}
  focus(){}
  showModal(){this.open=true}
  close(){this.open=false}
  scrollIntoView(){}
  get options(){return this.children}
}
const nodes=new Map();
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)},createElement:tag=>new Element(tag),querySelectorAll:()=>[],addEventListener(){},documentElement:new Element()};
let saved=null;
const context=vm.createContext({document,console,crypto:require('node:crypto').webcrypto,Date,Intl,Math,Set,Promise,Object,JSON,Number,String,Array,isNaN,localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v},window:{addEventListener(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},matchMedia:()=>({matches:false})});
vm.runInContext(script,context);
const run=s=>vm.runInContext(s,context);
const plain=s=>JSON.parse(JSON.stringify(run(s)));
let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name)}
function fixture(){run(`data={version:1,categories:defaults(),tasks:[]};$('search').value='';$('categoryFilter').value='all';$('statusFilter').value='all';$('priorityFilter').value='all';storageBlocked=false;view='list';celebrationTimer=null;`)}
const add=(id,patch={})=>run(`data.tasks.push(Object.assign({id:${JSON.stringify(id)},title:${JSON.stringify(id)},description:'',categoryId:'study',date:'2026-10-20',time:'23:59',priority:'medium',completed:false,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',completedAt:null,subtasks:[]},${JSON.stringify(patch)}))`);
test('Validates local dates, leap years, and time boundaries',()=>{assert.equal(run("validDate('2028-02-29')"),true);assert.equal(run("validDate('2027-02-29')"),false);assert.equal(run("validDate('2026-04-31')"),false);assert.equal(run("validDate('0000-01-01')"),false);assert.equal(run("validTime('24:00')"),false);assert.equal(run("validTime('23:59')"),true)});
test('Deadline precedes priority; ties use priority then creation time',()=>{fixture();add('later-high',{date:'2026-10-22',priority:'high'});add('earlier-low',{priority:'low'});add('earlier-high-new',{priority:'high',createdAt:'2026-10-02T00:00:00Z'});add('earlier-high-old',{priority:'high'});assert.deepEqual(plain('filtered().map(t=>t.id)'),['earlier-high-old','earlier-high-new','earlier-low','later-high'])});
test('Completed tasks sort after pending and by completion descending',()=>{fixture();add('old',{completed:true,completedAt:'2026-10-18T00:00:00Z'});add('new',{completed:true,completedAt:'2026-10-19T00:00:00Z'});add('pending');assert.deepEqual(plain('filtered().map(t=>t.id)'),['pending','new','old'])});
test('Search descriptions combines with category, state, and priority',()=>{fixture();add('match',{description:'Research notes',priority:'high'});add('wrong-category',{description:'Research',priority:'high',categoryId:'work'});add('wrong-priority',{description:'Research'});run("$('search').value='research';$('categoryFilter').value='study';$('statusFilter').value='pending';$('priorityFilter').value='high'");assert.deepEqual(plain('filtered().map(t=>t.id)'),['match'])});
test('Deadline statuses cover overdue, urgent, upcoming, normal, completed',()=>{fixture();const base=Date.now();for(const [id,offset] of [['overdue',-2],['urgent',12],['upcoming',48],['normal',120]]){const d=new Date(base+offset*3600000);add(id,{date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`})}assert.deepEqual(plain('data.tasks.map(t=>deadlineInfo(t)[0])'),['overdue','urgent','upcoming','normal']);run('data.tasks[0].completed=true');assert.equal(run('deadlineInfo(data.tasks[0])[0]'),'completed-state')});
test('Dashboard distinguishes today deadlines from actual completions today',()=>{fixture();const day=run('today()'),now=new Date().toISOString();add('due-today-pending',{date:day});add('due-today-completed',{date:day,completed:true,completedAt:'2020-01-01T00:00:00Z'});add('completed-today-other-date',{date:'2020-01-01',completed:true,completedAt:now});run('renderDashboard()');assert.equal(String(run("$('statToday').textContent")),'1');assert.equal(String(run("$('statCompleted').textContent")),'1');assert.equal(run("$('todayProgressText').textContent"),'1 / 2 · 50%')});
test('No deadlines today hides percentage',()=>{fixture();run('renderDashboard()');assert.equal(run("$('todayTrack').hidden"),true);assert.equal(run("$('todayProgressText').textContent"),'今天沒有到期任務')});
test('Monster mood priority: worried > nervous > happy > sleeping',()=>{fixture();run('setMood()');assert.equal(run("$('monster').dataset.mood"),'sleeping');add('future',{date:'9999-01-01'});run('setMood()');assert.equal(run("$('monster').dataset.mood"),'happy');add('today',{date:run('today()')});run('setMood()');assert.equal(run("$('monster').dataset.mood"),'nervous');add('overdue',{date:'2020-01-01'});run('setMood()');assert.equal(run("$('monster').dataset.mood"),'worried')});
test('Persistence round trip keeps task and subtasks',()=>{fixture();add('persist',{subtasks:[{id:'s',title:'Step',completed:true}]});run('persist();data.tasks=[];load()');assert.equal(run('data.tasks.length'),1);assert.equal(run('data.tasks[0].subtasks[0].completed'),true)});
test('Malformed storage remains intact and app stays usable',()=>{fixture();saved='{broken';run('load();persist();render()');assert.equal(saved,'{broken');assert.equal(run('storageBlocked'),true);assert.equal(run("$('storageWarning').hidden"),false)});
test('Restores reserved Other and repairs orphan category without losing task',()=>{fixture();add('orphan',{categoryId:'missing'});saved=run('JSON.stringify({...data,categories:[]})');run('load()');assert.equal(run('data.tasks.length'),1);assert.equal(run("data.categories[0].id"),'other');assert.equal(run('data.tasks[0].categoryId'),'other')});
test('Corrupt records do not block valid records',()=>{fixture();add('valid');add('bad',{date:'2026-02-30'});saved=run('JSON.stringify(data)');run('load()');assert.deepEqual(plain('data.tasks.map(t=>t.id)'),['valid'])});
test('Calendar spans leap day and year transitions in local dates',()=>{fixture();run("view='calendar';month=new Date(2028,1,1);renderCalendar()");let labels=plain("$('calendarGrid').children.slice(7).map(n=>n.attributes['aria-label'])");assert.equal(labels.length,42);assert.ok(labels.some(s=>s.startsWith('2028-02-29')));run("month=new Date(2026,11,1);renderCalendar()");labels=plain("$('calendarGrid').children.slice(7).map(n=>n.attributes['aria-label'])");assert.ok(labels.some(s=>s.startsWith('2027-01-01')))});
console.log(`${count} regression checks passed.`);
