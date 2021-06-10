/**
 * Copyright © 2021 Desmond Silveira.  All rights reserved.
 *
 * This software is free to use and extend to all registered members of the
 * American Solidarity Party.  Any extensions must give credit to the author
 * and preserve this notice.
 */

/** An election candidate. */
class Candidate {
  static map = new Map();
  name;
  lastName;
  i;

  constructor(i, name) {
    this.name = name;
    this.i = i;
    this.lastName = name.substring(name.lastIndexOf(' ') + 1);
    Candidate.map.set(i, this);
  }
}

/** A ballot of ranked choices for a single contest. */
class Ballot {
  candidates = [];
  value = 1;

  /**
   * Returns the next preference after the given candidate from among the
   * continuing candidates.
   * @param {!number} candidate The id of the candidate.
   * @param {!Array<!Candidate>} continuing Continuing candidates.
   * @return {number} The id of the next continuing candidate.
   */
  nextPreference(candidate, continuing) {
    let found = false;
    for (const c of this.candidates) {
      if (!found) {
        found = c == candidate;
      } else if (continuing.includes(Candidate.map.get(c))) {
        return c;
      }
    }
    return null;
  }

  clone() {
    const clone = new Ballot();
    clone.candidates = [...this.candidates];
    clone.value = this.value;
    return clone;
  }
}

class StvResult {
  /** {!BltFile} */
  blt;
  /** {!Array{?StvRound}} */
  rounds = [];

  constructor(blt) {
    this.blt = blt;
  }

  startNewRound() {
    this.rounds.push(new StvRound());
  }

  getCurrentRound() {
    return this.rounds[this.rounds.length - 1];
  }

  logSubround(ballotsByCandidate, exhausted, transferredProvisional, excluded) {
    const lastRound = this.getCurrentRound();
    const votes = new Map();
    for (const candidate of this.blt.candidates) {
      const ballots = ballotsByCandidate.get(candidate.i);
      let ctvv = 0;
      if (ballots) {
        ctvv = getCtvv(ballots);
      }
      votes.set(candidate.i, ctvv);
    }
    votes.set(0, getCtvv(exhausted));
    lastRound.ctvv.push(votes);
    lastRound.provisionals.push(transferredProvisional);
    for (const candidate of lastRound.provisionals) {
      if (candidate) {
        votes.set(candidate, lastRound.quota);
      }
    }
    lastRound.excluded.push(excluded);
  }
}

class StvRound {
  quota;
  /** {!Array<!Map<?Candidate, !number>} */
  ctvv = [];
  /** {!Array<!Array<!number>>} */
  provisionals = [];
  /** {!Array<!Array<!number>>} */
  excluded = [];
}

/**
 * A BLT file is a file, first described by Hill, Wichmann & Woodall in
 * "Algorithm 123 - Single Transferable Vote by Meek's method" (1987), for
 * capturing election results and metadata, particularly well-suited for STV
 * elections.
 */
class BltFile {
  candidateCount;
  seatCount;
  withdrawn = [];
  ballots = [];
  candidates = [];
  title;

  constructor(text) {
    let tokens = this.tokenize(text);
  
    let i = 0;
    this.candidateCount = Number(tokens[i++]);
  
    this.seatCount = Number(tokens[i++]);
  
    let token = Number(tokens[i++]);
    while (token < 0) {
      this.withdrawn.push(-token);
      token = Number(tokens[i++]);
    }
  
    do {
      let weight = token;
      token = Number(tokens[i++]);
      let ballot = new Ballot();
      while (token != 0) {
        ballot.candidates.push(token);
        token = Number(tokens[i++]);
      }
      for (let w = 0; w < weight; w++) {
        this.ballots.push(ballot)
      }
      token = Number(tokens[i++]);
    } while (token != 0);
  
    let index = 0;
    for (let c  = 0; c < this.candidateCount; c++) {
      token = tokens[i++];
      this.candidates.push(new Candidate(c + 1, token));
      index++;
    }

    token = tokens[i++];
    this.title = token;
  }

