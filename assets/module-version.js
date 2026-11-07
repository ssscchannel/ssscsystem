/* Temporary reusable version checker for each standalone lab module.
   Requires meta[name=sssc-module-version], #module-version-trigger and #module-version-panel. */
(()=>{
 const marker=document.querySelector('meta[name="sssc-module-version"]');
 const trigger=document.getElementById('module-version-trigger');
 const panel=document.getElementById('module-version-panel');
 if(!marker||!trigger||!panel)return;
 const current=marker.content;
 const local=panel.querySelector('[data-module-local]');
 const online=panel.querySelector('[data-module-online]');
 const status=panel.querySelector('[data-module-status]');
 const check=panel.querySelector('[data-module-check]');
 const reload=panel.querySelector('[data-module-reload]');
 const close=panel.querySelector('[data-module-close]');
 if(!local||!online||!status||!check||!reload||!close)return;
 local.textContent=current;trigger.textContent=current;
 const parseVersion=(html)=>html.match(/<meta\s+name=["']sssc-module-version["']\s+content=["'](v\d+)["']/i)?.[1]||null;
 const versionNumber=v=>Number.parseInt(v.replace(/^v/i,''),10);
 async function verify(){
  check.disabled=true;status.textContent='正在檢查線上版本…';
  try{
   const url=new URL(location.href);url.searchParams.set('module_version_check',String(Date.now()));
   const response=await fetch(url.toString(),{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const latest=parseVersion(await response.text());
   if(!latest)throw Error('找不到線上版本標記');
   online.textContent=latest;
   if(versionNumber(latest)>versionNumber(current))status.textContent='發現新版本，可點選重新載入。';
   else if(latest===current)status.textContent='目前已是最新版本。';
   else status.textContent='版本資訊不一致，請稍後重新檢查。';
  }catch(error){online.textContent='無法確認';status.textContent='暫時無法查詢線上版本，請稍後重試。'}
  finally{check.disabled=false}
 }
 trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;trigger.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)verify()});
 close.addEventListener('click',()=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false')});
 check.addEventListener('click',verify);
 reload.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('updated',String(Date.now()));location.replace(url.toString())});
})();
