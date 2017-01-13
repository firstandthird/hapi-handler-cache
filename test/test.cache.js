'use strict';
const code = require('code');   // assertion library
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Hapi = require('hapi');
const outputCachePlugin = require('../');

let server;

lab.experiment('hapi-output-cache', () => {
  lab.beforeEach((done) => {
    server = new Hapi.Server({
      debug: {
        log: ['error', 'hapi-method-loader']
      }
    });
    server.connection({ port: 3000 });
    server.register(outputCachePlugin, {}, (err) => {
      if (err) {
        throw err;
      }
      server.start(done)
    });
  });
  lab.afterEach((done) => {
    server.stop(done);
  });

  lab.test('can decorate a route', { timeout: 5000 }, (done) => {
    server.route({
      method: 'GET',
      path: '/',
      handler: {
        outputCache: {
          ttl: 100000,
          fn: (request, reply) => {
            setTimeout(() => {
              reply('money');
            }, 100);
          }
        }
      }
    });
    const firstCallStart = new Date().getTime();
    server.inject({
      method: 'GET',
      url: '/'
    }, (res) => {
      const firstCallEnd = new Date().getTime();
      const secondCallStart = new Date().getTime();
      server.inject({
        method: 'GET',
        url: '/'
      }, (res2) => {
        const secondCallEnd = new Date().getTime();
        const firstCallTook = firstCallEnd - firstCallStart;
        const secondCallTook = secondCallEnd - secondCallStart;
        code.expect(firstCallTook).to.be.greaterThan(secondCallTook);
        code.expect(firstCallTook - secondCallTook).to.be.greaterThan(10);
        done();
      });
    });
  });
  lab.test('can set a ttl setting', { timeout: 5000 }, (done) => {
    server.route({
      method: 'GET',
      path: '/',
      handler: {
        outputCache: {
          ttl: 1,
          fn: (request, reply) => {
            setTimeout(() => {
              reply('money');
            }, 100);
          }
        }
      }
    });
    const firstCallStart = new Date().getTime();
    server.inject({
      method: 'GET',
      url: '/'
    }, (res) => {
      const firstCallEnd = new Date().getTime();
      const secondCallStart = new Date().getTime();
      setTimeout(() => {
        server.inject({
          method: 'GET',
          url: '/'
        }, (res2) => {
          const secondCallEnd = new Date().getTime();
          const firstCallTook = firstCallEnd - firstCallStart;
          const secondCallTook = secondCallEnd - secondCallStart;
          code.expect(firstCallTook - secondCallTook).to.be.lessThan(10);
          done();
        });
      }, 2000);
    });
  });
  lab.test('can set a key', { timeout: 5000 }, (done) => {
    server.route({
      method: 'GET',
      path: '/',
      handler: {
        outputCache: {
          key: () => 'master',
          fn: (request, reply) => {
            setTimeout(() => {
              reply('money');
            }, 100);
          }
        }
      }
    });
    const firstCallStart = new Date().getTime();
    server.inject({
      method: 'GET',
      url: '/'
    }, (res) => {
      const firstCallEnd = new Date().getTime();
      const secondCallStart = new Date().getTime();
      setTimeout(() => {
        server.inject({
          method: 'GET',
          url: '/'
        }, (res2) => {
          const secondCallEnd = new Date().getTime();
          const firstCallTook = firstCallEnd - firstCallStart;
          const secondCallTook = secondCallEnd - secondCallStart;
          code.expect(firstCallTook - secondCallTook).to.be.lessThan(10);
          done();
        });
      }, 2000);
    });
  });
});
