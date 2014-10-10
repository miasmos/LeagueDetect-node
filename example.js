var leagueDetect = require('./main.js');
var opts = {path: 'E:\\Applications\\League of Legends'};
var ld = new leagueDetect(opts);

ld.events.on('LoadStart', function(evt) {
  console.log('Loading has started!');
});