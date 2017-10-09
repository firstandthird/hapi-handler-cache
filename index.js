const aug = require('aug');
exports.register = (server, passedOptions, next) => {
  const cache = server.cache({
    segment: 'outputCache',
  });

  const defaultOptions = {
    ttl: 60 * 1000,
    key: (request) => request.url.href.replace(/.nocache=1/, '').replace(/.refreshcache=1/, '')
  };
  const options = aug(defaultOptions, passedOptions);

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
      if (cached && cached.value) {
        request.outputCache = true;
        // go ahead and return the cached reply instead of continuing:
        const response = reply(cached.value);
        response.header('X-Output-Cache', 'hit');
        response.header('X-Output-Cache-Updated', cached.updated);
        response.header('X-Output-Cache-Expires', cached.expires);
        return;
      }
      reply.continue();
    });
  });

  const getCacheObj = function(request, response, ttl, done) {
    const now = new Date().getTime();
    const cacheObj = {
      updated: new Date(),
      expires: new Date(now + ttl)
    };
    if (response.variety === 'view') {
      //render so we can store the output html in cache
      request.render(response.source.template, response.source.context, response.source.options, (err, rendered, config) => {
        if (err) {
          return done(err);
        }
        cacheObj.value = rendered;
        done(null, cacheObj);
      });
      return;
    }
    cacheObj.value = response.source;
    done(null, cacheObj);
  };

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
    const key = options.key(request);
    getCacheObj(request, response, ttl, (err, cacheObj) => {
      if (err) {
        return server.log(['outputCache', 'renderError'], err);
      }
      cache.set(key, cacheObj, ttl, (setErr) => {
        if (setErr) {
          server.log(['outputCache', 'cacheError'], setErr);
        } else {
          server.log(['outputCache', 'set'], key);
        }
      });
    });
    request.response.header('X-Output-Cache', 'miss');
    reply.continue();
  });
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
