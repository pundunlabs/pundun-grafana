export class PundunDatasource {
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type
    this.url = instanceSettings.url
    this.name = instanceSettings.name
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
    var target = typeof options === 'string' ? options : options.target
    var interpolated = {
      target: this.templateSrv.replace(target, null, 'regex')
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + '/search',
      data: interpolated,
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
      return target.target !== 'select metric'
    })

    var targets = options.targets.map(target => {
      return {
        target: _this.templateSrv.replace(target.target),
        refId: target.refId,
        hide: target.hide,
        select: target.select,
        from: target.from,
        where: target.where || ''
      }
    })

    options.targets = targets

    return options
  }
}
