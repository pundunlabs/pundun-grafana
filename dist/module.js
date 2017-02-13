'use strict';

System.register(['./datasource', './query_ctrl'], function (_export, _context) {
  "use strict";

  var PundunDatasource, PundunQueryCtrl, PundunConfigCtrl, PundunQueryOptionsCtrl, PundunAnnotationsQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_datasource) {
      PundunDatasource = _datasource.PundunDatasource;
    }, function (_query_ctrl) {
      PundunQueryCtrl = _query_ctrl.PundunQueryCtrl;
    }],
    execute: function () {
      _export('ConfigCtrl', PundunConfigCtrl = function PundunConfigCtrl() {
        _classCallCheck(this, PundunConfigCtrl);
      });

      PundunConfigCtrl.templateUrl = 'partials/config.html';

      _export('QueryOptionsCtrl', PundunQueryOptionsCtrl = function PundunQueryOptionsCtrl() {
        _classCallCheck(this, PundunQueryOptionsCtrl);
      });

      PundunQueryOptionsCtrl.templateUrl = 'partials/query.options.html';

      _export('AnnotationsQueryCtrl', PundunAnnotationsQueryCtrl = function PundunAnnotationsQueryCtrl() {
        _classCallCheck(this, PundunAnnotationsQueryCtrl);
      });

      PundunAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';

      _export('Datasource', PundunDatasource);

      _export('QueryCtrl', PundunQueryCtrl);

      _export('ConfigCtrl', PundunConfigCtrl);

      _export('QueryOptionsCtrl', PundunQueryOptionsCtrl);

      _export('AnnotationsQueryCtrl', PundunAnnotationsQueryCtrl);
    }
  };
});