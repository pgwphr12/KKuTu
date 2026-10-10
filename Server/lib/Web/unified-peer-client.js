'use strict';
var https=require('https'),crypto=require('crypto'),Ticket=require('../sub/unified-ticket');
var PREFIX='/unified/client',DATA='/unified/data';
function readPath(path){return /^\/api\/(theme|wordbooks(?:\/[^/?]+\/words)?)$/.test(path) || /^\/dict\/[^/?]+$/.test(path) || path==='/soundpacks' || path==='/shop';}
function request(config,path,method,body,headers,limit){return new Promise(function(resolve,reject){
  var url=new URL(path,config.authorityOrigin),done=false;
  function finish(err,value){if(done)return;done=true;err?reject(err):resolve(value);}
  if(url.origin!==new URL(config.authorityOrigin).origin)return finish(Error('Invalid origin'));
  var data=body||'',req=https.request(url,{method:method,timeout:12000,headers:Object.assign({'Accept-Encoding':'identity'},headers||{},method==='POST'?{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(data)}:{})},function(res){
    var chunks=[],size=0;res.on('data',function(chunk){size+=chunk.length;if(size>(limit||8*1024*1024)){res.destroy();finish(Error('Oversize'));}else chunks.push(chunk);});
    res.on('error',function(e){finish(e);});res.on('end',function(){finish(null,{status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)});});
  });req.on('timeout',function(){req.destroy();finish(Error('Timeout'));});req.on('error',function(e){finish(e);});req.end(data);
});}
// Root-relative resources in both the document and the compiled game client must
// resolve to the exact compatible client version, without replacing Pearl files.
function paths(text){return text.replace(/(["'(=])\/(js|css|img|media|lib)\//g,'$1'+PREFIX+'/$2/');}
function documentHTML(html,session){return require('./unified-native-page').render(html,session);}
exports.paths=paths;exports.documentHTML=documentHTML;exports.readPath=readPath;
exports.install=function(app,DB,config,services){
  function available(res){if(!config.enabled||!services.secret()){res.status(503).send('연동서버 연결을 아직 설정하지 않았습니다.');return false;}return true;}
  function noCache(res){res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');}
  function fail(res){if(!res.headersSent)res.status(503).send('연동서버 연결에 실패했습니다. 파얼끄투에서 다시 입장해 주세요.');}
  app.get('/unified/join',function(req,res){
    noCache(res);if(!available(res))return;
    DB.session.findOne(['_id',req.session.id]).on(function(row){
      var profile=row&&row.profile;
      if(profile&&profile.id&&!profile.guest&&!profile.federationGuest&&!/^guest:/.test(profile.id))DB.users.findOne(['_id',profile.id]).on(function(user){
        if(user&&user.black&&(!user.blockedUntil||Number(user.blockedUntil)>Date.now()))return res.status(403).send('이용이 제한된 계정입니다.');
        launch(profile);
      });else {delete req.session.unifiedRemote;res.redirect(303,'/login');}
    });
    function launch(profile){
      services.status().then(function(state){
        if(!state.online)return res.status(503).send('연동서버가 준비 중입니다. 잠시 후 다시 입장하세요.');
        var previous=req.session.unifiedRemote;
        if(previous&&previous.subject===profile.id&&previous.expires>Date.now())return res.redirect(303,'/unified/play?server=1');
        if(state.count>=10)return res.status(503).send('연동서버 정원이 찼습니다.');
        var token=Ticket.sign(profile,config,services.secret()),claim=Ticket.verify(token,config,services.secret());
        return services.issuanceDB().then(function(){return services.pg().query('INSERT INTO kkutu_unified_issued (jti,digest,expires_at) VALUES ($1,$2,$3)',[claim.jti,crypto.createHash('sha256').update(token).digest('hex'),claim.exp]);}).then(function(){
          return request(config,'/unified/exchange','POST','ticket='+encodeURIComponent(token),{},16384);
        }).then(function(reply){
          if(reply.status!==200)throw Error('Exchange failed');
          var data=JSON.parse(reply.body.toString('utf8'));
          if(!/^unified-[a-f0-9]{48}$/.test(data.sid))throw Error('Invalid session');
          req.session.unifiedRemote={sid:data.sid,subject:profile.id,expires:Date.now()+2*3600000};
          req.session.save(function(err){if(err)return fail(res);res.redirect(303,'/unified/play?server=1');});
          services.pg().query('DELETE FROM kkutu_unified_issued WHERE expires_at<$1',[Date.now()]).catch(function(){});
        });
      }).catch(function(){fail(res);});
    }
  });
  app.get('/unified/play',function(req,res){
    noCache(res);if(!available(res))return;
    var remote=req.session.unifiedRemote;
    if(!remote||remote.expires<=Date.now())return res.redirect(303,'/unified/join');
    // A login/account switch must create a fresh federation identity.
    DB.session.findOne(['_id',req.session.id]).on(function(row){
      if(!row||!row.profile||!row.profile.id||row.profile.guest||row.profile.federationGuest||/^guest:/.test(row.profile.id)){delete req.session.unifiedRemote;return res.redirect(303,'/login');}
      var subject=row.profile.id;
      if(subject!==remote.subject){delete req.session.unifiedRemote;return res.redirect(303,'/unified/join');}
      request(config,'/unified/render','POST','sid='+encodeURIComponent(remote.sid),{'User-Agent':req.get('user-agent')||'', 'Accept-Language':req.get('accept-language')||'ko'},4*1024*1024).then(function(reply){
        if(reply.status!==200){delete req.session.unifiedRemote;throw Error('Render failed');}
        var html=documentHTML(reply.body.toString('utf8'),req.session);
        res.type('html').send(html);
      }).catch(function(){fail(res);});
    });
  });
  // Public static assets only. No cookies, credentials, arbitrary URLs or
  // redirects are forwarded. The game WebSockets connect directly to authority.
  app.get('/unified/client/*',function(req,res){
    if(!available(res))return;
    var path=String(req.params[0]||'');
    if(!/^(js|css|img|media|lib)\/[A-Za-z0-9_.\-/]+$/.test(path)||path.split('/').some(function(p){return p==='..'||p==='.';}))return res.status(400).end();
    var query=req.originalUrl.indexOf('?')>=0?req.originalUrl.slice(req.originalUrl.indexOf('?')):'';
    if(query.length>2000)return res.status(400).end();
    request(config,'/'+path+query,'GET').then(function(reply){
      if(reply.status!==200)return res.status(reply.status>=300&&reply.status<400?502:reply.status).end();
      var type=reply.headers['content-type']||'application/octet-stream',body=reply.body;
      if(/(?:javascript|text\/css)/i.test(type))body=Buffer.from(paths(body.toString('utf8')));
      res.set('Content-Type',type);res.set('Cache-Control','public, max-age=300');res.send(body);
    }).catch(function(){if(!res.headersSent)res.status(502).end();});
  });
  app.get('/unified/data/*',function(req,res){
    noCache(res);if(!available(res))return;
    if(!req.session.unifiedRemote)return res.status(403).json({error:'Not connected'});
    var path='/'+String(req.params[0]||'');
    if(!readPath(path))return res.status(403).json({error:'Unsupported unified request'});
    var query=req.originalUrl.indexOf('?')>=0?req.originalUrl.slice(req.originalUrl.indexOf('?')):'';
    request(config,path+query,'GET',null,{},2*1024*1024).then(function(reply){res.status(reply.status>=300&&reply.status<400?502:reply.status).set('Content-Type',reply.headers['content-type']||'application/json').send(reply.body);}).catch(function(){if(!res.headersSent)res.status(502).json({error:'Unavailable'});});
  });
  app.all('/unified/blocked',function(req,res){res.status(403).json({error:'연동서버에서는 원래 계정의 보관함과 데이터를 변경하지 않습니다.'});});
};
