var config = {}

config.server = {}
config.grafana = {}

config.server.port = process.env.PUNDUN_GRAFANA_PORT || '8087'
config.grafana.host =  process.env.GRAFANA_HOST || 'localhost'
config.grafana.port =  process.env.GRAFANA_PORT || '3000'
config.grafana.apiKey = 'eyJrIjoiZ3ZQbFpKdXFjRnBVV3plMEUwUXFxVjFzOVN5N3ZKZjQiLCJuIjoicHVuZHVuIiwiaWQiOjJ9'

module.exports = config
