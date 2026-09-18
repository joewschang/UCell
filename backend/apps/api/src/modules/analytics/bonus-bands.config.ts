export const BONUS_BAND_DEFINITION_VERSION='1';
/** Analytics configuration; independent of compensation parameters.
 * Zero is separate; positive bands use (lower,upper], including fractional TWD. */
export const BONUS_BANDS=Object.freeze([
 {key:'0',lower:'0',upper:'0'},
 {key:'1-5K',lower:'0',upper:'5000'},
 {key:'5-20K',lower:'5000',upper:'20000'},
 {key:'20-50K',lower:'20000',upper:'50000'},
 {key:'50-100K',lower:'50000',upper:'100000'},
 {key:'100-300K',lower:'100000',upper:'300000'},
 {key:'300K-1M',lower:'300000',upper:'1000000'},
 {key:'>1M',lower:'1000000',upper:null},
] as const);
