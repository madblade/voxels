/**
 * Keeps track of distant users that can connect to the local server.
 * Used when the local server is running.
 */

'use strict';

import extend       from '../../extend.js';

let LocalServer = function(app) {
    this.app = app;
    this.users = new Map();

    this.localClientOffer = '';
    this.localClientAnswer = '';
};

extend(LocalServer.prototype, {

    hasUser(userID) {
        return this.users.has(userID);
    },

    addUser(userID) {
        this.users.set(userID, {
            offer: '',
            answer: '',
            inboundConnection: null,
            inboundChannel: null
        });
    },

    removeUser(userID) {
        this.users.delete(userID);
    },

    // Server offer
    setUserOffer(userID, offer) {
        let user = this.users.get(userID);
        if (!user) {
            this.users.set(userID, {
                offer,
                answer: '',
                inboundConnection: null,
                inboundChannel: null
            });
        } else {
            user.offer = offer;
        }
    },

    setUserConnection(userID, connection) {
        let user = this.users.get(userID);
        if (!user) {
            console.error(`[Model/LocalServer] User "${userID}" not found.`);
            return;
        }
        user.inboundConnection = connection;
    },

    getUser(userID) {
        return this.users.get(userID);
    },

    // Client answer
    addAnswer(userID, answer) {
        let user = this.users.get(userID);
        if (!user) {
            console.error(`[Model/LocalServer] User "${userID}" not found.`);
            return;
        }
        user.answer = answer;
    },

    // WebRTC Client methods
    setLocalClientOffer(offer) {
        this.localClientOffer = offer;
    },

    setLocalClientAnswer(answer) {
        this.localClientAnswer = answer;
    }
});

export { LocalServer };
