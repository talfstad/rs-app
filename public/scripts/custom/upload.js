$(document).ready(function() {

    status('Choose a file :)');

    // Check to see when a user has selected a file                                                                                                                
/*    var timerId;
    timerId = setInterval(function() {
    if($('#file_field').val() !== '') {
            clearInterval(timerId);

            $('#uploadForm').submit();
        }
    }, 500);*/

    $('#upload').click(function() {
        status('uploading the file ...');

        $('#uploadForm').ajaxSubmit({                                                                                                                 

            error: function(xhr) {
                status('Error: ' + xhr.status);
            },

            success: function(response) {
                if(response.error) {
                    status('Opps, something bad happened');
                    return;
                }
         
                var urlOnServer = response.path;
         
                status('Success, file uploaded to:' + urlOnServer);            
            }
        });

        // Have to stop the form from submitting and causing                                                                                                       
        // a page refresh - don't forget this                                                                                                                      
        return false;
    });

    function status(message) {
        $('#status').text(message);
    }
});