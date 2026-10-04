var DEFAULT_CENTER=[-29.8587,31.0218];
var AREAS=ld('cs_areas',[]);
// Places are never created by AI. Keep only admin-created locations and
// student locations that came from an actual submitted crime report.
(function(){
  var changed=false;
  if(!Array.isArray(AREAS)) AREAS=[];
  AREAS=AREAS.filter(function(a){
    if(!a||typeof a!=='object') return false;
    if(a.source==='ai'||a.createdBy==='ai'||a.addedBy==='ai'){changed=true;return false}
    if(!a.source) { a.source='admin'; changed=true; }
    return true;
  });
  if(changed) try{localStorage.setItem('cs_areas',JSON.stringify(AREAS))}catch(e){}
})();
function ld(k,d){try{var v=localStorage.getItem(k);if(v)return JSON.parse(v)}catch(e){}return d}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}
}
var STAFF_CODE='DUT-STAFF-2026';
var STAFF_DOMAINS=['dut.ac.za'];
var STUDENT_DOMAINS=['dut4life.ac.za'];
var S={af:null,gchat:[],gpend:false,chat:[],aiKey:ld('cs_aikey',''),nav:null,mapType:ld('cs_mt','road'),voiceLang:ld('cs_voice_lang','en'),rt:{from:'',to:'',when:'now',res:null,sel:0,busy:false,err:'',cands:null,mine:null,placeSearch:null},users:ld('cs_users',[]),user:null,authMode:'in',f:{},role:null,pinHash:ld('cs_pin',''),adv:ld('cs_adv',{}),rf:'All',fails:0,lock:0,sort:'near',myReports:ld('cs_reports',[]),contacts:ld('cs_contacts',{emergency:'112',trusted:''}),tab:'Explore',stack:[],sel:null,saved:load(),report:{},done:false,dark:ld('cs_dark',false),me:null};
var VOICE_LANGS={en:{name:'English',tag:'en-ZA'},zu:{name:'isiZulu',tag:'zu-ZA'},af:{name:'Afrikaans',tag:'af-ZA'}};
if(!VOICE_LANGS[S.voiceLang])S.voiceLang='en';
(function(){if(!ld('cs_demo_cleaned',false)){S.users=S.users.filter(function(u){return u.email!=='student@dut4life.ac.za'&&u.email!=='admin@dut.ac.za'});sv('cs_users',S.users);sv('cs_demo_cleaned',true)}})();
(function(){var id=ld('cs_session',''),u=S.users.filter(function(x){return x.id===id})[0];if(u){S.user=u;S.role=u.role==='staff'?'staff':'student';S.tab=u.role==='staff'?'Overview':'Explore'}})();

function load(){try{var v=localStorage.getItem('cs_saved');if(v)return JSON.parse(v)}catch(e){}return []}
function persist(){try{localStorage.setItem('cs_saved',JSON.stringify(S.saved))}catch(e){}
}
var TYPE={'Vehicle-related':'Vehicle-related reports','Other':'Other incidents'};
function incs(a){var l=a.inc.map(function(i){return [i[0],i[1]]});
  S.myReports.forEach(function(r){if(r.area!==a.id)return;var n=TYPE[r.type]||r.type,f=l.filter(function(i){return i[0]===n})[0];if(f)f[1]++;else l.push([n,1])});return l}
