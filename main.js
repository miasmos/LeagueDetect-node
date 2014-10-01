var fs = require('fs');
var moment = require('moment');
var events = require('events');

function LeagueDetect(opts) {
  if (typeof opts === 'undefined') {
    this.opts = {}
  } else {
    this.opts = opts;
  }

  if (!this.opts.path) {
    this.opts.path = 'C:\\Riot Games\\League of Legends';
  }
  this.opts.fullpath = this.opts.path + '\\Logs\\Game - R3d Logs\\';

  this.events = new events.EventEmitter();
  this._reset();
  this._main();
}

LeagueDetect.prototype._main = function() {
  var self = this;

  this.mainInterval = setInterval(function() {
    if (!this.appTimeout) {
      if (self.lastLine == -1 && self.file == null && !self.appTimeout) {
        self._getNewestFile(self.opts.fullpath, function(file) {
          if (file) {
            if (self._isRecentFile(file.ctime) && self._isRecentlyModifiedFile(file.mtime) && !self.appTimeout) {
              console.log('Found game');
              self.waiting = false;
              self.file = file;
              self._readLines(self.file.file, function(line, data, end) {
                self._checkForEvent(data);
                if (end) {self.lastLine = line;}
              });
            } else {
              if (self.waiting != true) {
                self.waiting = true;
                console.log('Waiting for game to start...');
                self.events.emit('Waiting');
              }
            }
          }
        });
      } else if (self.lastLine != -1 && self.file != null && !self.appTimeout) {
        self._readLines(self.file.file, function(line, data, end) {
          if (line > self.lastLine) {
            self._checkForEvent(data);
            if (end && self.file != null && self.inProgress == true) {self.lastLine = line;}
          }
        });
      }
    }
  }, 1000);
}

LeagueDetect.prototype._reset = function(timeout) {
  if (timeout == true) {
    this.appTimeout = true;
    var self = this;
    setTimeout(function(){self.appTimeout = false;}, 2000);
  }
  this.lastLine = -1;
  this.file = null;
  this.inProgress = false;
  this.waiting = false;
}

LeagueDetect.prototype._checkForEvent = function(data) {
  if (this._contains('Logging started at ', data)) {
    console.log('LogStart');
    this.events.emit('LogStart');
    return;
  }
  if (this._contains('Timeout while waiting for client ID', data)) {
    console.log('LoadConnectError');
    this.events.emit('LoadConnectError');
    return;
  }
  if (this._contains('Received client ID', data) || this._contains('Spectator server version retrieved', data)) {
    console.log('LoadStart');
    this.inProgress = true;
    this.events.emit('LoadStart');
    return;
  }
  if (this._contains('GAMESTATE_GAMELOOP HUDProcess', data)) {
    console.log('GameStart');
    this.events.emit('GameStart');
    return;
  }
  if (this._contains('ERROR| Failed to connect to ', data)) {
    console.log('ReplayConnectError');
    this.events.emit('ReplayConnectError');
    return;
  }
  if (this._contains('ERROR| Replay download disabled', data)) {
    console.log('ReplayEndGameError');
    this.events.emit('ReplayEndGameError');
    return;
  }
  if (this._contains('ERROR| Crash occurred', data)) {
    console.log('CrashError');
    this.events.emit('CrashError');
    return;
  }
  if (this._contains('Finished Main Loop', data)) {
    console.log('GameEnd');
    this.events.emit('GameEnd');
    return;
  }
  if (this._contains('Exiting WinMain', data)) {
    console.log('LogEnd');
    this.events.emit('LogEnd');
    this._reset(true);
    return;
  }
}

LeagueDetect.prototype._contains = function(needle, stack) {
  return stack.indexOf(needle) > -1;
}

LeagueDetect.prototype._getNewestFile = function(dir, callback) {
  if (!callback) return;

  fs.readdir(dir, function(err, files) {
    if (err) {console.log(err); callback();}
    if (!files || (files && files.length === 0)) {
        callback();
    }
    if (files.length === 1) {
        callback(files[0]);
    }
    var newest = { file: files[0] };
    var checked = 0;
    fs.stat(dir + newest.file, function(err, stats) {
        newest.mtime = stats.mtime;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            (function(file) {
                fs.stat(file, function(err, stats) {
                    ++checked;
                    if (stats.mtime.getTime() > newest.mtime.getTime()) {
                        newest = { file : file, mtime : stats.mtime, ctime : stats.ctime };
                    }
                    if (checked == files.length) {
                        callback(newest);
                    }
                });
            })(dir + file);
        }
    });
  });
}

LeagueDetect.prototype._readLines = function(file, func) {
  var input = fs.createReadStream(file);
  var remaining = '';
  var lineNum = 0;

  input.on('data', function(data) {
    remaining += data;
    var index = remaining.indexOf('\n');
    var last  = 0;
    while (index > -1) {
      var line = remaining.substring(last, index);
      last = index + 1;
      func(++lineNum, line, 0);
      index = remaining.indexOf('\n', last);
    }

    remaining = remaining.substring(last);
  });

  input.on('end', function() {
    if (remaining.length > 0) {
      func(++lineNum, remaining, 1);
    } else {
      func(lineNum, '', 1);
    }
  });
}
LeagueDetect.prototype._isRecentFile = function(timestamp) {
  return this._timestampDiff(timestamp, 'minutes', 120);
}

LeagueDetect.prototype._isRecentlyModifiedFile = function(timestamp) {
  return this._timestampDiff(timestamp, 'seconds', 2);
}

LeagueDetect.prototype._timestampDiff = function(timestamp, interval, target) {
  var a = moment(timestamp);
  var b = moment(new Date());
  return b.diff(a, interval) < target;
}

var opts = {path: 'E:\\Applications\\League of Legends'}
var ld = new LeagueDetect(opts);

module.exports = LeagueDetect;