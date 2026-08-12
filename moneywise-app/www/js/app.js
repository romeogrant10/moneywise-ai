"use strict";
/* ============================================================
   MoneyWise AI — single-file MVP
   * localStorage persistence (works offline, no backend to test)
   * local rule-based AI Coach (swap aiReply() for a server-side
     LLM call in production — keys never ship to the client)
   ============================================================ */
var LS="mw_state_v1";

/* Update check — bump APP_VERSION here when cutting a release, and in
   www/versions.json (served at /versions.json). The app fetches the LIVE
   manifest (hosted URL), not the bundled one, and prompts to update. */
var APP_VERSION="1.0.0";
var UPDATE_MANIFEST_URL="";       /* "" => location.origin + /versions.json. Set to the hosted URL for native builds. */
var UPDATE_DISMISS_LS="mw_update_dismissed";
var CATS=[
  {k:"housing",n:"Housing",icon:"\u{1F3E0}"},
  {k:"utilities",n:"Utilities",icon:"\u{1F4A1}"},
  {k:"transportation",n:"Transportation",icon:"\u{1F697}"},
  {k:"food",n:"Food",icon:"\u{1F37D}"},
  {k:"insurance",n:"Insurance",icon:"\u{1F6E1}"},
  {k:"debt",n:"Debt payments",icon:"\u{1F4B3}"},
  {k:"subscriptions",n:"Subscriptions",icon:"\u{1F4F1}"},
  {k:"entertainment",n:"Entertainment",icon:"\u{1F3AC}"},
  {k:"shopping",n:"Shopping",icon:"\u{1F6CD}"},
  {k:"savings",n:"Savings",icon:"\u{1F437}"},
  {k:"other",n:"Other",icon:"\u{1F4E6}"}
];
var CAT_KEYS=CATS.map(function(c){return c.k;});
function blankBudget(){var b={};CAT_KEYS.forEach(function(k){b[k]=0;});return b;}
function defaultState(){
  return{onboarded:false,step:0,name:"",goal:"",income:0,payFrequency:"monthly",savings:0,
    budget:blankBudget(),debts:[],goals:[],premium:false,strategy:"avalanche",extra:0,aiServer:false,
    notif:{remind:false,bills:false,savings:false,debt:false,goals:false},
    incomePrefs:{hours:"",remote:"",skills:[]}};
}
var S=defaultState();
function load(){try{var r=JSON.parse(localStorage.getItem(LS));if(r&&typeof r==="object")S=Object.assign(defaultState(),r);}catch(e){S=defaultState();}}
function save(){localStorage.setItem(LS,JSON.stringify(S));}
function uid(){return "id"+Date.now()+Math.random().toString(16).slice(2,6);}
function num(v){return parseFloat(v)||0;}
function living(){return CAT_KEYS.filter(function(k){return k!=="savings";}).reduce(function(a,k){return a+num(S.budget[k]);},0);}
function totalExp(){return CAT_KEYS.reduce(function(a,k){return a+num(S.budget[k]);},0);}
function income(){return num(S.income);}
function monthlyFree(){return income()-totalExp();}
function monthly(){return income()-totalExp();}
function debtTotal(){return (S.debts||[]).reduce(function(a,d){return a+num(d.balance);},0);}
function debtMonthly(){return (S.debts||[]).reduce(function(a,d){return a+num(d.min);},0);}
function moneyFmt(n){n=num(n);var a=Math.abs(n);var s=a.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:a<100&&a%1!==0?2:0});return n<0?"-"+s:s;}
function healthScore(){
  var inc=income(),exp=living(),h=50;
  if(inc>0){var r=exp/inc;if(r<=0.5)h+=20;else if(r<=0.7)h+=12;else if(r<=0.85)h+=4;else h-=10;}
  var sr=inc>0?num(S.budget.savings)/inc:0;
  if(sr>=0.2)h+=15;else if(sr>=0.1)h+=8;else if(sr>=0.05)h+=2;else h-=6;
  var dp=debtMonthly();
  if(dp>0){var dr=inc>0?dp/inc:1;if(dr>0.35)h-=20;else if(dr>0.25)h-=12;else if(dr>0.15)h-=5;else h+=5;}
  if(num(S.savings)>0)h+=3;
  return Math.max(0,Math.min(100,Math.round(h)));
}
function healthBlurb(){
  var h=healthScore();
  if(h>=80)return "You're in great shape — solid savings and manageable debt. Look for chances to grow your money.";
  if(h>=60)return "You're doing well overall — improving your savings rate or debt payments would raise your score.";
  if(h>=40)return "Money feels tight right now. Focus on trimming your biggest expense and building a small buffer.";
  return "Your money needs attention. Trim the biggest expense and start a small automatic savings transfer.";
}
function greet(){var h=new Date().getHours();return h<12?"Good morning":h<18?"Good afternoon":"Good evening";}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function $(sel,r){r=r||document;return r.querySelector(sel);}
function $$(sel,r){r=r||document;return Array.prototype.slice.call(r.querySelectorAll(sel));}
function svg(p){return '<svg viewBox="0 0 24 24">'+p+'</svg>';}
var ICONS={
  home:'<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  budget:'<path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M8 14h4"/><path d="M15 14h2"/>',
  goals:'<path d="M12 3l2.2 4.9 5.3.6-4 3.8 1.1 5.2L12 15l-4.6 2.5 1.1-5.2-4-3.8 5.3-.6z"/>',
  coach:'<path d="M21 12a8 8 0 0 1-8 8H5a2 2 0 0 1-2-2v-6a8 8 0 0 1 8-8 8 8 0 0 1 8 8z"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
};
function shell(){
  var tabs=["home","budget","goals","coach","profile"].map(function(k){
    return '<button class="tab" id="tab-'+k+'" onclick="go(\''+k+'\')">'+svg(ICONS[k])+'<span>'+cap(k)+'</span></button>';
  }).join("");
  document.getElementById("app").innerHTML=
    '<div class="screen" id="screen-home"></div>'+
    '<div class="screen" id="screen-budget"></div>'+
    '<div class="screen" id="screen-goals"></div>'+
    '<div class="screen" id="screen-coach"></div>'+
    '<div class="screen" id="screen-profile"></div>'+
    '<div class="screen" id="screen-afford"></div>'+
    '<div class="screen" id="screen-debt"></div>'+
    '<div class="screen" id="screen-savcalc"></div>'+
    '<div class="screen" id="screen-income"></div>'+
    '<div class="screen" id="screen-premium"></div>'+
    '<div class="screen" id="screen-edit"></div>'+
    '<div class="tabbar">'+tabs+'</div>'+
    '<div class="chatinput" id="chatinput"><input id="coach-in" placeholder="Ask me anything about your money…" enterkeyhint="send"><button class="sendbtn" onclick="sendCoach()">'+svg('<path d="M3 11l18-8-8 18-2-8-8-2z"/>')+'</button></div>';
  var ci=$("#coach-in");if(ci)ci.addEventListener("keydown",function(e){if(e.key==="Enter")sendCoach();});
}
function go(screen){
  $$(".screen").forEach(function(s){s.classList.remove("active");});
  var el=document.getElementById("screen-"+screen);if(el)el.classList.add("active");
  window.scrollTo(0,0);
  ["home","budget","goals","coach","profile"].forEach(function(n){
    var t=document.getElementById("tab-"+n);if(t)t.classList.toggle("active",n===screen);
  });
  showChatInput(screen==="coach");
  var render={home:renderHome,budget:renderBudget,goals:renderGoals,coach:renderCoach,profile:renderProfile,afford:renderAfford,debt:renderDebt,savcalc:renderSavCalc,income:renderIncome,premium:renderPremium,edit:renderEdit};
  if(render[screen])render[screen]();
}
function showChatInput(on){var c=$("#chatinput");if(c)c.classList.toggle("show",!!on);}
function topbar(t,sub){return '<div class="topbar"><h1>'+t+'</h1>'+(sub?'<div class="sub">'+sub+'</div>':"")+'</div>';}
function emptyState(ic,t,d,label,fn){return '<div class="empty"><div class="ic">'+ic+'</div><h3>'+t+'</h3><p>'+d+'</p>'+(label?'<button class="btn" onclick="'+fn+'">'+label+'</button>':"")+'</div>';}
function toolRow(em,t,d,fn){return '<div class="listrow" onclick="'+fn+'"><div class="ic">'+em+'</div><div class="grow"><div class="tt">'+t+'</div><div class="ts">'+d+'</div></div></div>';}
function disclaimer(){return '<div class="disclaimer">MoneyWise AI provides educational information and estimates, not professional financial advice.</div>';}

