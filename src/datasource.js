export class PundunDatasource {
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type
    this.url = instanceSettings.url
    this.name = instanceSettings.name
    this.host = instanceSettings.jsonData.host
    this.port = instanceSettings.jsonData.port
    this.user = instanceSettings.jsonData.user
    this.password = instanceSettings.jsonData.password
    this.q = $q
    this.backendSrv = backendSrv
    this.templateSrv = templateSrv
  }

  query(options) {
    var query = this.buildQueryParameters(options)
    query.targets = query.targets.filter(function (t) {
      return !t.hide
    })
    if (query.targets.length <= 0) {
      return this.q.when({ data: [] })
    }

    return this.backendSrv.datasourceRequest({
      url: this.url + '/query',
      data: query,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  }

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/',
      params: {
        name: this.name,
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password
      },
      method: 'GET'
    }).then(function (response) {
      if (response.status === 200) {
        return { status: 'success', message: 'Data source is working', title: 'Success' }
      }
    })
  }

  annotationQuery(options) {
    var query = this.templateSrv.replace(options.annotation.query, {}, 'glob')
    var annotationQuery = {
      range: options.range,
      annotation: {
        name: options.annotation.name,
        datasource: options.annotation.datasource,
        enable: options.annotation.enable,
        iconColor: options.annotation.iconColor,
        query: query
      },
      rangeRaw: options.rangeRaw
    }

    return this.backendSrv.datasourceRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: annotationQuery
    }).then(function (result) {
      return result.data
    })
  }

  metricFindQuery(options) {
    let table
    if (options.from !== '-- enter table name --') {
      table = options.from
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + '/search',
      data: {
        datasource: this.name,
        table: table
      },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(this.mapToTextValue)
  }

  mapToTextValue(result) {
    return result.data.map( (d,i) => {
      if (d && d.text && d.value) {
        return { text: d.text, value: d.value }
      } else if (typeof(d) === 'object') {
        return { text: d, value: i }
      }
      return { text: d, value: d }
    })
  }

  buildQueryParameters(options) {
    var _this = this
    //remove placeholder targets
    options.targets = options.targets.filter(target => {
      let s = target.select.length > 0
      let f = target.from !== '-- enter table name --'
      return s && f
    })

    var targets = options.targets.map(target => {
      return {
        target: _this.templateSrv.replace(target.target),
        refId: target.refId,
        select: target.select,
        from: target.from,
        timeField: target.timeField,
        precision: target.precision,
        where: target.where || '',
        resultFormat : target.resultFormat
      }
    })
    options.datasource = this.name
    options.targets = targets

    return options
  }
}
