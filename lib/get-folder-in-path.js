'use strict'
const fs = require('fs')
const path = require('path')
const resolve = path.resolve
const exists = path.existsSync || fs.existsSync

// Function to recursively finding a folder
function getFolderInPath (folder, path, logger) {
  const result = resolve(path, folder)

  if (!exists(result)) {
    logger.log('pre-commit:')
    logger.log('pre-commit: Not found ' + folder + ' folder in', result)

    const newPath = resolve(path, '..')

    // Stop if we on top folder
    if (path === newPath) {
      return null
    }

    return getFolderInPath(folder, newPath, logger)
  }

  if (fs.lstatSync(result).isDirectory()) {
    logger.log('pre-commit:')
    logger.log('pre-commit: Found ' + folder + ' folder in', result)
    return result
  }
  return null
}

module.exports = getFolderInPath
