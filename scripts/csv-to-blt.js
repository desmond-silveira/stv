function CSV2BLT (csvContent, data) {
    // by: Vincent S.
    // In 100% compliance with CSV file format standard as documented here: https://docs.fileformat.com/spreadsheet/csv
    /*
        Usage is as follows:

        @param {String} csvContent The text content of the CSV file
        @param {Object} data Any additional data needed to convert to BLT format
            {
                title: @String The title of the election
                numWinners: @Number The number of winners there will be in the election
            }

        @returns {Object}
            {
                bltContent: @String The text content of the BLT file
                csvTable: @<String>[][] The CSV file as a 2-dimensional array
                candidates: @<String>[] The candidates in the election
            }
    */
    
    // get rid of extra whitespace
    csvContent = csvContent.trim();
    
    let csvTable = [];
    
    // parse the csv into a 2D array
    // Ideally this would be done with a Regex, but Regex are extremely difficult to create so I had to settle on using nested while loops
    var rowValues = [], i = 0, inString = false;
    while (i < csvContent.length) {
        let isEndOfRow = false;

        // j is the index of the start of the value
        let j = i;
        // increment until we find the end of the value
        while ((csvContent.charAt(i) !== "," || inString) && i < csvContent.length) {
            // exit loop if we hit a linebreak that isn't part of a string
            if (csvContent.charAt(i) === '\n' && !inString) {
                isEndOfRow = true;
                break;
            }
            
            // handle double quotes
            if (csvContent.charAt(i) === '"') {
                // ignore escaped double quotes
                if (csvContent.charAt(i + 1) === '"' && inString) {
                    i++;
                } else {
                    // update whether the cursor is in a string or not
                    inString = !inString;
                }
            }
            i++;
        }
        
        // slice the value out of the csvContent
        let val = csvContent.slice(j, i);
        // remove encompassing double quotes if present
        if (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
            val = val.slice(1, val.length - 1);
        }
        val = val.replaceAll('""', '"'); // unescape double quotes
        rowValues.push(val);
        
        // if is end of row: push row to table and create new row
        if (isEndOfRow || i == csvContent.length) {
            csvTable.push(rowValues);
            rowValues = [];
        }
        
        i++;
    }

    let candidates = [];

    let header = csvTable[0]; // the first row of the CSV may or may not be a header row
    
    // find all the candidates
    for (var i = 1; i < csvTable.length; i++) {
        for (var j = 0; j < csvTable[i].length; j++) {
            let name = csvTable[i][j];
            if (header[j].toLowerCase().includes("choice") && name.length > 0 && !candidates.includes(name)) {
                candidates.push(name);
            }
        }
    }
    
    // sort candidates into alphabetical order
    const commonSuffixes = ["Jr.", "Sr.", "II", "III", "IV", "V."];
    candidates.sort((name1, name2) => {
        let splitName1 = name1.split(" ");
        splitName1.forEach((piece, idx) => {
            if (commonSuffixes.includes(piece)) {
                splitName1.splice(idx, 1); // remove suffixes
            }
        });
        
        let splitName2 = name2.split(" ");
        splitName2.forEach((piece, idx) => {
            if (commonSuffixes.includes(piece)) {
                splitName2.splice(idx, 1); // remove suffixes
            }
        });
        
        let lastName1 = splitName1[splitName1.length - 1].toLowerCase();
        let lastName2 = splitName2[splitName2.length - 1].toLowerCase();
        
        // JavaScript ftw - we can compare strings together
        if (lastName1 < lastName2) {
            return -1;
        } else if (lastName1 > lastName2) {
            return 1;
        }
        return 0;
    });
    
    // this is only needed to properly align comments in the blt file
    let longestCandidateName = 0;
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].length > longestCandidateName) {
            longestCandidateName = candidates[i].length;
        }
    }
    
    // create the content for the candidate list
    let bltCandidateList = candidates.map((candidate, idx) => {
        const numSpacesToAdd = (longestCandidateName + 3 - candidate.length);
        return JSON.stringify(candidate) + " ".repeat(numSpacesToAdd) + "#" + (idx + 1);
    }).join("\n");
    
    // create the content for the ballot lsit
    let bltBallotList = csvTable.slice(1).map(ballot => {
        const bltBallot = ballot.map(val => (candidates.indexOf(val) + 1) || "").join(" ").replaceAll("  ", "");
        return "1 " + bltBallot + " 0";
    }).join("\n");

    // combine components to get full blt content
    const bltContent = [
        candidates.length,
        data.numWinners,
        bltBallotList,
        0,
        bltCandidateList,
        JSON.stringify(data.title)
    ].join("\n");
    
    return {
        bltContent: bltContent, // this is the important stuff
        // the following properties probably aren't that important, but lets return them just in case the user needs them
        csvTable: csvTable,
        candidates: candidates
    };
}