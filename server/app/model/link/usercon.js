/**
 *
 */

'use strict';

class UserConnection {

    constructor(user, socket) {
        this._user = user;
        this._socket = socket;

        this.listen();
    }

    // Model
    get user() { return this._user; }
    set user(user) { this._user = user; }
    get socket() { return this._socket; }

    send(kind, data) {
        this._socket.emit(kind, data);
    }

    /**
     * Game & hub management
     */
    listen() {
        // Use a unique channel for util functions
        // Actions are specified within the data
        this._socket.on('util', this.onUserRequest.bind(this));
    }

    // Drawback: switch potentially evaluates all statements
    // Advantage: does not loads the socket with many listeners
    onUserRequest(data) {
        switch (data.request) {

            // A user can ask the hub for a new game to be created.
            case 'createGame':
                if (data.hasOwnProperty('gameType')) this.handleCreateGame(data.gameType);
                break;

            // A user can join a specific game (given a kind and id).
            case 'joinGame':
                if (data.hasOwnProperty('gameId')) this.handleJoinGame(data.gameId);
                break;

            // A user can ask for the list of all available games.
            case 'hub':
                this.handleGetHubState();
                break;
        }
    }

    handleCreateGame(kind) {
        var gameId = this._user.requestNewGame(kind);
        if (gameId) this._user.join(kind, gameId);
    }

    handleJoinGame(data) {
        if (!data.kind || !data.gameId) return;
        this._user.join(data.kind, data.gameId);
    }

    handleGetHubState() {
        this._user.fetchHubState();
    }

    idle() {
        this._socket.off('util', this.onUserRequest.bind(this));
    }

    // Clean references.
    destroy() {
        this.idle();
        delete this._user;
        delete this._socket;
    }

}

export default UserConnection;