/* ============================================================
   ONBOARDING
============================================================ */
var GOAL_OPTIONS=["Save more money","Pay off debt","Build an emergency fund","Control my spending","Buy a car","Buy a home","Invest for the future","Increase my income","Other"];
var OB_STEPS=4;
function brandHTML(){return '<span class="brand"><span class="bmark">'+svg(ICONS.coach)+'</span><span class="wm">MoneyWise</span> <span class="ai">AI</span></span>';}
function obShell(){document.getElementById("app").innerHTML='<div class="onboard" id="onboard"></div>';}
function obRender(){
  var o=$("#onboard");if(!o)return;
  var s=S.step||0;
  var dots='<div class="dots">'+Array.from({length:OB_STEPS},function(_,i){return '<i class="'+(i<=s?"on":"")+'"></i>';}).join("")+'</div>';
  var html;
  if(s===0){
    html='<div class="obhead">'+brandHTML()+'</div><div style="padding:10px 8px">'+dots+
      '<div class="big-em">👋</div><div class="ob-title">Welcome to MoneyWise AI</div>'+
      '<div class="ob-sub">Your personal AI financial coach. Know where your money goes, what you can afford, and what to do next.</div>'+
      '<div class="foot"><button class="btn" onclick="obNext()">Get Started</button></div></div>';
  }else if(s===1){
    var chips=GOAL_OPTIONS.map(function(g){return '<button class="chip '+(S.goal===g?"selected":"")+'" onclick="obGoal(\''+g.replace(/'/g,"\\'")+'\')">'+g+'</button>';}).join("");
    html='<div class="obhead">'+brandHTML()+'</div><div style="padding:10px 22px">'+dots+
      '<div class="ob-title">What is your main financial goal?</div><div class="ob-sub">Pick the one that matters most right now.</div>'+
      '<div class="chips mt">'+chips+"</div>"+
      '<div class="foot"><button class="btn" onclick="obNext()">Continue</button></div>'+
      '<button class="skip" onclick="obNext()">Skip for now</button></div>';
  }else if(s===2){
    html='<div class="obhead">'+brandHTML()+'</div><div style="padding:10px 22px">'+dots+
      '<div class="ob-title">Tell us about your finances</div><div class="ob-sub">Rough numbers are fine. Skip anything you don\'t know.</div>'+
      obFinanceFields()+
      '<div class="foot"><div class="rbtns"><button class="btn ghost" onclick="obPrev()">Back</button><button class="btn" onclick="obSaveFin()">Continue</button></div></div>'+
      '<button class="skip" onclick="obNext()">Skip this step</button></div>';
  }else{
    html='<div class="obhead">'+brandHTML()+'</div><div style="padding:10px 22px">'+dots+
      '<div class="ob-title">How much do you want to save?</div><div class="ob-sub">Set a goal amount and target date. We\'ll calculate what to set aside.</div>'+
      '<div class="field mt"><label>Goal amount</label><div class="iwrap"><span class="pre">$</span><input type="number" id="ob-goal" placeholder="e.g. 5000" min="0"></div></div>'+
      '<div class="field"><label>Target date</label><input type="date" id="ob-date"></div>'+
      '<div class="progress-calc" id="ob-calc" style="display:none"></div>'+
      '<div class="foot"><div class="rbtns"><button class="btn ghost" onclick="obPrev()">Back</button><button class="btn gold" onclick="obFinish()">Done — see my dashboard</button></div></div>'+
      '<button class="skip" onclick="obFinish()">Skip for now</button></div>';
  }
  o.innerHTML=html;
  if(s===3)obCalcBind();
}
function obGoal(g){S.goal=g;save();obRender();}
function obNext(){S.step=Math.min(OB_STEPS-1,(S.step||0)+1);save();obRender();}
function obPrev(){S.step=Math.max(0,(S.step||0)-1);save();obRender();}
function obSaveFin(){
  S.income=num($("#f-income").value);S.payFrequency=$("#f-pay").value;S.savings=num($("#f-savings").value);
  S.budget.housing=num($("#f-housing").value);S.budget.utilities=num($("#f-utils").value);
  S.budget.transportation=num($("#f-transport").value);S.budget.food=num($("#f-food").value);
  S.budget.insurance=num($("#f-insurance").value);S.budget.subscriptions=num($("#f-subs").value);
  S.budget.debt=num($("#f-debt").value);S.budget.other=num($("#f-other").value);
  save();obNext();
}
function obFinanceFields(){
  var fv=function(k){return S.budget[k]||"";};
  return '<div class="field"><label>Monthly income</label><div class="iwrap"><span class="pre">$</span><input type="number" id="f-income" value="'+(S.income||"")+'"></div></div>'+
    '<div class="field"><label>Pay frequency</label><select id="f-pay">'+["monthly","weekly","biweekly","twice a month"].map(function(p){return '<option'+(S.payFrequency===p?" selected":"")+'>'+p+'</option>';}).join("")+'</select></div>'+
    '<div class="mobo"><div class="t">Housing / rent</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-housing" value="'+fv("housing")+'"></div></div>'+
    '<div class="mobo"><div class="t">Utilities</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-utils" value="'+fv("utilities")+'"></div></div>'+
    '<div class="mobo"><div class="t">Transportation</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-transport" value="'+fv("transportation")+'"></div></div>'+
    '<div class="mobo"><div class="t">Food</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-food" value="'+fv("food")+'"></div></div>'+
    '<div class="mobo"><div class="t">Insurance</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-insurance" value="'+fv("insurance")+'"></div></div>'+
    '<div class="mobo"><div class="t">Subscriptions</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-subs" value="'+fv("subscriptions")+'"></div></div>'+
    '<div class="mobo"><div class="t">Debt payments</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-debt" value="'+fv("debt")+'"></div></div>'+
    '<div class="mobo"><div class="t">Other monthly expenses</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-other" value="'+fv("other")+'"></div></div>'+
    '<div class="mobo"><div class="t">Current savings</div><div class="iwrap"><span class="pre">$</span><input type="number" id="f-savings" value="'+(S.savings||"")+'"></div></div>';
}
function obCalcGoal(){
  var g=num($("#ob-goal").value),d=$("#ob-date").value,box=$("#ob-calc");
  if(!g||!d)return;
  var months=Math.max(1,Math.round((new Date(d)-new Date())/2592000000));
  var per=g/months;
  box.style.display="block";
  box.innerHTML='<div class="pc-t">To reach '+moneyFmt(g)+' by '+d+'</div><div class="pc-n">'+moneyFmt(per)+' / month</div><div class="small" style="color:var(--teal-dark)">or about '+moneyFmt(per/4.33)+' / week. Small automatic transfers add up.</div>';
}
function obCalcBind(){
  var el=$("#ob-goal"),dt=$("#ob-date");
  if(el)el.addEventListener("input",obCalcGoal);
  if(dt)dt.addEventListener("change",obCalcGoal);
}
function obFinish(){
  var g=num($("#ob-goal").value),d=$("#ob-date").value;
  if(g>0||d){S.goals.push({id:uid(),name:S.goal||"Savings goal",target:g,current:0,date:d});}
  S.onboarded=true;save();shell();go("home");
}

/* ============================================================
   HOME
============================================================ */
function renderHome(){
  var e=$("#screen-home");if(!e)return;
  var h=healthScore();
  e.innerHTML=
    '<div class="hero"><div class="hi">'+greet()+', '+cap(S.name||"there")+' 👋</div>'+
      '<div class="score">'+h+'<span>/100</span></div>'+
      '<div class="lb" style="color:#fff;opacity:.9">Financial Health</div>'+
      '<div class="sb">'+healthBlurb()+'</div></div>'+
    '<div class="lb">Financial snapshot</div>'+
    '<div class="grid2">'+
      statCard("Income",moneyFmt(income()),"teal")+
      statCard("Expenses",moneyFmt(living()),"neg")+
      statCard("Money left",moneyFmt(monthlyFree()),"pos")+
      statCard("Savings",moneyFmt(num(S.savings)),"teal")+
      statCard("Debt",moneyFmt(debtTotal()),"neg")+
      statCard("Health",h+"/100","gold")+
    '</div>'+
    '<div class="card"><h3>✨ Ask your AI coach</h3><p>"What should I do with my money next?"</p><button class="btn ghost mt" onclick="go(\'coach\')">Ask MoneyWise AI</button></div>'+
    '<div class="lb">Tools</div>'+
    toolRow("💸","Can I Afford It?","See if a purchase fits your budget","go('afford')")+
    toolRow("💳","Debt Payoff Planner","Snowball vs avalanche payoff plan","go('debt')")+
    toolRow("🎯","Savings Calculator","Find your target monthly amount","go('savcalc')")+
    toolRow("🚀","Make More Money","Ideas to raise your income","go('income')")+
    disclaimer();
}
function statCard(k,v,c){return '<div class="stat"><div class="k">'+k+'</div><div class="v '+(c||"")+'">'+v+'</div></div>';}

/* ============================================================
   BUDGET
============================================================ */
function renderBudget(){
  var e=$("#screen-budget");if(!e)return;
  var inc=income(),tot=totalExp(),free=monthlyFree(),sv=num(S.budget.savings);
  var has=CAT_KEYS.some(function(k){return num(S.budget[k])>0;})||inc>0;
  if(!has){
    e.innerHTML=topbar("Budget","Plan your monthly spending")+emptyState("📊","Let's build your first budget","Add your income and monthly categories so we can see where money goes.","Create Budget","go('edit')");
    return;
  }
  var rows=CATS.map(function(c){
    var v=num(S.budget[c.k]);
    var pct=inc>0?Math.round(v/inc*100):0;
    var w=inc>0?Math.min(100,Math.round(v/inc*100)):0;
    return '<div class="barbox"><div class="l">'+c.icon+' '+c.n+'</div><div class="r"><b>'+moneyFmt(v)+'</b>'+(inc>0?' <span>· '+pct+'%</span>':"")+'</div></div>'+
      '<div class="bar"><i style="width:'+w+'%"></i></div>';
  }).join("");
  e.innerHTML=
    topbar("Budget","Know where your money goes")+
    '<div class="grid2">'+
      statCard('Income',moneyFmt(inc),'teal')+
      statCard('Expenses',moneyFmt(tot),'neg')+
      statCard('Savings',moneyFmt(sv),'teal')+
      statCard('Remaining',moneyFmt(monthlyFree()),monthlyFree()>=0?'pos':'neg')+
    '</div>'+
    '<div class="card"><h3>Monthly spending</h3>'+rows+'</div>'+
    '<button class="btn ghost" onclick="go(\'edit\')">Edit budget</button>'+
    '<button class="btn gold mt" onclick="budgetAnalyze()">✨ Analyze My Budget</button>'+
    '<div id="budget-an" class="mt"></div>'+disclaimer();
}
function budgetAnalyze(){
  var box=$("#budget-an");if(!box)return;
  var arr=CATS.filter(function(c){return c.k!=="other";})
    .map(function(c){return{icon:c.icon,n:c.n,k:c.k,v:num(S.budget[c.k])};})
    .filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;});
  if(!arr.length){box.innerHTML='<div class="card"><p class="muted">Add some expenses first, then I can analyze your budget.</p></div>';return;}
  var out='<div class="card"><h3>🧠 AI budget analysis</h3><p class="lb">High spending</p>';
  arr.slice(0,3).forEach(function(x){out+='<div class="barbox"><div class="l">'+x.icon+' '+x.n+'</div><div class="r"><b>'+moneyFmt(x.v)+'</b></div></div>';});
  out+='<p class="lb">Potential savings</p><p>Trim subscriptions and renegotiate bills. Reducing <b>'+arr[0].n+'</b> by 10% frees '+moneyFmt(arr[0].v*0.1)+'/month.</p>';
  out+='<p class="lb">Recommendation</p><p>Try the 50/30/20 rule — needs, wants, savings. You have '+moneyFmt(monthlyFree())+' free each month.</p></div>';
  box.innerHTML=out;
}

/* ============================================================
   GOALS
============================================================ */
function renderGoals(){
  var e=$("#screen-goals");if(!e)return;
  var gs=S.goals||[];
  if(!gs.length){
    e.innerHTML=topbar("Goals","Save for what matters")+emptyState("🎯","No financial goals yet","Create a goal and we'll tell you how much to set aside each month.","Create Your First Goal","openGoalForm()");
    return;
  }
  var cards=gs.map(function(g){
    var pct=g.target>0?Math.min(100,Math.round(num(g.current)/g.target*100)):0;
    var monthsLeft=g.date?Math.max(1,Math.round((new Date(g.date)-new Date())/2592000000)):12;
    var need=g.target-num(g.current);var per=monthsLeft>0?need/monthsLeft:0;
    return '<div class="card goal-card"><div class="row"><div class="grow"><h4>'+g.name+'</h4><div class="meta">'+moneyFmt(g.target)+' target · '+moneyFmt(g.current)+' saved'+(g.date?' · by '+g.date:"")+'</div></div><div class="pill" style="font-size:14px">'+pct+'%</div></div>'+
      '<div class="bar"><i style="width:'+pct+'%"></i></div>'+
      '<p class="small muted mt">Recommended: '+moneyFmt(per)+'/month ('+moneyFmt(per/4.33)+'/week)</p>'+
      '<button class="btn ghost sm" onclick="askGoal(\''+g.name+'\')">🤖 Ask AI About This Goal</button></div>';
  }).join("");
  e.innerHTML=topbar("Goals","Save for what matters")+cards+
    '<button class="btn ghost" onclick="openGoalForm()">+ Add a goal</button>';
}
function openGoalForm(){
  var e=$("#screen-goals");
  e.innerHTML=topbar("New goal","Tell us the target")+
    '<div class="card"><div class="field"><label>Goal name</label><input id="g-name" placeholder="e.g. Emergency Fund"></div>'+
    '<div class="field"><label>Target amount</label><div class="iwrap"><span class="pre">$</span><input type="number" id="g-target"></div></div>'+
    '<div class="field"><label>Current amount</label><div class="iwrap"><span class="pre">$</span><input type="number" id="g-cur" value="0"></div></div>'+
    '<div class="field"><label>Target date</label><input type="date" id="g-date"></div>'+
    '<div class="rbtns"><button class="btn ghost" onclick="go(\'goals\')">Cancel</button><button class="btn" onclick="addGoal()">Save goal</button></div></div>';
}
function addGoal(){
  var nm=$("#g-name").value||"My goal",t=num($("#g-target").value),cur=num($("#g-cur").value),d=$("#g-date").value;
  S.goals.push({id:uid(),name:nm,target:t,current:cur,date:d});save();renderGoals();
}
function askGoal(name){
  go("coach");
  ask("Help me reach my goal: "+name);
}

/* ============================================================
   AI COACH (local engine — swap aiReply() for a real LLM)
============================================================ */
var chatLog=[];
/* --- AI server wiring (optional) ---
   Set AI_CONFIG.enabled=true (or open the app with ?ai=1) to send coach
   questions to server.js, which calls the LLM with the API key kept on
   the server. When disabled or unreachable, the built-in local engine answers. */
var AI_CONFIG={url:"http://localhost:4000/api/coach",enabled:false};
try{AI_CONFIG.enabled=(location.search&&location.search.indexOf("ai=1")>=0);}catch(e){}
function openCoach(){renderCoach();}
function renderCoach(){
  var e=$("#screen-coach");if(!e)return;
  e.innerHTML=topbar("AI Coach","Your personal financial coach")+
    '<div class="sub" style="margin-bottom:10px">I use the numbers you entered to answer. Ask anything about your money.</div>'+
    '<div class="quick">'+
      ['Can I afford a $25,000 car?','How much should I save?','Where am I spending too much?','How do I pay off my credit card?','How should I split my paycheck?','What should I focus on this month?'].map(function(q,i){
        var em=['🚗','💛','🔍','💳','🧾','🎯'][i];
        return '<button onclick="ask(\''+q.replace(/'/g,"\\'")+'\')"><span class="e">'+em+'</span>'+q+'</button>';
      }).join('')+
    '</div>'+
    '<div class="chatwrap" id="chatwrap"></div>';
  if(!chatLog.length)chatLog=[{role:"ai",text:"Hi, I'm your AI coach 👋 Ask me anything about your money — can you afford something, how much to save, or what to focus on."}];
  renderChat();
  var ci=$("#coach-in");if(ci)ci.focus();
}
function renderVerdict(t){
  var m=t.match(/^@@VERDICT@@(YES|NO)@@\n\n([\s\S]*)$/);
  if(!m){return null;}
  return '<div class="vcard '+(m[1]==="YES"?"yes":"no")+'">'+fmtMsg(m[2])+'</div>';
}
function renderChat(){
  var box=$("#chatwrap");if(!box)return;
  box.innerHTML=chatLog.map(function(m){
    if(m.role==="suggest"){
      return '<div class="msg a">'+fmtMsg(m.text)+'<div class="chat-chips">'+m.chips.map(function(c){
        return '<button class="chip" onclick="ask(\''+c.replace(/'/g,"\\'")+'\')">'+c+'</button>';
      }).join('')+'</div></div>';
    }
    if(m.role==="user"){return '<div class="msg u">'+fmtMsg(m.text)+'</div>';}
    var v=renderVerdict(m.text);
    if(v){return v;}
    return '<div class="msg a">'+fmtMsg(m.text)+'</div>';
  }).join("");
  box.scrollTop=9999;
}
function fmtMsg(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\*\*(.*?)\*\*/g,"<b>$1</b>").replace(/\n/g,"<br>");}
function ask(q){
  chatLog.push({role:"user",text:q});renderChat();
  var idx=chatLog.length;
  chatLog.push({role:"ai",text:"…"});renderChat();
  resolveAiReply(q).then(function(reply){
    chatLog[idx]={role:"ai",text:reply};renderChat();
  });
}
function buildSnapshot(){
  return{income:income(),livingExpenses:living(),totalExpenses:totalExp(),moneyLeft:monthlyFree(),
    savings:num(S.savings),healthScore:healthScore(),budget:S.budget,
    debts:S.debts||[],goals:S.goals||[],payFrequency:S.payFrequency};
}
function resolveAiReply(q){
  if(S.premium&&(S.aiServer||AI_CONFIG.enabled)){
    return fetch(AI_CONFIG.url,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:q,snapshot:buildSnapshot()})})
      .then(function(r){if(!r.ok)throw new Error("server responded "+r.status);return r.json();})
      .then(function(d){return d.reply||"I couldn't get a clear answer — try rephrasing.";})
      .catch(function(e){
        console.warn("AI server unavailable, using local engine:",e);
        return aiReply(q)+"\n\n_[AI server unavailable] — showing a local estimate._";
      });
  }
  return Promise.resolve(aiReply(q));
}
function askQ(q){go("coach");ask(q);}
function sendCoach(){
  var inp=$("#coach-in");var v=inp.value.trim();if(!v)return;
  inp.value="";ask(v);
}
function aiReply(q){
  var t=q.toLowerCase();
  var amt=extractAmt(t);
  var inc=income(),free=monthlyFree();
  if(t.indexOf("afford")>=0&&amt){return affordMsg(amt);}
  if(/(can i|can we|do i have enough).*(buy|get)/.test(t)&&amt){return affordMsg(amt);}
  if(t.indexOf("save")>=0&&(amt||/how much/.test(t))){return saveMsg(amt);}
  if(/split|paycheck|allocate|divide/.test(t)){return splitMsg();}
  if(/debt|pay ?off|credit card|avalanche|snowball/.test(t)){return debtMsg(amt);}
  if(/weekend|fun money|discretionary|spend this/.test(t)){return weekendMsg();}
  if(/spending too much|where|analyze|overspend|insight/.test(t)){return budgetMsg();}
  if(/budget/.test(t)){return buildBudgetMsg();}
  if(/focus|this month|priority|should i/.test(t)){return focusMsg();}
  if(/invest|stock/.test(t)){return investMsg();}
  if(/afford/.test(t)&&/goal/.test(t)&&S.goals&&S.goals.length){return goalAffordMsg();}
  if(/goal/.test(t)&&S.goals&&S.goals.length){return goalMsg();}
  return fallbackMsg();
}
function extractAmt(t){var m=t.match(/\$?([\d,]+\.?\d*)\s?(k|thousand)?/i);if(!m)return null;var v=parseFloat(m[1].replace(/,/g,""));if(m[2])v*=1000;return v&&v>0?v:null;}
function base(){return "Based on the info you entered:\n\n• Monthly income: "+moneyFmt(income())+"\n• Monthly expenses: "+moneyFmt(living())+"\n• Estimated available monthly money: "+moneyFmt(monthlyFree());}
function affordMsg(p){
  var f=monthly();
  var v,cls;
  if(f>0&&p<=f*0.5){v="Looks comfortable";cls="good";}
  else if(f>0&&p<=f){v="Be careful";cls="careful";}
  else{v="Probably too expensive";cls="too";}
  var months=f>0?Math.ceil(p/f):0;
  var rec=Math.max(0,f*0.6);
  var out="**"+v+"**\n\n"+base()+"\n\n**Recommended budget:** about "+moneyFmt(rec)+" for this kind of purchase.\n\n";
  if(p>f&&months>0){out+="At "+moneyFmt(rec)+"/month, save for roughly "+Math.max(1,Math.ceil(p/rec))+" months before buying.\n\n";}
  out+="**Suggested plan**\n• Save "+moneyFmt(f>0?Math.max(50,rec/2):50)+"/month\n• Trim discretionary spending by "+moneyFmt(Math.round(Math.max(50,rec*0.15)/10)*10)+"/month\n• Keep your emergency savings untouched\n\n_Actual costs vary by location, fees, and timing. This is a helpful estimate, not a final recommendation._";
  return out;
}
function saveMsg(amt){
  var g=amt||5000;
  var rec=Math.max(50,Math.round((monthly()>0?monthly()*0.25:200)/10)*10);
  var weeks=rec>0?Math.ceil(g/rec):0;
  return "**How to save "+moneyFmt(g)+"**\n\n"+
    "At about "+moneyFmt(rec)+"/month, you'd reach your goal in ~"+weeks+" month(s). That's about "+moneyFmt(rec/4.33)+"/week.\n\n"+
    "**Suggested plan**\n• Set up an automatic transfer on payday\n• Put windfalls (tax refunds, bonuses) straight into savings\n• Trim one subscription or meal-out each week\n\n_Estimates only — not financial advice._";
}
function splitMsg(){
  var inc=income();
  return "**How to split your paycheck**\n\nA friendly rule of thumb:\n\n• Needs (housing, food, transport, insurance): **50%** = "+moneyFmt(inc*0.5)+"\n• Wants (fun, shopping): **20%** = "+moneyFmt(inc*0.2)+"\n• Savings & debt paydown: **30%** = "+moneyFmt(inc*0.3)+"\n\nRight now you have about "+moneyFmt(monthlyFree())+"/month of flexibility. Automate that amount on payday and you'll hit goals faster.";
}
function debtMsg(amt){
  var ds=S.debts||[];
  if(!ds.length)return "You haven't added any debts yet. Open the Debt tool, add them, and I'll give you a clear payoff plan.";
  var total=debtTotal();
  var msg="You have "+ds.length+" debt(s) totaling "+moneyFmt(total)+".\n\n"+ds.map(function(d){return "• "+d.name+" ("+d.rate+"%) — "+moneyFmt(d.balance)+" at "+moneyFmt(d.min)+"/min";}).join("\n");
  msg+="\n\n**Two strategies:**\n• **Snowball** — pay smallest first for quick wins.\n• **Avalanche** — pay highest interest first to save the most.\n\nPick the one that keeps you motivated — both work.";
  return msg;
}
function weekendMsg(){
  var f=monthly();
  var fun=Math.max(0,f*0.15);
  return "**Fun money for the weekend**\n\nAfter your fixed costs, you have about "+moneyFmt(f)+"/month of flexibility.\n\nA sensible weekend budget is roughly "+moneyFmt(fun)+" (15% of your surplus).\n\nUse a separate card or account for it and stop when it's gone — no guilt, just a plan.";
}
function budgetMsg(){
  var arr=CATS.filter(function(c){return c.k!=="other";}).map(function(c){return{icon:c.icon,n:c.n,v:num(S.budget[c.k])};}).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;});
  if(!arr.length)return "Fill in a few budget categories and I'll tell you where money leaks.";
  var out="**Where your money goes**\n\n"+arr.slice(0,4).map(function(x){return "• "+x.icon+" "+x.n+": "+moneyFmt(x.v);}).join("\n");
  out+="\n\n**Biggest opportunity:** "+arr[0].n+" at "+moneyFmt(arr[0].v)+". Cutting it by 10% frees "+moneyFmt(arr[0].v*0.1)+"/month.";
  return out;
}
function buildBudgetMsg(){
  var inc=income();
  return "**Let's build your budget**\n\nA simple starting template for your income:\n\n• Housing: "+moneyFmt(inc*0.30)+"\n• Food: "+moneyFmt(inc*0.15)+"\n• Transport: "+moneyFmt(inc*0.10)+"\n• Savings: "+moneyFmt(inc*0.20)+"\n• Everything else: "+moneyFmt(inc*0.25)+"\n\nAdjust to your real numbers in the Budget tab. The goal is knowing where each dollar goes — not perfection. Want me to apply this as a starting budget?";
}
function focusMsg(){
  var h=healthScore();
  var out="**Your focus this month**\n\n";
  var l=[];
  if(num(S.budget.savings)<income()*0.1)l.push("Build your savings — even a small automatic transfer adds up.");
  if(debtMonthly()>income()*0.3)l.push("Attack your debt — payments are above 30% of your income.");
  if(h>=70)l.push("You're stable — keep your buffer and start growing.");
  if(!l.length)l.push("Track every expense this month so you can see the truth.");
  l.forEach(function(x,i){out+=(i+1)+". "+x+"\n";});
  out+="\nHealth score is "+h+"/100 — "+healthBlurb();
  return out;
}
function investMsg(){
  return "I can share general info, but **MoneyWise AI is not an investment advisor and doesn't give personalized investment advice.**\n\nBasics:\n• Emergency fund first (3–6 months of expenses) before investing\n• Low-cost index funds are an easy place to start\n• Start small and invest regularly — time matters more than timing\n• Never invest money you'll need in the next few years\n\nReturns are never guaranteed. For advice specific to you, talk to a licensed advisor.";
}
function goalMsg(){
  var g=S.goals[0];var need=g.target-num(g.current);var mo=g.date?Math.max(1,Math.round((new Date(g.date)-new Date())/2592000000)):12;var per=mo>0?need/mo:0;
  return "**Goal: "+g.name+"**\n\nTarget "+moneyFmt(g.target)+", currently "+moneyFmt(g.current)+". You need "+moneyFmt(need)+" more.\n\nAt "+moneyFmt(per)+"/month you'll hit it in about "+mo+" months.\n\n**Suggested plan**\n• Automate "+moneyFmt(per)+"/month right after payday\n• Throw any extra income (side gigs, gifts) at it\n• Check in weekly to stay on track";
}
function goalAffordMsg(){
  var g=S.goals[0];
  var need=num(g.target)-num(g.current);
  var free=monthlyFree();
  var can=free>=need;
  var out="**"+(can?"Yes you can":"Not yet")+"** - "+(can?"you can afford to reach":"you can't fully afford to reach")+" your "+g.name+" goal right now.\n\n";
  out+=base()+"\n\n";
  out+="Your goal needs "+moneyFmt(need)+" more, and you have "+moneyFmt(free)+" free each month.\n\n";
  if(can){
    out+="Your free money covers the gap. **Suggested move:** set aside "+moneyFmt(need)+" toward "+g.name+" now and keep your emergency savings untouched.";
  }else{
    var months=need>0?Math.max(1,Math.ceil(need/free)):1;
    out+="**Suggested plan**\n• Automate "+moneyFmt(free)+"/month right after payday\n• Trim discretionary spending to close the gap faster\n• Throw any extra income at it\n\nAt "+moneyFmt(free)+"/month you'd reach it in about "+months+" months.";
  }
  return "@@VERDICT@@"+(can?"YES":"NO")+"@@\n\n"+out;
}
function fallbackMsg(){
  return "Happy to help! Here's the most useful thing right now: **"+focusMsg()+"**\n\nOr ask me things like:\n• \"Can I afford a $1,500 vacation?\"\n• \"How much should I save each month?\"\n• \"How do I split my paycheck?\"";
}

