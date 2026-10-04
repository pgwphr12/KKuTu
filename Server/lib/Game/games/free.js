/**
 * KKuTu - Fool Mode (XBB)
 * Ported for the legacy KKuTu rule engine.
 */
var Const = require('../../const');
var Lizard = require('../../sub/lizard');
var DIC;

const ROBOT_START_DELAY = [1200, 800, 400, 200, 0];
const ROBOT_TYPE_COEF = [1250, 750, 500, 250, 0];
const ROBOT_THINK_COEF = [4, 2, 1, 0, 0];

exports.init = function(_DB, _DIC){
    DIC = _DIC;
};

exports.getTitle = function(){
    var R = new Lizard.Tail();
    setTimeout(function(){ R.go("①②③④⑤⑥⑦⑧⑨⑩"); }, 10);
    return R;
};

exports.roundReady = function(){
    var my = this;
    clearTimeout(my.game.turnTimer);
    clearTimeout(my.game.robotTimer);
    my.game.round++;
    my.game.roundTime = my.time * 1000;
    my.game.chain = [];

    if(my.game.round <= my.round){
        if(my.opts.mission) my.game.mission = getMission();
        else delete my.game.mission;

        my.byMaster('roundReady', {
            round: my.game.round,
            mission: my.game.mission
        }, true);
        my.game.turnTimer = setTimeout(my.turnStart, 2400);
    }else{
        my.roundEnd();
    }
};

exports.turnStart = function(force){
    var my = this;
    var speed, si;

    if(!my.game.chain) return;
    my.game.roundTime = Math.min(my.game.roundTime, Math.max(10000, 150000 - my.game.chain.length * 1500));
    speed = my.getTurnSpeed(my.game.roundTime);
    clearTimeout(my.game.turnTimer);
    clearTimeout(my.game.robotTimer);
    my.game.late = false;
    my.game.loading = false;
    my.game.turnTime = 15000 - 1400 * speed;
    my.game.turnAt = (new Date()).getTime();

    my.byMaster('turnStart', {
        turn: my.game.turn,
        speed: speed,
        roundTime: my.game.roundTime,
        turnTime: my.game.turnTime,
        mission: my.game.mission,
        seq: force ? my.game.seq : undefined
    }, true);

    my.game.turnTimer = setTimeout(my.turnEnd, Math.min(my.game.roundTime, my.game.turnTime + 100));
    if(si = my.game.seq[my.game.turn]) if(si.robot){
        si._done = [];
        my.readyRobot(si);
    }
};

exports.turnEnd = function(){
    var my = this;
    var target, score = 0;

    if(!my.game.seq) return;
    target = DIC[my.game.seq[my.game.turn]] || my.game.seq[my.game.turn];

    if(my.game.loading){
        clearTimeout(my.game.turnTimer);
        my.game.turnTimer = setTimeout(my.turnEnd, 100);
        return;
    }
    clearTimeout(my.game.turnTimer);
    my.game.late = true;

    if(target && target.game){
        score = Const.getPenalty(my.game.chain, target.game.score);
        target.game.score += score;
    }

    my.byMaster('turnEnd', {
        ok: false,
        target: target ? target.id : null,
        score: score
    }, true);
    my.game._rrt = setTimeout(my.roundReady, 3000);
    clearTimeout(my.game.robotTimer);
};

exports.submit = function(client, text){
    var my = this;
    var tv = (new Date()).getTime();
    var mgt = my.game.seq && my.game.seq[my.game.turn];
    var t, score, bonus = 0;

    if(!mgt) return;
    if(!mgt.robot){
        if(mgt != client.id) return;
    }else if(!client.robot || mgt.id != client.id){
        return;
    }
    if(my.game.late || !my.game.chain) return;
    if(typeof text !== 'string' || !text.trim().length) return;

    // 브라우저/DB 계층의 문자열 처리 문제를 피하기 위해 surrogate(이모지 등)는 거부한다.
    if(/[\uD800-\uDFFF]/.test(text)){
        return client.publish('turnError', { code: 404, value: text }, true);
    }

    // XBB는 DB 검사, 끝말 검사, 중복 검사를 하지 않는다.
    my.game.loading = false;
    my.game.late = true;
    clearTimeout(my.game.turnTimer);
    t = tv - my.game.turnAt;
    score = my.getScore(text, t);
    if(my.game.mission === true){
        bonus = score - my.getScore(text, t, true);
    }

    my.game.chain.push(text);
    my.game.roundTime -= t;
    client.game.score += score;

    client.publish('turnEnd', {
        ok: true,
        value: text,
        mean: "",
        theme: "",
        wc: "unknown",
        score: score,
        bonus: bonus,
        baby: 0
    }, true);

    if(my.game.mission === true){
        my.game.mission = getMission();
    }
    setTimeout(my.turnNext, my.game.turnTime / 6);
};

exports.getScore = function(text, delay, ignoreMission){
    var my = this;
    var tr = 1 - delay / my.game.turnTime;
    var score, arr;

    if(!text || !my.game.chain) return 0;
    score = Const.getPreScore(text, my.game.chain, tr);

    if(!ignoreMission && my.game.mission){
        arr = text.match(new RegExp(escapeRegExp(my.game.mission), 'g'));
        if(arr && arr.length){
            score += score * 0.5 * arr.length;
            my.game.mission = true;
        }
    }
    return Math.round(score);
};

exports.readyRobot = function(robot){
    var my = this;
    var level = Math.max(0, Math.min(4, robot.level || 0));
    var delay = ROBOT_START_DELAY[level];
    var pool = Const.MISSION_XBB;
    var len;

    switch(level){
        case 0: len = 2 + Math.floor(Math.random() * 2); break;
        case 1: len = 3 + Math.floor(Math.random() * 3); break;
        case 2: len = 5 + Math.floor(Math.random() * 4); break;
        case 3: len = 8 + Math.floor(Math.random() * 7); break;
        default: len = 12 + Math.floor(Math.random() * 9); break;
    }

    var chars = [];
    for(var i=0; i<len; i++) chars.push(pool[Math.floor(Math.random() * pool.length)]);
    if(my.game.mission && chars.indexOf(my.game.mission) === -1){
        chars[Math.floor(Math.random() * chars.length)] = my.game.mission;
    }
    var text = chars.join('');
    delay += 300 * ROBOT_THINK_COEF[level] + text.length * ROBOT_TYPE_COEF[level];
    if(robot._done) robot._done.push(text);
    my.game.robotTimer = setTimeout(my.turnRobot, Math.max(100, delay), robot, text);
};

function getMission(){
    return Const.MISSION_XBB[Math.floor(Math.random() * Const.MISSION_XBB.length)];
}
function escapeRegExp(v){
    return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
