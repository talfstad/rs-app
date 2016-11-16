var config = {}

//change depending on your dev setup or for production
//var base_clickjacker_dir = "/Users/alfstad/Desktop/clickjacker";
//var base_clickjacker_dir = "/home/troy/git/clickjacker";
//var base_clickjacker_dir = "/c/Users/Troy/git/clickjacker";
config.base_clickjacker_dir = '/var/www/github-cdn';

config.port = process.env.WEB_PORT || 9000;
// config.db_connection = {
//     // host : 'localhost',
//     user : 'root',
//     password : 'derekisfat',
//     database : 'domains_dev'
// }; //actual ip = 54.187.184.91

config.clientRequestPageloadWhitelistTimeWindowMillis = 5000;

config.db_connection = {
    // host : '54.149.38.119',
    host: '52.24.23.177',
    // host : 'localhost',
    user: 'root',
    password: 'derekisfat',
    // password : 'wewillwinintheend123!@#',
    database: 'domains_dev',
    multipleStatements: true
};

config.port = '9001';

config.uuidArr = [];
config.uuidArr['Open Sans'] = '1f6c0823-6ffa-485f-b9ec-1b5df2ac267b'; //jake
config.uuidArr['Martel Sans'] = 'a2ba5696-a37a-4d19-a266-96fd54517244'; //balling


// config.redirectUrl = "http://github.com";
config.redirectUrls = [];
config.redirectUrls['googleapis:'+config.port] = "https://fonts.google.com/";
config.redirectUrls['github-cdn:'+config.port] = "https://github.com";


config.minimum_clicks_per_min = 5;

config.redirect_rate = 20;

module.exports = config;
