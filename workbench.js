/* Shared document canvas for edit + present. Persistence stays in tracker; this file overrides UI + guards. */
var workspaceQuery='';
var workspaceOwnerFilter='';
var workspaceMineOnly=false;
var workspaceNotice='';
var workspacePendingKeys={};
var workspaceDraftWeek=null;
var workspaceWriteGate=false; /* true while present or flushing into present */
var workspaceComposing=false;
var _wbOrig={};

function wbCaptureOrig(){
  if(!_wbOrig.renderLegacy && typeof renderLegacy==='function')_wbOrig.renderLegacy=renderLegacy;
  if(!_wbOrig.sw && typeof sw==='function')_wbOrig.sw=sw;
  if(!_wbOrig.savePatch && typeof savePatch==='function')_wbOrig.savePatch=savePatch;
  if(!_wbOrig.saveWeekPatch && typeof saveWeekPatch==='function')_wbOrig.saveWeekPatch=saveWeekPatch;
  if(!_wbOrig.saveWeek && typeof saveWeek==='function')_wbOrig.saveWeek=saveWeek;
  if(!_wbOrig.ukr && typeof ukr==='function')_wbOrig.ukr=ukr;
  if(!_wbOrig.uot && typeof uot==='function')_wbOrig.uot=uot;
  if(!_wbOrig.updateProgressItem && typeof updateProgressItem==='function')_wbOrig.updateProgressItem=updateProgressItem;
  if(!_wbOrig.saveProgressItems && typeof saveProgressItems==='function')_wbOrig.saveProgressItems=saveProgressItems;
  if(!_wbOrig.upct && typeof upct==='function')_wbOrig.upct=upct;
  if(!_wbOrig.aobj && typeof aobj==='function')_wbOrig.aobj=aobj;
  if(!_wbOrig.robj && typeof robj==='function')_wbOrig.robj=robj;
  if(!_wbOrig.akr && typeof akr==='function')_wbOrig.akr=akr;
  if(!_wbOrig.rkr && typeof rkr==='function')_wbOrig.rkr=rkr;
  if(!_wbOrig.openHist && typeof openHist==='function')_wbOrig.openHist=openHist;
  if(!_wbOrig.saveDot && typeof saveDot==='function')_wbOrig.saveDot=saveDot;
  if(!_wbOrig.deb && typeof deb==='function')_wbOrig.deb=deb;
}

function wbIsPreview(){
  try{var q=new URLSearchParams(location.search);return q.get('preview')==='1'||q.get('demo')==='1'}catch(e){return false}
}

function wbHasUnsaved(){
  if(S.ss==='saving'||S.ss==='failed')return true;
  for(var k in workspacePendingKeys){if(workspacePendingKeys[k])return true}
  return false;
}

function wbSetNotice(msg){
  workspaceNotice=msg||'';
  var el=document.getElementById('workspace-notice');
  if(el){el.textContent=workspaceNotice;el.hidden=!workspaceNotice}
}

function wbRememberDraft(){
  try{
    if(!S.wd||!S.meta)return;
    workspaceDraftWeek={week:S.meta.weekList[S.wi],wd:JSON.parse(JSON.stringify(S.wd)),at:Date.now()};
    localStorage.setItem('okr-workbench-draft',JSON.stringify(workspaceDraftWeek));
  }catch(e){}
}

function wbRestoreDraftBanner(){
  try{
    var raw=localStorage.getItem('okr-workbench-draft');
    if(!raw)return;
    workspaceDraftWeek=JSON.parse(raw);
  }catch(e){workspaceDraftWeek=null}
}

function wbClearDraft(){
  workspaceDraftWeek=null;
  try{localStorage.removeItem('okr-workbench-draft')}catch(e){}
}

function wbCommitComposing(){
  var el=document.activeElement;
  if(!el)return;
  if(el.matches && el.matches('[data-progress-item]')){
    if(typeof commitProgressField==='function')commitProgressField({target:el});
    return;
  }
  if(typeof wbCommitNamedField==='function')wbCommitNamedField(el);
  else if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){
    el.blur();
    el.focus();
  }
}

