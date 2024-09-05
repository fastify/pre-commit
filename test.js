'use strict'
const { test, beforeEach } = require('node:test')
const assert = require('node:assert')
const tty = require('node:tty')
const Hook = require('./')
const ttySupportColor = tty.isatty(process.stdout.fd)

const proxyquire = require('proxyquire')

test('pre-commit', async (t) => {
  await t.test('is exported as a function', () => {
    assert.strictEqual(typeof Hook, 'function')
  })

  await t.test('can be initialized without a `new` keyword', () => {
    const hook = Hook(function () {}, {
      ignorestatus: true
    })

    assert.strictEqual(hook instanceof Hook, true)
    assert.strictEqual(typeof hook.parse, 'function')
  })

  await t.test('#parse', async (t) => {
    let hook

    beforeEach(() => {
      hook = new Hook(function () {}, {
        ignorestatus: true
      })
    })

    await t.test('extracts configuration values from precommit.<flag>', () => {
      hook.json = {
        'precommit.silent': true
      }

      assert.strictEqual(hook.silent, false)

      hook.parse()

      assert.strictEqual(hook.config.silent, true)
      assert.strictEqual(hook.silent, true)
    })

    await t.test('extracts configuration values from pre-commit.<flag>', () => {
      hook.json = {
        'pre-commit.silent': true,
        'pre-commit.colors': false
      }

      assert.strictEqual(hook.silent, false)
      assert.strictEqual(hook.colors, ttySupportColor)

      hook.parse()

      assert.strictEqual(hook.config.silent, true)
      assert.strictEqual(hook.silent, true)
      assert.strictEqual(hook.colors, false)
    })

    await t.test('normalizes the `pre-commit` to an array', () => {
      hook.json = {
        'pre-commit': 'test, cows, moo'
      }

      hook.parse()

      assert.strictEqual(hook.config.run.length, 3)
      assert.deepStrictEqual(hook.config.run, ['test', 'cows', 'moo'])
    })

    await t.test('normalizes the `precommit` to an array', () => {
      hook.json = {
        precommit: 'test, cows, moo'
      }

      hook.parse()

      assert.strictEqual(hook.config.run.length, 3)
      assert.deepStrictEqual(hook.config.run, ['test', 'cows', 'moo'])
    })

    await t.test('allows `pre-commit` object based syntax', () => {
      hook.json = {
        'pre-commit': {
          run: 'test scripts go here',
          silent: true,
          colors: false
        }
      }

      hook.parse()

      assert.strictEqual(hook.config.run.length, 4)
      assert.deepStrictEqual(hook.config.run, ['test', 'scripts', 'go', 'here'])
      assert.strictEqual(hook.silent, true)
      assert.strictEqual(hook.colors, false)
    })

    await t.test('defaults to `test` if nothing is specified', () => {
      hook.json = {
        scripts: {
          test: 'mocha test.js'
        }
      }

      hook.parse()

      assert.strictEqual(hook.config.run.length, 1)
      assert.deepStrictEqual(hook.config.run, ['test'])
    })

    await t.test('ignores the default npm.script.test placeholder', () => {
      hook.json = {
        scripts: {
          test: 'echo "Error: no test specified" && exit 1'
        }
      }

      hook.parse()

      assert.strictEqual(typeof hook.config.run, 'undefined')
    })

    await t.test('overrides the `pre-commit` config property in package.json with the config inside `.pre-commit.json` if it exists', () => {
      const Hook = proxyquire('.', {
        'node:fs': {
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

      assert.deepStrictEqual(hook.config.run, ['lint', 'bench'])
    })

    await t.test('should properly handle errors while trying to read and parse the contents of `.pre-commit.json`', () => {
      let Hook = proxyquire('.', {
        'node:fs': {
          existsSync () {
            return true
          },
          readFileSync () {
            throw new Error()
          }
        }
      })

      hook = new Hook(exit)

      Hook = proxyquire('.', {
        'node:fs': {
          existsSync () { return true },
          readFileSync () {
            return Buffer.from('{ "bad": [json }')
          }
        }
      })

      hook = new Hook(exit)

      function exit (code, lines) {
        assert.notStrictEqual(lines.length, 0)
        assert.strictEqual(code, 1)
      }
    })
  })

  await t.test('#log', async (t) => {
    await t.test('prefixes the logs with `pre-commit`', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 1)
        assert.strictEqual(Array.isArray(lines), true)

        assert.strictEqual(lines[0], 'pre-commit: ')
        assert.strictEqual(lines[1], 'pre-commit: foo')
        assert.strictEqual(lines[2], 'pre-commit: ')
        assert.strictEqual(lines.length, 3)

        // color prefix check
        lines.forEach(function (line) {
          assert.strictEqual(line.includes('\u001b'), ttySupportColor)
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'])
    })

    await t.test('allows for a custom error code', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 0)
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'], 0)
    })

    await t.test('allows strings to be split \\n', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 0)

        assert.strictEqual(lines.length, 4)
        assert.strictEqual(lines[1], 'pre-commit: foo')
        assert.strictEqual(lines[2], 'pre-commit: bar')
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log('foo\nbar', 0)
    })

    await t.test('does not output colors when configured to do so', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 0)

        lines.forEach(function (line) {
          assert.strictEqual(line.includes('\u001b'), false)
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.config.colors = false

      hook.log('foo\nbar', 0)
    })

    await t.test('output lines to stderr if error code 1', () => {
      const err = console.error
      const hook = new Hook(function (code, lines) {
        console.error = err
      }, { ignorestatus: true })

      console.error = function (line) {
        assert.strictEqual(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 1)
    })

    await t.test('output lines to stderr if error code 0', () => {
      const log = console.log
      const hook = new Hook(function (code, lines) {
        console.log = log
      }, { ignorestatus: true })

      console.log = function (line) {
        assert.strictEqual(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 0)
    })
  })

  await t.test('#run', async (t) => {
    await t.test('runs the specified scripts and exit with 0 on no error', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 0)
        assert.strictEqual(typeof lines, 'undefined')
      }, { ignorestatus: true })

      hook.config.run = ['example-pass']
      hook.run()
    })

    await t.test('runs the specified test and exits with 1 on error', () => {
      const hook = new Hook(function (code, lines) {
        assert.strictEqual(code, 1)

        assert.strictEqual(Array.isArray(lines), true)
        assert.strictEqual(lines[1].includes('`example-fail`'), true)
        assert.strictEqual(lines[2].includes('code (1)'), true)
      }, { ignorestatus: true })

      hook.config.run = ['example-fail']
      hook.run()
    })
  })
})