/* ============================================================
   CAN I AFFORD IT?
============================================================ */
function renderAfford(){
  var e=$("#screen-afford");if(!e)return;
  e.innerHTML=topbar("Can I Afford It?","Check a purchase against your budget")+
    '<div class="card">'+
    '<div class="field"><label>What do you want to buy?</label><input id="a-item" placeholder="e.g. 2026 Toyota Camry"></div>'+
    '<div class="field"><label>Price</label><div class="iwrap"><span class="pre">$</span><input type="number" id="a-price" placeholder="32000"></div></div>'+
    '<div class="field"><label>Down payment / saved already (optional)</label><div class="iwrap"><span class="pre">$</span><input type="number" id="a-down" placeholder="5000"></div></div>'+
    '<button class="btn" onclick="checkAfford()">Check affordability</button></div>'+
    '<div id="a-result" class="mt"></div>'+
    '<div class="card"><p class="small muted">Recurring costs like cars, housing, subscriptions and financing can vary a lot. This is a helpful estimate, not a final financial recommendation.</p></div>';
}
function checkAfford(){
  var item=$("#a-item").value||"this purchase";
  var p=num($("#a-price").value),down=num($("#a-down").value);
  var effective=Math.max(0,p-down);
  var f=monthly();
  var box=$("#a-result");if(!box)return;
  var v,cls;
  if(f>0&&effective<=f*0.7){v="Looks comfortable";cls="good";}
  else if(f>0&&effective<=f){v="Be careful";cls="careful";}
  else{v="Probably too expensive";cls="too";}
  var months=effective>0&&f>0?Math.ceil(effective/f):0;
  var html='<div class="verdict '+cls+'"><div class="vt">'+v+'</div><div class="vs">For '+item+'</div></div>'+
    '<div class="card"><p class="lb">Reasoning</p>'+
    '<p>Price: '+moneyFmt(p)+(down>0?' · Down payment: '+moneyFmt(down)+' · Amount to cover: '+moneyFmt(effective):"")+'</p>'+
    '<p>Available monthly money: <b>'+moneyFmt(f)+'</b></p>'+
    (months>0?'<p>At your current surplus you\'d need about <b>'+months+' month(s)</b> of savings.</p>':"")+
    '</div><div class="card"><p class="lb">Suggested plan</p><p>• Save '+moneyFmt(months>0?Math.ceil(effective/Math.max(1,months)):0)+'/month</p><p>• Trim discretionary spending by '+moneyFmt(Math.round(Math.max(50,f*0.1)/10)*10)+'/month</p><p>• Keep your emergency savings untouched</p></div>'+disclaimer();
  box.innerHTML=html;
}
/* ---------- DEBT ---------- */
function renderDebt(){
  var e=$("#screen-debt");if(!e)return;
  var ds=S.debts||[];
  var rows=ds.length?ds.map(function(d){return '<tr><td>'+d.name+'</td><td>'+moneyFmt(d.balance)+'</td><td>'+d.rate+'%</td><td>'+moneyFmt(d.min)+'</td><td><button class="btn sm ghost" style="padding:4px 8px" onclick="removeDebt(\''+d.id+'\')">✕</button></td></tr>';}).join(""):'<tr><td colspan="5" class="muted">No debts yet</td></tr>';
  e.innerHTML=topbar("Debt Payoff","Plan to clear your balances")+
    '<div class="card"><h3>Your debts</h3><table class="t"><tr><th>Name</th><th>Balance</th><th>Rate</th><th>Min</th><th></th></tr>'+rows+'</table>'+
    '<button class="btn ghost mt" onclick="addDebtUI()">+ Add a debt</button></div>'+
    '<div class="card"><p class="lb">Strategy</p><div class="rbtns"><button class="btn ghost sm" id="strat-snow" onclick="setStrategy(\'snowball\')">❄️ Snowball</button><button class="btn ghost sm" id="strat-av" onclick="setStrategy(\'avalanche\')">⚡ Avalanche</button></div>'+
    '<p class="small muted mt">Snowball pays the smallest balance first for quick wins. Avalanche pays the highest interest first to save the most. Both work.</p></div>'+
    '<div class="card"><div class="field"><label>Extra payment per month</label><div class="iwrap"><span class="pre">$</span><input type="number" id="debt-extra" value="'+(S.extra||"")+'" placeholder="e.g. 100"></div></div>'+
    '<button class="btn gold" onclick="runDebtSim()">Calculate payoff</button></div>'+
    '<div id="debt-result" class="mt"></div>';
  styleStrategy();
}
function addDebtUI(){
  var e=$("#screen-debt");
  e.innerHTML=topbar("Add a debt","Record the details")+
    '<div class="card"><div class="field"><label>Debt name</label><input id="d-name" placeholder="e.g. Credit card"></div>'+
    '<div class="field"><label>Balance</label><div class="iwrap"><span class="pre">$</span><input type="number" id="d-bal"></div></div>'+
    '<div class="field"><label>Interest rate (%)</label><div class="iwrap"><span class="pre">%</span><input type="number" id="d-rate" placeholder="e.g. 22"></div></div>'+
    '<div class="field"><label>Minimum payment</label><div class="iwrap"><span class="pre">$</span><input type="number" id="d-min"></div></div>'+
    '<div class="rbtns"><button class="btn ghost" onclick="renderDebt()">Cancel</button><button class="btn" onclick="saveDebt()">Add debt</button></div></div>';
}
function saveDebt(){S.debts.push({id:uid(),name:$("#d-name").value||"Debt",balance:num($("#d-bal").value),rate:num($("#d-rate").value),min:num($("#d-min").value)});save();renderDebt();}
function removeDebt(id){S.debts=S.debts.filter(function(d){return d.id!==id;});save();renderDebt();}
function setStrategy(s){S.strategy=s;save();renderDebt();}
function styleStrategy(){var s=S.strategy;["snowball","avalanche"].forEach(function(x){var b=$("#strat-"+x);if(b){b.style.background=x===s?"var(--teal)":"var(--teal-soft)";b.style.color=x===s?"#fff":"var(--teal-dark)";}});}
function runDebtSim(){
  var box=$("#debt-result");if(!box)return;
  var ds=S.debts||[];if(!ds.length){box.innerHTML='<div class="card"><p class="muted">Add at least one debt first.</p></div>';return;}
  var extra=num($("#debt-extra").value);
  var a=simulate("avalanche",extra),b=simulate("snowball",extra);
  var chosen=S.strategy==="snowball"?b:a,other=S.strategy==="snowball"?a:b;
  box.innerHTML='<div class="card"><h3>Your plan ('+cap(S.strategy)+')</h3><p>Payoff in ~<b>'+chosen.months+' months</b> ('+(chosen.months/12).toFixed(1)+' yrs)</p><p>Estimated interest: <b>'+moneyFmt(chosen.interest)+'</b></p><p>Total to pay: '+moneyFmt(chosen.total)+'</p></div>'+
    '<div class="card"><h3>Compare: '+(S.strategy==="snowball"?"Avalanche":"Snowball")+'</h3><p>Payoff ~'+other.months+' months</p><p>Interest '+moneyFmt(other.interest)+'</p><p class="small muted">'+(other.interest<=chosen.interest?"The other strategy can change your payoff — pick whichever keeps you motivated.":"Your chosen strategy is faster or cheaper overall.")+'</p></div>'+disclaimer();
}
function simulate(strat,extra){
  var ds=S.debts.map(function(d){return{b:num(d.balance),min:num(d.min),r:num(d.rate)/100/12};});
  var months=0,intr=0,cap=900;
  while(ds.some(function(d){return d.b>0.5;})&&months<cap){
    months++;
    ds.forEach(function(d){if(d.b>0){var i=d.b*d.r;d.b+=i;intr+=i;}});
    var rem=extra;
    ds.forEach(function(d){var p=Math.min(d.min,d.b);d.b-=p;});
    var prio=ds.slice().filter(function(d){return d.b>0.01;}).sort(strat==="snowball"?function(a,b){return a.b-b.b;}:function(a,b){return b.r-a.r;});
    prio.forEach(function(d){if(rem>0&&d.b>0){var p=Math.min(rem,d.b);d.b-=p;rem-=p;}});
  }
  return{months:months,interest:intr,total:debtTotal()+intr};
}

