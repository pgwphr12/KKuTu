/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * 볕뉘 수정사항:
 * Login 을 Passport 로 수행하기 위한 수정
 */

var WS		 = require("ws");
var Express	 = require("express");
var Exession = require("express-session");
var Redission= require("connect-redis")(Exession);
var Redis	 = require("redis");
var Parser	 = require("body-parser");
var DDDoS	 = require("dddos");
var Server	 = Express();
var DB		 = require("./db");
//볕뉘 수정 구문삭제 (28)
var JLog	 = require("../sub/jjlog");
var WebInit	 = require("../sub/webinit");
var GLOBAL	 = require("../sub/global.json");
var Secure = require('../sub/secure');
//볕뉘 수정
var passport = require('passport');
//볕뉘 수정 끝
var Const	 = require("../const");
var https	 = require('https');
var fs		 = require('fs');
var path	 = require('path');
var Net      = require('net');

var Language = {
	'ko_KR': require("./lang/ko_KR.json"),
	'en_US': require("./lang/en_US.json")
};
//볕뉘 수정
var ROUTES = [
	"major", "consume", "admin", "login"
];
//볕뉘 수정 끝
var page = WebInit.page;
var gameServers = [];

WebInit.MOBILE_AVAILABLE = [
	"portal", "main", "kkutu"
];

require("../sub/checkpub");

JLog.info("<< KKuTu Web >>");
Server.set('views', __dirname + "/views");
Server.set('view engine', "pug");
// Cloudflare/WAF: trust X-Forwarded-Proto so req.protocol reflects the visitor-facing HTTPS connection.
Server.set("trust proxy", process.env.KKUTU_TRUST_PROXY === "1" ? 1 : false);
Server.use(function(req, res, next){
	if(Const.WAF && process.env.KKUTU_TRUST_CF_IP_HEADER === "1" && req.headers['cf-connecting-ip']){
		Object.defineProperty(req, 'ip', { value: req.headers['cf-connecting-ip'], configurable: true });
	}
	next();
});
Server.use(Express.static(__dirname + "/public"));
Server.use(Parser.urlencoded({ extended: true }));
// Use a deployment-specific session secret. Without one, generate an ephemeral strong secret.
// Set KKUTU_SESSION_SECRET in production so sessions survive restarts.
var KKUTU_SESSION_SECRET = process.env.KKUTU_SESSION_SECRET || require('crypto').randomBytes(48).toString('hex');
if(!process.env.KKUTU_SESSION_SECRET) console.warn('[KKuTu] KKUTU_SESSION_SECRET is unset: using an ephemeral secret.');
Server.use(Exession({
	/* use only for redis-installed

	store: new Redission({
		client: Redis.createClient(),
		ttl: 3600 * 12
	}),*/
	secret: KKUTU_SESSION_SECRET,
	resave: false,
	saveUninitialized: true
}));
//볕뉘 수정
Server.use(passport.initialize());
Server.use(passport.session());
Server.use((req, res, next) => {
	if(req.session.passport) {
		delete req.session.passport;
	}
	next();
});
Server.use((req, res, next) => {
	if(Const.IS_SECURED || Const.WAF) {
		if(req.protocol == 'http') {
			let url = 'https://'+req.get('host')+req.path;
			res.status(302).redirect(url);
		} else {
			next();
		}
	} else {
		next();
	}
});
//볕뉘 수정 끝
/* use this if you want

DDDoS = new DDDoS({
	maxWeight: 6,
	checkInterval: 10000,
	rules: [{
		regexp: "^/(cf|dict|gwalli)",
		maxWeight: 20,
		errorData: "429 Too Many Requests"
	}, {
		regexp: ".*",
		errorData: "429 Too Many Requests"
	}]
});
DDDoS.rules[0].logFunction = DDDoS.rules[1].logFunction = function(ip, path){
	JLog.warn(`DoS from IP ${ip} on ${path}`);
};
Server.use(DDDoS.express());*/

