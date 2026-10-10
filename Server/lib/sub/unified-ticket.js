"use strict";
var crypto = require('crypto');
function encode(value) { return Buffer.from(value).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function decode(value) { return Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64'); }
function key(secret) { if(typeof secret !== 'string' || !secret) throw Error('공유 키를 설정하세요.'); return secret; }
exports.sign = function(profile, config, secret, now) {
  now = now || Date.now();
  if(!profile || typeof profile.id !== 'string' || !profile.id || profile.id.length>200) throw Error('Invalid identity');
  var body = {v:1,iss:config.issuer,aud:config.audience,iat:now,exp:now+60000,jti:encode(crypto.randomBytes(24)),sub:profile.id,name:String(profile.title || profile.name || '파얼 손님').slice(0,40),guest:!!profile.guest};
  var data = encode(JSON.stringify(body));
  return data+'.'+encode(crypto.createHmac('sha256',key(secret)).update(data).digest());
};
exports.verify = function(ticket,config,secret,now) {
  now=now||Date.now();
  if(typeof ticket !== 'string' || ticket.length>4096) throw Error('Invalid ticket');
  var parts=ticket.split('.');
  if(parts.length!==2 || !parts.every(function(p){return /^[A-Za-z0-9_-]+$/.test(p);})) throw Error('Invalid encoding');
  var expected=crypto.createHmac('sha256',key(secret)).update(parts[0]).digest(), actual=decode(parts[1]);
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) throw Error('Invalid signature');
  var body=JSON.parse(decode(parts[0]).toString('utf8'));
  if(body.v!==1 || body.iss!==config.issuer || body.aud!==config.audience || !Number.isSafeInteger(body.iat) || !Number.isSafeInteger(body.exp) || body.exp<=now || body.iat>now+5000 || body.exp-body.iat!==60000 || !/^[A-Za-z0-9_-]{32}$/.test(body.jti) || typeof body.sub!=='string' || !body.sub || body.sub.length>200 || typeof body.name!=='string' || body.name.length>40 || typeof body.guest!=='boolean') throw Error('Invalid claims');
  return body;
};
exports.profile = function(body) {
  // Namespaced, non-admin identity. Never accept outfits, tokens or permissions.
  return {id:'federation:'+body.iss+':'+encode(crypto.createHash('sha256').update(body.sub).digest()),title:body.name,name:body.name,authType:'federation',federationOrigin:body.iss,federationGuest:body.guest};
};