/* ---------- SAVINGS CALCULATOR ---------- */
function renderSavCalc(){
  var e=$("#screen-savcalc");if(!e)return;
  e.innerHTML=topbar("Savings Calculator","Reach your goal")+
    '<div class="card"><div class="field"><label>Current savings</label><div class="iwrap"><span class="pre">$</span><input type="number" id="sc-cur" value="'+(S.savings||"")+'"></div></div>'+
    '<div class="field"><label>Goal amount</label><div class="iwrap"><span class="pre">$</span><input type="number" id="sc-goal"></div></div>'+
    '<div class="field"><label>Target date</label><input type="date" id="sc-date"></div>'+
    '<button class="btn" onclick="calcSavings()">Calculate</button></div>'+
    '<div id="sc-result" class="mt"></div>';
}
function calcSavings(){
  var cur=num($("#sc-cur").value),g=num($("#sc-goal").value),d=$("#sc-date").value,box=$("#sc-result");if(!box)return;
  var need=Math.max(0,g-cur);var mo=d?Math.max(1,Math.round((new Date(d)-new Date())/2592000000)):12;
  var html='<div class="card"><h3>Your savings plan</h3>';
  if(need===0){html+='<p class="pos" style="font-weight:700">You\u2019ve already reached this goal 🎉</p>';}
  else{var per=need/mo;html+='<p>Monthly needed: <b>'+moneyFmt(per)+'</b></p><p>or <b>'+moneyFmt(per/4.33)+'/week</b></p>'+(d?'<p class="small muted">Target completion: '+d+'</p>':"")+"</div>"+
    '<div class="card"><h3>AI savings strategy</h3><p>• Automate a transfer right after payday</p><p>• Route windfalls straight to this goal</p><p>• Free up cash by trimming one subscription</p></div>'+disclaimer();}
  box.innerHTML=html;
}