WebInit.init(Server, true);
DB.ready = function(){
	setInterval(function(){
		var q = [ 'createdAt', { $lte: Date.now() - 3600000 * 12 } ];

		DB.session.remove(q).on();
	}, 600000);
	setInterval(function(){
		gameServers.forEach(function(v){
			if(v.socket) v.socket.send(`{"type":"seek"}`);
			else v.seek = undefined;
		});
	}, 4000);
	JLog.success("DB is ready.");

	DB.kkutu_shop_desc.find().on(function($docs){
		var i, j;

		for(i in Language) flush(i);
		function flush(lang){
			var db;

			Language[lang].SHOP = db = {};
			for(j in $docs){
				db[$docs[j]._id] = [ $docs[j][`name_${lang}`], $docs[j][`desc_${lang}`] ];
			}
		}
	});
if(Const.IS_SECURED || Const.WAF) {
	const options = Secure();
	const edgePort = Const.EDGE_PORT || 443;
	const HTTPS_Server = https.createServer(options, Server);
	if(Const.WAF_GATEWAY) attachWafGateway(HTTPS_Server);
	HTTPS_Server.listen(edgePort, function(){
		JLog.success(`Web HTTPS/WSS gateway listening on ${edgePort}`);
	});
} else {
	Server.listen(Const.MAIN_PORTS[0]);
}
};

// 포트 번호로 서버를 찾기 위한 안전한 보조 객체 선언
if (typeof gameServersMap === 'undefined') {
    var gameServersMap = {};
}

Const.MAIN_PORTS.forEach(function(v, i){
	var serverKey = v.toString();
	var masterPort = (Const.MASTER_PORTS && Const.MASTER_PORTS[i]) || v;
	// WAF_GATEWAY에서는 외부 TLS를 443에서 종료하고 내부 게임 서버에는 plain WS로 연결한다.
	var protocol = Const.WAF_GATEWAY ? 'ws' : ((Const.IS_SECURED || Const.WAF) ? 'wss' : 'ws');
	var clientObj = new GameClient(serverKey, `${protocol}://${GLOBAL.GAME_SERVER_HOST}:${masterPort}/${serverKey}`);
	gameServers[i] = clientObj;
	gameServersMap[v] = clientObj;
	gameServersMap[serverKey] = clientObj;
});

function GameClient(id, url){
    var my = this;

    my.id = id;
    my.socket = new WS(url, { perMessageDeflate: false, rejectUnauthorized: false });
// ... 하단 코드 ...

	my.send = function(type, data){
		if(!data) data = {};
		data.type = type;

		my.socket.send(JSON.stringify(data));
	};
	my.socket.on('open', function(){
		JLog.info(`Game server #${my.id} connected`);
	});
	my.socket.on('error', function(err){
		JLog.warn(`Game server #${my.id} has an error: ${err.toString()}`);
	});
	my.socket.on('close', function(code){
		JLog.error(`Game server #${my.id} closed: ${code}`);
		my.socket.removeAllListeners();
		delete my.socket;
	});
	my.socket.on('message', function(data){
		var _data = data;
		var i;

		data = JSON.parse(data);

		switch(data.type){
			case "seek":
				my.seek = data.value;
				break;
			case "narrate-friend":
				for(i in data.list){
					gameServers[i].send('narrate-friend', { id: data.id, s: data.s, stat: data.stat, list: data.list[i] });
				}
				break;
			default:
		}
	});
}
// Cloudflare orange-cloud single-port gateway.
// Browser -> Cloudflare -> :443 only. Master/Room sockets stay on local internal ports.
function attachWafGateway(edgeServer){
	edgeServer.on('upgrade', function(req, socket, head){
		var rawUrl = req.url || '/';
		var clean = rawUrl.charAt(0) === '/' ? rawUrl.slice(1) : rawUrl;
		var amp = clean.split('&');
		var isRoom = amp.length >= 3;
		var chan = isRoom ? Number(amp[1]) : 0;
		var targetPort;

		if(isRoom){
			if(!chan || chan < 1){
				socket.destroy();
				return;
			}
			targetPort = Number(Const.ROOM_PORTS[0]) + chan - 1;
		}else{
			targetPort = Number((Const.MASTER_PORTS && Const.MASTER_PORTS[0]) || Const.MAIN_PORTS[0]);
		}

		var upstream = Net.connect({ host: GLOBAL.GAME_SERVER_HOST, port: targetPort }, function(){
			var requestLine = req.method + ' ' + rawUrl + ' HTTP/' + req.httpVersion + '\r\n';
			var headers = '';
			for(var i=0; i<req.rawHeaders.length; i += 2){
				headers += req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1] + '\r\n';
			}
			upstream.write(requestLine + headers + '\r\n');
			if(head && head.length) upstream.write(head);
			socket.pipe(upstream);
			upstream.pipe(socket);
		});

		upstream.on('error', function(err){
			JLog.warn('WAF gateway upstream error :' + targetPort + ' ' + err.toString());
			try { socket.destroy(); } catch(e) {}
		});
		socket.on('error', function(){
			try { upstream.destroy(); } catch(e) {}
		});
	});
}

