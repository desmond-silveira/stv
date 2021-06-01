/**
 * Copyright © 2018 Desmond Silveira.  All rights reserved.
 *
 * This software is free to use and extend to all registered members of the
 * American Solidarity Party.  Any extensions must give credit to the author
 * and preserve this notice.
 */

$(document).ready(function () {
  $('#blt').change(function (event) {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      let text;
      reader.onload = function () {
        text = reader.result;
        $('#blt-content').html('<pre>' + text + '</pre>');
      };
      reader.readAsText(this.files[0]);
    }
  });
});