function count(a){return incs(a).reduce(function(t,i){return t+i[1]},0)}
function risk(a){var c=count(a);return c>=8?'Elevated':c>=4?'Moderate':'Lower'}
function find(id){return AREAS.filter(function(a){return a.id===id})[0]||null}
function esc(s){return String(s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var tt;function toast(m){document.querySelectorAll('.toast').forEach(function(x){x.remove()});var t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);clearTimeout(tt);tt=setTimeout(function(){t.remove()},2600)}

function initMap(){
  var el=document.getElementById('lmap');if(!el)return;
  if(!window.L){el.innerHTML='<div class="pad" style="padding-top:90px">The map could not load. Check your internet connection and reload.</div>';return}
  var v=S.view||{c:DEFAULT_CENTER,z:12};
  var m=L.map(el,{zoomControl:false});if(S.view)m.setView(v.c,v.z);else initView(m);setTimeout(function(){m.invalidateSize()},60);
  setBase(m);L.control.zoom({position:'bottomright'}).addTo(m);
  function keep(){var c=m.getCenter();S.view={c:[c.lat,c.lng],z:m.getZoom()}}
  AREAS.forEach(function(a){var hi=count(a)>=4,col=hi?'#e0291d':'#6b7080';
    L.circle([a.lat,a.lng],{radius:hi?70:45,color:col,weight:1,fillColor:col,fillOpacity:.25,interactive:false}).addTo(m);
    L.marker([a.lat,a.lng],{icon:pinIcon(col,a.id===S.sel),title:a.name,riseOnHover:true}).addTo(m)
      .on('click',function(){keep();S.sel=a.id;render()});});
  if(S.me)L.circleMarker(S.me,{radius:8,color:'#fff',weight:3,fillColor:'#ff00bf',fillOpacity:1}).addTo(m);
  m.on('moveend',keep);
}
function H(t){return '<div class="hdr"><h1>'+t+'</h1></div>'}
function place(r){var a=find(r.area);return [a&&a.name,r.loc].filter(Boolean).join(' – ')||'Unspecified location'}
function hash(p){var b=new TextEncoder().encode('cs:'+p);if(window.crypto&&crypto.subtle)return crypto.subtle.digest('SHA-256',b).then(function(d){return Array.from(new Uint8Array(d)).map(function(x){return ('0'+x.toString(16)).slice(-2)}).join('')});return Promise.resolve(btoa('cs:'+p))}
function start(u){S.user=u;S.role=u.role==='staff'?'staff':'student';S.tab=u.role==='staff'?'Overview':'Explore';S.stack=[];S.f={};S.fails=0;sv('cs_session',u.id);render()}
function val(n){var e=document.querySelector('[data-f="'+n+'"]');return e?e.value:(S.f[n]||'')}
function roleOf(e){var d=String(e||'').trim().toLowerCase().split('@')[1]||'';return STAFF_DOMAINS.indexOf(d)>-1?'staff':STUDENT_DOMAINS.indexOf(d)>-1?'student':''}
var DOMAIN_MSG='Use your campus email: @dut4life.ac.za for students or @dut.ac.za for staff.';
function applyGrp(){var st=roleOf(val('email'))==='staff';document.querySelectorAll('[data-grp]').forEach(function(g){g.style.display=((g.dataset.grp==='staff')===st)?'':'none'})}
function auth(){
  var m=S.authMode,f=S.f;
  function inp(n,l,t,ph,ac,mode){return '<label class="meta" for="f-'+n+'">'+l+'</label><input id="f-'+n+'" data-f="'+n+'" type="'+t+'" placeholder="'+ph+'" autocomplete="'+ac+'"'+(mode?' inputmode="'+mode+'"':'')+' value="'+esc(f[n]||'')+'">'}
  function link(t,mode){return '<button class="item" style="min-height:48px;justify-content:center;color:var(--acc);font-weight:700" data-m="'+mode+'">'+t+'</button>'}
  function grp(g,html){return '<div data-grp="'+g+'">'+html+'</div>'}
  var sub={'in':'Sign in to see reported risk across campus.',up:'Create an account to report and review campus safety.',reset:'Reset your password. We verify your details first.'}[m];
  var h='<div style="padding:32px 16px 0;text-align:center"><div style="font-size:44px">🛡️</div><h1 style="font-size:26px;line-height:30px;margin-top:8px">Campus Safe</h1><div class="meta">'+sub+'</div></div>';
  if(m!=='reset')h+='<div class="chips" style="padding:16px 16px 0;margin:0"><button class="chip'+(m==='in'?' on':'')+'" style="flex:1;text-align:center" data-m="in">Sign in</button><button class="chip'+(m==='up'?' on':'')+'" style="flex:1;text-align:center" data-m="up">Create account</button></div>';
  h+='<div class="stack" style="margin:16px">';
  var sid=inp('sid','Student number','text','e.g. 22012345','off','numeric'),code=inp('code','Staff access code','password','Given by campus security','off');
  if(m==='in')h+=inp('email','Email','email','name@dut4life.ac.za','email')+inp('pw','Password','password','Your password','current-password')+'<button class="btn" data-act="signin">Sign in</button>'+link('Forgot password?','reset')+link('New here? Create an account','up');
  else if(m==='up')h+=inp('name','Full name','text','Your name','name')+inp('email','Campus email','email','name@dut4life.ac.za','email')+'<div class="meta">Students use @dut4life.ac.za and staff use @dut.ac.za. Your role is set from your email.</div>'+grp('student',sid)+grp('staff',code)+inp('pw','Password (8+ characters)','password','Create a password','new-password')+inp('pw2','Confirm password','password','Repeat password','new-password')+'<button class="btn" data-act="signup">Create account</button>'+link('Already have an account? Sign in','in');
  else h+=inp('email','Email','email','name@dut4life.ac.za','email')+grp('student',sid)+grp('staff',code)+inp('pw','New password (8+ characters)','password','New password','new-password')+inp('pw2','Confirm new password','password','Repeat new password','new-password')+'<button class="btn" data-act="reset">Reset password</button>'+link('Back to sign in','in');
  return h+'</div>'+'<div class="notice" style="margin:0 16px 16px">Create an account first, then sign in. Accounts are stored on this phone only, so this is an on-device sign-in, not a secure server login.</div>';
}
function sOverview(){
  var tot={};AREAS.forEach(function(a){incs(a).forEach(function(i){tot[i[0]]=(tot[i[0]]||0)+i[1]})});
  var names=Object.keys(tot).sort(function(a,b){return tot[b]-tot[a]}),mx=tot[names[0]]||1;
  var open=S.myReports.filter(function(r){return (r.status||'New')!=='Resolved'}).length;
  var elev=AREAS.filter(function(a){return risk(a)==='Elevated'}).length;
  var all=AREAS.reduce(function(t,a){return t+count(a)},0);
  function tile(n,l){return '<div style="min-width:44%"><b style="font-size:22px">'+n+'</b><span class="meta">'+l+'</span></div>'}
  var tm=['Morning','Afternoon','Evening','Late night'].map(function(t){return t+': '+S.myReports.filter(function(r){return r.time===t}).length}).join(' · ');
  return H('Security console')+'<div class="pad" style="padding-top:8px"><div class="metrics" style="flex-wrap:wrap;margin-bottom:16px">'+tile(all,'Reports in all areas')+tile(open,'Open student reports')+tile(elev,'Elevated areas')+tile(S.myReports.length,'Submitted on this phone')+'</div>'+
  '<p class="lbl">Incidents by type</p><div class="stack" style="margin-bottom:16px;gap:6px">'+names.map(function(n){return '<div><div class="row"><span>'+esc(n)+'</span><b>'+tot[n]+'</b></div><div class="bar" style="width:'+Math.round(tot[n]/mx*100)+'%"></div></div>'}).join('')+'</div>'+
  '<p class="lbl">Submitted reports by time</p><div class="stack" style="margin-bottom:16px">'+tm+'</div>'+
  '<p class="lbl">Areas by risk</p><div class="card">'+AREAS.slice().sort(function(a,b){return count(b)-count(a)}).map(function(a){return '<div class="item" style="min-height:56px"><b style="flex:1;font-size:15px">'+esc(a.name)+'</b><span class="risk" style="font-size:13px">'+risk(a)+' · '+count(a)+'</span></div>'}).join('')+'</div></div>';
}
function sReports(){
  var list=S.myReports.slice().reverse().filter(function(r){return S.rf==='All'||(r.status||'New')===S.rf});
  var f='<div class="chips">'+['All','New','Reviewing','Resolved'].map(function(x){return '<button class="chip'+(S.rf===x?' on':'')+'" data-rf="'+x+'">'+x+'</button>'}).join('')+'</div>';
  return H('Student reports')+'<div class="pad" style="padding-top:8px">'+f+(list.length?list.map(function(r){var st=r.status||'New';
    return '<div class="stack" style="margin:0 0 8px;gap:6px"><div class="row"><b>'+esc(r.type)+' · '+esc(place(r))+'</b><span class="risk" style="font-size:13px">'+st+'</span></div><div class="meta">'+esc(r.time)+' · '+new Date(r.at).toLocaleString()+'</div>'+(r.desc?'<div>'+esc(r.desc)+'</div>':'')+
    '<div class="chips" style="margin:4px 0 0">'+['New','Reviewing','Resolved'].map(function(x){return '<button class="chip'+(st===x?' on':'')+'" data-st="'+r.id+'|'+x+'">'+x+'</button>'}).join('')+'<button class="chip" data-delr="'+r.id+'">Delete</button></div></div>'}).join(''):'<div class="meta">No reports match this filter.</div>')+'</div>';
}
function hourLabel(i){return i===0?'12 am':i===24?'12 am (end of day)':i<12?i+' am':i===12?'12 pm':(i-12)+' pm'}
function hoursText(h1,h2){h1=+h1;h2=+h2;if(h1===h2)return 'All day';return h2===24&&h1>12?'After '+hourLabel(h1):hourLabel(h1)+'–'+hourLabel(h2)}
function persistAreas(){sv('cs_areas',AREAS)}
function blankForm(){return {name:'',q:'',lat:'',lng:'',h1:18,h2:24,summary:'',theft:0,assault:0,vehicle:0,other:0}}
function formFrom(a){var g=function(n){var i=a.inc.filter(function(x){return x[0]===n})[0];return i?i[1]:0};return {id:a.id,name:a.name,q:'',lat:String(a.lat),lng:String(a.lng),h1:a.h1==null?18:a.h1,h2:a.h2==null?24:a.h2,summary:a.summary||'',theft:g('Theft'),assault:g('Assault'),vehicle:g('Vehicle-related reports'),other:g('Other incidents')}}
function sAreas(){
  if(S.af)return areaForm();
  return H('Locations')+'<div class="pad" style="padding-top:8px"><div class="chips" style="margin:0 0 12px"><button class="btn sm" data-act="afnew">+ Add location</button><button class="chip" data-act="afshare">Share locations link</button></div>'+
  (AREAS.length?AREAS.map(function(a){
    return '<div class="stack" style="margin:0 0 8px;gap:6px"><div class="row"><b>'+esc(a.name)+'</b><span class="risk">'+risk(a)+'</span></div><div class="meta">'+count(a)+' reports · Riskiest '+esc(String(a.hours||'').toLowerCase())+' · '+a.lat.toFixed(4)+', '+a.lng.toFixed(4)+'</div>'+
    (S.adv[a.id]?'<div style="border-left:4px solid #c0152f;padding-left:8px">'+esc(S.adv[a.id])+'</div>':'')+
    '<input id="adv-'+a.id+'" maxlength="140" placeholder="Advisory shown to students" value="'+esc(S.adv[a.id]||'')+'" style="margin:0"><div class="chips" style="margin:0"><button class="chip" data-adv="'+a.id+'|set">Publish advisory</button><button class="chip" data-adv="'+a.id+'|clear">Clear</button><button class="chip" data-aedit="'+a.id+'">Edit</button><button class="chip" data-adel="'+a.id+'">Delete</button></div></div>'}).join(''):'<div class="stack">No locations yet. Tap <b>Add location</b> to create the first one. Students will see it on the map straight away.</div>')+'</div>';
}
function areaForm(){
  var f=S.af;
  function hrs(k){var o='';for(var i=0;i<=24;i++)o+='<option value="'+i+'"'+(+f[k]===i?' selected':'')+'>'+hourLabel(i)+'</option>';return '<select data-af="'+k+'" style="width:100%;min-height:48px;margin-bottom:8px;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--txt);font:16px system-ui">'+o+'</select>'}
  function num(k,l){return '<div style="flex:1;min-width:40%"><label class="meta">'+l+'</label><input type="number" min="0" inputmode="numeric" data-af="'+k+'" value="'+esc(f[k])+'"></div>'}
  return '<div class="hdr"><button class="ic" data-act="afcancel" aria-label="Back">‹</button><h1>'+(f.id?'Edit location':'Add location')+'</h1></div><div class="pad" style="padding-top:8px"><div class="stack" style="gap:4px">'+
  '<label class="meta">Location name</label><input data-af="name" maxlength="80" placeholder="e.g. Main library entrance" value="'+esc(f.name)+'">'+
  '<label class="meta">Find a place or address</label><div style="display:flex;gap:8px"><input data-af="q" placeholder="Search address or place" value="'+esc(f.q)+'" style="margin:0"><button class="btn sm" style="min-width:72px" data-act="afsearch">Find</button></div>'+
  '<div class="chips" style="margin:8px 0 0"><button class="chip" data-act="afloc">📍 Use my current location</button></div><div class="meta">Or tap the map to drop the pin.</div>'+
  '<div class="map" style="height:240px;border-radius:12px;margin:8px 0"><div id="amap" style="position:absolute;inset:0"></div>'+mtypeHtml(12)+'</div>'+
  '<div style="display:flex;gap:8px"><div style="flex:1"><label class="meta">Latitude</label><input data-af="lat" inputmode="decimal" value="'+esc(f.lat)+'"></div><div style="flex:1"><label class="meta">Longitude</label><input data-af="lng" inputmode="decimal" value="'+esc(f.lng)+'"></div></div>'+
  '<label class="meta">Riskiest from</label>'+hrs('h1')+'<label class="meta">Riskiest until</label>'+hrs('h2')+
  '<label class="meta">Short description (optional)</label><textarea data-af="summary" maxlength="200" placeholder="What students should know about this place">'+esc(f.summary)+'</textarea>'+
  '<p class="lbl" style="margin-top:12px">Reports already on record (past 30 days)</p><div style="display:flex;flex-wrap:wrap;gap:0 8px">'+num('theft','Theft')+num('assault','Assault')+num('vehicle','Vehicle-related')+num('other','Other')+'</div>'+
  '<button class="btn" data-act="afsave">'+(f.id?'Save changes':'Add location')+'</button><button class="btn sec" data-act="afcancel">Cancel</button></div></div>';
}
function initView(m){
  if(AREAS.length)m.fitBounds(L.latLngBounds(AREAS.map(function(a){return [a.lat,a.lng]})),{padding:[40,40],maxZoom:17});
  else if(S.me)m.setView(S.me,15);else m.setView(DEFAULT_CENTER,12);
}
function initAreaMap(){
  var el=document.getElementById('amap');if(!el||!S.af)return;
  if(!window.L){el.innerHTML='<div class="pad">The map could not load. Type the coordinates instead.</div>';return}
  var f=S.af,has=isFinite(parseFloat(f.lat))&&isFinite(parseFloat(f.lng)),m=L.map(el,{zoomControl:false});
  if(has)m.setView([+f.lat,+f.lng],17);else initView(m);
  setBase(m);L.control.zoom({position:'bottomright'}).addTo(m);
  AREAS.forEach(function(a){if(a.id===f.id)return;L.circle([a.lat,a.lng],{radius:150,color:'#6b7080',weight:1,fillOpacity:.1,interactive:false}).addTo(m)});
  var mk=has?L.marker([+f.lat,+f.lng],{icon:pinIcon('#e0291d',true)}).addTo(m):null;
  m.on('click',function(e){f.lat=e.latlng.lat.toFixed(6);f.lng=e.latlng.lng.toFixed(6);
    if(mk)mk.setLatLng(e.latlng);else mk=L.marker(e.latlng,{icon:pinIcon('#e0291d',true)}).addTo(m);
    var a=document.querySelector('[data-af=lat]'),b=document.querySelector('[data-af=lng]');if(a)a.value=f.lat;if(b)b.value=f.lng});
}
function shareAreas(){
  var data=AREAS.map(function(a){return {id:a.id,name:a.name,lat:a.lat,lng:a.lng,h1:a.h1,h2:a.h2,hours:a.hours,summary:a.summary,inc:a.inc,upd:a.upd}});
  var u=location.href.split('#')[0]+'#areas='+encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
  var warn=location.protocol==='file:'?' Host the app online first (for example on Netlify) so the link works on other phones.':'';
  if(navigator.share)navigator.share({title:'Campus Safe locations',url:u}).catch(function(){});
  else if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){toast('Link copied. Send it to students.'+warn)});
  else toast(u);
  if(warn&&navigator.share)toast(warn.trim());
}
function sAccount(){
  return H('Account')+'<div class="pad" style="padding-top:8px"><div class="stack" style="gap:4px;margin-bottom:16px"><b>'+esc(S.user.name)+'</b><div class="meta">'+esc(S.user.email)+' · Security staff</div></div><button class="btn sec" style="margin-top:0" data-act="exp">Export reports (CSV)</button><div class="stack" style="margin-top:16px"><p class="lbl">Change password</p><input id="npw" type="password" autocomplete="new-password" placeholder="New password (8+ characters)"><button class="btn" style="margin-top:0" data-act="chpw">Save new password</button></div><button class="btn" style="background:#c0152f" data-act="logout">Log out</button></div>';
}
function exportCsv(){
  var rows=[['id','date','area','typed_location','type','time','details','status']].concat(S.myReports.map(function(r){var a=find(r.area);return [r.id,new Date(r.at).toISOString(),a?a.name:'',r.loc||'',r.type,r.time,r.desc||'',r.status||'New']}));
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(',')}).join('\n');
  var u=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=u;a.download='campus-safe-reports.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);
}
var OSM='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
var SAT='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
var LAB='https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
var CUR={m:null,t:null,l:null};
var ROAD=[
  {u:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',o:{maxZoom:19,attribution:'Tiles &copy; Esri'}},
  {u:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',o:{subdomains:'abcd',maxZoom:19,attribution:'&copy; OpenStreetMap &copy; CARTO'}},
  {u:OSM,o:{maxZoom:19,attribution:'&copy; OpenStreetMap'}}];
function tileLayerFor(m,u,o,i){
  var t=L.tileLayer(u,o),errs=0,ok=false;
  t.on('tileload',function(){ok=true});
  t.on('tileerror',function(){errs++;if(ok||errs!==4||CUR.m!==m||CUR.t!==t)return;
    if(i!=null&&i+1<ROAD.length){m.removeLayer(t);CUR.t=tileLayerFor(m,ROAD[i+1].u,ROAD[i+1].o,i+1)}
    else toast('Map tiles could not load. Check your internet connection.')});
  return t.addTo(m);
}
function setBase(m){
  if(CUR.m!==m){CUR.m=m;CUR.t=null;CUR.l=null}
  if(CUR.t)m.removeLayer(CUR.t);if(CUR.l){m.removeLayer(CUR.l);CUR.l=null}
  if(S.mapType==='sat'){CUR.t=tileLayerFor(m,SAT,{maxZoom:19,attribution:'Tiles &copy; Esri'},null);CUR.l=L.tileLayer(LAB,{maxZoom:19}).addTo(m)}
  else CUR.t=tileLayerFor(m,ROAD[0].u,ROAD[0].o,0);
}
function mtypeHtml(top){return '<div class="mtype" style="top:'+top+'px"><button data-mt="road" class="'+(S.mapType!=='sat'?'on':'')+'">Map</button><button data-mt="sat" class="'+(S.mapType==='sat'?'on':'')+'">Satellite</button></div><button class="map-full" style="top:'+top+'px" data-act="mapfull" aria-label="View map fullscreen" title="View map fullscreen">⛶</button>'}
function voiceLanguageControl(){return '<label class="meta voice-label">Voice language<select class="voice-language" data-voice-lang aria-label="Voice guidance language">'+Object.keys(VOICE_LANGS).map(function(k){return '<option value="'+k+'"'+(S.voiceLang===k?' selected':'')+'>'+VOICE_LANGS[k].name+'</option>'}).join('')+'</select></label>'}
function toggleMapFullscreen(btn){var map=btn.closest('.map');if(!map)return;
  if(document.fullscreenElement===map){document.exitFullscreen().catch(function(){})}
  else if(map.requestFullscreen)map.requestFullscreen().catch(function(){toast('Fullscreen is not available in this browser.')});
  else toast('Fullscreen is not available in this browser.')}
document.addEventListener('fullscreenchange',function(){setTimeout(function(){if(CUR.m)CUR.m.invalidateSize();if(NAV.map)NAV.map.invalidateSize()},80)});
function pinIcon(col,big){var w=big?36:30,h=big?48:40;return L.divIcon({className:'',iconSize:[w,h],iconAnchor:[w/2,h-1],html:'<svg width="'+w+'" height="'+h+'" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))"><path d="M15 39C15 39 2 24 2 14a13 13 0 0 1 26 0c0 10-13 25-13 25z" fill="'+col+'" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#fff"/></svg>'})}
function hourOf(w){return w==='day'?14:w==='evening'?19:w==='late'?22:new Date().getHours()}
function inWin(id,h){var a=find(id);if(!a||a.h1==null)return false;return a.h1<=a.h2?(h>=a.h1&&h<a.h2):(h>=a.h1||h<a.h2)}
function segDist(p,a,b){var k=Math.cos(p[0]*Math.PI/180),m=111320;
  function X(q){return (q[1]-p[1])*k*m}function Y(q){return (q[0]-p[0])*m}
  var ax=X(a),ay=Y(a),bx=X(b),by=Y(b),dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t2=l?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l)):0,ex=ax+t2*dx,ey=ay+t2*dy;return Math.sqrt(ex*ex+ey*ey)}
function minDist(p,line){var d=1e9;for(var i=1;i<line.length;i++){var v=segDist(p,line[i-1],line[i]);if(v<d)d=v}return d}
function routePosition(p,line){var best=1e9,progress=0,walked=0,k=Math.cos(p[0]*Math.PI/180),scale=111320;
  for(var i=1;i<line.length;i++){
    var a=line[i-1],b=line[i],ax=(a[1]-p[1])*k*scale,ay=(a[0]-p[0])*scale,bx=(b[1]-p[1])*k*scale,by=(b[0]-p[0])*scale;
    var dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,part=Math.sqrt(len),t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0;
    var ex=ax+t*dx,ey=ay+t*dy,d=Math.sqrt(ex*ex+ey*ey);
    if(d<best){best=d;progress=walked+t*part}walked+=part;
  }
  return {distance:best,progress:progress};
}
function exposure(line,h){var sc=0,near=[],worst=null,wv=0;
  AREAS.forEach(function(a){var d=minDist([a.lat,a.lng],line);if(d>=150)return;var w=inWin(a.id,h)?1.5:0.6,v=count(a)*(1-d/150)*w;sc+=v;near.push(a.name);if(v>wv){wv=v;worst=a}});
  return {score:sc,near:near,worst:worst}}
