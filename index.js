exports.register = (server, options, next) => {
  const cache = server.cache({
    segment: 'outputCache',
  });

  const defaults = {
    enabled: (typeof options.enabled === 'boolean') ? options.enabled : true,
    ttl: options.ttl || 60 * 1000,
    key: options.key || function(request) {
      return request.url.href.replace(/.nocache=1/, '');
    }
  };

  server.handler('outputCache', (route, handlerOptions) => (request, reply) => {
    const key = (handlerOptions.key) ? handlerOptions.key(request) : defaults.key(request);

    if (!defaults.enabled) {
      return handlerOptions.fn(request, (response) => {
        const res = reply(response);
        if (res.header) {
          res.header('X-Output-Cache', 'disabled');
        }
      });
    }

    cache.get(key, (getErr, cached) => {
      if (cached && cached.value && request.query.nocache !== 1) {
        server.log(['outputCache', 'hit'], key);
        const response = reply(cached.value);
        if (response.header) {
          response.header('X-Output-Cache', 'hit');
          response.header('X-Output-Cache-Updated', cached.updated);
        }
        return;
      }
      server.log(['outputCache', 'miss'], key);
      handlerOptions.fn(request, (err, response) => {
        if (err) {
          response = err;
        }
        if (response instanceof Error || response.isBoom) {
          server.log(['outputCache', 'error'], key);
          return reply(response);
        }
        const ttl = options.ttl || defaults.ttl;
        const cacheObj = {
          value: response,
          updated: new Date().getTime()
        };
        cache.set(key, cacheObj, ttl, (setErr) => {
          if (setErr) {
            server.log(['outputCache', 'cacheError'], setErr);
          } else {
            server.log(['outputCache', 'set'], key);
          }
          const res = reply(response);
          if (res.header) {
            res.header('X-Output-Cache', 'miss');
            res.header('X-Output-Cache-Updated', cacheObj.updated);
          }
        });
      });
    });
  });
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};
