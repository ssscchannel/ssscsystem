/* Lobby interactions, preserved from tested v17. */
document.addEventListener('DOMContentLoaded',()=>{const cards=document.querySelectorAll('.lab-card');cards.forEach((card,index)=>{setTimeout(()=>{card.style.opacity='1';card.style.transform='translateY(0)'},index*100)});const audio=document.getElementById('lobby-music');const btn=document.getElementById('music-toggle');const MUSIC_KEY='sssc_lobby_music';audio.volume=.2;const setState=playing=>{btn.textContent=playing?'♫':'♪';btn.classList.toggle('playing',playing);btn.setAttribute('aria-label',playing?'暫停背景音樂':'播放背景音樂')};const startMusic=()=>audio.play().then(()=>{localStorage.setItem(MUSIC_KEY,'on');setState(true)}).catch(()=>setState(false));const stopMusic=()=>{audio.pause();localStorage.setItem(MUSIC_KEY,'off');setState(false)};btn.addEventListener('click',()=>audio.paused?startMusic():stopMusic());if(localStorage.getItem(MUSIC_KEY)==='on'){startMusic();const resume=()=>{if(audio.paused)startMusic();document.removeEventListener('pointerdown',resume)};document.addEventListener('pointerdown',resume,{once:true})}else setState(false)});function filterLabs(category){const buttons=document.querySelectorAll('.filter-btn');buttons.forEach(btn=>btn.classList.remove('active'));const clickedBtn=Array.from(buttons).find(b=>b.getAttribute('onclick').includes(`'${category}'`));if(clickedBtn)clickedBtn.classList.add('active');const cards=document.querySelectorAll('.lab-card');cards.forEach(card=>{const cardCat=card.getAttribute('data-category');if(category==='all'||cardCat===category){card.style.display='flex';card.style.opacity='0';card.style.transform='translateY(10px)';setTimeout(()=>{card.style.opacity='1';card.style.transform='translateY(0)'},50)}else card.style.display='none'})}
;

/* Compare this loaded lobby version against the published index, then manually refresh. */
(()=>{
  const trigger=document.getElementById('site-version-trigger');
  const panel=document.getElementById('site-version-panel');
  const online=document.getElementById('site-version-online');
  const status=document.getElementById('site-version-status');
  const check=document.getElementById('site-version-check');
  const reload=document.getElementById('site-version-reload');
  const close=document.getElementById('site-version-close');
  const current=document.querySelector('meta[name="sssc-build"]')?.content||'未知';
  document.getElementById('site-version-local').textContent=current;
  trigger.textContent=current;
  const versionOf=html=>html.match(/<meta\s+name=["']sssc-build["']\s+content=["'](v\d+)["']/i)?.[1]||null;
  async function verify(){
    check.disabled=true;status.textContent='正在檢查線上版本…';
    try{
      const url=new URL('index.html',document.baseURI);
      url.searchParams.set('version_check',String(Date.now()));
      const response=await fetch(url.toString(),{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const latest=versionOf(await response.text());
      if(!latest)throw Error('version marker missing');
      online.textContent=latest;
      const now=parseInt(current.replace(/^v/,''),10),newer=parseInt(latest.replace(/^v/,''),10);
      if(Number.isFinite(now)&&newer>now){
        status.textContent='發現新版，請按「重新載入」。';
        trigger.classList.add('outdated');
      }else if(latest===current){
        status.textContent='目前已是最新標記版本；若畫面異常，仍可重新載入。';
        trigger.classList.remove('outdated');
      }else{
        status.textContent='版本資訊不一致，請稍後重試或重新載入。';
      }
    }catch(err){
      online.textContent='無法確認';
      status.textContent='暫時無法確認線上版本，請檢查連線。';
    }finally{check.disabled=false}
  }
  trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;trigger.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)verify()});
  close.addEventListener('click',()=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false')});
  check.addEventListener('click',verify);
  reload.addEventListener('click',()=>{
    const url=new URL('index.html',document.baseURI);
    url.searchParams.set('updated',String(Date.now()));
    location.replace(url.toString());
  });
})();

