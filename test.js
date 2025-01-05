'use strict'
const { test } = require('node:test')
const tty = require('node:tty')
const Hook = require('./')
const ttySupportColor = tty.isatty(process.stdout.fd)

const proxyquire = require('proxyquire')

test('pre-commit', async (t) => {
  await t.test('is exported as a function', (t) => {
    t.assert.strictEqual(typeof Hook, 'function', 'Hook should be a function')
  })

  await t.test('can be initialized without a `new` keyword', (t) => {
    const hook = Hook(function () {}, {
      ignorestatus: true
    })

    t.assert.ok(hook instanceof Hook, 'hook should be an instance of Hook')
    t.assert.strictEqual(typeof hook.parse, 'function', 'hook.parse should be a function')
  })

  await t.test('#parse', async (t) => {
    let hook

    t.beforeEach(() => {
      hook = new Hook(function () {}, {
        ignorestatus: true
      })
    })

    await t.test('extracts configuration values from precommit.<flag>', (t) => {
      hook.json = {
        'precommit.silent': true
      }

      t.assert.strictEqual(hook.silent, false, 'hook.silent should initially be false')

      hook.parse()

      t.assert.strictEqual(hook.config.silent, true, 'hook.config.silent should be true after parsing')
      t.assert.strictEqual(hook.silent, true, 'hook.silent should be true after parsing')
    })

    await t.test('extracts configuration values from pre-commit.<flag>', (t) => {
      hook.json = {
        'pre-commit.silent': true,
        'pre-commit.colors': false
      }

      t.assert.strictEqual(hook.silent, false, 'hook.silent should initially be false')
      t.assert.strictEqual(hook.colors, ttySupportColor, 'hook.colors should initially match ttySupportColor')

      hook.parse()

      t.assert.strictEqual(hook.config.silent, true, 'hook.config.silent should be true after parsing')
      t.assert.strictEqual(hook.silent, true, 'hook.silent should be true after parsing')
      t.assert.strictEqual(hook.colors, false, 'hook.colors should be false after parsing')
    })

    await t.test('normalizes the `pre-commit` to an array', (t) => {
      hook.json = {
        'pre-commit': 'test, cows, moo'
      }

      hook.parse()

      t.assert.strictEqual(hook.config.run.length, 3, 'hook.config.run should have 3 items')
      t.assert.deepStrictEqual(hook.config.run, ['test', 'cows', 'moo'], 'hook.config.run should contain the correct items')
    })

    await t.test('normalizes the `precommit` to an array', (t) => {
      hook.json = {
        precommit: 'test, cows, moo'
      }

      hook.parse()

      t.assert.strictEqual(hook.config.run.length, 3, 'hook.config.run should have 3 items')
      t.assert.deepStrictEqual(hook.config.run, ['test', 'cows', 'moo'], 'hook.config.run should contain the correct items')
    })

    await t.test('allows `pre-commit` object based syntax', (t) => {
      hook.json = {
        'pre-commit': {
          run: 'test scripts go here',
          silent: true,
          colors: false
        }
      }

      hook.parse()

      t.assert.strictEqual(hook.config.run.length, 4, 'hook.config.run should have 4 items')
      t.assert.deepStrictEqual(hook.config.run, ['test', 'scripts', 'go', 'here'], 'hook.config.run should contain the correct items')
      t.assert.strictEqual(hook.silent, true, 'hook.silent should be true')
      t.assert.strictEqual(hook.colors, false, 'hook.colors should be false')
    })

    await t.test('defaults to `test` if nothing is specified', (t) => {
      hook.json = {
        scripts: {
          test: 'mocha test.js'
        }
      }

      hook.parse()

      t.assert.strictEqual(hook.config.run.length, 1, 'hook.config.run should have 1 item')
      t.assert.deepStrictEqual(hook.config.run, ['test'], 'hook.config.run should contain the correct item')
    })

    await t.test('ignores the default npm.script.test placeholder', (t) => {
      hook.json = {
        scripts: {
          test: 'echo "Error: no test specified" && exit 1'
        }
      }

      hook.parse()

      t.assert.strictEqual(typeof hook.config.run, 'undefined', 'hook.config.run should be undefined')
    })

    await t.test('overrides the `pre-commit` config property in package.json with the config inside `.pre-commit.json` if it exists', (t) => {
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

      t.assert.deepStrictEqual(hook.config.run, ['lint', 'bench'], 'hook.config.run should contain the correct items')
    })

    await t.test('should properly handle errors while trying to read and parse the contents of `.pre-commit.json`', (t) => {
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
        t.assert.ok(lines.length !== 0, 'lines should not be empty')
        t.assert.strictEqual(code, 1, 'exit code should be 1')
      }
    })
  })

  await t.test('#log', async (t) => {
    await t.test('prefixes the logs with `pre-commit`', (t) => {
      const hook = new Hook(function (code, lines) {
        t.assert.strictEqual(code, 1, 'exit code should be 1')
        t.assert.ok(Array.isArray(lines), 'lines should be an array')

        t.assert.ok(lines[0].includes('pre-commit: '), 'first line should start with `pre-commit: `')
        t.assert.ok(lines[1].includes('pre-commit: foo'), 'second line should start with `pre-commit: foo`')
        t.assert.ok(lines[2].includes('pre-commit: '), 'third line should start with `pre-commit: `')
        t.assert.strictEqual(lines.length, 3, 'total lines should be 3')

        // color prefix check
        lines.forEach(function (line) {
          t.assert.strictEqual(line.includes('\u001b'), ttySupportColor)
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'])
    })

    await t.test('allows for a custom error code', (t) => {
      const hook = new Hook(function (code) {
        t.assert.strictEqual(code, 0, 'exit code should be 0')
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log(['foo'], 0)
    })

    await t.test('allows strings to be split \\n', (t) => {
      const hook = new Hook(function (code, lines) {
        t.assert.strictEqual(code, 0, 'exit code should be 0')

        t.assert.strictEqual(lines.length, 4, 'total lines should be 4')
        t.assert.ok(lines[1].includes('pre-commit: foo'), 'second line should start with `pre-commit: foo`')
        t.assert.ok(lines[2].includes('pre-commit: bar'), 'third line should start with `pre-commit: bar`')
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.log('foo\nbar', 0)
    })

    await t.test('does not output colors when configured to do so', (t) => {
      const hook = new Hook(function (code, lines) {
        t.assert.strictEqual(code, 0, 'exit code should be 0')

        lines.forEach(function (line) {
          t.assert.strictEqual(line.includes('\u001b'), false, 'line should not include color prefix')
        })
      }, { ignorestatus: true })

      hook.config.silent = true
      hook.config.colors = false

      hook.log('foo\nbar', 0)
    })

    await t.test('output lines to stderr if error code 1', (t) => {
      const err = console.error
      const hook = new Hook(function () {
        console.error = err
      }, { ignorestatus: true })

      console.error = function (line) {
        t.assert.ok(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 1)
    })

    await t.test('output lines to stderr if error code 0', (t) => {
      const log = console.log
      const hook = new Hook(function () {
        console.log = log
      }, { ignorestatus: true })

      console.log = function (line) {
        t.assert.ok(line.includes('pre-commit: '), true)
      }

      hook.config.colors = false
      hook.log('foo\nbar', 0)
    })
  })

  await t.test('#run', async (t) => {
    await t.test('runs the specified scripts and exit with 0 on no error', (t) => {
      const hook = new Hook(function (code, lines) {
        t.assert.strictEqual(code, 0, 'exit code should be 0')
        t.assert.strictEqual(typeof lines, 'undefined', 'lines should be undefined')
      }, { ignorestatus: true })

      hook.config.run = ['example-pass']
      hook.run()
    })

    await t.test('runs the specified test and exits with 1 on error', (t) => {
      const hook = new Hook(function (code, lines) {
        t.assert.strictEqual(code, 1, 'exit code should be 1')

        t.assert.ok(Array.isArray(lines), 'lines should be an array')
        t.assert.ok(lines[1].includes('`example-fail`'), true)
        t.assert.ok(lines[2].includes('code (1)'), true)
      }, { ignorestatus: true })

      hook.config.run = ['example-fail']
      hook.run()
    })
  })

  await t.test('skips pre-commit if no staged changes', (t) => {
    const Hook = proxyquire('.', {
      'node:child_process': {
        execSync (command) {
          if (command === 'git diff --cached --quiet') {
            throw new Error('No staged changes')
          }
        }
      }
    })

    const hook = new Hook(
      function (code, lines) {
        t.assert.strictEqual(code, 0, 'exit code should be 0')
        t.assert.strictEqual(lines, undefined, 'lines should be undefined')
      },
      { ignorestatus: true }
    )

    hook.config.run = ['example-pass']
    hook.run()
  })
})
