const t = require('tap')
const resolve = require('path').resolve
const getFolderInPath = require('../getFolderInPath')

t.test('getFolderInPath', function (t) {
  t.plan(6)

  t.test('target folder is in root', function (t) {
    t.plan(1)
    const path = getFolderInPath('target', resolve(__dirname, 'testfolders/root'))
    t.ok(path.endsWith('testfolders/root/target'))
  })

  t.test('test folder is in submodule', function (t) {
    t.plan(1)
    const path = getFolderInPath('target', resolve(__dirname, 'testfolders/submodule/moduleA'))
    t.ok(path.endsWith('testfolders/submodule/moduleA/target'))
  })

  t.test('test folder is in submodule', function (t) {
    t.plan(1)
    const path = getFolderInPath('target', resolve(__dirname, 'testfolders/recursive/root/sub'))
    t.ok(path.endsWith('testfolders/recursive/root/target'))
  })

  t.test('folder is root', function (t) {
    t.plan(1)
    const path = getFolderInPath('super-special-folder-which-should-never-be-found', '/')
    t.same(path, null)
  })

  t.test('folder is empty', function (t) {
    t.plan(1)
    const path = getFolderInPath('target', resolve(__dirname, 'testfolders/empty'))
    t.same(path, null)
  })

  t.test('folder is empty', function (t) {
    t.plan(1)
    const path = getFolderInPath('target', resolve(__dirname, 'testfolders/file/module/sub'))
    t.same(path, null)
  })
})
