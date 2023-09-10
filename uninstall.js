'use strict'

const fs = require('node:fs')
const path = require('node:path')
const exists = fs.existsSync || path.existsSync
const root = path.resolve(__dirname, '..', '..', '..')
let git = path.resolve(root, '.git')

//
// Resolve git directory for submodules
//
if (exists(git) && fs.lstatSync(git).isFile()) {
  const gitinfo = fs.readFileSync(git).toString()
  const gitdirmatch = /gitdir: (.+)/.exec(gitinfo)
  const gitdir = gitdirmatch.length === 2 ? gitdirmatch[1] : null

  if (gitdir !== null) {
    git = path.resolve(root, gitdir)
  }
}

//
// Location of pre-commit hook, if it exists
//
const precommit = path.resolve(git, 'hooks', 'pre-commit')

//
// Bail out if we don't have pre-commit file, it might be removed manually.
//
if (!exists(precommit)) process.exit(0)

//
// If we don't have an old file, we should just remove the pre-commit hook. But
// if we do have an old precommit file we want to restore that.
//
if (!exists(precommit + '.old')) {
  fs.unlinkSync(precommit)
} else {
  fs.writeFileSync(precommit, fs.readFileSync(precommit + '.old'))
  fs.chmodSync(precommit, '755')
  fs.unlinkSync(precommit + '.old')
}