function geocode(txt,near){
  var t2=txt.trim().toLowerCase();
  if(t2==='my location'&&S.rt.mine)return Promise.resolve([S.rt.mine[0],S.rt.mine[1],'My location']);
  var a=AREAS.filter(function(x){return x.name.toLowerCase()===t2||(t2.length>=3&&x.name.toLowerCase().indexOf(t2)>-1)})[0];
  if(a)return Promise.resolve([a.lat,a.lng,a.name]);
  var url='https://nominatim.openstreetmap.org/search?format=json&limit=10&q='+encodeURIComponent(txt);
  if(near&&isFinite(near[0])&&isFinite(near[1])){
    var latPad=0.35,lonPad=Math.min(10,latPad/Math.max(0.2,Math.cos(near[0]*Math.PI/180)));
    url+='&viewbox='+[Math.max(-180,near[1]-lonPad),Math.min(90,near[0]+latPad),Math.min(180,near[1]+lonPad),Math.max(-90,near[0]-latPad)].join(',')+'&bounded=0';
  }
  return fetch(url).then(function(r){return r.json()}).then(function(j){
    if(!j.length)throw new Error('Could not find "'+txt+'". Try a more specific place name.');
    var lat=+j[0].lat,lon=+j[0].lon;
    if(!isFinite(lat)||!isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180){throw new Error('The location service returned invalid coordinates for "'+txt+'".');}
    return [lat,lon,j[0].display_name.split(',')[0],j[0].display_name]})}
function osrm(pts){var c=pts.map(function(p){return p[1]+','+p[0]}).join(';');
  return fetch('https://routing.openstreetmap.de/routed-foot/route/v1/foot/'+c+'?overview=full&geometries=geojson&alternatives=true&steps=true').then(function(r){return r.json()}).then(function(j){
    if(j.code!=='Ok'||!j.routes||!j.routes.length){var err=new Error(j.message||'No walking route was found between those places.');err.routeCode=j.code;throw err}
    return j.routes.map(function(r){return {coords:r.geometry.coordinates.map(function(c){return [c[1],c[0]]}),dist:r.distance,dur:r.duration,steps:stepsOf(r)}})})}
function findRoutes(fr,to){
  return geocode(fr).then(function(a){
    return geocode(to,a.slice(0,2)).then(function(b){
      var h=hourOf(S.rt.when);
      return osrm([a,b]).catch(function(er){
        if(er.routeCode==='NoRoute')throw new Error('No connected walking path was found from '+a[2]+' to '+b[2]+' ('+fmt(dm(a,b))+' apart). The destination matched: '+(b[3]||b[2])+'. Add a city or area name if this is not the place you meant.');
        throw er;
      }).then(function(base){
      var sh=base.reduce(function(m,c){return c.dist<m.dist?c:m},base[0]),ex=exposure(sh.coords,h);
      if(!ex.worst)return base;
      var k=Math.cos(a[0]*Math.PI/180),vx=(b[1]-a[1])*k*111320,vy=(b[0]-a[0])*111320,len=Math.sqrt(vx*vx+vy*vy)||1,px=-vy/len,py=vx/len;
      return Promise.all([1,-1].map(function(sg){
        var wp=[ex.worst.lat+sg*py*250/111320,ex.worst.lng+sg*px*250/(111320*k),'via'];
        return osrm([a,wp,b]).then(function(r){return r.slice(0,1)}).catch(function(){return []})
      })).then(function(x){return base.concat(x[0],x[1])});
      });
    });
  });
}
function rank(){
  var h=hourOf(S.rt.when),all=S.rt.cands.map(function(c){var e=exposure(c.coords,h);return {coords:c.coords,steps:c.steps||[],dist:c.dist,dur:c.dur,score:e.score,near:e.near,level:e.score>=8?'Higher':e.score>=3?'Moderate':'Lower'}});
  var minD=Math.min.apply(null,all.map(function(c){return c.dist})),seen={};
  var list=all.filter(function(c){return c.dist<=Math.max(minD*1.6,minD+400)}).filter(function(c){var k=Math.round(c.dist/15);if(seen[k])return false;seen[k]=1;return true});
  var best=0,fast=0;
  list.forEach(function(c,i){var b=list[best];if(c.score<b.score-0.01||(Math.abs(c.score-b.score)<=0.01&&c.dur<b.dur))best=i;if(c.dur<list[fast].dur)fast=i});
  S.rt.res={list:[list[best]],best:0,fast:0};S.rt.sel=0;
}
function route(){
  var r=S.rt,res=r.res,h=H('Safe route')+'<div class="pad" style="padding-top:8px"><div class="stack" style="margin-bottom:12px;gap:4px">'+
  '<label class="meta" for="rt-from">From</label><div style="display:flex;gap:8px"><input id="rt-from" list="places" data-rt="from" placeholder="Start location (place or address)" value="'+esc(r.from)+'" style="margin:0"><button class="btn sm" data-act="rtsearch" data-field="from">Search places</button></div>'+placeSearchHtml('from')+
  '<div class="chips" style="margin:4px 0 0"><button class="chip" data-act="rtloc">📍 Use my location</button><button class="chip" data-act="rtswap">⇅ Swap</button></div>'+
  '<label class="meta" for="rt-to">To</label><div style="display:flex;gap:8px"><input id="rt-to" list="places" data-rt="to" placeholder="Destination (place or address)" value="'+esc(r.to)+'" style="margin:0"><button class="btn sm" data-act="rtsearch" data-field="to">Search places</button></div>'+placeSearchHtml('to')+
  '<datalist id="places">'+AREAS.map(function(a){return '<option value="'+esc(a.name)+'">'}).join('')+'</datalist>'+
  '<label class="meta">Leaving</label><div class="chips" style="margin:0">'+[['now','Now'],['day','Daytime'],['evening','Evening'],['late','Late night']].map(function(o){return '<button class="chip'+(r.when===o[0]?' on':'')+'" data-rw="'+o[0]+'">'+o[1]+'</button>'}).join('')+'</div>'+
  voiceLanguageControl()+
  '<button class="btn" data-act="rtfind"'+(r.busy?' disabled':'')+'>'+(r.busy?'Finding routes…':'Find safest route')+'</button></div>'+
  (r.err?'<div class="stack" style="border-left:4px solid #c0152f;margin-bottom:12px">'+esc(r.err)+'</div>':'')+
  '<div class="map" style="height:300px;border-radius:12px;margin-bottom:12px"><div id="rmap" style="position:absolute;inset:0"></div>'+mtypeHtml(12)+'</div>';
  if(res){
    var b=res.list[res.best],f=res.list[res.fast];
    h+='<p class="lbl">'+res.list.length+' route'+(res.list.length>1?'s':'')+' · leaving '+(r.when==='now'?'now':{day:'in the daytime',evening:'in the evening',late:'late at night'}[r.when])+'</p>';
    if(res.best!==res.fast)h+='<div class="stack" style="margin-bottom:12px;gap:2px"><b>Safest route adds '+Math.max(1,Math.round((b.dur-f.dur)/60))+' min</b><div>I compared the fastest and safest options here.</div></div>';
    h+=res.list.map(function(c,i){
      var t=i===res.best&&i===res.fast?'Safest and fastest':i===res.best?'Safest route':i===res.fast?'Fastest route':'Alternative';
      var col=c.level==='Lower'?'#1a9a5a':c.level==='Moderate'?'#b07c00':'#c0152f';
      return '<button class="item" style="display:block;background:var(--card);padding:12px 16px;margin-bottom:8px;border-radius:12px;min-height:0;border:2px solid '+(i===r.sel?'var(--acc)':'transparent')+'" data-rsel="'+i+'"><div class="row"><b>'+t+'</b><b style="color:'+col+'">'+c.level+' risk</b></div><div class="meta">'+(c.dist/1000).toFixed(1)+' km · '+Math.max(1,Math.round(c.dur/60))+' min walk</div><div style="margin-top:4px">'+(c.near.length?'Passes near: '+esc(c.near.join(', ')):'Avoids all reported areas')+'</div></button>'}).join('');
  }
  return h+(res?assistantHtml():'')+'<div class="notice">Routes can be requested for any destination where mapped walking paths are available. Risk scores only use campus-security and student reports stored in this app; routes beyond that coverage are not independently assessed. A lower-risk label does not mean a route is safe. If you feel unsafe, contact emergency services.</div></div>';
}
function placeSearchHtml(field){var p=S.rt.placeSearch;if(!p||p.field!==field)return '';
  if(p.busy)return '<div class="meta">Searching worldwide place names…</div>';
  if(p.error)return '<div class="meta" role="status">'+esc(p.error)+'</div>';
  if(!p.items.length)return '<div class="meta" role="status">No places found. Try adding a city or country.</div>';
  return '<div class="stack" style="gap:4px;margin:4px 0 8px"><div class="meta">Choose the matching place</div>'+p.items.map(function(x,i){return '<button class="item" style="text-align:left;padding:8px 12px" data-placepick="'+i+'"><span>'+esc(x.label)+'</span></button>'}).join('')+'</div>';
}
function searchPlaces(txt,near){
  var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&q='+encodeURIComponent(txt);
  if(near&&isFinite(near[0])&&isFinite(near[1])){
    var latPad=0.35,lonPad=Math.min(10,latPad/Math.max(0.2,Math.cos(near[0]*Math.PI/180)));
    url+='&viewbox='+[Math.max(-180,near[1]-lonPad),Math.min(90,near[0]+latPad),Math.min(180,near[1]+lonPad),Math.max(-90,near[0]-latPad)].join(',')+'&bounded=0';
  }
  return fetch(url).then(function(r){if(!r.ok)throw new Error('Place search is unavailable. Check your connection and try again.');return r.json()}).then(function(items){
    return items.filter(function(x){var lat=+x.lat,lon=+x.lon;return isFinite(lat)&&isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}).map(function(x){return {lat:+x.lat,lon:+x.lon,label:x.display_name}});
  });
}
function initRouteMap(){
  var el=document.getElementById('rmap');if(!el)return;
  if(!window.L){el.innerHTML='<div class="pad">The map could not load. Check your internet connection.</div>';return}
  var m=L.map(el,{zoomControl:false});initView(m);
  setBase(m);L.control.zoom({position:'bottomright'}).addTo(m);
  AREAS.forEach(function(a){var hi=count(a)>=4,col=hi?'#c0152f':'#6b7080';L.circle([a.lat,a.lng],{radius:150,color:col,weight:1,fillColor:col,fillOpacity:hi ? 0.2 : 0.08,interactive:false}).addTo(m)});
  var r=S.rt.res;if(!r)return;
  r.list.forEach(function(c,i){if(!c||!Array.isArray(c.coords)||!c.coords.length||i===S.rt.sel)return;L.polyline(c.coords,{color:'#8a8fa0',weight:4,dashArray:'6 8'}).addTo(m)});
  var c=r.list[S.rt.sel];if(!c||!Array.isArray(c.coords)||!c.coords.length)return;
  var pl=L.polyline(c.coords,{color:'#d71920',weight:6}).addTo(m);
  addDirectionArrows(m,c.coords);
  L.circleMarker(c.coords[0],{radius:8,color:'#fff',weight:3,fillColor:'#352384',fillOpacity:1}).addTo(m);
  L.circleMarker(c.coords[c.coords.length-1],{radius:8,color:'#fff',weight:3,fillColor:'#ff00bf',fillOpacity:1}).addTo(m);
  m.fitBounds(pl.getBounds(),{padding:[24,24]});
}
function addDirectionArrows(m,coords){
  if(!Array.isArray(coords)||coords.length<2)return;
  var total=0;for(var i=1;i<coords.length;i++)total+=dm(coords[i-1],coords[i]);
  var interval=Math.max(150,total/24),next=interval,walked=0;
  for(var j=1;j<coords.length-1;j++){
    walked+=dm(coords[j-1],coords[j]);
    if(walked<next)continue;
    var a=coords[j-1],b=coords[j],lat=(a[0]+b[0])/2;
    var heading=Math.atan2((b[1]-a[1])*Math.cos(lat*Math.PI/180),b[0]-a[0])*180/Math.PI;
    L.marker(b,{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],html:'<span style="display:block;color:#d71920;font-size:24px;font-weight:900;line-height:24px;text-align:center;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;transform:rotate('+heading+'deg)">↑</span>'})}).addTo(m);
    next=walked+interval;
  }
}
function dm(a,b){var k=Math.cos((a[0]+b[0])*Math.PI/360),x=(b[1]-a[1])*k*111320,y=(b[0]-a[0])*111320;return Math.sqrt(x*x+y*y)}
function fmt(d){return d<1000?Math.max(5,Math.round(d/5)*5)+' m':(d/1000).toFixed(1)+' km'}
function stepsOf(r){var out=[];(r.legs||[]).forEach(function(l,li){l.steps.forEach(function(st,si){
  var last=li===r.legs.length-1&&si===l.steps.length-1,t=st.maneuver.type,m=st.maneuver.modifier||'';
  if(t==='arrive'&&!last)return;if(t==='depart'&&li>0){t='continue';m='straight'}
  out.push({t:t,m:m,n:st.name||'',d:st.distance,loc:[st.maneuver.location[1],st.maneuver.location[0]]})})});return out}
