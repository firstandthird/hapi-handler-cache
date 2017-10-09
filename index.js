'use strict';
const defaults = require('lodash.defaults');
exports.register = (server, passedOptions, next) => {
  const cache = server.cache({
    segment: 'outputCache',
  });

  const defaultOptions = {
    ttl: 60 * 1000,
    key: (request) => request.url.href.replace(/.nocache=1/, '').replace(/.refreshcache=1/, '')
  };
  const options = defaults(defaultOptions, passedOptions);

  server.ext('onPreHandler', (request, reply) => {
    if (!request.route.settings.plugins['hapi-output-cache'] ||
        request.auth.isAuthenticated ||
        request.query.nocache === '1' ||
        request.query.refreshcache === '1'
        ) {
      return reply.continue();
    }
    const key = options.key(request);

    cache.get(key, (getErr, cached) => {
      if (cached && (cached.value || cached.template)) {
        request.outputCache = true;
        // go ahead and return the cached reply instead of continuing:
        let response;
        if (cached.template) {
          response = reply.view(cached.template, cached.context, cached.options);
        } else {
          response = reply(cached.value);
        }
        response.header('X-Output-Cache', 'hit');
        response.header('X-Output-Cache-Updated', cached.updated);
        response.header('X-Output-Cache-Expires', cached.expires);
        return;
      }
      reply.continue();
    });
  });

  server.ext('onPreResponse', (request, reply) => {
    const response = request.response;
    if (!request.route.settings.plugins['hapi-output-cache'] ||
        request.query.nocache === '1') {
      response.header('X-Output-Cache', 'disabled');
      return reply.continue();
    }
    if (request.outputCache) {
      return reply.continue();
    }
    if (response && response.output && response.output.statusCode !== 200) {
      return reply.continue();
    }
    const ttl = request.route.settings.plugins['hapi-output-cache'].ttl || options.ttl;
    const now = new Date().getTime();
    const cacheObj = {
      updated: new Date(),
      expires: new Date(now + ttl)
    };
    if (response.variety === 'view') {
      cacheObj.template = response.source.template;
      cacheObj.context = response.source.context;
      cacheObj.options = response.source.options;
    } else {
      cacheObj.value = response.source;
    }
    const key = options.key(request);
    cache.set(key, cacheObj, ttl, (setErr) => {
      if (setErr) {
        server.log(['outputCache', 'cacheError'], setErr);
      } else {
        server.log(['outputCache', 'set'], key);
      }
    });
    request.response.header('X-Output-Cache', 'miss');
    reply.continue();
  });
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
