'use strict';
const code = require('code');   // assertion library
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Hapi = require('hapi');
const outputCachePlugin = require('../');

let server;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

lab.experiment('hapi-output-cache', () => {
  lab.beforeEach(async() => {
    server = new Hapi.Server({
      debug: {
        log: ['error', 'hapi-method-loader']
      },
      port: 3000
    });
    await server.register(outputCachePlugin, {});
    await server.start();
  });
  lab.afterEach(async() => {
    await server.stop();
  });

  lab.test('does not interfere with routes that are not decorated', { timeout: 5000 }, async() => {
    let count = 0;
    server.route({
      method: 'GET',
      path: '/route',
      handler(request, h) {
        return count++;
      }
    });
    const res = await server.inject({
      method: 'GET',
      url: '/route'
    });
    const res2 = await server.inject({
      method: 'GET',
      url: '/route'
    });
    code.expect(res.result).to.equal(0);
    code.expect(res2.result).to.equal(1);
  });

  lab.test('can decorate a route', { timeout: 5000 }, async() => {
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            ttl: 1000,
          }
        }
      },
      async handler(request, h) {
        await wait(100);
        return 'money';
      }
    });
    const firstCallStart = new Date().getTime();
    const res = await server.inject({
      method: 'GET',
      url: '/route'
    });
    code.expect(res.headers['x-output-cache']).to.equal('miss');
    code.expect(typeof res.headers['x-output-cache-updated']).to.equal('string');
    const firstCallEnd = new Date().getTime();
    const secondCallStart = new Date().getTime();
    const res2 = await server.inject({
      method: 'GET',
      url: '/route'
    });
    code.expect(res2.headers['x-output-cache']).to.equal('hit');
    code.expect(typeof res2.headers['x-output-cache-updated']).to.equal('string');
    const secondCallEnd = new Date().getTime();
    const firstCallTook = firstCallEnd - firstCallStart;
    const secondCallTook = secondCallEnd - secondCallStart;
    code.expect(firstCallTook).to.be.greaterThan(secondCallTook);
    code.expect(firstCallTook - secondCallTook).to.be.greaterThan(10);
  });

  lab.test('will skip the cache if called with nocache query option', { timeout: 5000 }, async() => {
    let count = 0;
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            ttl: 100000,
          }
        }
      },
      async handler(request, h) {
        count++;
        return count;
      }
    });
    const res = await server.inject({
      method: 'GET',
      url: '/route'
    });
    const res2 = await server.inject({
      method: 'GET',
      url: '/route'
    });
    const res3 = await server.inject({
      method: 'GET',
      url: '/route?nocache=1'
    });
    code.expect(res.result).to.equal(1);
    code.expect(res2.result).to.equal(1);
    code.expect(res3.result).to.equal(2);
  });

  lab.test('will not cache a non-200 return value', { timeout: 5000 }, async() => {
    let count = 0;
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            ttl: 100000,
          }
        }
      },
      handler(request, h) {
        if (count === 0) {
          count++;
          throw new Error('misaligned widgets');
        }
        return count;
      }
    });
    const res = await server.inject({
      method: 'GET',
      url: '/route'
    });
    code.expect(res.statusCode).to.equal(500);
    const res2 = await server.inject({
      method: 'GET',
      url: '/route'
    });
    code.expect(res2.statusCode).to.equal(200);
    code.expect(res2.result).to.equal(1);
  });

  lab.test('can set a ttl setting', { timeout: 5000 }, async() => {
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            ttl: 1,
          }
        }
      },
      async handler(request, h) {
        await wait(100);
        return 'money';
      }
    });
    const firstCallStart = new Date().getTime();
    await server.inject({
      method: 'GET',
      url: '/route'
    });
    const firstCallEnd = new Date().getTime();
    const secondCallStart = new Date().getTime();
    await wait(2000);
    await server.inject({
      method: 'GET',
      url: '/route'
    });
    const secondCallEnd = new Date().getTime();
    const firstCallTook = firstCallEnd - firstCallStart;
    const secondCallTook = secondCallEnd - secondCallStart;
    code.expect(firstCallTook - secondCallTook).to.be.lessThan(10);
  });

  lab.test('can set a key', { timeout: 5000 }, async() => {
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            key: () => 'master'
          }
        }
      },
      async handler(request, h) {
        await wait(100);
        return 'money';
      }
    });
    const firstCallStart = new Date().getTime();
    await server.inject({
      method: 'GET',
      url: '/route'
    });
    const firstCallEnd = new Date().getTime();
    const secondCallStart = new Date().getTime();
    await wait(2000);
    await server.inject({
      method: 'GET',
      url: '/route'
    });
    const secondCallEnd = new Date().getTime();
    const firstCallTook = firstCallEnd - firstCallStart;
    const secondCallTook = secondCallEnd - secondCallStart;
    code.expect(firstCallTook - secondCallTook).to.be.lessThan(10);
  });
});

lab.experiment('hapi-output-cache with views', () => {
  lab.beforeEach(async() => {
    server = new Hapi.Server({
      debug: {
        log: ['error', 'hapi-method-loader']
      },
      port: 3000
    });
    await server.register(outputCachePlugin, {});
    await server.register(require('vision'), {});
    await server.start();
  });
  lab.afterEach(async() => {
    await server.stop();
  });

  lab.test('can call a route with a view', { timeout: 5000 }, async() => {
    server.route({
      method: 'GET',
      path: '/route',
      config: {
        plugins: {
          'hapi-output-cache': {
            ttl: 1000,
          }
        }
      },
      handler(request, h) {
        return h.view('homepage', {
          date: new Date().getTime()
        });
      }
    });
    server.views({
      path: `${__dirname}/views`,
      engines: {
        html: require('handlebars')
      }
    });
    const res = await server.inject({
      method: 'GET',
      url: '/route'
    });
    const res2 = await server.inject({
      method: 'get',
      url: '/route'
    });
    code.expect(res.statusCode).to.equal(200);
    code.expect(res2.statusCode).to.equal(200);
    code.expect(res.result).to.equal(res2.result);
  });
});