function instr(s){var m=s.m||'',n=s.n?' onto '+s.n:'';
  if(s.t==='arrive')return 'You have arrived at your destination';
  if(s.t==='depart')return 'Start walking'+(s.n?' on '+s.n:'');
  if(s.t==='roundabout'||s.t==='rotary')return 'Take the roundabout'+n;
  if(m==='uturn')return 'Make a U-turn';
  if(!m||m==='straight')return 'Continue straight'+(s.n?' on '+s.n:'');
  return 'Turn '+m+n}
var VOICE_COPY={
  en:{start:'Starting guidance.',arrive:'You have arrived at your destination. Your guided walk is complete. Stay aware of your surroundings.',off:'You are off the planned route. Stop somewhere safe; I am finding another safer walking route from your current location.',wrongWay:'You seem to be moving the wrong way. Turn around and stop somewhere safe; I am finding a new safest route from where you are.',rerouteDone:'A new safest route is ready. Follow the red line and arrows.',rerouteFail:'I could not find another walking route. Stay somewhere safe and ask for help if you need it.',back:'You are back on the planned route. Continue ahead.',warning:'Safety warning. You are near {area}, which has {risk} reported risk. Stay on lit, busy paths and keep your phone handy.',turn:'Turn guidance. {instruction}.',preview:'In about {distance}, {instruction}.',now:'{instruction} now.',changed:'Voice guidance language changed to English.'},
  zu:{start:'Ukuqondisa indlela kuyaqala.',arrive:'Usufikile lapho uya khona. Uhambo lwakho oluqondiswayo luphelile. Qaphela indawo okuzungezile.',off:'Usuphumile emzileni ohleliwe. Yima endaweni ephephile; ngikutholela enye indlela yokuhamba ephephile kusukela lapho ukhona.',wrongWay:'Kubonakala sengathi uhamba ngendlela engalungile. Jikela ubuye ume endaweni ephephile; ngikutholela enye indlela ephephe kunazo zonke kusukela lapho ukhona.',rerouteDone:'Indlela entsha ephephe kunazo zonke isilungile. Landela umugqa obomvu nemicibisholo.',rerouteFail:'Angikwazanga ukuthola enye indlela yokuhamba. Hlala endaweni ephephile bese ucela usizo uma uludinga.',back:'Usuphindele emzileni ohleliwe. Qhubeka.',warning:'Isexwayiso sokuphepha. Useduze ne-{area}, enezinga lobungozi elibikiwe elithi {risk}. Hlala ezindleleni ezikhanyayo nezimatasa, futhi ugcine ifoni yakho iseduze.',turn:'Isiqondiso sendlela: {instruction}.',preview:'Uma usuhambe cishe ibanga elingu-{distance}, {instruction}.',now:'{instruction} manje.',changed:'Ulimi lokuqondisa ngezwi lushintshiwe lwaba isiZulu.'},
  af:{start:'Rigtingaanwysings begin nou.',arrive:'Jy het jou bestemming bereik. Jou begeleide stap is voltooi. Bly bewus van jou omgewing.',off:'Jy is buite die beplande roete. Stop op ’n veilige plek; ek soek ’n veiliger staproete vanaf jou huidige ligging.',wrongWay:'Dit lyk of jy in die verkeerde rigting beweeg. Draai om en stop op ’n veilige plek; ek soek die veiligste nuwe roete vanaf jou huidige ligging.',rerouteDone:'Die veiligste nuwe roete is gereed. Volg die rooi lyn en pyle.',rerouteFail:'Ek kon nie ’n ander staproete vind nie. Bly op ’n veilige plek en vra hulp as jy dit nodig het.',back:'Jy is terug op die beplande roete. Hou aan.',warning:'Veiligheidswaarskuwing. Jy is naby {area}, met {risk} aangemelde risiko. Bly op goed beligte, besige paadjies en hou jou foon byderhand.',turn:'Rigtingaanwysing: {instruction}.',preview:'Oor ongeveer {distance}, {instruction}.',now:'{instruction} nou.',changed:'Die stemrigtingtaal is nou Afrikaans.'}
};
function voiceCopy(key,data){var text=(VOICE_COPY[S.voiceLang]||VOICE_COPY.en)[key]||VOICE_COPY.en[key]||'';
  return text.replace(/\{(\w+)\}/g,function(_,k){return data&&data[k]!=null?data[k]:''})}
function voiceInstruction(s){var lang=S.voiceLang,m=s.m||'',name=s.n||'',dir={
  en:{left:'Turn left',right:'Turn right','slight left':'Turn slightly left','slight right':'Turn slightly right','sharp left':'Turn sharply left','sharp right':'Turn sharply right',uturn:'Make a U-turn',straight:'Continue straight'},
  zu:{left:'Jikela kwesobunxele',right:'Jikela kwesokudla','slight left':'Jikela kancane kwesobunxele','slight right':'Jikela kancane kwesokudla','sharp left':'Jikela kakhulu kwesobunxele','sharp right':'Jikela kakhulu kwesokudla',uturn:'Phenduka ubuyele emuva',straight:'Qhubeka uqonde'},
  af:{left:'Draai links',right:'Draai regs','slight left':'Draai effens links','slight right':'Draai effens regs','sharp left':'Draai skerp links','sharp right':'Draai skerp regs',uturn:'Maak ’n U-draai',straight:'Hou reguit aan'}
  }[lang]||null;
  if(s.t==='arrive')return voiceCopy('arrive');
  if(s.t==='depart')return lang==='zu'?'Qala ukuhamba'+(name?' ku-'+name:''):lang==='af'?'Begin stap'+(name?' op '+name:''):'Start walking'+(name?' on '+name:'');
  if(s.t==='roundabout'||s.t==='rotary')return lang==='zu'?'Ngena emjikelezweni'+(name?' ku-'+name:''):lang==='af'?'Neem die rotonde'+(name?' op '+name:''):'Take the roundabout'+(name?' onto '+name:'');
  var phrase=(dir||{left:'Turn left',right:'Turn right','slight left':'Turn slightly left','slight right':'Turn slightly right','sharp left':'Turn sharply left','sharp right':'Turn sharply right',uturn:'Make a U-turn',straight:'Continue straight'})[m]||((dir||{}).straight||'Continue straight');
  if(!m||m==='straight')return phrase+(name?(lang==='zu'?' ku-'+name:lang==='af'?' op '+name:' on '+name):'');
  return phrase+(name?(lang==='zu'?' ungene ku-'+name:lang==='af'?' op '+name:' onto '+name):'')}
