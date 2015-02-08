exports.register = function(server, options, next) {

  var cache = server.cache({
    segment: 'outputCache',
  });

  var defaults = {
    ttl: options.ttl || 60*1000,
    key: options.key || function(request) {
      return request.url.href;
    }
  };

  server.handler('outputCache', function(route, options) {

    return function(request, reply) {

      var key = (options.key) ? options.key(request) : defaults.key(request);

      cache.get(key, function(err, cached) {
        if (cached) {
          server.log(['outputCache', 'hit'], key);
          var response = reply(cached.item);
          response.header('X-Output-Cache', 'hit');
          return;
        }
        server.log(['outputCache', 'miss'], key);
        options.fn(request, function(response) {
          if (response.isBoom) {
            server.log(['outputCache', 'error'], key);
            return reply(response);
          }
          var ttl = options.ttl || defaults.ttl;
          cache.set(key, response, ttl, function(err) {
            if (err) {
              server.log(['outputCache', 'cacheError'], err);
            } else {
              server.log(['outputCache', 'set'], key);
            }
            var res = reply(response);
            res.header('X-Output-Cache', 'miss');
          });
        });
      });
    };
  });

  next();


};

exports.register.attributes = {
  pkg: require('./package.json')
};
