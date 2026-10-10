"use strict";
var crypto=require('crypto'), https=require('https'), Ticket=require('../sub/unified-ticket');
exports.install=function(app,DB,options) {
  var config=require('../sub/unified.json'), pool;
  function secret(){return process.env[config.secretEnv] || config.sharedKey;}
  function available(res){if(!config.enabled || !secret()){res.status(503).send('연동서버 연결을 아직 설정하지 않았습니다.');return false;}return true;}
  function noCache(res){res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');}
  function pg(){if(!pool){var g=require('../sub/global.json');pool=new (require('pg').Pool)({host:g.PG_HOST,port:g.PG_PORT,user:g.PG_USER,password:g.PG_PASSWORD,database:g.PG_DATABASE,max:2,connectionTimeoutMillis:3000,statement_timeout:5000});}return pool;}
  function confirmIssued(ticket){return new Promise(function(resolve,reject){
    var url=new URL('/unified/verify',config.peerOrigin),body='ticket='+encodeURIComponent(ticket),finished=false;
    function finish(err,value){if(finished)return;finished=true;err?reject(err):resolve(value);}
    var request=https.request(url,{method:'POST',timeout:4000,headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}},function(response){var text='';response.on('data',function(chunk){text+=chunk;if(text.length>16384){response.destroy();finish(Error('Oversize'));}});response.on('error',function(e){finish(e);});response.on('end',function(){try{var result=JSON.parse(text);if(response.statusCode!==200 || result.ok!==true)throw Error('Not issued');finish(null,result);}catch(e){finish(e);}});});
    request.on('timeout',function(){request.destroy();finish(Error('Timeout'));});request.on('error',function(e){finish(e);});request.end(body);
  });}
  if(config.role==='authority') {
    app.get('/api/unified-server',function(req,res){noCache(res);var state=options.status();res.json({name:'연동서버',max:10,count:state.count,online:config.enabled && state.online,modes:['KSH','KAW'],quickStart:false,ranked:false});});
    // Server-to-server exchange: the browser stays on the peer's own origin.
    app.post('/unified/exchange',function(req,res){
      noCache(res);if(!available(res))return;
      var token=req.body && req.body.ticket,claim;
      try{claim=Ticket.verify(token,config,secret());}catch(e){return res.status(403).json({error:'Invalid ticket'});}
      confirmIssued(token).then(function(result){
        if(result.jti!==claim.jti)throw Error('Mismatch');
        return pg().query('INSERT INTO kkutu_unified_ticket (jti, expires_at) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING jti',[claim.jti,claim.exp]);
      }).then(function(result){
        if(result.rowCount!==1)return res.status(409).json({error:'Used ticket'});
        var sid='unified-'+crypto.randomBytes(24).toString('hex'),profile=Ticket.profile(claim);profile.sid=sid;
        return pg().query('INSERT INTO session (_id,profile,"createdAt") VALUES ($1,$2,$3)',[sid,JSON.stringify(profile),Date.now()]).then(function(){res.json({sid:sid});});
      }).catch(function(){if(!res.headersSent)res.status(503).json({error:'Peer verification failed'});});
    });
    app.post('/unified/render',function(req,res){
      noCache(res);if(!available(res))return;
      var sid=req.body && req.body.sid;
      if(typeof sid!=='string' || !/^unified-[a-f0-9]{48}$/.test(sid))return res.status(403).send('Invalid session');
      pg().query('SELECT profile,"createdAt" FROM session WHERE _id=$1',[sid]).then(function(result){
        var row=result.rows && result.rows[0],profile=row && row.profile;
        if(typeof profile==='string')profile=JSON.parse(profile);
        if(!profile || profile.authType!=='federation' || profile.federationOrigin!==config.issuer || Date.now()-Number(row.createdAt)>12*3600000)return res.status(403).send('Expired session');
        // Do not overwrite the Express session or its Korea account cookie.
        var request=Object.create(req);
        request.session={id:sid,unifiedSid:sid,unifiedOrigin:'parkeol',profile:profile};
        request._playServer=1;
        if(!options.render)return res.status(503).send('Client renderer unavailable');
        options.render(request,res);
      }).catch(function(){if(!res.headersSent)res.status(503).send('Client unavailable');});
    });
    app.post('/unified/accept',function(req,res){
      noCache(res); if(!available(res))return;
      var claim;try{claim=Ticket.verify(req.body && req.body.ticket,config,secret());}catch(e){return res.status(403).send('연결 코드가 만료되었거나 올바르지 않습니다. 파얼끄투에서 다시 입장하세요.');}
      // UNIQUE nonce persists across workers and restarts; INSERT wins only once.
      // A short human-selected shared key alone must not let a visitor invent identities.
      // The configured HTTPS peer must confirm it actually issued this exact ticket.
      confirmIssued(req.body.ticket).then(function(result){if(result.jti!==claim.jti)throw Error('Mismatch');return pg().query('INSERT INTO kkutu_unified_ticket (jti, expires_at) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING jti',[claim.jti,claim.exp]);}).then(function(result){
        if(result.rowCount!==1)return res.status(409).send('이미 사용한 연결 코드입니다.');
        var sid='unified-'+crypto.randomBytes(24).toString('hex'), profile=Ticket.profile(claim);profile.sid=sid;
        return pg().query('INSERT INTO session (_id,profile,"createdAt") VALUES ($1,$2,$3)',[sid,JSON.stringify(profile),Date.now()]).then(function(){
          // Keep the visitor's ordinary Korea account session intact.
          var handoff=crypto.randomBytes(24).toString('hex'),hash=crypto.createHash('sha256').update(handoff).digest('hex');
          return pg().query('INSERT INTO kkutu_unified_handoff (code,session_id,expires_at) VALUES ($1,$2,$3)',[hash,sid,Date.now()+30000]).then(function(){
            // Top-level GET carries the existing SameSite=Lax Korea session.
            // Do not create/replace its cookie during the cross-site POST.
            res.redirect(303,'/unified/finish?code='+handoff);
          });
        });
      }).catch(function(){if(!res.headersSent)res.status(503).send('연동서버 준비가 완료되지 않았습니다.');});
    });
    app.get('/unified/finish',function(req,res){
      noCache(res);if(!available(res))return;
      var code=req.query && req.query.code;if(typeof code!=='string' || !/^[a-f0-9]{48}$/.test(code))return res.status(403).send('잘못된 연결 요청입니다.');
      pg().query('DELETE FROM kkutu_unified_handoff WHERE code=$1 AND expires_at>$2 RETURNING session_id',[crypto.createHash('sha256').update(code).digest('hex'),Date.now()]).then(function(result){
        if(result.rowCount!==1)return res.status(403).send('연결 요청이 만료되었습니다. 다시 입장하세요.');
        req.session.unifiedSid=result.rows[0].session_id;req.session.unifiedOrigin='parkeol';
        req.session.save(function(err){if(err)return res.status(503).send('세션 저장에 실패했습니다.');res.redirect(303,'/play2');});
      }).catch(function(){if(!res.headersSent)res.status(503).send('연동서버 연결을 완료하지 못했습니다.');});
    });
    return;
  }
  var issuedTable=null;
  function issuanceDB(){if(!issuedTable)issuedTable=pg().query('CREATE TABLE IF NOT EXISTS kkutu_unified_issued (jti text PRIMARY KEY, digest text NOT NULL, expires_at bigint NOT NULL)').catch(function(e){issuedTable=null;throw e;});return issuedTable;}
  app.post('/unified/verify',function(req,res){
    noCache(res);if(!available(res))return;
    var token=req.body && req.body.ticket,claim;try{claim=Ticket.verify(token,config,secret());}catch(e){return res.status(403).json({ok:false});}
    issuanceDB().then(function(){return pg().query('DELETE FROM kkutu_unified_issued WHERE jti=$1 AND digest=$2 AND expires_at>$3 RETURNING jti',[claim.jti,crypto.createHash('sha256').update(token).digest('hex'),Date.now()]);}).then(function(result){res.status(result.rowCount===1?200:403).json({ok:result.rowCount===1,jti:result.rowCount===1?claim.jti:undefined});}).catch(function(){res.status(503).json({ok:false});});
  });
  var cache=null,cacheAt=0,inFlight=null;
  function status(){
    if(cache && Date.now()-cacheAt<2000)return Promise.resolve(cache);
    if(inFlight)return inFlight;
    inFlight=new Promise(function(resolve){
      var url=new URL('/api/unified-server',config.authorityOrigin), settled=false;
      function finish(value){if(settled)return;settled=true;cache=value;cacheAt=Date.now();resolve(value);}
      var request=https.get(url,{timeout:3000},function(response){
        var text='';response.on('data',function(chunk){text+=chunk;if(text.length>16384){response.destroy();finish({online:false});}});
        response.on('error',function(){finish({online:false});});
        response.on('end',function(){try{var data=JSON.parse(text);if(response.statusCode!==200)throw Error();finish({online:!!data.online,count:Number(data.count)||0,max:10});}catch(e){finish({online:false});}});
      });
      request.on('timeout',function(){request.destroy();finish({online:false});});request.on('error',function(){finish({online:false});});
    }).then(function(value){inFlight=null;return value;});return inFlight;
  }
  app.get('/api/unified-server',function(req,res){noCache(res);if(!config.enabled)return res.json({name:'연동서버',online:false,max:10});status().then(function(value){res.json(Object.assign({name:'연동서버',max:10},value));});});
  require('./unified-peer-client').install(app,DB,config,{status:status,issuanceDB:issuanceDB,pg:pg,secret:secret});
};
