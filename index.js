#!/usr/bin/env node

'use strict'

const commander = require('commander')
const fs = require('fs')
const { MongoClient } = require('mongodb')
const path = require('path')

const banner = fs.readFileSync(path.join(__dirname, 'banner'), 'utf8')
const error = msg => console.error('\x1b[31m%s\x1b[0m', msg)
const warn = msg => console.warn('\x1b[33m%s\x1b[0m', msg)

const checkCollection = collection => {
  if (!['domains', 'ips', 'ranges', 'urls'].includes(collection)) {
    error('[!] Expected <collection> to be one of ["domains","ips","ranges","urls"]')
    process.exit(1)
  }
}

const init = async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })

  const db = client.db('mongomap')

  return { client, db }
}

const getCollection = async (db, collection) => {
  let coll

  if (collection === 'domains') {
    coll = await db.createCollection('domains')
    await coll.createIndex('name', { background: true, unique: true })
  } else if (collection === 'ips') {
    coll = await db.createCollection('ips')
    await coll.createIndex({ address: 1, program: 1 }, { background: true, unique: true })
  } else if (collection === 'ranges') {
    coll = await db.createCollection('ranges')
    await coll.createIndex('cidr', { background: true, unique: true })
  } else {
    coll = await db.createCollection('urls')
    await coll.createIndex('href', { background: true, unique: true })
  }

  return coll
}

const generateOps = (program, collection, batch) => {
  const docs = []
  const created = new Date()

  if (collection === 'domains') {
    batch.forEach(name => {
      const parts = name.split('.')
      let parent = null

      if (parts.length > 2) {
        parent = parts.slice(1).join('.')
      }

      docs.push({ created, name, parent, program })
    })
  } else if (collection === 'ips') {
    batch.forEach(address => {
      const privateIP = address.startsWith('10.') || address.startsWith('192.168.')
      privateIP || docs.push({ address, created, program })
    })
  } else if (collection === 'ranges') {
    batch.forEach(({ asn, cidr }) => docs.push({ asn, cidr, created, program }))
  } else {
    batch.forEach(href => {
      try {
        const url = new URL(href)
        const domain = url.hostname
        const secure = url.protocol === 'https:'
        docs.push({ created, domain, href, program, secure })
      } catch {}
    })
  }

  return docs.map(document => ({ insertOne: { document } }))
}

const generateOpts = collection => {
  const opts = { projection: { _id: 0 } }

  if (collection === 'domains') {
    opts.projection.name = 1
  } else if (collection === 'ips') {
    opts.projection.address = 1
  } else if (collection === 'ranges') {
    opts.projection.cidr = 1
  } else {
    opts.projection.href = 1
  }

  return opts
}

const push = async (program, collection, file) => {
  checkCollection(collection)

  let asn

  if (collection === 'ranges') {
    asn = path.parse(path.basename(file)).name

    if (!/^AS[0-9]+$/.test(asn)) {
      error('[!] Filename is not a valid ASN')
      process.exit(1)
    }

    asn = +asn.slice(2)
  }

  let data

  try {
    data = await fs.promises.readFile(file, 'utf8')
  } catch {
    error('[!] Couldn\'t read file: ' + file)
    process.exit(1)
  }

  error(banner)
  warn('[-] Loaded file of ' + collection)

  const lines = data
    .split('\n')
    .filter(Boolean)
    .map(line => line.trim())

  const { client, db } = await init()
  const coll = await getCollection(db, collection)

  warn('[-] Connected to database')

  for (let i = 0; i < lines.length; i += 1e3) {
    let batch = lines.slice(i, i + 1e3)

    if (collection === 'ranges') {
      batch = batch.map(cidr => ({ asn, cidr }))
    }

    const ops = generateOps(program, collection, batch, file)

    await coll.bulkWrite(ops, { ordered: false })
      .catch(err => err.message.includes('duplicate key error') || error('[!] ' + err.message))
  }

  warn('[-] Wrote ' + collection)
  warn('[-] Closing connection')

  client.close()

  warn('[-] Done!')
}

const pull = async (program, collection, opts) => {
  checkCollection(collection)

  error(banner)

  const { client, db } = await init()
  const coll = await getCollection(db, collection)

  warn('[-] Connected to database')

  const today = new Date()

  today.setHours(0)
  today.setMinutes(0)
  today.setSeconds(0)
  today.setMilliseconds(0)

  const created = { $gte: today }
  const query = { created, program }

  opts = generateOpts(collection)

  warn('[-] Finding ' + collection)

  const cursor = coll.find(query, opts)
  const results = await cursor.toArray()

  results.forEach(result => {
    const [key] = Object.keys(result)
    console.log(result[key])
  })

  warn('[-] Closing connection')

  client.close()

  warn('[-] Done!')
}

const program = new commander.Command()

program.version('0.1.0')

program
  .command('push <program> <collection> <file>')
  .description('store the contents of a file in the database')
  .action(push)

program
  .command('pull <program> <collection>')
  .description('pull documents that were added to the database today')
  .action(pull)

program
  .parseAsync(process.argv)
  .catch(err => error(err) || 1)
  .then(process.exit)
