var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var methodOverride = require('method-override')
var moment = require('moment')
var pundunjs = require('pundunjs')
var jsep = require('jsep')
var http = require('http')

const co = require('co')
const cf = require('co-functional')
const debug = require('debug')('server')
const apiKey = 'eyJrIjoiZ3ZQbFpKdXFjRnBVV3plMEUwUXFxVjFzOVN5N3ZKZjQiLCJuIjoicHVuZHVuIiwiaWQiOjJ9'
const httpHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + apiKey
}
const httpOptions = {
  host: 'localhost',
  port: '3000',
  path: '/api/datasources',
  headers: httpHeaders
}
const datasources = new Map()
const tables = new Map()

app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(methodOverride())
app.use(logErrors)
app.use(clientErrorHandler)
app.use(errorHandler)

function logErrors (err, req, res, next) {
  debug(err.stack)
  next(err)
}

function clientErrorHandler (err, req, res, next) {
  if (req.xhr) {
    res.status(500).send({ error: 'Something failed!' })
  } else {
    next(err)
  }
}

function errorHandler (err, req, res, next) {
  debug('err', err)
  debug('next:',next)
  res.status(500)
  res.render('error', { error: err })
}

var annotation = {
  name : 'annotation name',
  enabled: true,
  datasource: 'generic datasource',
  showLine: true,
}

var annotations = [
  { annotation: annotation, 'title': 'Don is kinda funny', 'time': 1450754160000, text: 'teeext', tags: 'taaags' },
  { annotation: annotation, 'title': 'Wow he really won', 'time': 1450754160000, text: 'teeext', tags: 'taaags' },
  { annotation: annotation, 'title': 'When is the next ', 'time': 1450754160000, text: 'teeext', tags: 'taaags' }
]

/*var table =
  {
    columns: [{text: 'Time', type: 'time'}, {text: 'Country', type: 'string'}, {text: 'Number', type: 'number'}],
    values: [
      [ 1234567, 'SE', 123 ],
      [ 1234567, 'DE', 231 ],
      [ 1234567, 'US', 321 ],
    ]
  }
*/

app.all('/', function(req, res) {
  var credentials = {
    name: req.query.name,
    host: req.query.host,
    port: req.query.port,
    username: req.query.user,
    password: req.query.password
  }
  app.set('credentials', credentials)
  updateCredentials(credentials)
  respond(res, 'Successfuly connected to Pundun Node')
})

app.all('/search', function(req, res){
  co(function*() {
    debug('req.body.table', req.body.table)
    if(typeof req.body.datasource !== 'undefined' && typeof req.body.table !== 'undefined') {
      let ds = datasources.get(req.body.datasource)
      let dbRes = yield ds.client.tableInfo(req.body.table, ['key', 'columns'])
      let kc = extractTableInfo(dbRes)
      var result = kc.key.concat(kc.columns)
      tables.set(req.body.table, kc)
      respond(res, result)
    }
    else {
      respond(res, [])
    }
  })
})

app.all('/annotations', function(req, res) {
  debug(req.url)
  debug(req.data)
  respond(res, annotations)
})

app.options('/query', function(req, res){
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  respond(res, [])
})

app.post('/query', function(req, res){
  debug(req.url)
  debug(req.body)
  let ds = datasources.get(req.body.datasource)
  let client = ds.client
  let startTs = moment(req.body.range.to, moment.ISO_8601).valueOf()
  let endTs = moment(req.body.range.from, moment.ISO_8601).valueOf()
  let targets = req.body.targets
  let limit = req.body.maxDataPoints
  const promise = cf.map(function*(t) {
    let timeScale = getTimeScaleDown(t.precision)
    let keyFields = getKeyFields(t.from, ds)
    let startKey = keyFields.map(f => {
      if(f === t.timeField) {
        return {name: f, int: (startTs*timeScale)}
      } else {
        let bin = new Buffer(8)
        return {name: f, binary: bin.fill(255)}
      }
    })
    let endKey = keyFields.map(f => {
      if(f === t.timeField) {
        return {name: f, int: (endTs*timeScale)}
      } else {
        debug('min safe', Number.MIN_SAFE_INTEGER)
        return {name: f, int: Number.MIN_SAFE_INTEGER}
      }
    })
    let dbRes = yield client.readRange(t.from, startKey, endKey, limit)
    let datapoints = extractDatapoints(dbRes, t.select, t.where, t.timeField, timeScale)
    let map = new Map()
    let targetMap = datapoints.reduce((acc, m) => {
      m.forEach((v,k) => {
        var obj = (acc.get(k) || []).concat(v)
        acc.set(k, obj)
      })
      return acc
    }, map)
    let respObj = []
    targetMap.forEach((v,k) => {
      respObj.push({
        'target': (t.refId).concat('.', k),
        'datapoints': v
      })
    })
    return respObj
  }, targets)
  promise.then(result => {
    let data = result.reduce((acc, arr) => {return acc.concat(arr)}, [])
    respond(res, data)
  })
})

function extractDatapoints(dbRes, select, where_, tfield, tscale) {
  let list = dbRes.response.keyColumnsList.list
  let where = parseWhere(where_)
  let filteredList = list.filter(kvp => {return applyWhereFilter(kvp, where)})
  return filteredList.map(kvp => {return parseKvp(kvp, select, tfield, tscale)})
}

