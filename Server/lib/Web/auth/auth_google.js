const config = require('../../sub/auth.json');

module.exports.config = {
    strategy: require('passport-google-oauth20').Strategy,
    color: '#FFFFFF',
    fontColor: '#000000',
    vendor: 'google',
    displayName: 'withGoogle'
};

module.exports.strategyConfig = {
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
    passReqToCallback: true,
    scope: ['openid', 'profile', 'email']
};

module.exports.strategy = (process, MainDB, Ajae) => {
    return (req, accessToken, refreshToken, profile, done) => {
        const $p = {};

        $p.authType = 'google';
        $p.id = profile.id;

        const name = profile.name || {};
        $p.name = [
            name.familyName,
            name.givenName
        ].filter(Boolean).join(' ') || profile.displayName || 'Google User';

        $p.title = profile.nickname || profile.displayName || $p.name;
        $p.image = profile.photos?.[0]?.value || '';

        process(req, accessToken, MainDB, $p, done);
    };
};