function arrow(s){var m=s.m||'';return s.t==='arrive'?'🏁':m==='left'?'⬅️':m==='right'?'➡️':m==='slight left'?'↖️':m==='slight right'?'↗️':m==='sharp left'?'↙️':m==='sharp right'?'↘️':m==='uturn'?'↩️':'⬆️'}
function advice(){
  var r=S.rt,res=r.res;if(!res)return '';var b=res.list[res.best],f=res.list[res.fast];
  var when={now:'right now',day:'in the daytime',evening:'in the evening',late:'late at night'}[r.when];
  var t='I compared '+res.list.length+' walking route'+(res.list.length>1?'s':'')+' '+when+'. ';
  if(res.best===res.fast)t+='The fastest route is also the safest I found: '+b.level.toLowerCase()+' reported risk, '+(b.dist/1000).toFixed(1)+' km, about '+Math.max(1,Math.round(b.dur/60))+' min. ';
  else t+='I recommend the safest route. It adds about '+Math.max(1,Math.round((b.dur-f.dur)/60))+' min but lowers the reported risk from '+f.level.toLowerCase()+' to '+b.level.toLowerCase()+'. ';
  t+=b.near.length?'It still passes near '+b.near.join(' and ')+', so stay on lit, busy paths there. ':'It avoids every reported area. ';
  return t+'Tap Start guidance for turn-by-turn directions and warnings as you get near a reported area.';
}
function localAnswer(q){
  var r=S.rt,res=r.res,t=q.toLowerCase(),b=res.list[res.best],f=res.list[res.fast],h=hourOf(r.when);
  function km(c){return (c.dist/1000).toFixed(1)+' km, about '+Math.max(1,Math.round(c.dur/60))+' min'}
  if(/fast|quick|short/.test(t)){r.sel=res.fast;return 'I switched the map to the fastest route ('+km(f)+', '+f.level.toLowerCase()+' risk).'+(res.fast!==res.best?' It is about '+Math.max(1,Math.round((b.dur-f.dur)/60))+' min quicker than the safest route, but the reported risk is higher.':' It is also the safest route I found.')}
  if(/safest|safer|best/.test(t)){r.sel=res.best;return 'I switched the map to the safest route ('+km(b)+', '+b.level.toLowerCase()+' risk).'+(b.near.length?' It passes near '+b.near.join(' and ')+'.':' It avoids every reported area.')}
  if(/unsafe|scared|afraid|follow|danger|threat|help|emergenc/.test(t))return 'If you feel unsafe, move toward a busy, well-lit place such as a building entrance or a security point. Call emergency services on '+(S.contacts.emergency||'112')+' if you are in danger. The Safety tab can share your location link or text it to your trusted contact.';
  if(/hour|time|night|evening|dark|late|day|now|when/.test(t)){var act=AREAS.filter(function(a){return inWin(a.id,h)}).map(function(a){return a.name});return 'I scored the routes for '+h+':00. '+(act.length?'Reports peak around '+act.join(', ')+' at that hour, so routes near them score higher. ':'None of the reported areas are in their peak hours then, so scores are lower. ')+'Use the Leaving buttons to compare daytime, evening and late night.'}
  if(/why|explain|reason|recommend|choose|chose|how/.test(t))return 'Each route is scored by how close it passes to reported areas, multiplied by how many reports that area has, with extra weight when you travel in its riskier hours. The lowest score wins, and very long detours are dropped. '+(res.best===res.fast?'Here the fastest route also scored best.':'Here the safest route scored lower than the fastest one.');
  if(/near|pass|area|where/.test(t)){var s2=res.list[r.sel];return s2.near.length?'The selected route passes near '+s2.near.join(', ')+'.':'The selected route avoids all reported areas.'}
  return 'I can explain why I picked a route, show how the time of day changes risk, switch to the fastest or safest route, or tell you what to do if you feel unsafe.';
}
function askClaude(q){
  var res=S.rt.res,ctx={leaving:S.rt.when,hour:hourOf(S.rt.when),from:S.rt.from,to:S.rt.to,routes:res.list.map(function(c,i){return {id:i,safest:i===res.best,fastest:i===res.fast,km:+(c.dist/1000).toFixed(2),minutes:Math.round(c.dur/60),risk:c.level,passesNear:c.near}}),areas:AREAS.map(function(a){return {name:a.name,reports30d:count(a),mostReported:a.hours}})};
  var sys='You are the Campus Safe route safety assistant for university students walking on campus. Answer using only the route data provided. The reports may be incomplete, so never claim a route is guaranteed safe. Keep answers under 90 words, practical and calm. If the student feels in danger, tell them to move to a busy, lit place and call emergency services. Reply in '+VOICE_LANGS[S.voiceLang].name+' unless a place name or phone number must remain unchanged.';
  return fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.aiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:300,system:sys,messages:[{role:'user',content:'Route data: '+JSON.stringify(ctx)+' Question: '+q}]})})
   .then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error.message);return j.content.map(function(x){return x.text||''}).join('').trim()});
}
function ask(q){
  q=String(q||'').trim();if(!q||!S.rt.res)return;S.chat.push({r:'u',t:q});
  if(S.aiKey){var i=S.chat.length;S.chat.push({r:'a',t:'Thinking…'});render();
    askClaude(q).then(function(a){S.chat[i].t=a;speakAssistantReply(a);render()}).catch(function(){S.chat[i].t=localAnswer(q)+' (Claude could not be reached, so this came from the on-device assistant.)';speakAssistantReply(S.chat[i].t);render()});return}
  S.chat.push({r:'a',t:localAnswer(q)});speakAssistantReply(S.chat[S.chat.length-1].t);render();
}
function assistantHtml(){
  var r=S.rt,res=r.res,sel=res.list[r.sel],can=sel.steps&&sel.steps.length>1;
  return '<button class="btn" data-act="navstart"'+(can?'':' disabled')+' >🧭 Start guidance on selected route</button>'+
  '<div class="stack" style="margin-top:12px;gap:8px"><div class="row" style="align-items:center"><b>🤖 Safety assistant</b><span class="meta">'+(S.aiKey?'Claude connected':'On this phone')+'</span></div><div style="white-space:pre-wrap">'+esc(advice())+'</div>'+
  '<div class="chips" style="margin:0">'+['Why this route?','Is it safe at this hour?','What if I feel unsafe?','Show the fastest instead'].map(function(q){return '<button class="chip" data-aiq="'+q+'">'+q+'</button>'}).join('')+'</div>'+
  S.chat.map(function(m){return '<div style="white-space:pre-wrap;'+(m.r==='u'?'text-align:right;color:var(--acc);font-weight:600':'')+'">'+esc(m.t)+'</div>'}).join('')+
  '<div style="display:flex;gap:8px"><input id="ai-q" placeholder="Ask about this route…" style="margin:0"><button class="btn sm" style="min-width:64px" data-act="aiask">Ask</button></div></div>';
}
var NAV={map:null,me:null};
function speakText(text){
  var msg=String(text||'').trim();
  if(!msg||!(window.speechSynthesis&&window.SpeechSynthesisUtterance))return;
  try{
    var u=new SpeechSynthesisUtterance(msg),lang=VOICE_LANGS[S.voiceLang]||VOICE_LANGS.en;
    u.lang=lang.tag;
    u.rate=0.95;u.pitch=1;u.volume=1;
    var voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
    var code=lang.tag.split('-')[0],v=voices.filter(function(x){return String(x.lang||'').toLowerCase()===lang.tag.toLowerCase()})[0]||voices.filter(function(x){return String(x.lang||'').toLowerCase().indexOf(code)===0})[0];
    if(v)u.voice=v;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function say(t){
  if(!(S.nav&&S.nav.voice))return;
  speakText(t);
}
function speakAssistantReply(text){
  if(S.nav&&S.nav.voice){speakText(text)}
}
if(window.speechSynthesis&&speechSynthesis.onvoiceschanged!==undefined){speechSynthesis.onvoiceschanged=function(){speechSynthesis.getVoices()}}
function startWatch(){
  if(!navigator.geolocation){toast('Location is not available. Use simulated movement instead.');return null}
  return navigator.geolocation.watchPosition(function(p){onPos(p.coords.latitude,p.coords.longitude)},function(){toast('Could not get your location. Allow location access or use simulated movement.')},{enableHighAccuracy:true,maximumAge:2000});
}
function stopWatch(){var n=S.nav;if(!n)return;if(n.wid!=null&&navigator.geolocation)navigator.geolocation.clearWatch(n.wid);n.wid=null;if(n.sim){clearInterval(n.sim);n.sim=null}}
function endNav(){stopWatch();if(window.speechSynthesis)speechSynthesis.cancel();S.nav=null;NAV.map=null;NAV.me=null}
function toggleSim(){
  var n=S.nav;if(!n)return;if(n.sim){clearInterval(n.sim);n.sim=null;updateNavUI();return}
  if(n.wid!=null&&navigator.geolocation){navigator.geolocation.clearWatch(n.wid);n.wid=null}
  var c=S.rt.res.list[S.rt.sel],idx=0,inc=Math.max(2,Math.ceil(c.coords.length/120));
  n.sim=setInterval(function(){idx=Math.min(idx+inc,c.coords.length-1);onPos(c.coords[idx][0],c.coords[idx][1]);if(idx>=c.coords.length-1&&n.sim){clearInterval(n.sim);n.sim=null}},900);updateNavUI();
}
function onPos(lat,lng){
  var n=S.nav;if(!n||n.arrived||n.rerouting)return;var c=S.rt.res.list[S.rt.sel],st=c.steps,p=[lat,lng];n.pos=p;S.rt.mine=p;
  if(NAV.me)NAV.me.setLatLng(p);if(NAV.map)NAV.map.panTo(p);
  var prevI=n.i;
  while(n.i<st.length-2&&dm(p,st[n.i+1].loc)<20)n.i++;
  var dEnd=dm(p,c.coords[c.coords.length-1]);
  if(dEnd<30){n.arrived=true;say(voiceCopy('arrive'));stopWatch();updateNavUI();return}
  var nxt=st[Math.min(n.i+1,st.length-1)];n.dNext=dm(p,nxt.loc);
  n.rem=n.i+1>=st.length-1?dEnd:n.dNext+st.slice(n.i+1,st.length-1).reduce(function(t,x){return t+x.d},0);
  var wasOff=n.off,pos=routePosition(p,c.coords);
  n.off=pos.distance>70;
  n.offCount=n.off?(n.offCount||0)+1:0;
  if(n.maxProgress==null)n.maxProgress=pos.progress;
  if(n.lastProgress!=null&&pos.progress<n.lastProgress-4&&n.maxProgress-pos.progress>25)n.wrongCount=(n.wrongCount||0)+1;
  else if(n.lastProgress==null||pos.progress>n.lastProgress+4)n.wrongCount=0;
  n.lastProgress=pos.progress;
  if(pos.progress>n.maxProgress){n.maxProgress=pos.progress;n.wrongCount=0}
  var wrongWay=n.wrongCount>=4&&n.maxProgress-pos.progress>25;
  if(Date.now()>=(n.rerouteAfter||0)&&(n.offCount>=3||wrongWay)){rerouteNavigation(wrongWay);updateNavUI();return}
  if(!n.off&&wasOff){n.alert='You are back on the planned route. Continue with the guidance.';say(voiceCopy('back'));}
  AREAS.forEach(function(a){if(n.warned[a.id]||risk(a)==='Lower'||dm(p,[a.lat,a.lng])>200)return;n.warned[a.id]=1;
    var ar=risk(a).toLowerCase(),riskLabel=S.voiceLang==='zu'?(ar==='elevated'?'ephezulu':'oluphakathi'):S.voiceLang==='af'?(ar==='elevated'?'verhoogde':'matige'):ar;
    n.alert='You are near '+a.name+', which has '+ar+' reported risk ('+a.hours.toLowerCase()+'). Stay on lit, busy paths and keep your phone handy.';say(voiceCopy('warning',{area:a.name,risk:riskLabel}))});
  if(n.i!==prevI){
    var moved=st[Math.min(n.i,st.length-1)];
    say(voiceCopy('turn',{instruction:voiceInstruction(moved)}));
    n.spoken[n.i]=1;
  }
  if(n.dNext<=120&&!n.previewed[n.i]){n.previewed[n.i]=1;say(voiceCopy('preview',{distance:fmt(n.dNext),instruction:voiceInstruction(nxt)}));}
  if(n.dNext<=45&&!n.spoken[n.i]){n.spoken[n.i]=1;say(voiceCopy('now',{instruction:voiceInstruction(nxt)}))}
  updateNavUI();
}
function rerouteNavigation(wrongWay){
  var n=S.nav;if(!n||n.rerouting||!n.pos||!S.rt.to)return;
  n.rerouting=true;n.alert=voiceCopy(wrongWay?'wrongWay':'off');say(n.alert);stopWatch();updateNavUI();
  findRoutes('My location',S.rt.to).then(function(candidates){
    if(S.nav!==n)return;
    S.rt.from='My location';S.rt.cands=candidates;rank();
    n.i=0;n.spoken={};n.previewed={};n.warned={};n.off=false;n.offCount=0;n.wrongCount=0;n.lastProgress=null;n.rerouting=false;
    n.maxProgress=routePosition(n.pos,S.rt.res.list[S.rt.sel].coords).progress;n.alert=voiceCopy('rerouteDone');
    render();n.wid=startWatch();say(n.alert);
  }).catch(function(){
    if(S.nav!==n)return;
    n.rerouting=false;n.rerouteAfter=Date.now()+30000;n.offCount=0;n.wrongCount=0;n.alert=voiceCopy('rerouteFail');
    updateNavUI();n.wid=startWatch();say(n.alert);
  });
}
function nav(){
  return '<div class="hdr"><button class="ic" data-act="navend" aria-label="End guidance">‹</button><h1>Guided walk</h1><button class="chip" data-act="navvoice" style="min-height:40px">'+(S.nav&&S.nav.voice?'🔊 Voice on':'🔇 Voice off')+'</button></div>'+
  '<div class="pad" style="padding-top:8px;padding-bottom:0">'+voiceLanguageControl()+'</div><div class="map" style="height:300px"><div id="nmap" style="position:absolute;inset:0"></div>'+mtypeHtml(12)+'</div><div id="navbox" class="pad"></div>';
}
function updateNavUI(){
  var box=document.getElementById('navbox'),n=S.nav;if(!box||!n)return;
  var c=S.rt.res.list[S.rt.sel],st=c.steps,h='';
  if(n.arrived){box.innerHTML='<div class="stack" style="text-align:center;gap:8px"><div style="font-size:44px">🏁</div><h1>You have arrived</h1><div class="meta">Stay aware of your surroundings. Tell someone you trust that you got there safely.</div><button class="btn" data-act="navend">Done</button></div>';return}
  var nxt=st[Math.min(n.i+1,st.length-1)],d0=n.dNext!=null?n.dNext:dm(c.coords[0],nxt.loc),rem=n.rem!=null?n.rem:c.dist;
  h+='<div class="stack" style="gap:6px"><div class="meta">'+(n.pos?'In '+fmt(d0):'Waiting for your location…')+'</div><div style="display:flex;gap:12px;align-items:center"><span style="font-size:40px">'+arrow(nxt)+'</span><h1 style="font-size:22px;line-height:26px">'+esc(instr(nxt))+'</h1></div><div class="meta">Now on: '+esc(st[n.i].n||'the path')+' · '+fmt(rem)+' left · about '+Math.max(1,Math.round(rem/78))+' min · '+c.level+' risk</div></div>';
  if(n.off)h+='<div class="stack" style="border-left:4px solid #c0152f;margin-top:12px;gap:8px"><b>You are off the route</b><button class="btn" style="margin:0" data-act="navreroute">Re-route from here</button></div>';
  if(n.alert)h+='<div class="stack" style="border-left:4px solid #e0a000;margin-top:12px;gap:4px"><b>🤖 Heads up</b><div>'+esc(n.alert)+'</div></div>';
  h+='<button class="btn sec" data-act="navsim">'+(n.sim?'Stop simulation':'Simulate movement')+'</button><button class="btn sec" data-act="share">Share my location</button><a class="btn" style="background:#c0152f" href="'+esc(telHref(S.contacts.emergency))+'">Call '+esc(S.contacts.emergency||'112')+'</a>';
  box.innerHTML=h;
}
function initNavMap(){
  var el=document.getElementById('nmap');if(!el||!S.nav)return;
  if(!window.L){el.innerHTML='<div class="pad">The map could not load. Directions below still work.</div>';updateNavUI();return}
  var c=S.rt.res.list[S.rt.sel],m=L.map(el,{zoomControl:false}).setView(S.nav.pos||c.coords[0],17);
  setBase(m);L.control.zoom({position:'bottomright'}).addTo(m);
  AREAS.forEach(function(a){var hi=count(a)>=4,col=hi?'#c0152f':'#6b7080';L.circle([a.lat,a.lng],{radius:150,color:col,weight:1,fillColor:col,fillOpacity:hi ? 0.2 : 0.08,interactive:false}).addTo(m)});
  var pl=L.polyline(c.coords,{color:'#d71920',weight:6}).addTo(m);
  addDirectionArrows(m,c.coords);
  L.circleMarker(c.coords[c.coords.length-1],{radius:8,color:'#fff',weight:3,fillColor:'#ff00bf',fillOpacity:1}).addTo(m);
  NAV.me=L.circleMarker(S.nav.pos||c.coords[0],{radius:9,color:'#fff',weight:3,fillColor:'#2f6fed',fillOpacity:1}).addTo(m);NAV.map=m;
  if(!S.nav.pos)m.fitBounds(pl.getBounds(),{padding:[24,24]});updateNavUI();
}
function rtGo(rf,rto){
  S.rt.busy=true;S.rt.err='';render();
  findRoutes(rf,rto).then(function(c){S.rt.cands=c;S.chat=[];rank();S.rt.busy=false;if(S.gpend){S.gpend=false;S.gchat.push({r:'a',t:advice()})}render()}).catch(function(er){S.rt.busy=false;S.rt.res=null;S.rt.err=er.message||'Could not get a route.';if(S.gpend){S.gpend=false;S.gchat.push({r:'a',t:'I could not get a route: '+S.rt.err})}render()});
}
function ex(){return AREAS.length>1?'from '+AREAS[0].name+' to '+AREAS[1].name:'to the main library'}
function parseRoute(q){
  var m=q.match(/(?:from\s+(.+?)\s+)?\bto\s+(.+?)[\s.!?]*$/i);
  if(!m||!/(route|walk|go\b|get\b|take|navigate|direction|safe|way|head)/i.test(q)){
    if(/[?]/.test(q)||/^(hi|hello|hey|which|what|how|why|when|who|can you|could you|is |are |tell me|help|i feel|i am unsafe)\b/i.test(q))return null;
    var destination=q.replace(/^(?:please\s+)?(?:take me to|go to|walk to|navigate to|route to|to)\s+/i,'').trim();
    return destination.length>=2&&destination.length<=120?{from:'',to:destination}:null;
  }
  var low=q.toLowerCase(),when=/late night|midnight|late at night/.test(low)?'late':/evening|tonight|after dark|night/.test(low)?'evening':/daytime|morning|afternoon|during the day/.test(low)?'day':null;
  function clean(x){x=x.trim();for(var i=0;i<3;i++)x=x.replace(/\s+(tonight|now|later|this evening|in the evening|late at night|late night|in the morning|this afternoon|in the afternoon|during the day|please|safely)$/i,'');return x.replace(/^(the|my)\s+/i,'').trim()}
  var to=clean(m[2]),from=m[1]?clean(m[1]):'';
  return to?{from:from,to:to,when:when}:null;
}
function doRoute(x){
  if(x.when)S.rt.when=x.when;
  function go(fr){S.rt.from=fr;S.rt.to=x.to;S.gpend=true;S.gchat.push({r:'a',t:'Finding the safest walking route from '+(fr==='My location'?'where you are':fr)+' to '+x.to+'…'});S.tab='Route';S.stack=[];rtGo(fr,x.to)}
  if(x.from)return go(x.from);
  if(S.rt.mine)return go('My location');
  if(!navigator.geolocation){S.gchat.push({r:'a',t:'Tell me where you are starting from, for example: '+ex()+'.'});render();return}
  S.gchat.push({r:'a',t:'Checking your location…'});render();
  navigator.geolocation.getCurrentPosition(function(p){S.rt.mine=[p.coords.latitude,p.coords.longitude];go('My location')},function(){S.gchat.push({r:'a',t:'I could not get your location. Allow location access, or tell me where you are starting from, for example: '+ex()+'.'});render()});
}
function gLocal(q){
  var t=q.toLowerCase(),h=hourOf('now');
  if(/^(hi|hello|hey)\b/.test(t))return 'Hello! Tell me where you are going, for example: take me '+ex()+' tonight. I will find the safest walking route and guide you.';
  if(/unsafe|scared|afraid|follow|danger|threat|emergenc|help/.test(t))return 'If you feel unsafe, move toward a busy, well-lit place such as a building entrance or a security point. Call emergency services on '+(S.contacts.emergency||'112')+' if you are in danger. The Safety tab can share your location link or text it to your trusted contact.';
  if(/risk|area|avoid|where|hotspot|dangerous|safe/.test(t)&&!/route|walk|take me/.test(t))return 'Right now ('+h+':00):\n'+AREAS.slice().sort(function(a,b){return count(b)-count(a)}).map(function(a){return '• '+a.name+': '+risk(a)+', '+count(a)+' reports'+(inWin(a.id,h)?' (in its riskier hours)':'')}).join('\n');
  if(/plan|route|walk|navigate|direction/.test(t))return 'Where are you starting and where are you going? For example: '+ex()+'. If you leave out the start, I will use your current location.';
  return 'I can find the safest walking route for you. Try: take me '+ex()+', or ask which areas are risky right now.';
}
function askClaudeG(q){
  var h=hourOf('now'),ctx={hour:h,areas:AREAS.map(function(a){return {name:a.name,reports30d:count(a),mostReported:a.hours,riskierNow:inWin(a.id,h)}})};
  var sys='You are the Campus Safe assistant for university students walking on campus. Use only the campus data provided. The reports may be incomplete, so never claim any place or route is guaranteed safe. Keep answers under 90 words, practical and calm. If the student wants a route, tell them to say for example: take me '+ex()+'. If they feel in danger, tell them to move to a busy, lit place and call emergency services.';
  return fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.aiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:300,system:sys,messages:[{role:'user',content:'Campus data: '+JSON.stringify(ctx)+' Question: '+q}]})})
   .then(function(r){return r.json()}).then(function(j){if(j.error)throw new Error(j.error.message);return j.content.map(function(x){return x.text||''}).join('').trim()});
}
function gask(q){
  q=String(q||'').trim();if(!q)return;S.gchat.push({r:'u',t:q});
  var x=parseRoute(q);if(x){doRoute(x);return}
  function done(){render();var sc=document.querySelector('.screen');if(sc)sc.scrollTop=sc.scrollHeight}
  if(S.aiKey&&!/unsafe|emergenc|scared|afraid|danger/.test(q.toLowerCase())){var i=S.gchat.length;S.gchat.push({r:'a',t:'Thinking…'});done();
    askClaudeG(q).then(function(a){S.gchat[i].t=a;speakAssistantReply(a);done()}).catch(function(){S.gchat[i].t=gLocal(q)+' (Claude could not be reached, so this came from the on-device assistant.)';speakAssistantReply(S.gchat[i].t);done()});return}
  S.gchat.push({r:'a',t:gLocal(q)});speakAssistantReply(S.gchat[S.gchat.length-1].t);done();
}
function assistantTab(){
  var nm=S.user?S.user.name.split(' ')[0]:'';
  return H('🤖 Safety assistant')+'<div class="pad" style="padding-top:8px"><div class="stack" style="gap:8px"><div>Hi '+esc(nm)+'. Type a destination name, or tell me where to go, and I will find the safest walking route and guide you turn by turn. Try: <i>take me '+esc(ex())+' tonight</i></div><div class="meta">'+(S.aiKey?'Claude is connected for general questions.':'Running on this phone. Add an API key in the Safety tab to let Claude answer general questions.')+'</div></div>'+
  '<div class="chips" style="margin:12px 0">'+['Which areas are risky right now?','Plan a safe route','What should I do if I feel unsafe?'].map(function(q){return '<button class="chip" data-gq="'+q+'">'+q+'</button>'}).join('')+'</div>'+
  S.gchat.map(function(m){return '<div class="stack" style="margin:0 0 8px;white-space:pre-wrap;'+(m.r==='u'?'background:var(--soft);margin-left:32px':'margin-right:32px')+'">'+esc(m.t)+'</div>'}).join('')+
  '<div style="display:flex;gap:8px;margin-top:12px"><input id="g-q" placeholder="Where do you want to go?" style="margin:0"><button class="btn sm" style="min-width:72px" data-act="gask">Send</button></div></div>';
}
function distLabel(a){return S.me?fmt(dm(S.me,[a.lat,a.lng])):''}
function updLabel(a){var d=Math.floor((Date.now()-(a.upd||Date.now()))/864e5);return d<=0?'today':d===1?'yesterday':d+' days ago'}
function areaMeta(a){return [distLabel(a),'Updated '+updLabel(a)].filter(Boolean).join(' · ')}
function sorted(){return AREAS.slice().sort(function(a,b){if(S.sort==='risk')return count(b)-count(a);return S.me?dm(S.me,[a.lat,a.lng])-dm(S.me,[b.lat,b.lng]):0})}
function sortChips(){return [['near','Closest'],['risk','Highest risk']].map(function(o){return '<button class="chip'+(S.sort===o[0]?' on':'')+'" data-sort="'+o[0]+'">'+o[1]+'</button>'}).join('')}
function explore(){
  var sel=find(S.sel)||AREAS[0]||null;
  return '<div class="map"><div id="lmap" style="position:absolute;inset:0"></div>'+mtypeHtml(76)+'<div class="mtype" style="top:124px"><button data-go="Assistant" style="background:#ff00bf;color:#fff">🤖 Ask the AI assistant</button></div>'+'<div class="top"><div class="box"><b style="font-size:16px">Campus Safe</b><div class="meta">Reported risk · North Campus</div></div><button class="loc" data-act="locate" aria-label="Show my location">◎</button></div>'+
  '<div class="box" style="position:absolute;bottom:12px;left:16px;font-size:13px;font-weight:600;display:flex;gap:8px;align-items:center"><span class="dot" style="background:#e0291d"></span>Higher reported crime</div></div>'+
  '<div style="background:var(--card);padding:16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--bd)">'+
  (sel?'<div class="row"><div><h1>'+esc(sel.name)+'</h1><div class="meta">Selected area · reports from the past 30 days</div></div><span class="risk">'+risk(sel)+'</span></div><div>'+count(sel)+' reports nearby · Most reported '+esc(sel.hours.toLowerCase())+'</div><button class="item" style="min-height:48px;color:var(--acc);font-weight:700" data-area="'+sel.id+'">Review area details ›</button>':'<h1>Select an area</h1>')+'</div>'+
  '<div class="pad">'+(AREAS.length?'':'<div class="stack" style="margin-bottom:12px">No locations have been added yet. Campus security adds them from the Locations tab in the staff console.</div>')+'<div class="row" style="align-items:center;margin-bottom:12px"><h1>Nearby areas</h1><button class="btn sm" data-go="Report">⚠ Report crime</button></div><div class="chips">'+sortChips()+'</div><div class="card">'+
  sorted().map(function(a){return '<button class="item" data-area="'+a.id+'"><div style="flex:1"><b>'+esc(a.name)+'</b><div class="meta">'+areaMeta(a)+'</div></div><span class="risk" style="font-size:13px">'+risk(a)+'</span></button>'}).join('')+'</div></div>';
}

