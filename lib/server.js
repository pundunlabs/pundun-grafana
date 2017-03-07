var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var methodOverride = require('method-override')
var moment = require('moment')
var pundunjs = require('pundunjs')
var jsep = require('jsep')
var http = require('http')
var config = require('./config')

const co = require('co')
const cf = require('co-functional')
const debug = require('debug')('server')

const httpHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + config.grafana.apiKey
}
const httpOptions = {
  host: config.grafana.host,
  port: config.grafana.port,
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
      let dbRes = yield ds.client.tableInfo(req.body.table, ['key', 'columns', 'comparator'])
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
  respond(res, [])
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
  let startTs = moment(req.body.range.to, moment.ISO_8601).format('x')
  let endTs = moment(req.body.range.from, moment.ISO_8601).format('x')
  let targets = req.body.targets
  let limit = req.body.maxDataPoints
  const promise = cf.map(function*(t) {
    let timeScale = getTimeScaleDown(t.precision)
    let keyFields = getKeyFields(t.from, ds)
    let startKey = keyFields.map(f => {
      if(f === t.timeField) {
        debug('start:', Math.floor(startTs*timeScale))
        return {name: f, int: Math.floor(startTs*timeScale)}
      } else {
        let bin = new Buffer(8)
        return {name: f, binary: bin.fill(255)}
      }
    })
    let endKey = keyFields.map(f => {
      if(f === t.timeField) {
        return {name: f, int: Math.floor(endTs*timeScale)}
      } else {
        debug('min safe', Number.MIN_SAFE_INTEGER)
        return {name: f, int: Number.MIN_SAFE_INTEGER}
      }
    })
    let kc = tables.get(t.from)
    if (kc.comparator == 'ascending') {
      endKey = [startKey, startKey = endKey][0]
    }
    let dbRes = yield client.readRange(t.from, startKey, endKey, limit)
    return extractDatapoints(dbRes, timeScale, t)
  }, targets)
  promise.then(result => {
    let data = result.reduce((acc, arr) => {return acc.concat(arr)}, [])
    respond(res, data)
  })
})

function extractDatapoints(dbRes, timeScale, t) {
  let list = dbRes.response.keyColumnsList.list
  let where = parseWhere(t.where)
  let filtered = list.filter(kvp => {return applyWhereFilter(kvp, where)})
  if (t.resultFormat == 'table') {
    return formatAsTable(filtered, t.refId, t.select, t.timeField, timeScale)
  } else {
    return formatAsTimeSeries(filtered, t.refId, t.select, t.timeField, timeScale)
  }
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

function formatAsTable(datapoints, refId, select, timeField, timeScale) {
  let columns = []
  let index = new Map()
  select.reduce((acc, columnName) => {
    index.set(columnName, acc)
    let obj = {text: (refId).concat('.', columnName)}
    columns[acc] = (columnName == timeField) ? Object.assign(obj, {type: 'time', sort: true}) : obj
    return acc + 1
  }, 0)
  let rows = datapoints.map(kvp => {
    let row = kvp.key.concat(kvp.columns)
    return row.reduce((acc, col) => {
      let i = index.get(col.name)
      if (! undefined) {
        let v = getValue(col)
        v = (col.name == timeField) ? moment(Math.floor(v / timeScale)).format('HH:mm:ss') : v
        acc[i] = v
      }
      return acc
    }, [])
  })
  return [
    {
      'columns': columns,
      'rows': rows,
      'type': 'table'
    }
  ]
}

function formatAsTimeSeries(list, refId, select, timeField, timeScale) {
  let targetMap = list.reduce((acc, kvp) => {
    let all = kvp.key.concat(kvp.columns)
    let filtered = all.filter(field => { return applySelectFilter(field, select)})
    let ts = kvp.key.filter(k => {return findTs(k, timeField)}).map(v => {return getValue(v)})[0]
    let intTs = Math.floor(ts/timeScale)
    return filtered.reduce((a, col) => {
      let dp = [getValue(col), intTs]
      let obj = (a.get(col.name) || []).concat([dp])
      return a.set(col.name, obj)
    }, acc)
  }, new Map())

  let respObj = []
  targetMap.forEach((v,k) => {
    respObj.push({
      'target': (refId).concat('.', k),
      'datapoints': v
    })
  })
  return respObj
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
      let dbRes = yield ds.client.tableInfo(table, ['key', 'columns', 'comparator'])
      let kc = extractTableInfo(dbRes)
      tables.set(table, kc)
      return kc.key
    })
  }
}

function generateTestTable() {
  co(function*() {
    var iter = datasources.values()
    let client = iter.next().value.client
    let table = 'gexample'
    let res = yield client.deleteTable(table).catch()
    debug('del res', res)
    yield client.createTable(table, ['ts']).catch()
    let ts = moment().unix().valueOf()
    let N = 1000
    let arr = Array.apply(null, {length: N}).map(Number.call, Number)
    yield arr.map(a => {
      let t = ts + a
      let col2 = Math.sin((t % 90) * Math.PI / 180) * 10
      client.write(table,
        [{name:'ts', int: t}],
        [{name: 'col1', int: t % 10},
         {name: 'col2', double: col2},
         {name: 'col3', string: 'example'}])
    })
  })
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
    let promisses = []
    datasources.forEach((v,k) => {
      debug(k, v)
      let client = new pundunjs({
        host: v.host,
        port: v.port,
        username: v.user,
        password: v.password
      })
      v.client = client
      promisses.push(co(function *() { yield client.connect() }))
    })
    Promise.all(promisses).then(() => {
      if( config.test ) {
        debug('Generating test data..')
        generateTestTable()
      }
      app.listen(config.server.port)
      debug('Server is listening to port', config.server.port)
    })
  })
}
