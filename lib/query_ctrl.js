import {QueryCtrl} from 'app/plugins/sdk'
import './css/query-editor.css!'

export class PundunQueryCtrl extends QueryCtrl {
  constructor($scope, $injector, uiSegmentSrv) {
    super($scope, $injector)
    this.scope = $scope
    this.uiSegmentSrv = uiSegmentSrv
    this.target.select = this.target.select || []
    this.selectSegments = this.target.select.map(s => {
      return uiSegmentSrv.newSegment({fake: true, value: s})
    })
    this.selectSegments.push(uiSegmentSrv.newPlusButton())
    this.target.from = this.target.from || '-- enter table name --'
    this.target.where = this.target.where || []
    this.whereSegments = this.target.where.map(w => {
      return uiSegmentSrv.newSegment({fake: true, value: w })
    })
    this.whereSegments.push(uiSegmentSrv.newPlusButton())
    this.removeTagFilterSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove --'})
  }

  getOptions() {
    return this.datasource.metricFindQuery(this.target)
      .then(this.uiSegmentSrv.transformToSegments(false))
    // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
  }

  toggleEditorMode() {
    this.target.query = 'SELECT ' + this.target.select +
                        ' FROM ' + this.target.from +
                        ' WHERE '  + this.target.where
    this.target.rawQuery = !this.target.rawQuery
  }

  onChangeInternal() {
    this.panelCtrl.refresh() // Asks the panel to refresh data.
  }

  onSelectSegment(segment) {
    return this.datasource.metricFindQuery(this.target)
    .then(this.uiSegmentSrv.transformToSegments(true))
    .then(results => {
      if (segment.type === 'key') {
        results.splice(0, 0, this.clone(this.removeTagFilterSegment))
      }
      return results
    })
  }

  onSelectUpdate(segment, index) {
    if (segment.value === this.removeTagFilterSegment.value) {
      this.target.select.splice(index, 1)
      this.selectSegments.splice(index, 1)
    } else {
      this.select[index] = this.clone(segment.value)
      this.selectSegments[index] = segment
      this.selectSegments[index].type = 'key'
      if (this.selectSegments[this.selectSegments.length-1].type !== 'plus-button') {
        this.selectSegments.push(this.uiSegmentSrv.newPlusButton())
      }
    }
  }

  onWhereSegment(segment) {
    return this.datasource.metricFindQuery(this.target)
    .then(this.uiSegmentSrv.transformToSegments(true))
    .then(results => {
      if (segment.type === 'condition') {
        results.splice(0, 0, this.clone(this.removeTagFilterSegment))
      }
      return results
    })
  }

  onWhereUpdate(segment, index) {
    if (segment.value === this.removeTagFilterSegment.value) {
      this.target.where.splice(index, 1)
      this.whereSegments.splice(index, 1)
    } else {
      this.target.where[index] = this.clone(segment.value)
      this.whereSegments[index] = segment
      this.whereSegments[index].type = 'condition'
      if (this.whereSegments[this.whereSegments.length-1].type !== 'plus-button') {
        this.whereSegments.push(this.uiSegmentSrv.newPlusButton())
      }
    }
  }

  getCollapsedText() {
    this.target.query = 'SELECT ' + this.target.select +
                        ' FROM ' + this.target.from +
                        ' WHERE '  + this.target.where
  }

  clone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }
}

PundunQueryCtrl.templateUrl = 'partials/query.editor.html'