function area(id){
  var a=find(id),sv=S.saved.indexOf(id)>-1;
  if(!a)return '<div class="hdr"><button class="ic" data-act="back">‹</button><h1>Area risks</h1></div><div class="pad">This area is no longer available.</div>';
  return '<div class="hdr"><button class="ic" data-act="back" aria-label="Back">‹</button><h1>'+esc(a.name)+'</h1><button class="ic" data-save="'+id+'" aria-label="Save">'+(sv?'★':'☆')+'</button></div><div style="padding-top:16px">'+(S.adv[id]?'<div class="stack" style="border-left:4px solid #c0152f;gap:4px"><b>Security advisory</b><div>'+esc(S.adv[id])+'</div></div>':'')+
  '<div class="hero"><div class="row"><h1>'+risk(a)+' reported risk</h1><span class="risk">'+count(a)+' reports</span></div><div>'+esc(a.summary)+'</div><div class="metrics"><div><b>30 days</b><span class="meta">Time period</span></div><div><b>'+esc(a.hours)+'</b><span class="meta">Most reported</span></div></div></div>'+
  '<div class="pad" style="padding-top:0"><p class="lbl">Reported incidents</p></div><div class="stack">'+incs(a).map(function(i){return '<div style="display:flex;align-items:center;gap:12px;min-height:48px"><span class="dot"></span><span style="flex:1">'+i[0]+'</span><b>'+i[1]+'</b></div>'}).join('')+'</div>'+
  '<div class="pad" style="padding-top:0"><p class="lbl">Nearby areas</p><div class="card">'+AREAS.filter(function(o){return o.id!==id}).map(function(o){return '<button class="item" data-area="'+o.id+'"><div style="flex:1"><b>'+esc(o.name)+'</b><div class="meta">'+[distLabel(o),risk(o)].filter(Boolean).join(' · ')+'</div></div><span style="color:var(--pri);font-size:22px">›</span></button>'}).join('')+'</div>'+
  '<button class="btn" data-save="'+id+'">'+(sv?'Remove saved place':'Save this place')+'</button><div class="notice">Reports are added by campus security and students and may be incomplete. Do not rely on them for emergency decisions.</div></div></div>';
}

function savedPlaces(){
  var h='<div class="hdr"><h1>Saved places</h1></div><div class="pad" style="padding-top:8px">Places you want to check again.';
  if(!S.saved.length)return h+'<div class="center"><h1>Keep an area close</h1><div>Save a place from its area details to check its reported risk again.</div><button class="btn" data-go="Explore">Explore the map</button></div></div>';
  return h+'<div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">'+S.saved.map(function(id){var a=find(id);
    return '<button class="item" style="background:var(--card);padding:12px 16px;min-height:72px" data-area="'+id+'"><div style="flex:1"><b>'+(a?esc(a.name):'Unnamed place')+'</b><div class="meta">'+(a?risk(a)+' · '+count(a)+' reports · Updated '+updLabel(a):'Area report unavailable')+'</div></div><span style="color:var(--acc);font-size:22px">›</span></button>'}).join('')+'</div></div>';
}

