'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var _typeof, _createClass, PundunDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [],
    execute: function () {
      _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
      } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };

      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('PundunDatasource', PundunDatasource = function () {
        function PundunDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, PundunDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.host = instanceSettings.jsonData.host;
          this.port = instanceSettings.jsonData.port;
          this.user = instanceSettings.jsonData.user;
          this.password = instanceSettings.jsonData.password;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
        }

        _createClass(PundunDatasource, [{
          key: 'query',
          value: function query(options) {
            var query = this.buildQueryParameters(options);
            query.targets = query.targets.filter(function (t) {
              return !t.hide;
            });
            if (query.targets.length <= 0) {
              return this.q.when({ data: [] });
            }

            return this.backendSrv.datasourceRequest({
              url: this.url + '/query',
              data: query,
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
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
                return { status: 'success', message: 'Data source is working', title: 'Success' };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
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
            };

            return this.backendSrv.datasourceRequest({
              url: this.url + '/annotations',
              method: 'POST',
              data: annotationQuery
            }).then(function (result) {
              return result.data;
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(options) {
            var table = void 0;
            if (options.from !== '-- enter table name --') {
              table = options.from;
            }
            return this.backendSrv.datasourceRequest({
              url: this.url + '/search',
              data: {
                datasource: this.name,
                table: table
              },
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }).then(this.mapToTextValue);
          }
        }, {
          key: 'mapToTextValue',
          value: function mapToTextValue(result) {
            return result.data.map(function (d, i) {
              if (d && d.text && d.value) {
                return { text: d.text, value: d.value };
              } else if ((typeof d === 'undefined' ? 'undefined' : _typeof(d)) === 'object') {
                return { text: d, value: i };
              }
              return { text: d, value: d };
            });
          }
        }, {
          key: 'buildQueryParameters',
          value: function buildQueryParameters(options) {
            var _this = this;
            //remove placeholder targets
            options.targets = options.targets.filter(function (target) {
              var s = target.select.length > 0;
              var f = target.from !== '-- enter table name --';
              return s && f;
            });

            var targets = options.targets.map(function (target) {
              return {
                target: _this.templateSrv.replace(target.target),
                refId: target.refId,
                select: target.select,
                from: target.from,
                timeField: target.timeField,
                precision: target.precision,
                where: target.where || ''
              };
            });
            options.datasource = this.name;
            options.targets = targets;

            return options;
          }
        }]);

        return PundunDatasource;
      }());

      _export('PundunDatasource', PundunDatasource);
    }
  };
});