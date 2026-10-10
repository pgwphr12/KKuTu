(function(){
  'use strict';
  var open=XMLHttpRequest.prototype.open;
  function read(path){return /^\/api\/(theme|wordbooks(?:\/[^/?]+\/words)?)$/.test(path)||/^\/dict\/[^/?]+$/.test(path);}
  XMLHttpRequest.prototype.open=function(method,url){
    var args=Array.prototype.slice.call(arguments),target;
    try{target=new URL(String(url),location.href);}catch(e){return open.apply(this,args);}
    if(target.origin===location.origin&&!/^\/unified\//.test(target.pathname)){
      if(String(method).toUpperCase()!=='GET')args[1]='/unified/blocked';
      else if(read(target.pathname))args[1]='/unified/data'+target.pathname+target.search;
      else if(target.pathname==='/shop'||target.pathname==='/soundpacks'){ /* Native read-only client metadata and music packs. */ }
      else if(/^\/(?:box|api\/|ranking|leaderboard)/.test(target.pathname))args[1]='/unified/blocked';
    }
    return open.apply(this,args);
  };
  document.addEventListener('DOMContentLoaded',function(){
    document.title='파얼끄투 · 연동서버';
    document.documentElement.classList.add('unified-peer');
    // ExitBtn keeps Pearl's normal leave-room action. SettingDiag's server
    // button already returns to Pearl's own homepage.
  });
})();