function myReportsHtml(){
  var h='<div class="pad" style="padding-top:0"><p class="lbl">My reports</p>';
  var mine=S.myReports.filter(function(r){return r.uid===S.user.id});
  if(!mine.length)return h+'<div class="meta">Incidents you report appear here. Reports tied to a listed area count toward its totals.</div></div>';
  return h+mine.slice().reverse().map(function(r){var a=find(r.area);
    return '<div class="stack" style="margin:0 0 8px;gap:4px"><div class="row"><b>'+esc(r.type)+' · '+esc([a&&a.name,r.loc].filter(Boolean).join(' – ')||'Unspecified location')+'</b><button class="chip" style="min-height:40px" data-delr="'+r.id+'">Delete</button></div><div class="meta">'+esc(r.time)+' · '+new Date(r.at).toLocaleDateString()+'</div>'+(r.desc?'<div>'+esc(r.desc)+'</div>':'')+'</div>'}).join('')+'</div>';
}
function saved(){return savedPlaces()+myReportsHtml()}
function telHref(number){var n=String(number||'112').replace(/[^\d+*#,;]/g,'');return 'tel:'+(n||'112')}
function safety(){
  var c=S.contacts;
  return '<div class="hdr"><h1>Safety tools</h1></div><div class="pad" style="padding-top:8px"><a class="btn" style="background:#c0152f;margin-top:0" href="'+esc(telHref(c.emergency))+'" aria-label="Call emergency services at '+esc(c.emergency||'112')+'">Call '+esc(c.emergency||'112')+'</a><button class="btn sec" style="margin-top:8px" data-act="copyem">Copy emergency number</button><div class="meta" style="margin-bottom:12px">On a phone, Call opens your dialer. On a computer, use your phone to call this number.</div>'+
  '<button class="btn sec" data-act="share">Share my location</button><button class="btn sec" data-act="sms">Text my location to my contact</button>'+
  '<div class="stack" style="margin-top:16px"><p class="lbl">Numbers (change these to your campus security line)</p><label class="meta">Emergency number</label><input id="em" type="tel" inputmode="tel" value="'+esc(c.emergency||'')+'"><label class="meta">Trusted contact</label><input id="tc" type="tel" inputmode="tel" placeholder="e.g. 082 000 0000" value="'+esc(c.trusted||'')+'"><button class="btn" style="margin-top:8px" data-act="savec">Save numbers</button></div>'+
  '<div class="stack" style="margin-top:16px"><p class="lbl">AI assistant (optional)</p><div class="meta">The route assistant works on this phone. To let it answer free-form questions with Claude, paste your own Anthropic API key. It is stored on this phone and sent only to Anthropic, so use a key with a small spend limit.</div><input id="aikey" type="password" autocomplete="off" placeholder="'+(S.aiKey?'Key saved (paste to replace)':'sk-ant-...')+'"><div class="chips" style="margin:0"><button class="chip" data-act="aisave">Save key</button>'+(S.aiKey?'<button class="chip" data-act="aiclear">Remove key</button>':'')+'</div></div><div class="notice">Numbers are stored on this phone only. In an emergency, call your local emergency services first.</div></div>';
}
function where(cb){if(!navigator.geolocation){toast('Location is not available on this device.');return}
  navigator.geolocation.getCurrentPosition(function(p){cb('https://maps.google.com/?q='+p.coords.latitude+','+p.coords.longitude)},function(){toast('Could not get your location. Allow location access and try again.')})}
function about(){
  var g=['Highlighted areas have higher reported crime risk.','Area summaries show reports from the past 30 days.','Patterns can change; check the updated date in each area.'];
  return '<div class="hdr"><h1>About risk reports</h1><button class="chip" data-act="theme" style="margin-left:auto;min-height:40px">'+(S.dark?'Light':'Dark')+' mode</button></div><div class="pad" style="padding-top:8px">'+
  '<div class="hero" style="margin:0 -16px 16px"><h1>Use reports as context</h1><div>Campus Safe shows reported crime patterns by area, based on locations added by campus security and places created through student crime reports. A risk level is not a prediction of what will happen during your trip.</div></div><p class="lbl">How to read the map</p>'+
  '<div class="stack" style="margin:0 -16px 16px">'+g.map(function(t){return '<div style="display:flex;gap:12px;align-items:center;min-height:48px"><span class="dot"></span><span style="flex:1">'+t+'</span></div>'}).join('')+'</div>'+
  '<div class="notice" style="margin:0 -16px">This map shows locations added by campus security plus places created through student crime reports. It is not a live incident feed or verified route guidance. Use your judgment when choosing where and when to travel. If you need immediate help, contact local emergency services.</div><div class="stack" style="margin:16px -16px 0;gap:4px"><b>'+esc(S.user.name)+'</b><div class="meta">'+esc(S.user.email)+(S.user.sid?' · '+esc(S.user.sid):'')+'</div><button class="btn sec" data-act="logout" style="margin-top:12px">Sign out</button></div></div>';
}

function chips(key,opts){return '<div class="chips">'+opts.map(function(o){return '<button class="chip'+(S.report[key]===o[1]?' on':'')+'" data-r="'+key+'" data-v="'+esc(o[1])+'">'+esc(o[0])+'</button>'}).join('')+'</div>'}
function report(){
  var back='<div class="hdr"><button class="ic" data-act="back" aria-label="Back">‹</button><h1>'+(S.done?'Report received':'Report an incident')+'</h1></div>';
  if(S.done)return back+'<div class="center"><h1>Thank you for reporting</h1><div>Your report is saved on this phone and counts toward the area totals shown here. A new place is created only when you enter a place with your report. AI never creates places. Reports are not sent to emergency services or added to verified crime data.</div><button class="btn" data-act="back">Done</button></div>';
  var ar=AREAS.map(function(a){return [a.name,a.id]}),ty=['Theft','Assault','Vehicle-related','Other'].map(function(x){return [x,x]}),tm=['Morning','Afternoon','Evening','Late night'].map(function(x){return [x,x]});
  return back+'<div class="pad" style="padding-top:8px">Share an incident to help inform campus safety awareness. Do not include names or identifying details.<div class="stack" style="margin-top:16px"><p class="lbl">Area</p>'+chips('area',ar)+'<p class="lbl">Or add the place where the incident happened</p><input id="loc" maxlength="80" placeholder="e.g. Library car park, Gate 3" value="'+esc(S.report.loc||'')+'" style="margin-bottom:8px"><button class="chip" data-act="reportloc" style="width:100%;text-align:center">📍 Use my current location for this report</button><div class="meta">A new place is created only with your submitted crime report. AI never creates places.</div>'+'<p class="lbl">Incident type</p>'+chips('type',ty)+'<p class="lbl">Approximate time</p>'+chips('time',tm)+'<p class="lbl">Optional details</p><textarea id="desc" maxlength="300" placeholder="Avoid names and identifying information">'+esc(S.report.desc||'')+'</textarea><button class="btn" data-act="submit">Submit report</button></div><div class="notice">This app keeps reports on this phone only. It does not transmit them, verify incidents, or contact emergency services. For immediate danger, contact local emergency services.</div></div>';
}

function render(){
  if(!S.user){var ap=document.getElementById('app');ap.className='';ap.innerHTML='<div class="screen nobar">'+auth()+'</div>';document.documentElement.setAttribute('data-theme',S.dark?'dark':'light');applyGrp();return}
  var top=S.role==='staff'?null:S.stack[S.stack.length-1],body,bar=!top;
  if(top){var p=top.split(':');body=p[0]==='area'?area(p[1]):p[0]==='nav'?nav():report()}
  else if(S.role==='staff')body=S.tab==='Reports'?sReports():S.tab==='Locations'?sAreas():S.tab==='Account'?sAccount():sOverview();
  else body=S.tab==='Explore'?explore():S.tab==='Route'?route():S.tab==='Assistant'?assistantTab():S.tab==='Saved'?saved():S.tab==='Safety'?safety():about();
  var keep=document.querySelector('.screen'),sc=keep?keep.scrollTop:0;
  document.getElementById('app').innerHTML='<div class="screen'+(bar?'':' nobar')+'">'+body+'</div>'+(bar?'<nav class="tabs">'+(S.role==='staff'?[['Overview','📊'],['Reports','📋'],['Locations','📍'],['Account','👤']]:[['Explore','🗺'],['Route','🧭'],['Assistant','🤖'],['Saved','🔖'],['Safety','🆘'],['About','ℹ️']]).map(function(t){return '<button class="'+(S.tab===t[0]?'on':'')+'" data-go="'+t[0]+'"><span>'+t[1]+'</span>'+t[0]+'</button>'}).join('')+'</nav>':'');
  document.documentElement.setAttribute('data-theme',S.dark?'dark':'light');
  document.querySelector('.screen').scrollTop=sc;document.getElementById('app').className=S.role==='staff'?'staff':'';initMap();initRouteMap();initNavMap();initAreaMap();
}

document.addEventListener('click',function(e){
  var t=e.target.closest('[data-area],[data-go],[data-act],[data-save],[data-r],[data-pin],[data-sort],[data-delr],[data-rf],[data-st],[data-adv],[data-m],[data-rsel],[data-rw],[data-mt],[data-aiq],[data-gq],[data-aedit],[data-adel],[data-placepick]');if(!t)return;
  var d=t.dataset;
  if(t.hasAttribute('data-placepick')){var ps=S.rt.placeSearch,choice=ps&&ps.items[+d.placepick];if(choice&&ps.field){S.rt[ps.field]=choice.label;S.rt.placeSearch=null;S.rt.err=''}render();return}
  else if(d.pin){S.sel=d.pin}
  else if(d.area){S.sel=d.area;S.stack.push('area:'+d.area)}
  else if(d.go==='Report'){S.report={};S.done=false;S.stack.push('report')}
  else if(d.go){S.stack=[];S.tab=d.go}
  else if(d.save){var i=S.saved.indexOf(d.save);if(i>-1){S.saved.splice(i,1);toast('Place removed from Saved.')}else{S.saved.push(d.save);toast(find(d.save).name+' saved.')}persist()}
  else if(d.r){S.report[d.r]=d.v}
  else if(d.rf){S.rf=d.rf}
  else if(d.sort){S.sort=d.sort}
  else if(d.delr){var rid=String(d.delr);if(confirm('Delete this report?')){S.myReports=S.myReports.filter(function(r){return String(r.id)!==rid});sv('cs_reports',S.myReports);toast('Report deleted.')}}
  else if(d.st){var q=d.st.split('|');S.myReports.forEach(function(r){if(String(r.id)===q[0])r.status=q[1]});sv('cs_reports',S.myReports)}
  else if(d.adv){var q2=d.adv.split('|'),inp=document.getElementById('adv-'+q2[0]);
    if(q2[1]==='set'){if(!inp||!inp.value.trim()){toast('Type an advisory first.');return}S.adv[q2[0]]=inp.value.trim();toast('Advisory published.')}else{delete S.adv[q2[0]];toast('Advisory cleared.')}sv('cs_adv',S.adv)}
  else if(d.act==='afnew'){S.af=blankForm()}
  else if(d.aedit){var ea=find(d.aedit);if(ea)S.af=formFrom(ea)}
  else if(d.adel){var da=find(d.adel);if(da&&confirm('Delete "'+da.name+'"? Students will no longer see it.')){AREAS=AREAS.filter(function(x){return x.id!==d.adel});S.saved=S.saved.filter(function(x){return x!==d.adel});sv('cs_saved',S.saved);delete S.adv[d.adel];sv('cs_adv',S.adv);if(S.sel===d.adel)S.sel=null;persistAreas();toast('Location deleted.')}}
  else if(d.act==='afcancel'){S.af=null}
  else if(d.act==='afshare'){shareAreas();return}
  else if(d.act==='afloc'){if(!navigator.geolocation){toast('Location is not available on this device.');return}
    navigator.geolocation.getCurrentPosition(function(p){S.af.lat=p.coords.latitude.toFixed(6);S.af.lng=p.coords.longitude.toFixed(6);render()},function(){toast('Could not get your location. Allow location access, or tap the map instead.')});return}
  else if(d.act==='afsearch'){var qq=(S.af.q||'').trim();if(!qq){toast('Type a place or address to search.');return}
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(qq)).then(function(r){return r.json()}).then(function(j){
      if(!j.length){toast('Could not find that place. Try a more specific name.');return}
      S.af.lat=(+j[0].lat).toFixed(6);S.af.lng=(+j[0].lon).toFixed(6);if(!S.af.name.trim())S.af.name=j[0].display_name.split(',')[0];render()}).catch(function(){toast('Could not reach the search service. Check your connection.')});return}
  else if(d.act==='afsave'){var f=S.af,nm=f.name.trim(),la=parseFloat(f.lat),ln=parseFloat(f.lng);
    if(nm.length<2){toast('Enter a location name.');return}
    if(!isFinite(la)||!isFinite(ln)||Math.abs(la)>90||Math.abs(ln)>180){toast('Set the location: search for it, use your location, or tap the map.');return}
    var cnt=function(k){var v=parseInt(f[k],10);return isFinite(v)&&v>0?v:0},inc=[['Theft',cnt('theft')],['Assault',cnt('assault')],['Vehicle-related reports',cnt('vehicle')],['Other incidents',cnt('other')]].filter(function(x){return x[1]>0});
    var rec={id:f.id||'a'+Date.now(),name:nm,lat:la,lng:ln,h1:+f.h1,h2:+f.h2,hours:hoursText(f.h1,f.h2),summary:(f.summary||'').trim()||'Reports for this location come from students and campus security. Review it as one part of your travel decision.',inc:inc,upd:Date.now(),source:'admin',createdBy:S.user&&S.user.id||'admin'};
    var ix=AREAS.map(function(x){return x.id}).indexOf(rec.id);if(ix>-1)AREAS[ix]=rec;else AREAS.push(rec);
    persistAreas();S.af=null;if(!S.sel)S.sel=rec.id;toast('Location saved.')}
  else if(d.gq){gask(d.gq);return}
  else if(d.act==='gask'){var gi=document.getElementById('g-q');gask(gi?gi.value:'');return}
  else if(d.aiq){ask(d.aiq);return}
  else if(d.act==='aiask'){var qi=document.getElementById('ai-q');ask(qi?qi.value:'');return}
  else if(d.act==='aisave'){var kv=document.getElementById('aikey').value.trim();if(!/^sk-ant-/.test(kv)){toast('That does not look like an Anthropic API key.');return}S.aiKey=kv;sv('cs_aikey',kv);toast('Claude connected.')}
  else if(d.act==='aiclear'){S.aiKey='';sv('cs_aikey','');toast('Key removed.')}
  else if(d.act==='mapfull'){toggleMapFullscreen(t);return}
  else if(d.act==='rtsearch'){
    var field=d.field==='from'?'from':'to',input=document.getElementById('rt-'+field),query=input?input.value.trim():'';
    if(query.length<2){toast('Enter at least two characters to search.');return}
    var near=field==='to'?(S.rt.from.toLowerCase()==='my location'?(S.rt.mine||S.me||DEFAULT_CENTER):(S.rt.mine||S.me||DEFAULT_CENTER)):(S.rt.mine||S.me||DEFAULT_CENTER);
    S.rt.placeSearch={field:field,items:[],busy:true,error:''};render();
    searchPlaces(query,near).then(function(items){if(!S.rt.placeSearch||S.rt.placeSearch.field!==field)return;S.rt.placeSearch.items=items;S.rt.placeSearch.busy=false;render()}).catch(function(er){if(!S.rt.placeSearch||S.rt.placeSearch.field!==field)return;S.rt.placeSearch.busy=false;S.rt.placeSearch.error=er.message||'Place search failed.';render()});return}
  else if(d.act==='navstart'){var sc0=S.rt.res&&S.rt.res.list[S.rt.sel];
    if(!sc0||!sc0.steps||sc0.steps.length<2){toast('No turn-by-turn steps are available for this route.');return}
    S.nav={i:0,voice:true,spoken:{},previewed:{},warned:{},off:false,offCount:0,wrongCount:0,lastProgress:null,maxProgress:null,rerouting:false,pos:null,arrived:false,alert:'',sim:null,wid:null,dNext:null,rem:null};S.stack.push('nav');S.nav.wid=startWatch();say(voiceCopy('start'))}
  else if(d.act==='navend'){endNav();S.stack.pop()}
  else if(d.act==='navvoice'){S.nav.voice=!S.nav.voice;if(!S.nav.voice&&window.speechSynthesis)speechSynthesis.cancel();var vb=document.querySelector('[data-act=navvoice]');if(vb)vb.textContent=S.nav.voice?'🔊 AI voice on':'🔇 AI voice off';return}
  else if(d.act==='navsim'){toggleSim();return}
  else if(d.act==='navreroute'){var pp=S.nav.pos;endNav();S.stack=[];S.tab='Route';if(pp){S.rt.mine=pp;S.rt.from='My location';rtGo('My location',S.rt.to);return}}
  else if(d.mt){S.mapType=d.mt;sv('cs_mt',d.mt);if(CUR.m)setBase(CUR.m);document.querySelectorAll('.mtype button').forEach(function(b){b.classList.toggle('on',b.dataset.mt===d.mt)});return}
  else if(d.rsel){S.rt.sel=+d.rsel}
  else if(d.rw){S.rt.when=d.rw;if(S.rt.cands)rank()}
  else if(d.act==='rtswap'){var tmp=S.rt.from;S.rt.from=S.rt.to;S.rt.to=tmp}
  else if(d.act==='rtloc'){if(!navigator.geolocation){toast('Location is not available on this device.');return}
    navigator.geolocation.getCurrentPosition(function(p){S.rt.mine=[p.coords.latitude,p.coords.longitude];S.rt.from='My location';render()},function(){toast('Could not get your location. Allow location access and try again.')});return}
  else if(d.act==='rtfind'){
    var rf=document.getElementById('rt-from').value.trim(),rto=document.getElementById('rt-to').value.trim();S.rt.from=rf;S.rt.to=rto;
    if(!rf||!rto){toast('Enter a start and a destination.');return}
    if(rf.toLowerCase()===rto.toLowerCase()){toast('Start and destination are the same.');return}
    S.rt.busy=true;S.rt.err='';render();
    findRoutes(rf,rto).then(function(c){S.rt.cands=c;S.chat=[];rank();S.rt.busy=false;render()}).catch(function(er){S.rt.busy=false;S.rt.res=null;S.rt.err=/Failed to fetch|NetworkError|Load failed/i.test(er.message||'')?'Could not reach the routing service. Check your internet connection and try again.':(er.message||'Could not get a route.');render()});return}
  else if(d.m){var keep=d.m==='reset'?val('email'):'';S.authMode=d.m;S.f=keep?{email:keep}:{}}
  else if(d.act==='signin'){
    var em=val('email').trim().toLowerCase(),pw=val('pw'),now=Date.now();
    if(now<S.lock){toast('Too many attempts. Try again in '+Math.ceil((S.lock-now)/1000)+' seconds.');return}
    if(!em||!pw){toast('Enter your email and password.');return}
    if(!roleOf(em)){toast(DOMAIN_MSG);return}
    hash(em+':'+pw).then(function(h){var u=S.users.filter(function(x){return x.email===em&&x.hash===h})[0];
      if(!u){S.fails++;if(S.fails>=5){S.lock=Date.now()+30000;S.fails=0}toast('Email or password is incorrect.');return}
      start(u)});return}
  else if(d.act==='signup'){
    var em2=val('email').trim().toLowerCase(),role=roleOf(em2),name=val('name').trim(),sid=val('sid').trim(),pw1=val('pw'),pw2=val('pw2'),code=val('code');
    if(name.length<2){toast('Enter your full name.');return}
    if(!role){toast(DOMAIN_MSG);return}
    if(role==='student'&&!/^\d{6,12}$/.test(sid)){toast('Enter your student number (6 to 12 digits).');return}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em2)){toast('Enter a valid email address.');return}
    if(pw1.length<8){toast('Use a password of at least 8 characters.');return}
    if(pw1!==pw2){toast('The passwords do not match.');return}
    if(role==='staff'&&code!==STAFF_CODE){toast('The staff access code is incorrect.');return}
    if(S.users.some(function(x){return x.email===em2})){toast('An account with this email already exists. Sign in instead.');return}
    hash(em2+':'+pw1).then(function(h){var u={id:Date.now(),name:name,sid:role==='student'?sid:'',email:em2,role:role,hash:h};S.users.push(u);sv('cs_users',S.users);S.user=null;S.role=null;S.stack=[];S.authMode='in';S.f={email:em2};sv('cs_session','');render();toast('Account created. Sign in to continue.')});return}
  else if(d.act==='reset'){
    var em3=val('email').trim().toLowerCase(),n1=val('pw'),n2=val('pw2'),now3=Date.now();
    if(now3<S.lock){toast('Too many attempts. Try again in '+Math.ceil((S.lock-now3)/1000)+' seconds.');return}
    if(n1.length<8){toast('Use a password of at least 8 characters.');return}
    if(n1!==n2){toast('The passwords do not match.');return}
    var ru=S.users.filter(function(x){return x.email===em3})[0],proof=roleOf(em3)==='staff'?val('code'):val('sid').trim();
    if(!ru||(ru.role==='staff'?proof!==STAFF_CODE:proof!==ru.sid)){S.fails++;if(S.fails>=5){S.lock=Date.now()+30000;S.fails=0}toast('We could not verify those details. Check your email and '+(roleOf(em3)==='staff'?'staff access code':'student number')+'.');return}
    hash(em3+':'+n1).then(function(h){ru.hash=h;sv('cs_users',S.users);S.authMode='in';S.f={email:em3};render();toast('Password reset. Sign in with your new password.')});return}
  else if(d.act==='logout'){S.user=null;S.role=null;S.tab='Explore';S.stack=[];S.f={};S.authMode='in';sv('cs_session','')}
  else if(d.act==='exp'){exportCsv();return}
  else if(d.act==='chpw'){var np=document.getElementById('npw').value;if(np.length<8){toast('Use a password of at least 8 characters.');return}
    hash(S.user.email+':'+np).then(function(h){S.user.hash=h;sv('cs_users',S.users);toast('Password changed.')});return}
  else if(d.sort){S.sort=d.sort}
  else if(d.delr){S.myReports=S.myReports.filter(function(r){return String(r.id)!==d.delr});sv('cs_reports',S.myReports);toast('Report deleted.')}
  else if(d.act==='savec'){S.contacts={emergency:document.getElementById('em').value.trim(),trusted:document.getElementById('tc').value.trim()};sv('cs_contacts',S.contacts);toast('Numbers saved.')}
  else if(d.act==='copyem'){var number=String(S.contacts.emergency||'112');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(number).then(function(){toast('Emergency number copied.')},function(){toast('Emergency number: '+number)});else toast('Emergency number: '+number);return}
  else if(d.act==='share'){where(function(u){var m='My location: '+u;if(navigator.share)navigator.share({text:m}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(m).then(function(){toast('Location link copied.')});else toast(m)});return}
  else if(d.act==='sms'){if(!S.contacts.trusted){toast('Add a trusted contact number first.');return}where(function(u){window.location.href='sms:'+S.contacts.trusted+'?&body='+encodeURIComponent('I am sharing my location: '+u)});return}
  else if(d.act==='back'){S.stack.pop()}
  else if(d.act==='theme'){S.dark=!S.dark;sv('cs_dark',S.dark)}
  else if(d.act==='locate'){
    if(!navigator.geolocation){toast('Location is not available on this device.');return}
    navigator.geolocation.getCurrentPosition(function(p){S.me=[p.coords.latitude,p.coords.longitude];S.view={c:S.me,z:16};render()},
      function(){toast('Could not get your location. Allow location access and try again.')});return}
  else if(d.act==='reportloc'){
    if(!navigator.geolocation){toast('Location is not available on this device.');return}
    navigator.geolocation.getCurrentPosition(function(p){S.me=[p.coords.latitude,p.coords.longitude];var lc=document.getElementById('loc');if(lc&&!lc.value.trim())lc.value='Reported location';S.report.loc=lc?lc.value.trim():'Reported location';toast('Your current location will be used for this report.');},function(){toast('Could not get your location. Allow location access and try again.')});return}
  else if(d.act==='submit'){var ta=document.getElementById('desc');S.report.desc=ta?ta.value:'';
    var lc=document.getElementById('loc');S.report.loc=lc?lc.value.trim():'';if((!S.report.area&&!S.report.loc)||!S.report.type||!S.report.time){toast('Please pick or type a location, an incident type, and an approximate time.');return}
    var areaId=S.report.area||'';
    if(!areaId&&S.report.loc){
      var nm=S.report.loc.trim(), existing=AREAS.filter(function(a){return String(a.name).toLowerCase()===nm.toLowerCase()})[0];
      if(existing) areaId=existing.id;
      else {
        var rec={id:'student-'+Date.now(),name:nm,lat:S.me?+S.me[0]:DEFAULT_CENTER[0],lng:S.me?+S.me[1]:DEFAULT_CENTER[1],h1:18,h2:24,hours:'6 pm–12 am',summary:'Place added through a student crime report. This location is not independently verified.',inc:[],upd:Date.now(),source:'student',createdBy:S.user.id};
        AREAS.push(rec);areaId=rec.id;persistAreas();
      }
    }
    S.myReports.push({uid:S.user.id,id:Date.now(),area:areaId,loc:S.report.loc||'',type:S.report.type,time:S.report.time,desc:S.report.desc||'',at:Date.now()});sv('cs_reports',S.myReports);S.done=true}
  render();
});
document.addEventListener('keydown',function(e){if(e.key!=='Enter')return;if(e.target.id==='g-q'){e.preventDefault();gask(e.target.value)}else if(e.target.id==='ai-q'){e.preventDefault();ask(e.target.value)}});
document.addEventListener('change',function(e){if(!e.target.matches('[data-voice-lang]'))return;
  S.voiceLang=VOICE_LANGS[e.target.value]?e.target.value:'en';sv('cs_voice_lang',S.voiceLang);render();
  if(S.nav&&S.nav.voice)say(voiceCopy('changed'))});
document.addEventListener('input',function(e){if(e.target.dataset&&e.target.dataset.af&&S.af)S.af[e.target.dataset.af]=e.target.value;if(e.target.dataset&&e.target.dataset.rt){S.rt[e.target.dataset.rt]=e.target.value;if(S.rt.placeSearch&&S.rt.placeSearch.field===e.target.dataset.rt)S.rt.placeSearch=null}if(e.target.dataset&&e.target.dataset.f){S.f[e.target.dataset.f]=e.target.value;if(e.target.dataset.f==='email')applyGrp()}if(e.target.id==='desc')S.report.desc=e.target.value;if(e.target.id==='loc')S.report.loc=e.target.value});
(function(){var m=location.hash.match(/^#areas=(.+)$/);if(!m)return;
  try{var arr=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    if(Array.isArray(arr)&&arr.every(function(a){return a&&typeof a.name==='string'&&isFinite(a.lat)&&isFinite(a.lng)&&Array.isArray(a.inc)})){AREAS=arr.map(function(a){a.source=a.source==='student'?'student':'admin';return a});persistAreas();S.imported=arr.length}}catch(e){}
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}})();
S.saved=S.saved.filter(function(id){return find(id)});
render();
if(S.imported)setTimeout(function(){toast('Campus locations updated ('+S.imported+').')},300);
