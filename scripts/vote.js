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
        parseBlt(text);
      };
      reader.readAsText(this.files[0]);
    }
  });
});

function parseBlt(text) {
  const withdrawn = [];
  const ballots = new Map();
  const candidates = [];

  let tokens = tokenize(text);

  let i = 0;
  const candidateCount = Number(tokens[i++]);

  const seatCount = Number(tokens[i++]);

  let token = Number(tokens[i++]);
  while (token < 0) {
    withdrawn.push(-token);
    token = Number(tokens[i++]);
  }

  do {
    let weight = token;
    token = Number(tokens[i++]);
    let ballot = [];
    while (token != 0) {
      ballot.push(token);
      token = Number(tokens[i++]);
    }
    ballots.set(ballot, (ballots.get(ballot) || 0) + weight);
    token = Number(tokens[i++]);
  } while (token != 0);

  let index = 0;
  for (let c  = 0; c < candidateCount; c++) {
    token = tokens[i++];
    if (!withdrawn.includes(c + 1)) {
      candidates[index] = {
        "name" : token,
        "lastName": token.substring(token.lastIndexOf(' ') + 1),
        "id": c + 1
      }
      index++;
    }
  }

  token = tokens[i++];
  const title = token;

  return {
    "seatCount" : seatCount,
    "ballots" : ballots,
    "candidates" : candidates,
    "title" : title
  };
}

function tokenize(text) {
    text = text.replace(/^\uFEFF/, '')  // remove BOM
    text = text.replaceAll(/(#[^\r\n]*)?\r?\n/g, ' ').replace(/#.*$/, '');  // remove comments
    let stringStart = text.indexOf('"');
    let tokens = text.slice(0, stringStart).split(/\s+/);
    tokens.pop(); // remove last empty token
    let stringTokens = text.slice(stringStart + 1, text.lastIndexOf('"')).split(/"\s+"/);
    tokens.push(...stringTokens);
    return tokens;
}