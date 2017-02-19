'use strict';
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
      if (!request.plugins) {
        request.plugins = {};
      }
      request.plugins.outputCache = {};
      cache.get(key, (getErr, cached) => {
        if (cached && cached.value && request.query.nocache !== 1) {
          server.log(['outputCache', 'hit'], key);
          // set the cached values in the plugin field:
          request.plugins.outputCache['X-Output-Cache'] = 'hit';
          request.plugins.outputCache['X-Output-Cache-Updated'] = cached.updated;
          // go ahead and return the cached reply instead of continuing:
          return reply(cached.value);
        }
        request.plugins.outputCache['X-Output-Cache'] = 'miss';
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
  server.ext('onPreResponse', (request, reply) => {
    if (!request.route.settings.plugins['hapi-output-cache'] || !options.enabled || !request.plugins.outputCache) {
      return reply.continue();
    }
    // if a cached value was found notify the browser:
    if (request.plugins.outputCache['X-Output-Cache'] === 'hit') {
      request.response.headers['X-Output-Cache'] = 'hit';
      request.response.headers['X-Output-Cache-Updated'] = request.plugins.outputCache['X-Output-Cache-Updated'];
      return reply.continue();
    }
    // otherwise set the output as the new cached value:
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
  });
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
