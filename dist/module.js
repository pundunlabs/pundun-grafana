import {PundunDatasource} from './datasource'
import {PundunQueryCtrl} from './query_ctrl'

class PundunConfigCtrl {}
PundunConfigCtrl.templateUrl = 'partials/config.html'

class PundunQueryOptionsCtrl {}
PundunQueryOptionsCtrl.templateUrl = 'partials/query.options.html'

class PundunAnnotationsQueryCtrl {}
PundunAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html'

export {
  PundunDatasource as Datasource,
  PundunQueryCtrl as QueryCtrl,
  PundunConfigCtrl as ConfigCtrl,
  PundunQueryOptionsCtrl as QueryOptionsCtrl,
  PundunAnnotationsQueryCtrl as AnnotationsQueryCtrl
}