function extractTableInfo(dbRes) {
  let fields = dbRes.response.proplist.fields
  return fields.reduce((acc, pv) => {
    acc[pv.name] = pv.string.trim().split(' ')
    return acc
  }, {})
}

function parseWhere(where) {
  return where.map(e => { return jsep(e) })
}

function applyWhereFilter(kvp, where){
  let all = kvp.key.concat(kvp.columns)
  let list = all.map(field => {
    return where.reduce((acc, obj) => {
      let leftCmp = (obj.left.name || obj.left.value)
      let rightCmp = (obj.right.name || obj.right.value)
      if (field.name === leftCmp){
        return acc && op(getValue(field), rightCmp, obj.operator)
      } else if (field.name === rightCmp){
        return acc && op(leftCmp, getValue(field), obj.operator)
      } else {
        return acc && true
      }
    }, true)
  })
  return list.reduce((acc, elem) => { return (acc && elem)}, true)
}

function op(val, cmp, predicate) {
  let bool = false
  switch (predicate) {
    case '==':
      bool = (val == cmp)
      break
    case '===':
      bool = (val === cmp)
      break
    case '>=':
      bool = (val >= cmp)
      break
    case '<=':
      bool = (val <= cmp)
      break
    case '<':
      bool = (val < cmp)
      break
    case '>':
      bool = (val > cmp)
      break
    case '!=':
      bool = (val != cmp)
      break
    case '!==':
      bool = (val != cmp)
  }
  return bool
}

function parseKvp(kvp, select, tfield, tscale){
  let all = kvp.key.concat(kvp.columns)
  let ts = kvp.key.filter(k => {return findTs(k, tfield)}).map(v => {return getValue(v)})[0]
  let filtered = all.filter(field => { return applySelectFilter(field, select)})
  let intTs = ts/tscale
  return filtered.reduce((acc, col) => {
    let dp = [getValue(col), intTs]
    let obj = (acc.get(col.name) || []).concat([dp])
    return acc.set(col.name, obj)
  }, new Map())
}

function findTs(k, tfield) {
  if (k.name === tfield) { return true }
}

function getValue(c) {
  let val = Object.values(c)[1]
  let res = null
  switch (Object.keys(c)[1]){
    case 'boolean':
      res = (val == 'true')
      break
    case 'int':
      res = parseInt(val)
      break
    case 'binary':
      res = val
      break
    case 'null':
      break
    case 'double':
      res = parseFloat(val)
      break
    case 'string':
      res = val
      break
  }
  return res
}

function applySelectFilter(field, select) {
  return select.reduce((acc, s) => {return (acc || (s === field.name))}, false)
}

function getTimeScaleDown(precision) {
  let s = 1
  switch (precision) {
    case 'second':
      s = 1/1000
      break
    case 'microsecond':
      s = 1000
      break
    case 'nanosecond':
      s = 1000000
      break
    case 'millisecond':
      break
  }
  return s
}


function respond(res, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.json(obj)
  res.end()
}

function updateCredentials(credentials) {
  let current = datasources.get(credentials.name)
  let client = current.client
  if (client) { client.disconnect() }
  let merged = Object.assign(current, credentials)
  client = new pundunjs({
    host: merged.host,
    port: merged.port,
    username: merged.user,
    password: merged.password
  })
  co(function *() { yield client.connect() })
  datasources.set(merged.name, Object.assign(merged, {client: client}))
}

function getDatasources() {
  return new Promise((resolve, reject) => {
    const req = http.get(httpOptions, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        reject(new Error('Failed to fetch data sources, status code: ' + res.statusCode))
      }
      let str = ''
      res.on('data', (chunk) => {
        str += chunk
      }).on('end', () => {
        let body = JSON.parse(str)
        resolve(body.filter(item => { return (item.type === 'pundun-grafana')}))
      })
    })
    req.on('error', (err) => {
      reject(err)
    })
  })
}

function getKeyFields(table, ds) {
  let kc = tables.get(table)
  if (kc !== undefined) {
    return kc.key
  } else {
    co(function*() {
      let dbRes = yield ds.client.tableInfo(table, ['key', 'columns'])
      let kc = extractTableInfo(dbRes)
      tables.set(table, kc)
      return kc.key
    })
  }
}

if (require.main === module) {
  co(function*() {
    let pundunSources = yield getDatasources()
      .then(r => { return r })
      .catch(err => {
        debug('error', err)
        return []
      })
    pundunSources.reduce((acc, s) => {
      acc.set(s.name, s.jsonData)
    }, datasources)
    datasources.forEach((v,k) => {
      debug(k, v)
      let client = new pundunjs({
        host: v.host,
        port: v.port,
        username: v.user,
        password: v.password
      })
      v.client = client
      co(function *() { yield client.connect() })
    })
    debug('datasources', datasources)
/*
    let table = 'gexample'
    yield client.connect()
    yield client.deleteTable(table).catch()
    yield client.createTable(table, ['ts']).catch()
    let ts = moment().unix().valueOf()
    let N = 1
    let arr = Array.apply(null, {length: N}).map(Number.call, Number)
    yield arr.map(a => {
      let t = ts + a
      let col2 = Math.sin((t % 90) * Math.PI / 180) * 10
      client.write(table,
        [{name:'ts', string: t.toString()}],
        [{name: 'col1', int: t % 10},
         {name: 'col2', double: col2},
         {name: 'col3', string: 'example'}])
    })
*/
    const port = '8087'
    app.listen(port)
    debug('Server is listening to port', port)
  })
}
