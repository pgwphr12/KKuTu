const config = require('../../sub/auth.json');
const axios = require('axios');
const OAuth2Strategy = require('passport-oauth2').Strategy;

// passport-oauth2의 기본 전략 이름은 "oauth2"이므로,
// 이 서버의 /login/roblox 라우트와 맞도록 이름을 "roblox"로 고정한다.
class RobloxOAuth2Strategy extends OAuth2Strategy {
    constructor(options, verify) {
        super(options, verify);
        this.name = 'roblox';
    }
}

module.exports.config = {
    strategy: RobloxOAuth2Strategy,
    color: '#00A2FF',
    fontColor: '#FFFFFF',
    vendor: 'roblox',
    displayName: 'withRoblox'
};

module.exports.strategyConfig = {
    clientID: config.roblox.clientID,
    clientSecret: config.roblox.clientSecret,
    callbackURL: config.roblox.callbackURL,

    // Roblox OAuth 2.0 / OpenID Connect 공식 엔드포인트
    authorizationURL: 'https://apis.roblox.com/oauth/v1/authorize',
    tokenURL: 'https://apis.roblox.com/oauth/v1/token',

    passReqToCallback: true,
    scope: ['openid', 'profile']
};

module.exports.strategy = (process, MainDB, Ajae) => {
    return (req, accessToken, refreshToken, profile, done) => {
        axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            timeout: 10000
        }).then((response) => {
            const profile = response.data || {};

            if (!profile.sub) {
                const error = new Error('Roblox UserInfo 응답에 sub가 없습니다.');
                error.responseData = profile;
                return done(error);
            }

            const $p = {};

            $p.authType = 'roblox';
            $p.id = 'roblox-' + profile.sub;
            $p.name = profile.preferred_username || profile.name || profile.nickname || ('Roblox-' + profile.sub);
            $p.title = $p.name;
            $p.image = profile.picture || '';

            process(req, accessToken, MainDB, $p, done);
        }).catch((error) => {
            const detail = error.response
                ? {
                    status: error.response.status,
                    data: error.response.data
                }
                : error.message;

            console.error('Roblox UserInfo 요청 실패:', detail);
            return done(error);
        });
    };
};
