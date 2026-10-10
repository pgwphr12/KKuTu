'use strict';
var path=require('path'),Const=require('../const');
function decode(text){return text.replace(/&#(\d+);/g,function(_,n){return String.fromCodePoint(Number(n));}).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function element(html,id){
  var start=new RegExp('<([a-z][a-z0-9]*)\\b[^>]*\\bid=["\']'+id+'["\'][^>]*>','i').exec(html);
  if(!start)return null;
  if(/^(?:input|img|meta|link|br|hr)$/i.test(start[1]))return start[0];
  var tag=start[1],re=new RegExp('</?'+tag+'\\b[^>]*>','gi'),depth=1,end=start.index+start[0].length,match;
  re.lastIndex=end;
  while((match=re.exec(html))){depth+=match[0][1]==='/'?-1:1;if(!depth)return html.slice(start.index,re.lastIndex);}
  throw Error('Incomplete game metadata');
}
function text(html,id){var node=element(html,id);if(!node)throw Error('Missing game metadata: '+id);return decode(node.replace(/^<[^>]*>|<\/[^>]*>$/g,''));}
function replace(html,id,value){var old=element(html,id);if(!old)return html;return html.replace(old,function(){return value;});}
exports.element=element;
exports.render=function(authority,session){
  var rule=JSON.parse(text(authority,'RULE')),options=JSON.parse(text(authority,'OPTIONS')),url=text(authority,'URL');
  if(!/^wss:\/\/[A-Za-z0-9.-]+(?::\d+)?\/game2\/unified-[a-f0-9]{48}$/.test(url))throw Error('Invalid integrated game URL');
  var language=require('./lang/ko_KR.json'),locale=Object.assign({},language.GLOBAL,language.SHOP,language.kkutu,{modeKAW:'아무거나 잇기',server_1:'연동서버'});
  var variables={page:'kkutu',lang:'ko_KR',locale:locale,session:session||{},published:false,mobile:false,data:{},_id:'unified',PROTOCOL:'wss',HOST:'localhost',PORT:443,ROOM_PORT:443,MOREMI_PART:text(authority,'MOREMI_PART').split(','),AVAIL_EQUIP:text(authority,'AVAIL_EQUIP').split(','),RULE:rule,OPTIONS:options,MODE:Object.keys(rule),KO_INJEONG:Const.KO_INJEONG,EN_INJEONG:Const.EN_INJEONG,KO_THEME:Const.KO_THEME,EN_THEME:Const.EN_THEME,IJP_EXCEPT:Const.IJP_EXCEPT,CATEGORIES:Const.CATEGORIES,GROUPS:Const.GROUPS};
  // This is the same template, navigation and settings as Pearl server 1.
  var html=require('pug').renderFile(path.join(__dirname,'views','kkutu.pug'),variables);
  html=replace(html,'URL','<span id="URL">'+url+'</span>');
  ['ko-pick-list','en-pick-list'].forEach(function(id){var shared=element(authority,id);if(shared)html=replace(html,id,shared);});
  html=html.replace(/<script\b[^>]*src=["']https:\/\/www\.google\.com\/recaptcha[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,'');
  html=html.replace('<link rel="stylesheet" href="/css/in_game_kkutu_shop.css">','<link rel="stylesheet" href="/css/in_game_kkutu.css"><link rel="stylesheet" href="/css/in_game_kkutu_shop.css">');
  html=html.replace(/src=['"]\/js\/in_game_kkutu\.min\.js['"]/,'src="/js/unified-native-game.js?v=20261005-native-2"');
  return html.replace('</head>','<script src="/js/unified-peer-page.js?v=20261005-native-2"></script><script src="/js/unified-native-bridge.js?v=20261005-native-2" defer></script><link rel="stylesheet" href="/css/unified-native.css?v=20261005-native-2"></head>');
};
