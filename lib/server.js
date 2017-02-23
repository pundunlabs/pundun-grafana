var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var methodOverride = require('method-override')
var moment = require('moment')
var pundunjs = require('pundunjs')
var jsep = require('jsep')
const co = require('co')
const cf = require('co-functional')
const debug = require('debug')('server')

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

var timeserie = []

var now = Date.now()

for (var i = timeserie.length -1; i >= 0; i--) {
  var series = timeserie[i]
  var decreaser = 0
  for (var y = series.datapoints.length -1; y >= 0; y--) {
    series.datapoints[y][1] = Math.round((now - decreaser) /1000) * 1000
    decreaser += 50000
  }
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

now = Date.now()
decreaser = 0
for (i = 0; i < annotations.length; i++) {
  var anon = annotations[i]

  anon.time = (now - decreaser)
  decreaser += 1000000
}

var table =
  {
    columns: [{text: 'Time', type: 'time'}, {text: 'Country', type: 'string'}, {text: 'Number', type: 'number'}],
    values: [
      [ 1234567, 'SE', 123 ],
      [ 1234567, 'DE', 231 ],
      [ 1234567, 'US', 321 ],
    ]
  }

now = Date.now()
decreaser = 0
for (i = 0; i < table.values.length; i++) {
  anon = table.values[i]
  anon[0] = (now - decreaser)
  decreaser += 1000000
}

app.all('/', function(req, res) {
  respond(res, 'Here is what you get')
})

app.all('/search', function(req, res){
  var result = []
  timeserie.map(ts => result.push(ts.target))
  respond(res, result)
})

app.all('/annotations', function(req, res) {
  debug(req.url)
  debug(req.body)
  respond(res, annotations)
})

app.options('/query', function(req, res){
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  respond(res, [])
})

app.post('/query', function(req, res){
  debug(req.url)
  debug(req.body)
  var startTs = moment(req.body.range.to, moment.ISO_8601).valueOf()
  var endTs = moment(req.body.range.from, moment.ISO_8601).valueOf()
  var targets = req.body.targets
  debug('startTs ', startTs, 'endTs' , endTs)
  var startKey = [{name:'ts', string: startTs.toString()}]
  var endKey = [{name:'ts', string: endTs.toString()}]
  var limit = req.body.maxDataPoints
  var client = req.app.get('client')
  const promise = cf.map(function*(t) {
    var dbRes = yield client.readRange(t.from, startKey, endKey, limit)
    var datapoints = extractDatapoints(dbRes, t.select, t.where)
    var map = new Map()
    var targetMap = datapoints.reduce((acc, m) => {
      m.forEach((v,k) => {
        var obj = (acc.get(k) || []).concat(v)
        acc.set(k, obj)
      })
      return acc
    }, map)
    var respObj = []
    targetMap.forEach((v,k) => {
      respObj.push({
        'target': (t.refId).concat('.', k),
        'datapoints': v
      })
    })
    return respObj
  }, targets)
  promise.then(result => {
    var data = result.reduce((acc, arr) => {return acc.concat(arr)}, [])
    respond(res, data)
  })
})

function extractDatapoints(dbRes, select, where_) {
  var response = dbRes.response
  var keyColumnsList = response.keyColumnsList
  var list = keyColumnsList.list
  var where = parseWhere(where_)
  var filteredList = list.filter(kvp => {return applyWhereFilter(kvp, where)})
  return filteredList.map(kvp => {return parseKvp(kvp, select)})
}

function parseWhere(where) {
  return where.map(e => { return jsep(e) })
}

function applyWhereFilter(kvp, where){
  var all = kvp.key.concat(kvp.columns)
  var list = all.map(field => {
    return where.reduce((acc, obj) => {
      var leftCmp = (obj.left.name || obj.left.value)
      var rightCmp = (obj.right.name || obj.right.value)
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
  var bool = false
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

function parseKvp(kvp, select){
  var all = kvp.key.concat(kvp.columns)
  var ts = kvp.key.filter(k => {return findTs(k)}).map(v => {return getValue(v)})[0]
  var filtered = all.filter(field => { return applySelectFilter(field, select)})
  var intTs = ts*1000
  var map = new Map()
  return filtered.reduce((acc, col) => {
    var dp = [getValue(col), intTs]
    var obj = (acc.get(col.name) || []).concat([dp])
    return acc.set(col.name, obj)
  }, map)
}

function findTs(k) {
  if (k.name === 'ts') { return true }
}

function getValue(c) {
  var val = Object.values(c)[1]
  var res = null
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

function respond(res, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.json(obj)
  res.end()
}

//function clone(obj) {
//  return Object.assign({}, obj)
//  return JSON.parse(JSON.stringify(obj))
//}

if (require.main === module) {
  const client = new pundunjs({
    host: '192.168.211.150',
    port: '8887',
    username: 'admin',
    password: 'admin'
  })
  co(function*() {
    var table = 'gexample'
    yield client.connect()
    yield client.deleteTable(table).catch()
    yield client.createTable(table, ['ts']).catch()
    var ts = moment().unix().valueOf()
    var N = 1000
    var arr = Array.apply(null, {length: N}).map(Number.call, Number)
    yield arr.map(a => {
      var t = ts + a
      var col2 = Math.sin((t % 90) * Math.PI / 180) * 10
      client.write(table,
        [{name:'ts', string: t.toString()}],
        [{name: 'col1', int: t % 10},
         {name: 'col2', double: col2},
         {name: 'col3', string: 'example'}])
    })
    const port = '8087'
    app.listen(port)
    app.set('client', client)
    debug('Server is listening to port', port)
  })
}
