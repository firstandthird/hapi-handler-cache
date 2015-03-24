var Hapi = require('hapi');
var Boom = require('boom');

var server = new Hapi.Server({
  debug: {
    log: ['outputCache']
  }
});
server.connection({ port: 3000 });

server.register({
  register: require('../'),
  options: {

  }
}, function(err) {
});

server.route([
  {
    method: 'GET',
    path: '/',
    handler: {
      outputCache: {
        ttl: 10*1000,
        fn: function(request, reply) {
          reply(new Date().getTime());
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/error',
    handler: {
      outputCache: {
        ttl: 10*1000,
        fn: function(request, reply) {
          reply(Boom.badRequest('error'));
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/error-object',
    handler: {
      outputCache: {
        ttl: 10*1000,
        fn: function(request, reply) {
          reply(new Error('error object'), { test: 1 });
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/reply-null',
    handler: {
      outputCache: {
        ttl: 10*1000,
        fn: function(request, reply) {
          reply(null, new Date().getTime());
        }
      }
    }
  }
]);

server.start(function () {
  console.log('Server running at:', server.info.uri);
});