require('./unified-server').install(Server, DB, {});
ROUTES.forEach(function(v){
	require(`./routes/${v}`).run(Server, WebInit.page);
});
Server.get("/", function(req, res){
	var server = req.query.server;
	var wantsGame = (server !== undefined && Const.MAIN_PORTS[server]);

	DB.session.findOne([ '_id', req.session.id ]).on(function($ses){
		// DB 세션이 잠깐 누락되어도 Express 로그인 세션이 살아 있으면
		// 로그인 사용자를 게스트로 떨어뜨리지 않고 즉시 복구한다.
		if(!$ses && req.session.profile && req.session.profile.id){
			var profile = req.session.profile;
			profile.sid = req.session.id;

			return DB.session.upsert([ '_id', req.session.id ]).set({
				'profile': profile,
				'createdAt': Date.now()
			}).on(function(){
				onFinish({ _id: req.session.id, profile: profile });
			});
		}

		if(global.isPublic){
			onFinish($ses);
		}else{
			if($ses && $ses.profile) $ses.profile.sid = $ses._id;
			onFinish($ses);
		}
	});

	function onFinish($doc){
		var id = req.session.id;
		var authenticated = !!($doc && $doc.profile && $doc.profile.id && !$doc.profile.guest && !$doc.profile.federationGuest && !/^guest:/.test($doc.profile.id));
		var loginRequired = wantsGame && !authenticated;
		if(loginRequired) return res.redirect(303, "/login");

		if(authenticated){
			$doc.profile.sid = req.session.id;
			req.session.profile = $doc.profile;
			id = req.session.id;
		}else{
			delete req.session.profile;

			// The game master already assigns a guest identity to this session.
		}

		// 로그인 사용자는 정상적으로 kkutu 화면을 렌더링한다.
		page(req, res, wantsGame ? "kkutu" : "portal", {
			'_page': "kkutu",
			'loginRequired': loginRequired,
			'authenticated': authenticated,
			'_id': id,
			'PORT': Const.WAF_GATEWAY ? (Const.EDGE_PORT || 443) : ((Const.MASTER_PORTS && Const.MASTER_PORTS[server]) || Const.MAIN_PORTS[server]),
			'ROOM_PORT': Const.WAF_GATEWAY ? (Const.EDGE_PORT || 443) : Const.ROOM_PORTS[server],
			'HOST': req.hostname,
			'PROTOCOL': Const.IS_SECURED || Const.WAF ? 'wss' : 'ws',
			'TEST': req.query.test,
			'MOREMI_PART': Const.MOREMI_PART,
			'AVAIL_EQUIP': Const.AVAIL_EQUIP,
			'CATEGORIES': Const.CATEGORIES,
			'GROUPS': Const.GROUPS,
			'MODE': Const.GAME_TYPE,
			'RULE': Const.RULE,
			'OPTIONS': Const.OPTIONS,
			'KO_INJEONG': Const.KO_INJEONG,
			'EN_INJEONG': Const.EN_INJEONG,
			'KO_THEME': Const.KO_THEME,
			'EN_THEME': Const.EN_THEME,
			'IJP_EXCEPT': Const.IJP_EXCEPT,
			'ogImage': (process.env.KKUTU_PUBLIC_URL || "https://example.com")+"/img/kkutu/logo.png",
			'ogURL': (process.env.KKUTU_PUBLIC_URL || "https://example.com")+"/",
			'ogTitle': "글자로 놀자! 파얼끄투",
			'ogDescription': "끝말잇기가 이렇게 박진감 넘치는 게임이었다니!"
		});
	}
});

// 사운드팩 목록: /media/kkutu/<팩이름>/ 폴더를 자동 탐색
Server.get("/soundpacks", function(req, res){
	var baseDir = path.join(__dirname, "public", "media", "kkutu");
	fs.readdir(baseDir, function(err, files){
		if(err) return res.send([]);
		var dirs = files.filter(function(name){
			try { return fs.statSync(path.join(baseDir, name)).isDirectory(); }
			catch(e) { return false; }
		});
		var packs = dirs.map(function(name){
			var dir = path.join(baseDir, name);
			var packFiles = [];
			try { packFiles = fs.readdirSync(dir); } catch(e) {}
			return { name: name, files: packFiles };
		});
		res.send(packs);
	});
});

Server.get("/servers", function(req, res){
	var list = [];

	gameServers.forEach(function(v, i){
		list[i] = v.seek;
	});
	res.send({ list: list, max: Const.KKUTU_MAX });
});

//볕뉘 수정 구문 삭제(274~353)

Server.get("/legal/:page", function(req, res){
	page(req, res, "legal/"+req.params.page);
});
