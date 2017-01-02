FROM ubuntu:14.04
MAINTAINER Buildcave, LLC "trevor@buildcave.com"

# Update packages
RUN sudo apt-get update -y
RUN sudo apt-get upgrade -y

# Install some packages we need
RUN apt-get install -y curl

#Install Node.JS latest 4.x version
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
RUN sudo apt-get install -y nodejs

#gzip for gzip dependency
RUN sudo apt-get install -y gzip
RUN sudo apt-get install -y unzip

# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
ADD package.json /tmp/package.json

RUN cd /tmp && npm install

RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/

# Bundle app source
ADD . /opt/app

WORKDIR /opt/app

#start the app
EXPOSE 3000

CMD ["node", "--stack-size=8192", "--max-old-space-size=8192", "./app.js"]
