/**
 *
 */

'use strict';

App.Model.Client.prototype.triggerEvent = function(type, data) {

    switch(type) {
        case 'm':
            this.triggerMovement(type, data);
            break;
        case 'a':
            this.triggerAction(type, data);
            break;
        case 'r':
            this.triggerRotation(type, data);
            break;
        case 'b':
            this.triggerBlock(type, data);
            break;
        default:
            break;
    }

    // Refresh, count transmitted items, if > threshold, stock them
    this.numberOfEvents++;
};

App.Model.Client.prototype.pushEvents = function() {
    var connectionEngine = this.app.engine.connection;
    var events = this.eventsToPush;
    var currentEvent;

    var maxNumberOfEvents = this.maxNumberOfEventsPer16ms;
    if (this.numberOfEvents > maxNumberOfEvents ) {
        this.filterEvents(); // Remove unnecessary events.
        console.log('Calm down, user...');
    }

    // Push to server
    for (var eventId = 0, length = events.length; eventId < length; ++eventId) {
        currentEvent = events[eventId];
        connectionEngine.send(currentEvent[0], currentEvent[1]);
    }

    // Flush
    this.eventsToPush = [];
    this.numberOfEvents = 0;
};

App.Model.Client.prototype.getEventsOfType = function(type) {
    var events = this.eventsToPush;
    var result = [];

    // N.B. prefer straight cache-friendly traversals
    for (var eventId = 0, length = events.length; eventId < length; ++eventId) {
        var currentEvent = events[eventId];

        if (currentEvent[0] === type) {
            result.push(currentEvent);
        }
    }

    return result;
};


App.Model.Client.prototype.filterEvents = function() {
    var events = this.eventsToPush;
    var filteredEvents = [];
    var lastRotation;

    // Remove all rotations except the last.
    for (var i = 0, l = events.length; i < l; ++i) {
        var currentEvent = events[i];
        if (currentEvent[0] !== 'r') {
            lastRotation = events[i];
        }
        else {
            filteredEvents.push(currentEvent);
        }
    }

    filteredEvents.push(lastRotation);
    this.eventsToPush = filteredEvents;
};
