/**
 *
 */

'use strict';

import $ from 'jquery';

let ListenerModule = {

    registerTouch()
    {
        // TODO wire into MobileWidgetControls.

        // Low-level swipe manipulation
        $(window).on('touchstart', function(ev) {
            let e = ev.originalEvent;
            console.log(e);

            /** Usage:
             *
             * var touches = e.touches;
             * var nbFingers = e.touches.length;
             * var touchObj = e.changedTouches[0];
             * var startX = touchObj.pageX;
             * var startY = touchObj.pageY;
             * var startTime = new Date().getTime();
             *
             */
        });

        $(window).on('touchmove', function(ev) {
            let e = ev.originalEvent;
            console.log(e);

            /** Usage:
             *
             * e.changedTouches[0].pageX;
             * e.changedTouches[0].pageY;
             *
             */
        });

        $(window).on('touchend', function(ev) {
            let e = ev.originalEvent;
            console.log(e);

            /** Example:
             *
             * var touchobj = e.changedTouches[0];
             *
             * var dX = touchobj.pageX - startX; var daX = Math.abs(dX); // px
             * var dY = touchobj.pageY - startY; var daY = Math.abs(dY); // px
             * var elapsedTime = new Date().getTime() - startTime; // get time elapsed
             * var hasSwiped = elapsedTime <= allowedTime;
             *
             * var toRight =   (hasSwiped && daX > threshold && daY <= 100 && dX >= 0);
             * var toLeft =    (hasSwiped && daX > threshold && daY <= 100 && dX < 0);
             * var toTop =     (hasSwiped && daY > threshold && daX <= 100 && dY < 0);
             * var toBottom =  (hasSwiped && daY > threshold && daX <= 100 && dY >= 0);
             *
             */
        });

        // Higher level API
        // $(window).on('tap', function(ev) {console.log(ev);});
        // $(window).on('swipe', function(ev) {console.log(ev);});
        // $(window).on('swipeleft', function(ev) {console.log(ev);});
        // $(window).on('swiperight', function(ev) {console.log(ev);});
    },

    unregisterTouch() {
        $(window).off('touchstart');
        $(window).off('touchend');
        $(window).off('touchmove');

        // $(window).off('tap');
        // $(window).off('swipe');
        // $(window).off('swipeleft');
        // $(window).off('swiperight');
    }

};

export { ListenerModule };
