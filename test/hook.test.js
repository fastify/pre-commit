'use strict'
const Hook = require('..')
const t = require('tap')
const tty = require('tty')
const ttySupportColor = tty.isatty(process.stdout.fd)

const proxyquire = require('proxyquire')

t.test('pre-commit', function (t) {
  t.plan(5)

  t.test('is exported as a function', function (t) {
    t.plan(1)
    t.strictSame(typeof Hook, 'function')
  })

  t.test('can be initialized without a `new` keyword', function (t) {
    t.plan(2)

    const hook = Hook(function () {}, {
      ignorestatus: true
    })

    t.strictSame(hook instanceof Hook, true)
    t.strictSame(typeof hook.parse, 'function')
  })

  t.test('#parse', function (t) {
    t.plan(9)

    let hook

    t.beforeEach(function () {
      hook = new Hook(function () {}, {
        ignorestatus: true
      })
    })

    t.test('extracts configuration values from precommit.<flag>', function (t) {
      t.plan(3)

      hook.json = {
        'precommit.silent': true
      }

      t.strictSame(hook.silent, false)

      hook.parse()

      t.strictSame(hook.config.silent, true)
      t.strictSame(hook.silent, true)
    })

    t.test('extracts configuration values from pre-commit.<flag>', function (t) {
      t.plan(5)

      hook.json = {
        'pre-commit.silent': true,
        'pre-commit.colors': false
      }

      t.strictSame(hook.silent, false)
      t.strictSame(hook.colors, ttySupportColor)

      hook.parse()

      t.strictSame(hook.config.silent, true)
      t.strictSame(hook.silent, true)
      t.strictSame(hook.colors, false)
    })

    t.test('normalizes the `pre-commit` to an array', function (t) {
      t.plan(2)

      hook.json = {
        'pre-commit': 'test, cows, moo'
      }

      hook.parse()

      t.strictSame(hook.config.run.length, 3)
      t.strictSame(hook.config.run, ['test', 'cows', 'moo'])
    })

    t.test('normalizes the `precommit` to an array', function (t) {
      t.plan(2)

      hook.json = {
        precommit: 'test, cows, moo'
      }

      hook.parse()

      t.strictSame(hook.config.run.length, 3)
      t.strictSame(hook.config.run, ['test', 'cows', 'moo'])
    })

    t.test('allows `pre-commit` object based syntax', function (t) {
      t.plan(4)

      hook.json = {
        'pre-commit': {
          run: 'test scripts go here',
          silent: true,
          colors: false
        }
      }

      hook.parse()

      t.strictSame(hook.config.run.length, 4)
      t.strictSame(hook.config.run, ['test', 'scripts', 'go', 'here'])
      t.strictSame(hook.silent, true)
      t.strictSame(hook.colors, false)
    })

    t.test('defaults to `test` if nothing is specified', function (t) {
      t.plan(2)

      hook.json = {
        scripts: {
          test: 'mocha test.js'
        }
      }

      hook.parse()

      t.strictSame(hook.config.run.length, 1)
      t.strictSame(hook.config.run, ['test'])
    })

    t.test('ignores the default npm.script.test placeholder', function (t) {
      t.plan(1)

      hook.json = {
        scripts: {
          test: 'echo "Error: no test specified" && exit 1'
        }
      }

      hook.parse()

      t.strictSame(typeof hook.config.run, 'undefined')
    })

    t.test('overrides the `pre-commit` config property in package.json with the config inside `.pre-commit.json` if it exists', function (t) {
      t.plan(1)

      const Hook = proxyquire('..', {
        fs: {
          existsSync () {
            return true
          },
          readFileSync () {
            const rawText = JSON.stringify({ run: ['lint', 'bench'] })
            return Buffer.from(rawText)
          }
        }
      })

      hook = new Hook(function () {}, { ignorestatus: true })

      // ----
      t.same(hook.config.run, ['lint', 'bench'])
    })

    t.test('should properly handle errors while trying to read and parse the contents of `.pre-commit.json`', function (t) {
      t.plan(4)

      let Hook = proxyquire('..', {
        fs: {
          existsSync () {
            return true
          },
          readFileSync () {
            throw new Error()
          }
        }
      })

      hook = new Hook(exit)

      Hook = proxyquire('..', {
        fs: {
          existsSync () { return true },
          readFileSync () {
            return Buffer.from('{ "bad": [json }')
          }
        }
      })

      hook = new Hook(exit)

      // *****************
      function exit (code, lines) {
        t.not(lines.length, 0)
        t.equal(code, 1)
      }
    })
  })

  t.test('#log', function (t) {
    t.plan(6)

    t.test('prefixes the logs with `pre-commit`', function (t) {
      t.plan(9)
      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 1)
        t.strictSame(Array.isArray(lines), true)

        t.strictSame(lines[0], 'pre-commit: ')
        t.strictSame(lines[1], 'pre-commit: foo')
        t.strictSame(lines[2], 'pre-commit: ')
        t.strictSame(lines.length, 3)

        // color prefix check
        lines.forEach(function (line) {
          t.strictSame(line.includes('\u001b'), ttySupportColor)
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'])
    })

    t.test('allows for a custom error code', function (t) {
      t.plan(1)

      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 0)
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'], 0)
    })

    t.test('allows strings to be split \\n', function (t) {
      t.plan(4)

      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 0)

        t.strictSame(lines.length, 4)
        t.strictSame(lines[1], 'pre-commit: foo')
        t.strictSame(lines[2], 'pre-commit: bar')
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log('foo\nbar', 0)
    })

    t.test('does not output colors when configured to do so', function (t) {
      t.plan(5)

      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 0)

        lines.forEach(function (line) {
          t.strictSame(line.includes('\u001b'), false)
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.config.colors = false

      hook.log('foo\nbar', 0)
    })

    t.test('output lines to stderr if error code 1', function (t) {
      t.plan(4)

      const err = console.error
      const hook = new Hook(function (code, lines) {
        console.error = err
      }, { ignorestatus: true })

      console.error = function (line) {
        t.strictSame(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 1)
    })

    t.test('output lines to stderr if error code 0', function (t) {
      t.plan(4)

      const log = console.log
      const hook = new Hook(function (code, lines) {
        console.log = log
      }, { ignorestatus: true })

      console.log = function (line) {
        t.strictSame(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 0)
    })
  })

  t.test('#run', function (t) {
    t.plan(2)

    t.test('runs the specified scripts and exit with 0 on no error', function (t) {
      t.plan(2)

      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 0)
        t.strictSame(typeof lines, 'undefined')
      }, { ignorestatus: true })

      hook.config.run = ['example-pass']
      hook.run()
    })

    t.test('runs the specified test and exits with 1 on error', function (t) {
      t.plan(4)

      const hook = new Hook(function (code, lines) {
        t.strictSame(code, 1)

        t.strictSame(Array.isArray(lines), true)
        t.strictSame(lines[1].includes('`example-fail`'), true)
        t.strictSame(lines[2].includes('code (1)'), true)
      }, { ignorestatus: true })

      hook.config.run = ['example-fail']
      hook.run()
    })
  })
})