/* ---------- MAKE MORE MONEY ---------- */
function renderIncome(){
  var e=$("#screen-income");if(!e)return;
  e.innerHTML=topbar("Make More Money","General ideas to boost income")+
    '<div class="card"><p class="small muted">Optional details help tailor ideas. Nothing is guaranteed — these are general suggestions.</p>'+
    '<div class="field"><label>Hours available per week</label><select id="ir-hours"><option value="">Prefer not to say</option><option value="low">1–5 hrs</option><option value="mid">5–10 hrs</option><option value="high">10+ hrs</option></select></div>'+
    '<div class="field"><label>Work preference</label><select id="ir-remote"><option value="">Prefer not to say</option><option value="remote">Remote</option><option value="local">Local / in person</option></select></div>'+
    '<button class="btn" onclick="showIncome()">Show me ideas</button></div>'+
    '<div id="inc-result" class="mt"></div>';
}
function showIncome(){
  var hours=$("#ir-hours").value,remote=$("#inc-remote").value,box=$("#inc-result");if(!box)return;
  var ideas=[
    {e:"💻",t:"Freelancing",d:"Offer your skills on freelance platforms."},
    {e:"⏰",t:"Overtime",d:"Ask about extra shifts at your current job."},
    {e:"🛠️",t:"Part-time work",d:"A steady second job adds predictable income."},
    {e:"🏷️",t:"Sell unused items",d:"List clothes, electronics and tools you don\u2019t use."},
    {e:"🌱",t:"Local services",d:"Tutoring, cleaning, or errands near you."},
    {e:"💼",t:"Remote work",d:"Remote roles open more options with stable internet."},
    {e:"📚",t:"Skill development",d:"Learn one in-demand skill to raise your earning power."},
    {e:"🤝",t:"Side gigs",d:"Turn a hobby you love into small projects."}];
  var f=ideas;
  if(hours==="low"||hours==="mid")f=f.filter(function(x){return x.t!=="Overtime";});
  if(remote==="local")f=f.filter(function(x){return x.t!=="Remote work";});
  box.innerHTML=f.map(function(x){return '<div class="card" style="display:flex;gap:12px;align-items:center;padding:14px"><div style="font-size:26px">'+x.e+'</div><div><b>'+x.t+'</b><div class="small muted">'+x.d+'</div></div></div>';}).join("")+
    '<div class="disclaimer">These are general ideas — income is never guaranteed and depends on your market, effort and skills.</div>';
}

