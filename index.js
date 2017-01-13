const defaults = require('lodash.defaults');
exports.register = (server, passedOptions, next) => {
  const cache = server.cache({
    segment: 'outputCache',
  });

  const defaultOptions = {
    enabled: true,
    ttl: 60 * 1000,
    key: (request) => request.url.href.replace(/.nocache=1/, '')
  };
  const options = defaults(defaultOptions, passedOptions);

  server.ext('onPreHandler', (request, reply) => {
    if (request.route.settings.plugins['hapi-output-cache'] && options.enabled) {
      const key = options.key(request);
      cache.get(key, (getErr, cached) => {
        if (cached && cached.value && request.query.nocache !== 1) {
          server.log(['outputCache', 'hit'], key);
          // stub the handler so our response is not overwitten:
          console.log(request.route)
          // const response = reply(cached.value);
          // response.header('X-Output-Cache', 'hit')
          // response.header('X-Output-Cache-Updated', cache.updated);
          request.response.headers['X-Output-Cache'] = 'hit';
          return reply(cached.value);
        }
        server.log(['outputCache', 'miss'], key);
        reply.continue();
      });
    } else {
      return request.route.settings.handler(request, (response) => {
        const res = reply(response);
        if (res.header) {
          res.header('X-Output-Cache', 'disabled');
        }
      });
    }
  });
  server.ext('onPostHandler', (request, reply) => {
    console.log(request.response.headers);
    console.log(reply.headers)
    if (request.route.settings.plugins['hapi-output-cache'] && options.enabled && request.response.headers['x-output-cache'] !== 'hit') {
      const cacheObj = {
        value: request.response.source,
        updated: new Date().getTime()
      };
      cache.set(options.key(request), cacheObj, options.ttl, (setErr) => {
        if (setErr) {
          server.log(['outputCache', 'cacheError'], setErr);
        } else {
          server.log(['outputCache', 'set'], options.key);
        }
        request.response.headers['X-Output-Cache'] = 'miss';
        request.response.headers['X-Output-Cache-Updated'] = cacheObj.updated;
        reply.continue();
      });
    }
  });
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
