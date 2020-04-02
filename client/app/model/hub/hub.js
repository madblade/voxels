/**
 * Keeps track of active server games.
 */

'use strict';

import extend       from '../../extend.js';

let Hub = function(app) {
    this.app = app;
    this.games = new Map();
};

extend(Hub.prototype, {

    update(data) {
        console.log(`Hub: ${data}`);
        data = JSON.parse(data);

        let map = this.games;

        // For all kinds.
        for (let property in data) {
            let games = data[property];
            let thisGames = map.get(property);

            if (!thisGames) {
                map.set(property, games);
            } else {
                // Reset games.
                thisGames.empty();
                for (let id = 0; id < games.length; ++id) {
                    let g = games[id];
                    if (thisGames.indexOf(g) < 0) thisGames.push(g);
                }
            }
        }

        this.enterHub();
    },

    enterHub() {
        let app = this.app;
        let map = this.games;
        app.setState('hub', map);
        // if (app.isLoading()) {
        // Update state.
        // } else if (app.getState() === 'hub') {
        // Bypass endHub.
        // app.setState('hub', map);
        // }
    }

});

export { Hub };