/* ---------- PREMIUM ---------- */
function renderPremium(){
  var e=$("#screen-premium");if(!e)return;
  var feats=["Unlimited AI Coach conversations","Advanced budget analysis","Advanced debt payoff planning","Unlimited financial goals","Spending insights","Personalized monthly financial plan","Advanced \u201cCan I Afford It?\u201d analysis","Income improvement recommendations"];
  e.innerHTML=topbar("MoneyWise Pro","Upgrade your money")+
    '<div class="card tcenter"><h2 style="margin:0">Pro</h2><p style="font-size:34px;font-weight:800;margin:8px 0">$9.99<span style="font-size:15px;color:var(--muted)">/month</span></p><p class="small muted">Start with a 7-day free trial. Not charged during testing.</p>'+
    (S.premium?'<span class="pill pro-pill" style="font-size:15px;padding:10px 18px">You\u2019re on Pro ✓</span>':'<button class="btn gold" onclick="setPremium(true)">Start 7-day free trial</button>')+'</div>'+
    '<div class="card"><p class="lb">Everything in Free, plus</p>'+feats.map(function(f){return '<div class="feature"><div class="fi">✓</div><div class="grow"><div class="ft">'+f+'</div></div><div class="st">'+ (S.premium?"✓":"•")+'</div></div>';}).join("")+'</div>'+disclaimer();
}

