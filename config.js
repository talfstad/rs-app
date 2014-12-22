var config = {}

config.base_clickjacker_dir = '/c/Users/Troy/git/clickjacker';

config.port = process.env.WEB_PORT || 9000;
config.db_connection = {
    host : '54.187.184.91',
    user : 'root',
    password : 'derekisfat',
    database : 'domains_dev'
}; //actual ip = 54.187.184.91

module.exports = config;