var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var methodOverride = require('method-override')
var moment = require('moment')
var pundunjs = require('pundunjs')

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
//const Client = pundunjs

/*const client = new Client({
  host: '192.168.211.150',
  port: '8887',
  username: 'admin',
  password: 'admin'
})
*/
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
  { annotation: annotation, 'title': 'Donlad trump is kinda funny', 'time': 1450754160000, text: 'teeext', tags: 'taaags' },
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
  debug('startTs ', startTs, 'endTs' , endTs)
  var startKey = [{name:'ts', string: startTs.toString()}]
  var endKey = [{name:'ts', string: endTs.toString()}]
  var client = req.app.get('client')
  var dbRes = client.readRange(req.app.get('table'), startKey, endKey, 1500)
  debug('dbRes', dbRes)
  var tsResult = []
  respond(res, tsResult)
})

function respond(res, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.json(obj)
  res.end()
}

//function clone(obj) {
//  return JSON.parse(JSON.stringify(obj))
//}

if (require.main === module) {
  const client = new pundunjs({
    host: '192.168.211.150',
    port: '8887',
    username: 'admin',
    password: 'admin'
  })
  const co = require('co')
  co(function*() {
    var table = 'gexample'
    yield client.connect()
    //yield client.deleteTable(table)
    client.createTable(table, ['ts'])
    var ts = moment().unix().valueOf()
    yield client.write(table,
        [{name:'ts', string: ts.toString()}],
        [{name: 'col1', string: ts.toString()}])
    const port = '8087'
    app.listen(port)
    app.set('client', client)
    app.set('table', table)
    debug('Server is listening to port', port)
  })
}