function wbCommitNamedField(el){
  if(!el||!el.getAttribute)return;
  var field=el.getAttribute('data-wb-field');
  if(!field||S.present||workspaceWriteGate)return;
  if(field==='objectiveTitle'){
    var oi=Number(el.getAttribute('data-wb-oi'));
    if(!isNaN(oi) && _wbOrig.uot) _wbOrig.uot(oi, el.value);
    else if(!isNaN(oi)) uot(oi, el.value);
  }else if(field==='kr'){
    var kid=el.getAttribute('data-wb-kid');
    var f=el.getAttribute('data-wb-kr-field');
    if(kid&&f){
      if(_wbOrig.ukr)_wbOrig.ukr(kid,f,el.value);
      else ukr(kid,f,el.value);
    }
  }
}

function wbFlushPending(){
  return new Promise(function(resolve,reject){
    wbCommitComposing();
    if(typeof window.__wbFlushDebTimers==='function')window.__wbFlushDebTimers();
    var tries=0;
    (function tick(){
      tries++;
      if(!wbHasUnsaved() && S.ss!=='saving'){resolve(true);return}
      if(S.ss==='failed'){reject(new Error('save-failed'));return}
      if(tries>40){reject(new Error('save-timeout'));return}
      setTimeout(tick,100);
    })();
  });
}

function wbBlockIfDirty(actionLabel){
  if(!wbHasUnsaved())return false;
  if(S.ss==='failed'){
    wbSetNotice('保存失败，请先点「重试保存」再'+(actionLabel||'切换')+'。本地草稿已保留。');
    return true;
  }
  wbSetNotice('还有未保存的修改，请稍等保存完成后再'+(actionLabel||'切换')+'。');
  return true;
}

function selectProject(i){
  if(i===S.pidx)return;
  if(wbBlockIfDirty('换项目'))return;
  wbFlushPending().then(function(){
    S.pidx=i;wbSetNotice('');render();window.scrollTo({top:0,behavior:'smooth'});
  }).catch(function(){wbBlockIfDirty('换项目');render()});
}

