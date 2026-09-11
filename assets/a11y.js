/* =====================================================================
   Apex Marketing — shared accessibility widget + light/dark theme
   Injects the floating button + panel into every page, persists the
   user's choices in localStorage ('apex-a11y') and applies them.
   Must be loaded BEFORE the page's own i18n script (index.html) so the
   [data-i18n] labels are picked up by the language switcher.
   ===================================================================== */
(function(){
  var R=document.documentElement, KEY='apex-a11y';
  var ZOOMS=[0.9,1,1.15,1.3,1.5,1.75];
  /* flag -> html class */
  var FLAGS={light:'theme-light',contrast:'a11y-contrast',links:'a11y-links',nomotion:'a11y-nomotion',
             readable:'a11y-readable',spacing:'a11y-spacing',cursor:'a11y-cursor'};
  var state={z:1,f:{}};

  function load(){ try{var s=localStorage.getItem(KEY); if(s){ var p=JSON.parse(s); if(p&&typeof p==='object'){ state.z=p.z||1; state.f=p.f||{}; } } }catch(e){} }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){} }

  /* ---------- markup ---------- */
  var ICON_A11Y='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="3.6" r="2.1"/><path d="M20.4 7.1c0-.66-.54-1.2-1.2-1.2-.13 0-.25.02-.37.06L15 7.2c-1.9.6-3.1.6-3 .6s-1.1 0-3-.6L5.17 5.96a1.2 1.2 0 0 0-.37-.06c-.66 0-1.2.54-1.2 1.2 0 .53.34.98.82 1.14L9 9.9v3.3l-2.2 7.1a1.2 1.2 0 0 0 .8 1.5c.63.2 1.3-.16 1.5-.79L11 14.9h2l1.9 6.1c.2.63.87.99 1.5.79a1.2 1.2 0 0 0 .8-1.5L15 13.2V9.9l4.58-1.66c.48-.16.82-.61.82-1.14z"/></svg>';
  var ICON_SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function opt(flag,key,label,icon){
    return '<button class="a11y-opt" type="button" data-flag="'+flag+'" aria-pressed="false">'+
           '<span class="lb">'+(icon||'')+'<span data-i18n="'+key+'">'+label+'</span></span></button>';
  }

  var html=
    '<button class="a11y-btn" id="a11yBtn" type="button" aria-expanded="false" aria-controls="a11yPanel" aria-label="פתיחת תפריט נגישות" title="נגישות">'+ICON_A11Y+'</button>'+
    '<div class="a11y-panel" id="a11yPanel" role="dialog" aria-label="תפריט נגישות" hidden>'+
      '<div class="a11y-head"><strong data-i18n="a11y_t">נגישות</strong>'+
      '<button class="a11y-x" id="a11yClose" type="button" aria-label="סגירת תפריט נגישות">&#10005;</button></div>'+
      opt('light','a11y_light','מצב בהיר',ICON_SUN)+
      '<div class="a11y-sep"></div>'+
      '<div class="a11y-row"><span data-i18n="a11y_font">גודל טקסט</span><span class="a11y-steps">'+
        '<button type="button" data-step="-1" aria-label="הקטנת גודל הטקסט">A&minus;</button>'+
        '<span id="a11yZoomVal">100%</span>'+
        '<button type="button" data-step="1" aria-label="הגדלת גודל הטקסט">A+</button></span></div>'+
      opt('contrast','a11y_contrast','ניגודיות גבוהה')+
      opt('links','a11y_links','הדגשת קישורים')+
      opt('nomotion','a11y_motion','עצירת אנימציות')+
      opt('readable','a11y_readable','גופן קריא')+
      opt('spacing','a11y_spacing','מרווח שורות מוגדל')+
      opt('cursor','a11y_cursor','סמן מוגדל')+
      '<button class="a11y-reset" id="a11yReset" type="button" data-i18n="a11y_reset">איפוס הגדרות</button>'+
      '<a class="a11y-link" href="accessibility.html" data-i18n="a11y_stmt">להצהרת הנגישות המלאה</a>'+
    '</div>';

  var host=document.createElement('div'); host.id='a11yHost'; host.innerHTML=html;
  document.body.appendChild(host);

  var btn=document.getElementById('a11yBtn'), panel=document.getElementById('a11yPanel');
  var close=document.getElementById('a11yClose'), reset=document.getElementById('a11yReset');
  var zval=document.getElementById('a11yZoomVal');
  var themeMeta=document.querySelector('meta[name="theme-color"]');

  function smil(pause){
    var svgs=document.getElementsByTagName('svg');
    for(var i=0;i<svgs.length;i++){ try{ pause ? svgs[i].pauseAnimations() : svgs[i].unpauseAnimations(); }catch(e){} }
  }
  /* swap the white wordmark for the dark one on light backgrounds */
  function logos(light){
    var imgs=document.querySelectorAll('img[src$="assets/apex.png"],img[src$="assets/apex-dark.png"]');
    for(var i=0;i<imgs.length;i++){
      imgs[i].src = imgs[i].src.replace(/apex(-dark)?\.png$/, light?'apex-dark.png':'apex.png');
    }
  }
  function paint(){
    R.style.setProperty('--a11y-zoom',state.z);
    R.classList.toggle('a11y-zoom',state.z!==1);
    zval.textContent=Math.round(state.z*100)+'%';
    Object.keys(FLAGS).forEach(function(f){
      var on=!!state.f[f];
      R.classList.toggle(FLAGS[f],on);
      var b=panel.querySelector('[data-flag="'+f+'"]');
      if(b) b.setAttribute('aria-pressed',on?'true':'false');
    });
    smil(!!state.f.nomotion);
    var light=!!state.f.light && !state.f.contrast;
    logos(light);
    if(themeMeta) themeMeta.setAttribute('content', light?'#F3F4F7':'#08090C');
    document.querySelectorAll('[data-theme-toggle]').forEach(function(t){
      t.setAttribute('aria-pressed',state.f.light?'true':'false');
      var he=R.lang!=='en';
      t.setAttribute('aria-label', state.f.light ? (he?'מעבר למצב כהה':'Switch to dark mode') : (he?'מעבר למצב בהיר':'Switch to light mode'));
      t.setAttribute('title', state.f.light ? (he?'מצב כהה':'Dark mode') : (he?'מצב בהיר':'Light mode'));
    });
  }
  function open(o){
    panel.hidden=!o; btn.setAttribute('aria-expanded',o?'true':'false');
    if(o){ var t=panel.querySelector('button.a11y-opt'); if(t) t.focus(); }
  }
  function toggle(f){ state.f[f]=!state.f[f]; paint(); save(); }

  btn.addEventListener('click',function(){ open(panel.hidden); });
  close.addEventListener('click',function(){ open(false); btn.focus(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && !panel.hidden){ open(false); btn.focus(); } });
  document.addEventListener('click',function(e){
    if(!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) open(false);
  });
  panel.querySelectorAll('[data-step]').forEach(function(b){
    b.addEventListener('click',function(){
      var i=ZOOMS.indexOf(state.z); if(i<0) i=1;
      i=Math.min(ZOOMS.length-1,Math.max(0,i+parseInt(b.dataset.step,10)));
      state.z=ZOOMS[i]; paint(); save();
    });
  });
  panel.querySelectorAll('[data-flag]').forEach(function(b){ b.addEventListener('click',function(){ toggle(b.dataset.flag); }); });
  document.querySelectorAll('[data-theme-toggle]').forEach(function(t){ t.addEventListener('click',function(){ toggle('light'); }); });
  reset.addEventListener('click',function(){ state={z:1,f:{}}; paint(); save(); });

  /* re-label the theme button when the language changes (index.html) */
  new MutationObserver(function(){ paint(); }).observe(R,{attributes:true,attributeFilter:['lang']});

  load(); paint();
})();