  tokenize(text) {
    // remove BOM
    text = text.replace(/^\uFEFF/, '')
    // remove comments
    text = text.replaceAll(/(#[^\r\n]*)?\r?\n/g, ' ').replace(/#.*$/, '');
    let stringStart = text.indexOf('"');
    let tokens = text.slice(0, stringStart).split(/\s+/);
    // remove last empty token
    tokens.pop();
    tokens.push(...text.slice(stringStart + 1, text.lastIndexOf('"')).split(/"\s+"/));
    return tokens;
  }
}

/**
 * Tallies the ballots for an election using Wright system STV rules.
 * @param {!BltFile} blt The BLT file.
 * @param {?Array<!number>} excluded The ids of candidates to be excluded from
 *     processing.
 * @returns {!StvResult} The results of the tally.
 */
function countStv(blt, results = new StvResult(blt), excluded = [...blt.withdrawn]) {
  results.startNewRound();
  const continuing = blt.candidates.filter(c => !excluded.includes(c.i));
  const exhausted = [];
  // Wright System 2.1
  const ballots = getNonExhaustedBallots(blt.ballots, excluded);
  // Wright System 2.2 and 2.3
  const ballotsByCandidate = assignBallots(ballots, excluded);
  // Wright System 2.4
  const totalVote = ballots.length;
  // Wright System 2.5
  const quota = getHagenbachBischoffQuota(totalVote, blt.seatCount);
  results.getCurrentRound().quota = quota;
  // Wright System 2.6
  const provisionals = getProvisionals(ballotsByCandidate, quota);

  results.logSubround(ballotsByCandidate, exhausted, null, [...excluded]);

  // Wright System 2.7
  if (provisionals.size == blt.seatCount) {
    return results;
  }
  // Wright System 2.8
  if (continuing.length > blt.seatCount) {
    // Wright System 2.9
    sortByCtvv(provisionals);

    const elected = distributeSurplusVotes(results, provisionals,
        ballotsByCandidate, continuing, exhausted, quota);
    if (elected) {
      return elected;
    }
  }
  // Wright System 2.12
  while (provisionals.size < blt.seatCount && haveBallots(provisionals)) {
    // Wright System 2.9
    sortByCtvv(provisionals);

    const elected = distributeSurplusVotes(results, provisionals,
      ballotsByCandidate, continuing, exhausted, quota);
    if (elected) {
      return results;
    }
  }
  // Wright System 2.13
  let newExcluded;
  if (provisionals.size < blt.seatCount) {
    newExcluded = exclude(continuing, provisionals, ballotsByCandidate, excluded);
  }

    // Wright System 2.15
  if (continuing.length == blt.seatCount) {
    for (const e of newExcluded) {
      results.logSubround(ballotsByCandidate, exhausted, null, e);
    }
    return results;
  }
  // Wright System 2.16
  if (continuing.length > blt.seatCount + 1) {
    return countStv(blt, results, excluded);
  } else {
    // Wright System 2.17
    for (const c of getNonprovisionalContinuing(continuing, provisionals)) {
      results.logSubround(ballotsByCandidate, exhausted, c, null);
    }
    return results;
  }
}

function distributeSurplusVotes(results, provisionals,
    ballotsByCandidate, continuing, exhausted, quota) {
  const nonprovisionalContinuing = getNonprovisionalContinuing(continuing, provisionals);
  // Wright System 2.10
  // Transfer surplus for each provisional, highest first
  for (const [c, v] of provisionals) {
    const ctvv = getCtvv(v);
    if (ctvv > quota) {
      const surplusTransferValue = ((ctvv - quota) / ctvv);
      for (const ballot of v) {
        ballot.value *= surplusTransferValue;
      }
      // Wright System 2.11
      for (const ballot of v) {
        // Wright System 2.11.1
        const nextPreference = ballot.nextPreference(c, nonprovisionalContinuing);
        if (nextPreference) {
          let nextPrefBallots = ballotsByCandidate.get(nextPreference);
          if (!nextPrefBallots) {
            nextPrefBallots = [];
            ballotsByCandidate.set(nextPreference, nextPrefBallots);
          }
          nextPrefBallots.push(ballot);
        } else {
          // Wright System 2.11.2
          exhausted.push(ballot);
        }
      }
      // Wright System 2.11.3
      v.length = 0;
      results.logSubround(ballotsByCandidate, exhausted, c, null);
    }
  }
  // Wright System 2.11.4
  const nonprovisionalContinuingCtvv = getFilteredBallotsMap(
      ballotsByCandidate, nonprovisionalContinuing);
  const newProvisionals = getProvisionals(nonprovisionalContinuingCtvv, quota);
  for (const [c, v] of newProvisionals) {
    provisionals.set(c, v);
  }
  // Wright System 2.11.5
  if (provisionals.size == results.blt.seatCount) {
    sortByCtvv(newProvisionals);
    for (const [c, v] of newProvisionals) {
      results.logSubround(ballotsByCandidate, exhausted, c, null);
    }
    return results;
  }
}

/**
 * Returns ballots that indicate some ranked preference, not including blank
 * ballots or those that only include candidates that are excluded from the
 * tally.
 * @param {!Array<!Ballot>} ballots The ballots.
 * @param {!Array<!number>} excluded The ids of candidates to be excluded from
 *     processing.
 * @returns {Array<Ballot>} The ballots that express a transferable
 *     preference.
 */
function getNonExhaustedBallots(ballots, excluded) {
  const nonExhaustedBallots = [];
  for (const ballot of ballots) {
    for (const candidate of ballot.candidates) {
      if (!excluded.includes(candidate)) {
        nonExhaustedBallots.push(ballot.clone());
        break;
      }
    }
  }
  return nonExhaustedBallots;
}

/**
 * Returns mapping of candidate ids to the ballots for that candidate, ignoring
 * excluded candidates.
 * @param {!Array<!Ballot>} ballots The ballots.
 * @param {!Array<!number>} excluded The ids of candidates to be excluded from
 *     processing.
 * @returns {Map<number, Array<Ballot>} The mapping.
 */
function assignBallots(ballots, excluded) {
  const votes = new Map();
  for (const ballot of ballots) {
    let candidate;
    for (const c of ballot.candidates) {
      if (!excluded.includes(c)) {
        candidate = c;
        break;
      }
    }
    if (candidate) {
      if (!votes.has(candidate)) {
        votes.set(candidate, []);
      }
      votes.get(candidate).push(ballot);
    }
  }
  return votes;
}

/**
 * Gets the Hagenbach-Bischoff quota.
 * @param {!number} ballotCount The number of ballots.
 * @param {!number} seatCount The number of vacant seats.
 * @returns {number} The quota.
 */
function getHagenbachBischoffQuota(ballotCount, seatCount) {
  return ballotCount / (seatCount + 1);
}

/**
 * Gets the provisionally elected candidates, that is, the candidates whose
 * total value of votes (Ctvv) is greater than or equal to the quota.
 * @param {!Map<!number, !Array<!Ballot>} ballotsByCandidate
 *     Mapping of candidate ids to the ballots for that candidate.
 * @param {!number} quota The quota.
 * @returns {Map<number, Array<Ballot>} The provisional candidates.
 */
function getProvisionals(ballotsByCandidate, quota) {
  const provisionals = new Map();
  for (const [c, v] of ballotsByCandidate) {
    if (v.reduce((sum, i) => sum + i.value, 0) >= quota) {
      provisionals.set(c, v);
    }
  }
  return provisionals;
}

/**
 * Sorts candidates in descending order by candidate total value of votes (Ctvv).
 * @param {!Map<!number, !Array<!Ballot>} map Map of canidates to their ballots.
 */
function sortByCtvv(map) {
  const mapDesc = new Map([...map.entries()].sort(
      ([c1, v1], [c2, v2]) => {return getCtvv(v2) - getCtvv(v1)}));
  map.clear();
  mapDesc.forEach((value, key) => {map.set(key, value)});
}

/**
 * Gets the candidates total value of votes (Ctvv).
 * @param {!Array<!Ballot>} votes The ballots for a candidate.
 * @returns {number} The Ctvv.
 */
function getCtvv(votes) {
  return votes.reduce((sum, i) => sum + i.value, 0)
}

/**
 * Gets the continuing candidates that haven't already been provisionally elected.
 * @param {!Array<!Candidate>} continuing The continuing candidates.
 * @param {!Map<!number, !Array<!Ballot>} provisional The provisionally elected
 *     candidates.
 * @returns {Array<Candidate} The nonprovisional continuing candidates.
 */
function getNonprovisionalContinuing(continuing, provisional) {
  const nonProvisionalContinuing = [];
  outer:
  for (const cont of continuing) {
    for (const [c, v] of provisional) {
      if (c == cont.i) {
        continue outer;
      }
    }
    nonProvisionalContinuing.push(cont);
  }
  return nonProvisionalContinuing;
}

/**
 * Gets copy of ballots by candidate Map filtered by the given set of candidates.
 * @param {!Map<!number, !Array<!Ballot>} ballotsByCandidate The ballots by candidate.
 * @param {!Array<!Candidate>} candidates The candidates to filter by.
 * @returns {Map<number, Array<Ballot>} The filtered ballots by candidate Map.
 */
function getFilteredBallotsMap(ballotsByCandidate, candidates) {
  const filteredBallotsMap = new Map();
  for (const [c, v] of ballotsByCandidate) {
    if (candidates.includes(Candidate.map.get(c))) {
      filteredBallotsMap.set(c, v);
    }
  }
  return filteredBallotsMap;
}

/**
 * @param {!Map<!number, !Array<!Ballot>} ballotsByCandidate The ballot Map.
 * @returns Whether any of the candidates in the ballot Map have any ballots.
 */
function haveBallots(ballotsByCandidate) {
  for (const [c, v] of ballotsByCandidate) {
    if (v.length != 0) {
      return true;
    }
  }
  return false;
}

/**
 * Excludes all zero-vote nonprovisional continuing candidates, or if there are
 * none, then the single nonprovisional continuing candidate with the lowest
 * value of the vote.
 * @param {!Array<!Candidate>} continuing Continuing candidates.
 * @param {!Map<!number, !Array<!Ballot>} provisionals Ballots by provisionally
 *     elected candidates.
 * @param {!Map<!number, !Array<!Ballot>} ballotsByCandidate Ballots by candidate.
 * @param {!Array<!number>} excluded Ids of excluded candidates.
 * @returns 
 */
function exclude(continuing, provisionals, ballotsByCandidate, excluded) {
  const nonprovisionalContinuing =
      getNonprovisionalContinuing(continuing, provisionals);
  const filteredBallotsMap =
      getFilteredBallotsMap(ballotsByCandidate, nonprovisionalContinuing);
  const exc = [];
  for (const [c, v] of filteredBallotsMap) {
    if (getCtvv(v) == 0) {
      exc.push(c);
    }
  }
  if (exc.length == 0) {
    sortByCtvv(filteredBallotsMap);
    const keys = Array.from(filteredBallotsMap.keys());
    const ctvv = getCtvv(filteredBallotsMap.get(keys[keys.length - 1]));
    let i = keys.length - 1;
    while (i >= 0 && getCtvv(filteredBallotsMap.get(keys[i])) == ctvv) {
      exc.push(keys[i]);
      i--;
    }
    // Wright System 2.14
    if (exc.length > 1) {
      rankedPairs(exc, ballotsByCandidate);
    }
  }
  excluded.push(...exc);
  return exc;
}

function rankedPairs(exc, ballotsByCandidate) {
  const pairs = [];
  for (let i = 0; i < exc.length - 1; i++) {
    for (let j = i + 1; j < exc.length; j++) {
      pairs.push([exc[i], exc[j]]);
    }
  }
  const pairValues = [];
  for (const [a, b] of pairs) {
    let aCount = 0;
    let bCount = 0;
    for (const ballots of ballotsByCandidate.values()) {
      for (const ballot of ballots) {
        for (const candidate of ballot.candidates) {
          if (candidate == a) {
            aCount++;
            break;
          } else if (candidate == b) {
            bCount++;
            break;
          }
        }
      }
    }
    let winnerCount;
    if (aCount > bCount) {
      winner = [a, aCount];
    } else if (bCount > aCount) {
      winner = [b, bCount];
    } else {
      winner = [null, aCount];
    }
    pairValues.push([[a, b], winner]);
  }
  pairValues.sort(([pair1, [winner1, value1]], [pair2, [winner2, value2]]) => value2 - value1);
  let ret;
  for (let i = 0; !ret && i < pairValues.length; i++) {
    ret = pairValues[i][1][0];
  }
  if (ret) {
    exc.length = 0;
    exc.push(ret);
  } else {
    console.log(`Tie in ranked pairs! Using first element among ties: ${exc}`);
    exc.length = 1;
  }
}