function suggestChips(){
  var chips=[];
  var free=monthlyFree();
  var g=(S.goals||[])[0];
  var goalUsed=false;
  if(free>0&&g){
    chips.push("Can I afford to reach my "+g.name+" goal now?");
    goalUsed=true;
  }else if(free>0){
    var amt=Math.max(500,Math.round(free*3/500)*500);
    chips.push("Can I afford a "+moneyFmt(amt)+" purchase?");
  }
  var cats=CATS.filter(function(c){return c.k!=="savings"&&c.k!=="other";})
    .map(function(c){return {n:c.n,v:num(S.budget[c.k])};})
    .filter(function(x){return x.v>0;})
    .sort(function(a,b){return b.v-a.v;});
  if(cats.length){
    chips.push("How can I spend less on "+cats[0].n.toLowerCase()+"?");
  }
  var ds=(S.debts||[]).slice().sort(function(a,b){return (b.rate||0)-(a.rate||0);});
  if(ds.length){
    chips.push("How do I pay off "+ds[0].name+" faster?");
  }
  if(g&&!goalUsed){
    chips.push("How do I reach my "+g.name+" goal?");
  }
  var seen={},out=[];
  chips.forEach(function(c){if(!seen[c]){seen[c]=1;out.push(c);}});
  if(out.length<3){out.push("How should I split my paycheck?");}
  if(out.length<3){out.push("How much should I save each month?");}
  return out.slice(0,3);
}
function setPremium(v){S.premium=!!v;if(v){S.aiServer=true;chatLog.push({role:"suggest",text:"👋 Welcome, Pro! Your real AI coach is now connected and live. Tap one below:",chips:suggestChips()});}save();go("coach");}

