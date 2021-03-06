/**
 * Main application routes
 */

'use strict';

import path from 'path';

export default function(app)
{
    // Add routes below
    // app.use('/api/users', require('./api/user'));
    // app.use('/auth', require('./auth').default);

    // All undefined asset or api routes should return a 404
    // app.route('/:url(api|auth|components|app|assets)/*')
    //     .get(function pageNotFound(req, res) {
    //         var viewFilePath = '404';
    //         var statusCode = 404;
    //         var result = {
    //             status: statusCode
    //         };
    //
    //         res.status(result.status);
    //         res.render(viewFilePath, {}, function(err, html) {
    //             if (err) {
    //                 return res.status(result.status).json(result);
    //             }
    //
    //             res.send(html);
    //         });
    //     });

    // All other routes should redirect to the index.html
    app.route('/*')
        .get((req, res) => {
            res.sendFile(path.resolve(`${app.get('appPath')}/index.html`));
        });
}
