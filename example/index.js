const Hapi = require('hapi');
const Boom = require('boom');

const server = new Hapi.Server({
  debug: {
    log: ['outputCache']
  }
});
server.connection({ port: 8080 });

server.register([
  { register: require('vision') },
  {
    register: require('../'),
    options: {
      ttl: 5 * 1000
    }
  }
], (err) => {
  if (err) {
    throw err;
  }
  server.views({
    path: `${__dirname}/views`,
    engines: {
      html: require('handlebars')
    }
  });
});

server.route([
  {
    method: 'GET',
    path: '/',
    config: {
      plugins: {
        'hapi-output-cache': {
        }
      },
    },
    handler(request, reply) {
      reply(new Date().getTime());
    }
  },
  {
    method: 'GET',
    path: '/long',
    config: {
      plugins: {
        'hapi-output-cache': {
          ttl: 60 * 1000
        }
      },
    },
    handler(request, reply) {
      reply(new Date().getTime());
    }
  },
  {
    method: 'GET',
    path: '/view',
    config: {
      plugins: {
        'hapi-output-cache': {
          ttl: 5 * 1000
        }
      },
    },
    handler(request, reply) {
      reply.view('homepage', {
        date: new Date().getTime()
      });
    }
  },
  {
    method: 'GET',
    path: '/error',
    config: {
      plugins: {
        'hapi-output-cache': {
          ttl: 5 * 1000
        }
      }
    },
    handler(request, reply) {
      reply(Boom.badRequest('error'));
    }
  }
]);

server.start(() => {
  console.log('Server running at:', server.info.uri);
});

