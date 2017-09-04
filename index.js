#!/usr/bin/env node

import 'babel-polyfill'
import program from 'commander'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import ProgressBar from 'progress'
import prompt from 'prompt'

import { version } from './package.json'

// helpers

const skipFolders = (folderName) => [
  '.git', 'node_modules'
].indexOf(folderName) === -1
const skipFiles = (fileName) => [
  '.DS_Store', '._.DS_Store', '._Odin3.ini'
].indexOf(fileName) === -1
const getAboluteDir = (dir) => path.resolve(dir)
const isValidDir = (dir) => fs.existsSync(dir)

const getHash = (file) => new Promise(resolve => {
  // the file you want to get the hash
  const fd = fs.createReadStream(file)
  const hash = crypto.createHash('sha256')
  hash.setEncoding('hex')

  fd.on('end', () => {
      hash.end()
      resolve(hash.read().toString()) // the desired sha1sum
  })

  // read all file and pipe it (write it) to the hash object
  fd.pipe(hash)
})

const getFiles = async (dir) => {
  let files = []
  const fileNames = fs.readdirSync(dir)

  for (const fileName of fileNames) {
    const path = dir + '/' + fileName
    try {
      const stat = fs.statSync(path)

      if (stat) {
        if (stat.isDirectory() && skipFolders(fileName)) {
          const dirFiles = await getFiles(path)
          files = [ ...files, ...dirFiles ]
        } else if (stat && stat.isFile() && skipFiles(fileName)) {
          files.push(path)
        }
      }
    } catch (e) {
      console.log(`Error with '${path}' file.`)
    }
  }

  return files
}

const getHashs = async (files) => {
  let hashs = {}
  const bar = new ProgressBar(' - Create Hashs file [:bar] :current/:total :percent ', {
    complete: '=',
    incomplete: ' ',
    total: files.length
  })

  for (const file of files) {
    bar.tick()
    const hash = await getHash(file)
    if (hashs[hash]) {
      hashs[hash].push(file)
    } else {
      hashs[hash] = [file]
    }
  }

  return hashs
}

const searchDuplicates = (filesHashs) => {
  const results = {}

  Object.keys(filesHashs).map(fileHashKey => {
    if (filesHashs[fileHashKey].length > 1) {
      results[fileHashKey] = filesHashs[fileHashKey]
    }
  })

  return results
}

const getDirsOrdered = (duplicates, filesHashs) => {
  const results = {}

  Object.keys(duplicates).map(hash => {
    for (const file of duplicates[hash]) {
      const dir = path.dirname(file)
      if (results[dir]) {
        results[dir].push(filesHashs[hash])
      } else {
        results[dir] = [filesHashs[hash]]
      }
    }
  })

  return results
}

const removeFiles = (dirsOrdered, key, all) => {
  for (const files of dirsOrdered[key]) {
    if (all) {
      for (const file of files) {
        fs.unlink(file)
      }
    } else {
      const file = files.find(file => file.indexOf(key) !== -1)
      fs.unlink(file)
    }
  }
}

const askToRemoveFiles = (dirsOrdered, key) => new Promise(resolve => {
  console.log(`\nThere are ${dirsOrdered[key].length} duplicate files in '${key}':`)
  for (const file of dirsOrdered[key]) {
    console.log(` - ${file.join(' = ')}`)
  }

  prompt.start()
  const property = {
    name: 'yesno',
    message: `Remove ${dirsOrdered[key].length} duplicate files in '${key}'?`,
    validator: /yes|no|stop|all/,
    warning: 'Must respond yes, no, all or stop',
    default: 'no'
  }
  prompt.get(property, (err, result) => {
    if (result) {
      switch (result.yesno) {
        case 'yes':
          removeFiles(dirsOrdered, key)
          resolve(true)
          break
        case 'all':
          removeFiles(dirsOrdered, key, true)
          resolve(true)
          break
        case 'no':
          resolve(true)
          break
        case 'stop':
          resolve(false)
          break
        default:
          resolve(true)
      }
    } else {
      resolve(false)
    }
  })
})

// program

program
  .version(version)
  .arguments('<dir> [otherDirs...]')
  .option('-E, --extensions <extensions>', 'Limit to a list of extensions (odt,zip,gpx)', val => val.split(','))
  .action(async (dir, otherDirs, options) => {
    console.log('\nStart:')

    const dirs = [dir]
    let files = []
    if (otherDirs) {
      otherDirs.forEach(oDir => dirs.push(oDir))
    }

    for (const d of dirs) {
      const absoluteDir = getAboluteDir(d)
      if (!isValidDir(absoluteDir)) {
        console.log(` - Is not valid dir. (${d})`)
        return
      }

      console.log(` - Scan ${absoluteDir}:`)

      const dirFiles = await getFiles(absoluteDir)
      const count = dirFiles.length
      console.log(` - There ${count > 0 ? `are ${count} files` : `is ${count} file`}.`)

      files = [ ...files, ...dirFiles ]
    }

    // calculate hashs
    const filesHashs = await getHashs(files)

    // remove files without duplicate
    const duplicates = searchDuplicates(filesHashs)
    const count = Object.keys(duplicates).length
    console.log(` - There are ${count} folder${count > 0 ? 's' : ''} with duplicate files.`)

    // order paths
    const dirsOrdered = getDirsOrdered(duplicates, filesHashs)
    const keys = Object.keys(dirsOrdered).sort((dir1, dir2) => {
        if (dirsOrdered[dir1].length < dirsOrdered[dir2].length) return -1
        else if (dirsOrdered[dir1].length > dirsOrdered[dir2].length) return +1
        else return 0
    }).reverse()

    // remove files
    for (const key of keys) {
      const dontStop = await askToRemoveFiles(dirsOrdered, key)
      if (!dontStop) {
        return
      }
    }
  })
  .parse(process.argv)
