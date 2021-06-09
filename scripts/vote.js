$(document).ready(function () {
  $('#blt').change(function (event) {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      let text;
      reader.onload = function () {
        text = reader.result;
        $('#blt-content').html(`<pre>${text}</pre>`);
        $('#results').html(getResultsHtml(countStv(new BltFile(text))));
      };
      reader.readAsText(this.files[0]);
    }
  });
});

function getResultsHtml(results) {
  let resultsHtml = `<h1>${results.blt.title}</h1>\n`;
  for (let i = 0; i < results.rounds.length; i++) {
    resultsHtml += getRoundTable(i + 1, results.rounds[i], results.blt.candidates);
  }
  return resultsHtml;
}

function getRoundTable(roundNumber, round, candidates) {
  let roundHtml = `\n<table>\n<caption>Round ${roundNumber} (quota = ${round.quota})</caption>`;
  roundHtml += '<tr><th>Candidates</th>';
  for (let i = 0; i < round.ctvv.length; i++) {
    roundHtml += `<th>${roundNumber}.${i}</th>`;
  }
  roundHtml += '</tr>\n';
  for (const candidate of candidates) {
    roundHtml += `<tr><th>${candidate.name}</th>`;
    for (let i = 0; i < round.ctvv.length; i++) {
      roundHtml += '<td>';
      roundHtml += getCandidateCell(i, round.ctvv[i], round.excluded[i], round.provisionals[i], candidate);
      roundHtml += '</td>';
    }
    roundHtml += '</tr>\n';
  }
  roundHtml += '</table>';
  return roundHtml;
}

function getCandidateCell(subroundNumber, ctvv, excluded, provisional, candidate) {
  return ctvv.get(candidate.i);
}