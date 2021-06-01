$(document).ready(function () {
  $("#blt").change(function (event) {
    if (this.files && this.files[0]) {
      var reader = new FileReader();
      var text;
      reader.onload = function () {
        text = reader.result;
        $("#blt-content").html("<pre>" + text + "</pre>");
      };
      reader.readAsText(this.files[0]);

      
    }
  });
});