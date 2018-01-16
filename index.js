const register = (server, passedOptions) => {
  const cache = server.cache({
    segment: 'outputCache',
  });

  const defaultOptions = {
    ttl: 60 * 1000,
    key: (request) => request.url.href.replace(/.nocache=1/, '').replace(/.refreshcache=1/, '')
  };
  const options = Object.assign({}, defaultOptions, passedOptions);

  server.ext('onPreHandler', async(request, h) => {
    if (!request.route.settings.plugins['hapi-output-cache'] ||
        request.auth.isAuthenticated ||
        request.query.nocache === '1' ||
        request.query.refreshcache === '1'
        ) {
      return h.continue;
    }
    const key = options.key(request);
    const cached = await cache.get(key);
    if (cached && cached.value) {
      request.outputCache = true;
      // go ahead and return the cached reply instead of continuing:
      const response = h.response(cached.value);
      response.header('X-Output-Cache', 'hit');
      response.header('X-Output-Cache-Updated', cached.updated);
      response.header('X-Output-Cache-Expires', cached.expires);
      return response.takeover(cached.value);
    }
    return h.continue;
  });

  const getCacheObj = async (request, response, ttl) => {
    const now = new Date().getTime();
    const cacheObj = {
      updated: new Date(),
      expires: new Date(now + ttl)
    };
    cacheObj.value = response.source;
    return cacheObj;
  };

  server.ext('onPreResponse', async(request, h) => {
    const response = request.response;
    if (!request.route.settings.plugins['hapi-output-cache'] ||
        request.query.nocache === '1') {
      response.header('X-Output-Cache', 'disabled');
      return h.continue;
    }
    if (request.outputCache) {
      return h.continue;
    }
    if (response && response.output && response.output.statusCode !== 200) {
      return h.continue;
    }
    const ttl = request.route.settings.plugins['hapi-output-cache'].ttl || options.ttl;
    const key = options.key(request);
    try {
      const cacheObj = await getCacheObj(request, response, ttl);
      await cache.set(key, cacheObj, ttl);
      server.log(['outputCache', 'set'], key);
      // cache update header won't be automatically set as in previous version:
      request.response.header('X-Output-Cache-Updated', cacheObj.updated.toString());
      request.response.header('X-Output-Cache', 'miss');
    } catch (err) {
      server.log(['outputCache', 'error'], err);
    }
    return h.continue;
  });
};


exports.plugin = {
  name: 'hapi-output-cache',
  register,
  once: true,
  pkg: require('./package.json')
};
