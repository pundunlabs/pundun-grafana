'use strict';

System.register(['app/plugins/sdk', './css/query-editor.css!'], function (_export, _context) {
  "use strict";

  var QueryCtrl, _createClass, PundunQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  return {
    setters: [function (_appPluginsSdk) {
      QueryCtrl = _appPluginsSdk.QueryCtrl;
    }, function (_cssQueryEditorCss) {}],
    execute: function () {
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

      _export('PundunQueryCtrl', PundunQueryCtrl = function (_QueryCtrl) {
        _inherits(PundunQueryCtrl, _QueryCtrl);

        function PundunQueryCtrl($scope, $injector, uiSegmentSrv) {
          _classCallCheck(this, PundunQueryCtrl);

          var _this = _possibleConstructorReturn(this, (PundunQueryCtrl.__proto__ || Object.getPrototypeOf(PundunQueryCtrl)).call(this, $scope, $injector));

          _this.scope = $scope;
          _this.uiSegmentSrv = uiSegmentSrv;
          _this.target.select = _this.target.select || [];
          _this.selectSegments = _this.target.select.map(function (s) {
            return uiSegmentSrv.newSegment({ fake: true, value: s });
          });
          _this.selectSegments.push(uiSegmentSrv.newPlusButton());
          _this.target.from = _this.target.from || '-- enter table name --';
          _this.target.where = _this.target.where || [];
          _this.whereSegments = _this.target.where.map(function (w) {
            return uiSegmentSrv.newSegment({ fake: true, value: w });
          });
          _this.whereSegments.push(uiSegmentSrv.newPlusButton());
          _this.removeTagFilterSegment = uiSegmentSrv.newSegment({ fake: true, value: '-- remove --' });
          return _this;
        }

        _createClass(PundunQueryCtrl, [{
          key: 'getOptions',
          value: function getOptions() {
            return this.datasource.metricFindQuery(this.target).then(this.uiSegmentSrv.transformToSegments(false));
            // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
          }
        }, {
          key: 'toggleEditorMode',
          value: function toggleEditorMode() {
            this.target.query = 'SELECT ' + this.target.select + ' FROM ' + this.target.from + ' WHERE ' + this.target.where;
            this.target.rawQuery = !this.target.rawQuery;
          }
        }, {
          key: 'onChangeInternal',
          value: function onChangeInternal() {
            this.panelCtrl.refresh(); // Asks the panel to refresh data.
          }
        }, {
          key: 'onSelectSegment',
          value: function onSelectSegment(segment) {
            var _this2 = this;

            return this.datasource.metricFindQuery(this.target).then(this.uiSegmentSrv.transformToSegments(true)).then(function (results) {
              if (segment.type === 'key') {
                results.splice(0, 0, _this2.clone(_this2.removeTagFilterSegment));
              }
              return results;
            });
          }
        }, {
          key: 'onSelectUpdate',
          value: function onSelectUpdate(segment, index) {
            if (segment.value === this.removeTagFilterSegment.value) {
              this.target.select.splice(index, 1);
              this.selectSegments.splice(index, 1);
            } else {
              this.target.select[index] = this.clone(segment.value);
              this.selectSegments[index] = segment;
              this.selectSegments[index].type = 'key';
              if (this.selectSegments[this.selectSegments.length - 1].type !== 'plus-button') {
                this.selectSegments.push(this.uiSegmentSrv.newPlusButton());
              }
            }
          }
        }, {
          key: 'onWhereSegment',
          value: function onWhereSegment(segment) {
            var _this3 = this;

            return this.datasource.metricFindQuery(this.target).then(this.uiSegmentSrv.transformToSegments(true)).then(function (results) {
              if (segment.type === 'condition') {
                results.splice(0, 0, _this3.clone(_this3.removeTagFilterSegment));
              }
              return results;
            });
          }
        }, {
          key: 'onWhereUpdate',
          value: function onWhereUpdate(segment, index) {
            if (segment.value === this.removeTagFilterSegment.value) {
              this.target.where.splice(index, 1);
              this.whereSegments.splice(index, 1);
            } else {
              this.target.where[index] = this.clone(segment.value);
              this.whereSegments[index] = segment;
              this.whereSegments[index].type = 'condition';
              if (this.whereSegments[this.whereSegments.length - 1].type !== 'plus-button') {
                this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
              }
            }
          }
        }, {
          key: 'getCollapsedText',
          value: function getCollapsedText() {
            this.target.query = 'SELECT ' + this.target.select + ' FROM ' + this.target.from + ' WHERE ' + this.target.where;
          }
        }, {
          key: 'clone',
          value: function clone(obj) {
            return JSON.parse(JSON.stringify(obj));
          }
        }]);

        return PundunQueryCtrl;
      }(QueryCtrl));

      _export('PundunQueryCtrl', PundunQueryCtrl);

      PundunQueryCtrl.templateUrl = 'partials/query.editor.html';
    }
  };
});