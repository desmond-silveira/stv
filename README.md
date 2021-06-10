This is a program built by Desmond Silveira for tallying [single transferable vote](https://en.wikipedia.org/wiki/Single_transferable_vote) (STV) ballots.  If a file in the [BLT format](https://code.google.com/archive/p/droop/wikis/BltFileFormat.wiki) (first described by Hill, Wichmann & Woodall in _[Algorithm 123 - Single Transferable Vote by Meek's method]_(http://www.dia.govt.nz/diawebsite.NSF/Files/meekm/$file/meekm.pdf)_) and popularized by [OpaVote](https://www.opavote.com/) is uploaded, a tally is generated. In the generated tables, cells shaded in green are for those candidates that have been elected in the sub-round and cells shaded in red are those that have been excluded.

This implementation is specifically designed for use in the internal elections of the [American Solidarity Party](https://solidarity-party.org).  The [Wright system](https://en.wikipedia.org/wiki/Wright_system) is used, but instead of the [Droop quota](https://en.wikipedia.org/wiki/Droop_quota), the [Hagenbach-Bischoff quota](https://en.wikipedia.org/wiki/Hagenbach-Bischoff_quota) is used, and instead of ties being resolved by lot, ties are broken by using [ranked pairs](https://en.wikipedia.org/wiki/Ranked_pairs) (RP) among the candidates that have tied.