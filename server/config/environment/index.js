'use strict';

var path = require('path');
var _ = require('lodash');

// All configurations will extend these options
// ============================================
var all = {
    env: process.env.NODE_ENV,

    // Root path of server
    // root: path.normalize(__dirname + '/../../..'),
    root: path.normalize(path.join(__dirname, '/../../..')),

    // Server port
    port: process.env.PORT || 8080,

    // Server IP
    ip: process.env.IP || '127.0.0.1',

    // Should we populate the DB with sample data?
    seedDB: false,

    // Secret for session, you will want to change this and make it an environment variable
    secrets: {
        session: 'app-secret' // Must gen secret
    }
};

// Export the config object based on the NODE_ENV
// ==============================================
module.exports = _.merge(
    all,
    //require('./shared'),
    require(`./${process.env.NODE_ENV}.js`) || {}
);
