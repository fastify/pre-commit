'use strict'

const t = require('tap')
const resolve = require('path').resolve
const normalize = require('path').normalize
const getFolderInPath = require('./get-folder-in-path')

const dummyLogger = {
  log: () => {}
}

t.test('getFolderInPath', function (t) {
  t.plan(6)

  t.test('target folder is in root', function (t) {
    t.plan(1)
    const path = getFolderInPath('target_git', resolve(__dirname, '../testfolders/root'), dummyLogger)
    t.ok(path.endsWith(normalize('testfolders/root/target_git')))
  })

  t.test('test folder is in submodule', function (t) {
    t.plan(1)
    const path = getFolderInPath('target_git', resolve(__dirname, '../testfolders/submodule/moduleA'), dummyLogger)
    t.ok(path.endsWith(normalize('testfolders/submodule/moduleA/target_git')))
  })

  t.test('test folder is in submodule', function (t) {
    t.plan(1)
    const path = getFolderInPath('target_git', resolve(__dirname, '../testfolders/recursive/root/sub'), dummyLogger)
    t.ok(path.endsWith(normalize('testfolders/recursive/root/target_git')))
  })

  t.test('folder is root', function (t) {
    t.plan(1)
    const path = getFolderInPath('super-special-folder-which-should-never-be-found', '/', dummyLogger)
    t.same(path, null)
  })

  t.test('folder is empty', function (t) {
    t.plan(1)
    const path = getFolderInPath('target_git', resolve(__dirname, '../testfolders/empty'), dummyLogger)
    t.same(path, null)
  })

  t.test('folder is empty', function (t) {
    t.plan(1)
    const path = getFolderInPath('target_git', resolve(__dirname, '../testfolders/file/module/sub'), dummyLogger)
    t.same(path, null)
  })
})