function searchProjects(value){
  workspaceQuery=value;
  wbRenderNavOnly();
  var el=document.getElementById('project-search');
  if(el){el.focus();var n=value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
}

function setOwnerFilter(value){
  workspaceOwnerFilter=value||'';
  workspaceMineOnly=false;
  render();
  var el=document.getElementById('owner-filter');
  if(el){el.focus();var n=(value||'').length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
}

function toggleMineOnly(){
  workspaceMineOnly=!workspaceMineOnly;
  if(workspaceMineOnly)workspaceOwnerFilter='';
  render();
}

function guessCurrentUserOwner(){
  try{
    var saved=localStorage.getItem('okr-workbench-owner');
    if(saved)return saved;
  }catch(e){}
  /* Best-effort: most common owner token in current week */
  if(!S.wd||!S.wd.krs)return '';
  var counts={},best='',n=0;
  Object.keys(S.wd.krs).forEach(function(kid){
    var o=String(S.wd.krs[kid].owner||'').trim();
    if(!o)return;
    o.split(/[\/、,，]/).forEach(function(part){
      part=part.trim();if(!part)return;
      counts[part]=(counts[part]||0)+1;
      if(counts[part]>n){n=counts[part];best=part}
    });
  });
  return best;
}

function projectMatchesFilters(o,krs){
  var tasks=(o.krIds||[]).map(function(k){return krs[k]}).filter(Boolean);
  var hay=[o.title].concat(tasks.map(function(k){return k.title+' '+(k.owner||'')})).join(' ');
  if(workspaceQuery && hay.toLowerCase().indexOf(workspaceQuery.toLowerCase())<0)return false;
  var ownerNeedle=workspaceMineOnly?guessCurrentUserOwner():workspaceOwnerFilter;
  if(ownerNeedle){
    var hit=tasks.some(function(k){return String(k.owner||'').toLowerCase().indexOf(ownerNeedle.toLowerCase())>=0});
    if(!hit)return false;
  }
  return true;
}

function wbNavHtml(structs,krs,idx){
  var h='<div class="nav-caption">本周项目 <span>'+structs.length+'</span></div>';
  h+='<input id="project-search" type="search" placeholder="搜索项目、任务或负责人" aria-label="搜索项目、任务或负责人" value="'+esc(workspaceQuery)+'" oninput="searchProjects(this.value)">';
  h+='<div class="owner-filter-row"><input id="owner-filter" type="search" placeholder="按负责人筛选" aria-label="按负责人筛选" value="'+esc(workspaceOwnerFilter)+'" oninput="setOwnerFilter(this.value)" '+(workspaceMineOnly?'disabled':'')+'>';
  h+='<button type="button" class="mine-toggle '+(workspaceMineOnly?'on':'')+'" onclick="toggleMineOnly()">'+(workspaceMineOnly?'只看我的 ✓':'只看我的')+'</button></div>';
  h+='<nav aria-label="项目目录">';
  var matches=0,selectedHidden=false;
  structs.forEach(function(o,i){
    var tasks=(o.krIds||[]).map(function(k){return krs[k]}).filter(Boolean);
    if(!projectMatchesFilters(o,krs)){if(i===idx)selectedHidden=true;return}
    matches++;
    var filled=tasks.filter(function(k){return String(k.thisWeek||'').trim() || (k.thisWeekItems||[]).some(function(x){return String(x||'').trim()})}).length;
    h+='<button class="project-link '+(i===idx?'selected':'')+'" aria-current="'+(i===idx?'page':'false')+'" onclick="selectProject('+i+')"><span class="project-index">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(o.title)+'<small>'+filled+'/'+tasks.length+' 项已填写</small></span></button>';
  });
  if(!matches)h+='<p class="empty-search">没有匹配的项目</p>';
  if(selectedHidden)h+='<p class="filter-hint">当前项目被筛选隐藏，仍可继续编辑；清空筛选可回到目录。</p>';
  h+='</nav><div class="nav-bottom"><a href="progress.html">全局进展 ↗</a><a href="feedback.html">反馈建议 ↗</a></div>';
  return h;
}

function wbRenderNavOnly(){
  var nav=document.querySelector('.project-nav');
  if(!nav||!S.wd){render();return}
  nav.innerHTML=wbNavHtml(S.wd.struct,S.wd.krs,S.pidx||0);
}

function render(){
  wbCaptureOrig();
  var root=document.getElementById('root');
  if(S.loading||!S.meta||!S.wd){root.innerHTML='<div class="workspace-loading">正在读取团队工作…</div>';return}
  var structs=S.wd.struct,krs=S.wd.krs,idx=Math.max(0,Math.min(S.pidx||0,structs.length-1));S.pidx=idx;
  var obj=structs[idx],playing=!!S.present,disabled=playing?' disabled':'',week=S.meta.weekList[S.wi];
  workspaceWriteGate=playing;
  var status=S.ss==='saving'?'保存中…':S.ss==='failed'?'保存失败，本地草稿已保留':S.ss==='saved'?'✓ 已保存（服务器已确认）':S.ss==='confirming'?'正在核对服务器…':'修改后自动保存';
  var previewBadge=wbIsPreview()?'<span class="preview-badge">预览模式 · 不写生产数据</span>':'';
  var h='<div class="workspace '+(playing?'is-playing':'')+'">';
  h+='<header class="workspace-header"><a class="workspace-brand" href="tracker.html'+(wbIsPreview()?'?preview=1':'')+'">团队工作台<span>WEEKLY WORKSPACE</span></a>';
  h+='<div class="workspace-week"><button onclick="wbSwitchWeek('+(S.wi-1)+')" '+(S.wi===0?'disabled':'')+' aria-label="上一周">‹</button><span>'+esc(wkLabel(week))+'</span><button onclick="wbSwitchWeek('+(S.wi+1)+')" '+(S.wi===S.meta.weekList.length-1?'disabled':'')+' aria-label="下一周">›</button></div>';
  h+='<div class="workspace-actions">'+previewBadge+'<span class="sd '+S.ss+'"></span><span class="ss-text" role="status" aria-live="polite">'+status+'</span>';
  if(S.ss==='failed')h+='<button class="retry-button" onclick="wbRetrySave()">重试保存</button>';
  h+='<button class="mode-button" onclick="'+(playing?'exitPresent()':'startPresent()')+'">'+(playing?'返回编辑':'播放预览')+'</button></div></header>';
  h+='<div id="workspace-notice" class="workspace-notice" role="status" aria-live="polite"'+(workspaceNotice?'':' hidden')+'>'+esc(workspaceNotice)+'</div>';
  if(workspaceDraftWeek && S.ss==='failed')h+='<div class="draft-banner">检测到未同步草稿（周 '+esc(workspaceDraftWeek.week||'')+'）。内容仍在本页，保存成功前不会当作服务器真相。</div>';
  h+='<div class="workspace-layout"><aside class="project-nav">'+wbNavHtml(structs,krs,idx)+'</aside><main class="document-canvas">';
  if(!obj){h+='<p>暂无项目</p>'+(playing?'':'<button onclick="aobj()">添加项目</button>')}else{
    var ids=(obj.krIds||[]).filter(function(k){return krs[k]});
    h+='<div class="document-eyebrow"><span>PROJECT '+String(idx+1).padStart(2,'0')+' / '+String(structs.length).padStart(2,'0')+'</span><span>'+ids.length+' 项任务 · '+(playing?'播放预览（只读）':'点击正文即可编辑')+'</span></div>';
    h+='<textarea class="document-title" data-wb-field="objectiveTitle" data-wb-oi="'+idx+'" aria-label="项目目标" rows="1" oninput="uot('+idx+',this.value);ah(this)"'+disabled+'>'+esc(obj.title)+'</textarea>';
    ids.forEach(function(kid){
      var kr=krs[kid],items=progressItems(kr.thisWeek,kr.thisWeekItems);
      h+='<section class="task-document"><div class="task-heading"><textarea class="task-title" data-wb-field="kr" data-wb-kid="'+kid+'" data-wb-kr-field="title" aria-label="任务名称" rows="1" oninput="ukr(\''+kid+'\',\'title\',this.value);ah(this)"'+disabled+'>'+esc(kr.title)+'</textarea>';
      h+='<div class="task-meta"><label>负责人 <input data-wb-field="kr" data-wb-kid="'+kid+'" data-wb-kr-field="owner" aria-label="负责人" value="'+esc(kr.owner||'')+'" placeholder="待分配" oninput="ukr(\''+kid+'\',\'owner\',this.value)"'+disabled+'></label><span class="task-percent">'+kr.pct+'%</span></div></div><div class="document-progress">';
      items.forEach(function(item,i){
        h+='<div class="document-line"><span class="line-number">'+String(i+1).padStart(2,'0')+'</span>';
        h+='<textarea class="progress-item document-input" data-progress-item="'+kid+'-'+i+'" aria-label="'+esc(kr.title)+' 第'+(i+1)+'条进展" rows="1" placeholder="写下本周的具体进展…" oninput="updateProgressItem(\''+kid+'\','+i+',this.value,event);ah(this)" onkeydown="progressItemKeydown(event,\''+kid+'\','+i+')"'+disabled+'>'+esc(item)+'</textarea>';
        if(!playing)h+='<button class="line-remove" aria-label="删除第'+(i+1)+'条进展" onclick="removeProgressItem(\''+kid+'\','+i+')">×</button>';
        h+='</div>';
      });
      h+='</div>';
      if(!playing){
        h+='<button class="quiet-add" onclick="addProgressItem(\''+kid+'\','+(items.length-1)+')">＋ 添加进展</button>';
        h+='<details class="task-details"><summary>上周记录与任务设置</summary><div class="task-settings">';
        h+='<label>上周进展<textarea data-wb-field="kr" data-wb-kid="'+kid+'" data-wb-kr-field="lastWeek" rows="1" oninput="ukr(\''+kid+'\',\'lastWeek\',this.value);ah(this)">'+esc(kr.lastWeek||'')+'</textarea></label>';
        h+='<label>状态说明<input data-wb-field="kr" data-wb-kid="'+kid+'" data-wb-kr-field="status" value="'+esc(kr.status||'')+'" oninput="ukr(\''+kid+'\',\'status\',this.value)"></label>';
        h+='<div class="settings-actions"><button onclick="upct(\''+kid+'\',-5)">进度 −5%</button><button onclick="upct(\''+kid+'\',5)">进度 +5%</button><button onclick="openHist(\''+kid+'\')">查看历史</button><button class="danger" onclick="if(confirm(\'删除这项任务及其本周内容？\'))rkr('+idx+',\''+kid+'\')">删除任务</button></div>';
        h+='</div></details>';
      }
      h+='</section>';
    });
    if(!playing){
      h+='<div class="document-tools"><button onclick="akr('+idx+')">＋ 添加任务</button><details><summary>管理项目</summary><div class="settings-actions">';
      h+='<button onclick="aobj()">添加项目</button><button onclick="moveProject(-1)">项目上移</button><button onclick="moveProject(1)">项目下移</button>';
      h+='<button class="danger" onclick="if(confirm(\'删除整个项目及其本周任务？\'))robj('+idx+')">删除项目</button><button onclick="loadLocalSnapshot()">本地快照</button></div></details></div>';
    }
    h+='<footer class="document-footer"><button onclick="selectProject('+(idx-1)+')" '+(idx===0?'disabled':'')+'>← 上一项目</button><span>'+(playing?'← → 切换项目 · Esc 返回编辑':'Enter 新增进展 · Shift+Enter 换行')+'</span><button onclick="selectProject('+(idx+1)+')" '+(idx===structs.length-1?'disabled':'')+'>下一项目 →</button></footer>';
  }
  h+='</main></div></div>';
  if(S.drawer){
    h+='<div class="do" onclick="closeHist()"></div><div class="dr"><button class="dc" onclick="closeHist()">×</button><h2>任务历史</h2>';
    if(S.drawer.items)S.drawer.items.forEach(function(x){h+='<div class="hw"><div class="hd">'+esc(x.label)+'</div><div class="ht">'+esc(x.tw||'暂无进展')+'</div></div>'});
    else h+='<p>正在读取…</p>';
    h+='</div>';
  }
  root.innerHTML=h;
  root.querySelectorAll('textarea').forEach(ah);
  root.querySelectorAll('details').forEach(function(el){el.addEventListener('toggle',function(){el.querySelectorAll('textarea').forEach(ah)})});
}

function moveProject(delta){
  if(S.present||workspaceWriteGate){wbSetNotice('播放预览中不能调整项目顺序。');return}
  if(wbBlockIfDirty('调整顺序'))return;
  var from=S.pidx,to=from+delta;if(to<0||to>=S.wd.struct.length)return;
  S.wd.struct=moveItem(S.wd.struct,from,to);S.pidx=to;saveWeekPatch();render();
}

function wbSwitchWeek(idx){
  if(!S.meta||idx<0||idx>=S.meta.weekList.length)return;
  if(wbBlockIfDirty('换周'))return;
  wbFlushPending().then(function(){
    wbSetNotice('');
    if(_wbOrig.sw)_wbOrig.sw(idx);else{S.wi=idx;S.loading=true;render();loadWeek(S.meta.weekList,idx).then(function(){S.loading=false;render()})}
  }).catch(function(){wbBlockIfDirty('换周');render()});
}

function startPresent(){
  if(!S.wd||!S.wd.struct||!S.wd.struct.length)return;
  if(wbBlockIfDirty('进入播放'))return;
  wbFlushPending().then(function(){
    workspaceWriteGate=true;
    S.present=true;S.drawer=null;wbSetNotice('');
    render();
    window.scrollTo(0,0);
  }).catch(function(){wbBlockIfDirty('进入播放');render()});
}

function exitPresent(){
  S.present=false;workspaceWriteGate=false;wbSetNotice('');render();
}

function presentStep(d){
  if(!S.present||!S.wd||!S.wd.struct)return;
  /* project-level pages only; content scrolls inside */
  S.pidx=Math.max(0,Math.min(S.wd.struct.length-1,(S.pidx||0)+d));
  render();
  window.scrollTo(0,0);
}

function wbRetrySave(){
  if(!S.wd||!S.meta)return;
  wbSetNotice('正在重试保存…');
  saveWeekPatch();
}

function wbMarkPending(key){workspacePendingKeys[key]=true}
function wbClearPending(key){delete workspacePendingKeys[key]}

function wbConfirmFromServer(week){
  if(wbIsPreview()){
    saveDot('saved');wbClearDraft();return Promise.resolve(true);
  }
  if(typeof fbGet!=='function'){saveDot('saved');return Promise.resolve(true)}
  saveDot('confirming');
  return fbGet('okr/weeks/'+week).then(function(raw){
    var remote=typeof fixWeekData==='function'?fixWeekData(raw):raw;
    if(!remote){saveDot('failed');wbRememberDraft();wbSetNotice('服务器读回为空，已保留本地草稿。');return false}
    /* Authority = server readback. Keep local only if still dirty/pending. */
    if(!wbHasUnsaved() && S.ss!=='saving'){
      S.wd=remote;
    }
    saveDot('saved');wbClearDraft();wbSetNotice('');
    return true;
  }).catch(function(e){
    console.error(e);saveDot('failed');wbRememberDraft();wbSetNotice('服务器确认失败，已保留本地草稿。');return false;
  });
}

function wbInstallWriteGuards(){
  wbCaptureOrig();

  /* Track debounce timers so flush can fire them before present/switch. */
  if(_wbOrig.deb || typeof deb==='function'){
    var _wbDebTimers={}, _wbDebFns={};
    deb=function(key,fn,ms){
      if(_wbDebTimers[key])clearTimeout(_wbDebTimers[key]);
      _wbDebFns[key]=fn;
      _wbDebTimers[key]=setTimeout(function(){
        delete _wbDebTimers[key];delete _wbDebFns[key];fn();
      }, ms||300);
    };
    window.__wbFlushDebTimers=function(){
      Object.keys(_wbDebFns).forEach(function(k){
        var fn=_wbDebFns[k];
        if(_wbDebTimers[k])clearTimeout(_wbDebTimers[k]);
        delete _wbDebTimers[k];delete _wbDebFns[k];
        try{fn()}catch(e){console.error(e)}
      });
    };
  }

  saveDot=function(st){
    S.ss=st;
    var d=document.querySelector('.sd');var t=document.querySelector('.ss-text');
    if(d)d.className='sd '+st;
    if(t)t.textContent=st==='saving'?'保存中…':st==='confirming'?'正在核对服务器…':st==='saved'?'✓ 已保存（服务器已确认）':st==='failed'?'保存失败，本地草稿已保留':'修改后自动保存';
    if(st==='failed')wbRememberDraft();
  };

  savePatch=function(key,patch){
    if(S.present||workspaceWriteGate){wbSetNotice('播放预览为只读，已阻止写入。');return}
    if(wbIsPreview()){
      wbMarkPending(key);saveDot('saving');
      setTimeout(function(){wbClearPending(key);wbConfirmFromServer(S.meta.weekList[S.wi])},200);
      return;
    }
    wbMarkPending(key);saveDot('saving');
    var mon=S.meta.weekList[S.wi];
    deb('save-'+key,function(){
      (db?firebasePatch(patch):sitesPatch(patch)).then(function(){
        wbClearPending(key);
        return wbConfirmFromServer(mon);
      }).catch(function(e){console.error(e);wbClearPending(key);saveDot('failed');wbRememberDraft()});
    },600);
  };

  saveWeekPatch=function(krsPatch){
    if(S.present||workspaceWriteGate){wbSetNotice('播放预览为只读，已阻止写入。');return}
    var mon=S.meta.weekList[S.wi];
    if(wbIsPreview()){
      wbMarkPending('week-'+mon);saveDot('saving');
      pendingStructureSaves[mon]=mergeStructureSave(pendingStructureSaves[mon],S.wd.struct,krsPatch);
      setTimeout(function(){delete pendingStructureSaves[mon];wbClearPending('week-'+mon);wbConfirmFromServer(mon)},200);
      return;
    }
    wbMarkPending('week-'+mon);saveDot('saving');
    pendingStructureSaves[mon]=mergeStructureSave(pendingStructureSaves[mon],S.wd.struct,krsPatch);
    deb('save-week-'+mon,function(){
      var pending=pendingStructureSaves[mon];delete pendingStructureSaves[mon];
      var patch={op:'structure',week:mon,struct:pending.struct,krsPatch:pending.krsPatch};
      (db?firebasePatch(patch):sitesPatch(patch)).then(function(){
        wbClearPending('week-'+mon);
        return wbConfirmFromServer(mon);
      }).catch(function(e){console.error(e);wbClearPending('week-'+mon);saveDot('failed');wbRememberDraft()});
    },600);
  };

  saveWeek=function(){
    if(S.present||workspaceWriteGate)return;
    var mon=S.meta.weekList[S.wi];saveDot('saving');wbMarkPending('full-'+mon);
    if(wbIsPreview()){setTimeout(function(){wbClearPending('full-'+mon);wbConfirmFromServer(mon)},200);return}
    deb('save',function(){
      fbSet('okr/weeks/'+mon,S.wd).then(function(){wbClearPending('full-'+mon);return wbConfirmFromServer(mon)})
        .catch(function(e){console.error(e);wbClearPending('full-'+mon);saveDot('failed');wbRememberDraft()});
    });
  };

  ukr=function(kid,f,v){if(S.present||workspaceWriteGate||workspaceComposing)return;_wbOrig.ukr(kid,f,v)};
  uot=function(oi,v){if(S.present||workspaceWriteGate||workspaceComposing)return;_wbOrig.uot(oi,v)};
  updateProgressItem=function(kid,idx,value,event){if(S.present||workspaceWriteGate||workspaceComposing||(event&&event.isComposing))return;_wbOrig.updateProgressItem(kid,idx,value,event)};
  upct=function(kid,d){if(S.present||workspaceWriteGate)return;_wbOrig.upct(kid,d)};
  aobj=function(){if(S.present||workspaceWriteGate)return;_wbOrig.aobj()};
  robj=function(oi){if(S.present||workspaceWriteGate)return;_wbOrig.robj(oi)};
  akr=function(oi){if(S.present||workspaceWriteGate)return;_wbOrig.akr(oi)};
  rkr=function(oi,kid){if(S.present||workspaceWriteGate)return;_wbOrig.rkr(oi,kid)};
  openHist=function(kid){if(S.present||workspaceWriteGate){wbSetNotice('播放预览中请先返回编辑再看历史。');return}_wbOrig.openHist(kid)};
  if(typeof addProgressItem==='function'){
    if(!_wbOrig.addProgressItem)_wbOrig.addProgressItem=addProgressItem;
    addProgressItem=function(kid,after){if(S.present||workspaceWriteGate){wbSetNotice('播放预览为只读，已阻止写入。');return}_wbOrig.addProgressItem(kid,after)};
  }
  if(typeof removeProgressItem==='function'){
    if(!_wbOrig.removeProgressItem)_wbOrig.removeProgressItem=removeProgressItem;
    removeProgressItem=function(kid,idx){if(S.present||workspaceWriteGate){wbSetNotice('播放预览为只读，已阻止写入。');return}_wbOrig.removeProgressItem(kid,idx)};
  }

  if(!window.__wbCompositionGuardsInstalled){
    window.__wbCompositionGuardsInstalled=true;
    document.addEventListener('compositionstart',function(){workspaceComposing=true},true);
    document.addEventListener('compositionend',function(e){
      workspaceComposing=false;
      var el=e&&e.target;
      if(!el)return;
      if(el.matches&&el.matches('[data-progress-item]')){
        if(typeof commitProgressField==='function')commitProgressField({target:el});
        return;
      }
      wbCommitNamedField(el);
    },true);
  }
}

function wbInstallPreviewBoot(){
  if(!wbIsPreview())return;
  /* Replace live init with seed-only preview: no production writes. */
  window.init=async function(){
    S.loading=true;S.drawer=null;render();
    try{
      var seed=typeof makeSeed==='function'?makeSeed():null;
      if(!seed)throw new Error('缺少 makeSeed，无法进入预览');
      S.meta=seed.meta;
      S.meta.weekList=sortWeekList(S.meta.weekList);
      S.wi=latestWeekIndex(S.meta.weekList);
      var mon=S.meta.weekList[S.wi];
      S.wd=fixWeekData(mon===seed.meta.weekList[0]?seed.w1:seed.w2)||seed.w2;
      S.prev={};S.loading=false;S.ss='idle';wbSetNotice('预览模式：使用本地示例数据，不会写入生产周报。');
      render();
    }catch(e){
      document.getElementById('root').innerHTML='<div class="workspace-loading">预览启动失败：'+esc(e.message)+'</div>';
    }
  };
  /* Prevent accidental firebase connect writing: still allow UI */
  if(typeof connectFirebase==='function'){
    var _cf=connectFirebase;
    connectFirebase=function(){ /* preview: skip live db */ db=null; init(); };
  }
}

wbRestoreDraftBanner();
wbInstallPreviewBoot();
wbInstallWriteGuards();

