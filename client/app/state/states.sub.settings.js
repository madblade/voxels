/**
 *
 */

'use strict';

App.State.StateManager.prototype.registerSettings = function() {
    this.registerState('settings', this.startSettings, this.endSettings);
};

App.State.StateManager.prototype.startSettings = function() {
    var app = this.app;

    // HTML menu getters.
    var homeHTML = function() {
        return '<table class="table table-bordered" style="width:100%" class="noselect">' +
            '<tr id="graphics"><td>Graphics</td></tr>' +
            '<tr id="gameplay"><td>Gameplay</td></tr>' +
            '<tr id="sound"><td>Sound</td></tr>' +
            '<tr id="return"><td>Return</td></tr>' +
            '</table>';
    };

    var graphicsHTML = function() {
        // TODO decouple
        var settings = app.engine.graphics.settings;
        var content = '<table class="table table-bordered" style="width:100%" class="noselect">';
        for (var s in settings) {
            content +='<tr><td>' + settings[s] + '</td></tr>';
        }
        content += '<tr id="return"><td>Return</td></tr>';
        content += '</table>';
        return content;
    };

    var gameplayHTML = function() {
        // TODO decouple
        var settings = app.engine.controls.settings;
        var content = '<table class="table table-bordered" style="width:100%" class="noselect">';

        if (settings.hasOwnProperty('language')) {
            var language =  '<select id="language" class="form-control">' +
                '<option value="default">Choose your layout:</option>' +
                '<option value="en">en</option>' +
                '<option value="fr">fr</option>' +
                '</select>';

            content +='<tr><td>Keyboard layout</td>' + '<td>' + language + '</td></tr>';
        }

        content += '<tr id="return"><td colspan="2">Return</td></tr>';
        content += '</table>';

        return content;
    };

    var soundHTML = function() {
        // TODO decouple
        var settings = app.engine.audio.settings;
        var content = '<table class="table table-bordered" style="width:100%" class="noselect">';
        content += '<tr id="return"><td>Return</td></tr>';
        for (var s in settings) {
            content +='<tr><td>' + settings[s] + '</td></tr>';
        }
        content += '</table>';
        return content;
    };

    // Menu navigators.
    var goGraphics = function() {
        unlistenHome();
        $("#announce").empty().append(graphicsHTML());
        listenReturn();
    };
    var goGameplay = function() {
        unlistenHome();
        $("#announce").empty().append(gameplayHTML());
        listenReturn();
        var l = $('#language');
        l.change(function() {
            var selected = l.find('option:selected').val();
            // TODO decouple
            app.engine.controls.changeLayout(selected, true); // Don't restart listeners.
            l.off('change');
        });
    }.bind(this);
    var goSound = function() {
        unlistenHome();
        $("#announce").empty().append(soundHTML());
        listenReturn();
    };

    // Listeners.
    var listenReturn = function() {
        $('#return').click(function() {
            $('#return').off('click');
            var content = homeHTML();
            $("#announce").empty().append(content);
            listenHome();
        });
    };
    var listenHome = function() {
        $('#graphics').click(function() { goGraphics(); }.bind(this));
        $('#gameplay').click(function() { goGameplay(); }.bind(this));
        $('#sound').click(function() { goSound(); }.bind(this));
        $('#return').click(function() {
            $(document).off('keydown');
            unlistenHome();
            app.state.setState('ingame');
            // TODO decouple
            app.engine.controls.requestPointerLock();

        }.bind(this));
    };
    var unlistenHome = function() {
        $('#graphics').off('click');
        $('#gameplay').off('click');
        $('#sound').off('click');
    };

    // Add content, then fade in and add listeners.
    $("#announce").addClass('settings').append(homeHTML()).fadeIn();
    listenHome();

    $(document).keydown(function(event) {
        if (!event.keyCode) { return; }
        // TODO decouple
        if (event.keyCode === app.engine.controls.keyControls.escape) {
            // Remove listeners and get away from the bike.
            $(document).off('keydown');
            unlistenHome();
            this.setState('ingame');
        }
    }.bind(this));
};

App.State.StateManager.prototype.endSettings = function() {
    // Fade out settings menu.
    return new Promise(function(resolve) {
        var settings = $("#announce");
        settings.fadeOut(200, function() {
            settings.empty().removeClass('settings');
            resolve();
        });
    });
};
