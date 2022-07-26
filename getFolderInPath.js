'use strict'
const fs = require('fs')
const path = require('path')
const resolve = path.resolve
const exists = fs.existsSync

// Function to recursively finding a folder
function getFolderInPath (folder, path) {
  const result = resolve(path, folder)

  if (!exists(result)) {
    console.log('pre-commit:')
    console.log('pre-commit: Not found ' + folder + ' folder in', result)

    const newPath = resolve(path, '..')

    // Stop if we on top folder
    if (path === newPath) {
      return null
    }

    return getFolderInPath(folder, newPath)
  }

  if (fs.lstatSync(result).isDirectory()) {
    console.log('pre-commit:')
    console.log('pre-commit: Found ' + folder + ' folder in', result)
    return result
  }
  return null
}

module.exports = getFolderInPath
module.exports.getFolderInPath = getFolderInPath
