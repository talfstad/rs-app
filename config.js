var config = {}

//change depending on your dev setup or for production
//var base_clickjacker_dir = "/Users/alfstad/Desktop/clickjacker";
//var base_clickjacker_dir = "/home/troy/git/clickjacker";
//var base_clickjacker_dir = "/c/Users/Troy/git/clickjacker";
config.base_clickjacker_dir = '/var/www/github-cdn';

config.port = process.env.WEB_PORT || 9000;
config.db_connection = {
    host : 'localhost',
    user : 'root',
    password : 'derekisfat',
    database : 'domains_dev'
}; //actual ip = 54.187.184.91

module.exports = config;