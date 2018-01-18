const Hapi = require('hapi');
const Boom = require('boom');

const f = async() => {
  const server = new Hapi.Server({
    debug: {
      log: ['outputCache']
    },
    port: 8080
  });
  await server.register([
    { plugin: require('vision') },
    {
      plugin: require('../'),
      options: {
        ttl: 10 * 1000
      }
    }
  ]);
  server.views({
    path: `${__dirname}/views`,
    engines: {
      html: require('handlebars')
    }
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
      handler(request, h) {
        return new Date().getTime();
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
      handler(request, h) {
        return new Date().getTime();
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
      handler(request, h) {
        return h.view('homepage', {
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
      handler(request, h) {
        throw Boom.badRequest('error');
      }
    }
  ]);
  await server.start();
  console.log('Server running at:', server.info.uri);
};

f();
