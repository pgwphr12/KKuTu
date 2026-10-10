(function(){
  'use strict';var state={online:false,max:10},busy=false;
  function draw(){
    ['ServerSelectList','server-list'].forEach(function(id){
      var parent=document.getElementById(id);if(!parent)return;
      var card=parent.querySelector('[data-unified-entry]');
      if(!card){card=document.createElement('article');card.setAttribute('data-unified-entry','true');card.className='unified-entry-card';var copy=document.createElement('div');copy.className='server-choice-copy';var name=document.createElement('strong');name.textContent='연동서버';copy.appendChild(name);var count=document.createElement('p');count.className='unified-entry-count';copy.appendChild(count);card.appendChild(copy);var button=document.createElement('button');button.type='button';button.textContent='입장';button.addEventListener('click',function(e){e.stopPropagation();var authenticated=document.getElementById('portal-authenticated');if(authenticated&&authenticated.textContent.trim()!=='1'){location.assign('/login');return;}if(state.online&&Number(state.count)<10)location.assign('/unified/join');});card.appendChild(button);parent.appendChild(card);}
      var text=state.online ? state.count+' / 10명 · 끄투게임즈코리아와 함께 플레이' : '연동서버 연결 준비 중';
      var countNode=card.querySelector('.unified-entry-count');if(countNode.textContent!==text)countNode.textContent=text;
      card.querySelector('button').disabled=!state.online || state.count>=10;
      card.classList.toggle('is-offline',!state.online);
    });
  }
  function update(){if(busy || document.hidden)return;busy=true;var xhr=new XMLHttpRequest();xhr.open('GET','/api/unified-server');xhr.timeout=4000;xhr.onload=function(){try{state=JSON.parse(xhr.responseText);}catch(e){state={online:false};}busy=false;draw();};xhr.onerror=xhr.ontimeout=function(){busy=false;state={online:false};draw();};xhr.send();}
  (window.jQuery ? window.jQuery : function(fn){document.addEventListener('DOMContentLoaded',fn);})(function(){
    draw();update();setInterval(update,4000);
    ['ServerSelectList','server-list'].forEach(function(id){var parent=document.getElementById(id);if(parent)new MutationObserver(function(){if(!parent.querySelector('[data-unified-entry]'))draw();}).observe(parent,{childList:true});});
  });
})();