/* ---------- PROFILE ---------- */
function renderProfile(){
  var e=$("#screen-profile");if(!e)return;
  e.innerHTML=topbar("Profile","Your account")+
    '<div class="card"><div class="row"><div class="grow"><h3>'+cap(S.name||"There")+'</h3><div class="sub">'+moneyFmt(income())+'/month · '+(S.premium?'<span class="pill pro-pill">Pro</span>':'<span class="pill">Free</span>')+'</div></div></div>'+
    '<button class="btn ghost mt" onclick="go(\'edit\')">Edit my finances</button></div>'+
    aiEngineCard()+
'<div class="card"><p class="lb">Notifications</p>'+
    notifRow("remind","Weekly budget check")+notifRow("bills","Bill reminders")+notifRow("savings","Savings contributions")+notifRow("debt","Debt payments")+notifRow("goals","Financial goals")+
    '<p class="small muted mt">Demo only — nothing is sent anywhere.</p></div>'+
    (S.premium?"":'<div class="banner"><h3>💰 Go Pro</h3><p>Unlimited AI coach, advanced analysis, and more.</p><button class="btn gold mt" onclick="go(\'premium\')">See plans</button></div>')+
    '<div class="card"><p class="lb">Data & privacy</p>'+
    '<button class="btn ghost" onclick="demoData()">Load sample data</button>'+
    '<button class="btn ghost mt" onclick="resetAll()">Reset my data</button>'+
    '<button class="btn delbtn mt" onclick="deleteAccount()">Delete my account</button>'+
    '<p class="small muted mt">Your data stays on this device and is never sent to a server in this demo. You can edit or delete it anytime. We never ask for passwords or full card numbers.</p></div>';
  startAIStatus();
}
function notifRow(k,t){return '<div class="listrow"><div class="grow"><div class="tt">'+t+'</div></div><label class="switch"><input type="checkbox" '+(S.notif[k]?"checked":"")+' onchange="toggleNotif(\''+k+'\',this.checked)"><span class="slider"></span></label></div>';}
function toggleNotif(k,v){S.notif[k]=v;save();}
function toggleAi(v){S.aiServer=!!v;save();renderProfile();}
var aiTimer=null;
function checkServer(){
  var dot=$("#ai-status");if(!dot)return;
  dot.className="ai-dot chk";
  var t=setTimeout(function(){dot.className="ai-dot err";},3500);
  fetch(AI_CONFIG.url,{method:"GET"})
    .then(function(){clearTimeout(t);dot.className="ai-dot ok";})
    .catch(function(){clearTimeout(t);dot.className="ai-dot err";});
}
function startAIStatus(){
  if(aiTimer)clearInterval(aiTimer);
  checkServer();
  aiTimer=setInterval(checkServer,8000);
}
function aiEngineCard(){
  if(S.premium){
    return '<div class="card"><p class="lb">AI engine</p>'+
      '<div class="listrow"><div class="grow"><div class="tt">Connect AI <span id="ai-status" class="ai-dot" title="Tap to refresh" onclick="checkServer()"></span></div><div class="ts">Use the server LLM ('+AI_CONFIG.url+')</div></div><label class="switch"><input type="checkbox" '+(S.aiServer?"checked":"")+' onchange="toggleAi(this.checked)"><span class="slider"></span></label></div>'+
      '<p class="small muted mt">'+(S.aiServer?"On - sent to your server; falls back if unreachable.":"Off - built-in local engine. Turn on to use your real LLM.")+'</p></div>';
  }
  return '<div class="card"><p class="lb">AI coach</p>'+
    '<div class="listrow"><div class="grow"><div class="tt">Real AI coach</div><div class="ts">Smart, personalized answers from a live model</div></div><span class="pill pro-pill">Pro</span></div>'+
    '<button class="btn gold mt" onclick="go(\'premium\')">Unlock with Pro</button>'+
    '<p class="small muted mt">Free plan uses the built-in coach. Upgrade to get answers from your real AI model.</p></div>';
}

function demoData(){
  Object.assign(S,{name:"Alex",income:4800,payFrequency:"biweekly",savings:2400,
    budget:{housing:1500,utilities:220,transportation:380,food:640,insurance:190,debt:360,subscriptions:70,entertainment:180,shopping:140,savings:450,other:90},
    debts:[{id:uid(),name:"Credit card",balance:4590,rate:22,min:160},{id:uid(),name:"Car loan",balance:8600,rate:6.5,min:220}],
    goals:[{id:uid(),name:"Emergency Fund",target:5000,current:2400,date:""},{id:uid(),name:"Vacation",target:2000,current:500,date:""}]});
  save();go("home");
}
function resetAll(){if(confirm("Reset all your MoneyWise data?")){S=defaultState();save();shell();go("home");}}
function deleteAccount(){if(confirm("Delete your account and all data? This can't be undone.")){localStorage.removeItem(LS);S=defaultState();obShell();obRender();}}

/* ---------- EDIT ---------- */
function renderEdit(){
  var e=$("#screen-edit");if(!e)return;
  var cats=CATS.map(function(c){return '<div class="field"><label>'+c.icon+' '+c.n+'</label><div class="iwrap"><span class="pre">$</span><input type="number" id="ed-'+c.k+'" value="'+(S.budget[c.k]||"")+'"></div></div>';}).join("");
  e.innerHTML=topbar("Edit finances","Update your details")+
    '<div class="card"><div class="field"><label>Your name</label><input id="ed-name" value="'+(S.name||"")+'"></div>'+
    '<div class="field"><label>Monthly income</label><div class="iwrap"><span class="pre">$</span><input type="number" id="ed-income" value="'+(S.income||"")+'"></div></div>'+
    '<div class="field"><label>Current savings</label><div class="iwrap"><span class="pre">$</span><input type="number" id="ed-savings" value="'+(S.savings||"")+'"></div></div></div>'+
    '<div class="card"><h3>Monthly budget</h3>'+cats+'</div>'+
    '<button class="btn" onclick="saveEdit()">Save changes</button>';
}
function saveEdit(){
  S.name=$("#ed-name").value;S.income=num($("#ed-income").value);S.savings=num($("#ed-savings").value);
  CATS.forEach(function(c){S.budget[c.k]=num($("#ed-"+c.k).value);});
  save();go("budget");
}

/* ---------- UPDATE CHECK ---------- */
function semverCmp(a,b){
  a=(a||"0").split(".").map(Number);b=(b||"0").split(".").map(Number);
  for(var i=0;i<3;i++){a[i]=a[i]||0;b[i]=b[i]||0;if(a[i]>b[i])return 1;if(a[i]<b[i])return -1;}
  return 0;
}
function updateManifestUrl(){return UPDATE_MANIFEST_URL||(location.origin+"/versions.json");}
function checkForUpdate(){
  if(location.protocol==="file:")return; /* no origin to fetch from */
  try{
    fetch(updateManifestUrl()).then(function(r){return r.ok?r.json():null;}).then(function(m){
      if(!m||!m.currentVersion)return;
      if(semverCmp(m.currentVersion,APP_VERSION)<=0)return;
      try{if(localStorage.getItem(UPDATE_DISMISS_LS)===m.currentVersion)return;}catch(e){}
      showUpdateModal(m);
    }).catch(function(){});
  }catch(e){}
}
function dismissUpdate(v){try{localStorage.setItem(UPDATE_DISMISS_LS,v||"");}catch(e){}hideUpdate();}
function hideUpdate(){var el=document.getElementById("update-modal");if(el&&el.parentNode)el.parentNode.removeChild(el);}
function showUpdateModal(m){
  hideUpdate();
  var v=(m.currentVersion||"").toString(),now=APP_VERSION;
  var btns=(m.downloads||[]).map(function(d){
    return '<a class="btn" style="display:block;text-align:center;margin-bottom:8px" href="'+d.url+'" target="_blank" rel="noopener">'+d.label+'</a>';
  }).join("");
  if(!btns&&m.releaseNotesUrl)btns='<a class="btn" style="display:block;text-align:center;margin-bottom:8px" href="'+m.releaseNotesUrl+'" target="_blank" rel="noopener">See what\'s new</a>';
  var el=document.createElement("div");
  el.id="update-modal";
  el.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:24px;";
  el.innerHTML='<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center">'+
    '<div style="font-size:40px;line-height:1">\u{1F4F1}</div>'+
    '<h3 style="margin:10px 0 6px">Update available</h3>'+
    '<p style="margin:0 0 14px;font-size:14px;color:#475569">'+(m.message||"A new version of MoneyWise AI is available.")+'</p>'+
    '<p style="margin:0 0 16px;font-size:13px;color:#64748b">You\'re on <b>'+now+'</b> — the latest is <b>'+(m.currentVersion||"")+'</b>.</p>'+
    btns+
    '<button class="btn ghost" style="width:100%;margin-top:4px" onclick="dismissUpdate(\''+(m.currentVersion||"")+'\')">Not now</button>'+
  '</div>';
  document.body.appendChild(el);
}

/* ---------- BOOT ---------- */
function init(){load();if(S.onboarded){shell();go("home");checkForUpdate();}else{obShell();obRender();}}
init();
