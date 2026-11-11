/**
 * Hindi 0 to 99, written by hand. pi's `tables/hi.json` has off-by-one errors in its romanized rows
 * (for example "chaar" under 3 and "pachees" under 24), so that table is not used for units.
 * Format per row: native spellings | romanized spellings. Romanized forms are folded by `norm()`.
 */
const ROWS: string[] = [
  'शून्य|shunya', 'एक|ek', 'दो|do', 'तीन|teen,tin', 'चार|char,chaar', 'पाँच,पांच|panch,paanch', 'छह,छः,छे|chhe,chhah,chhai', 'सात|saat,sat', 'आठ|aath,ath', 'नौ|nau,nao',
  'दस|das', 'ग्यारह|gyarah', 'बारह|barah', 'तेरह|terah', 'चौदह|chaudah', 'पंद्रह,पन्द्रह|pandrah,pandarah', 'सोलह|solah', 'सत्रह|satrah', 'अठारह|atharah,athaarah', 'उन्नीस|unnis,unnees',
  'बीस|bees,bis', 'इक्कीस|ikkis,ikkees', 'बाईस|baais,baaees,bais', 'तेईस|teis,teees', 'चौबीस|chaubis,chaubees', 'पच्चीस|pachchis,pachees,pachis,pacchis', 'छब्बीस|chhabbis,chhabbees', 'सत्ताईस|sattais,sattaees', 'अट्ठाईस,अठाईस|atthais,atthaees,athaais', 'उनतीस|untis,unatis,unnatis',
  'तीस|tees,tis', 'इकतीस|ikattis,iktis,ikatis', 'बत्तीस|battis,battees', 'तैंतीस|taintis,tentis', 'चौंतीस|chauntis', 'पैंतीस|paintis', 'छत्तीस|chhattis', 'सैंतीस|saintis', 'अड़तीस|adtis,artis,adatis', 'उनतालीस|untalis,unchalis',
  'चालीस|chalis,chaalis,chalees', 'इकतालीस|iktalis,ikatalis', 'बयालीस|bayalis,byalis', 'तैंतालीस|taintalis', 'चौवालीस,चौंतालीस|chauvalis,chavalis,chauntalis', 'पैंतालीस|paintalis', 'छियालीस|chhiyalis', 'सैंतालीस|saintalis', 'अड़तालीस|adtalis,artalis', 'उनचास|unchas,unanchas,unnchas',
  'पचास|pachas,pachaas', 'इक्यावन|ikyavan,ikyaavan', 'बावन|bavan,baavan', 'तिरेपन,तिरपन|tirpan,tirepan,trepan', 'चौवन|chauvan,chauwan', 'पचपन|pachpan', 'छप्पन|chhappan', 'सत्तावन|sattavan', 'अट्ठावन,अठावन|atthavan,athavan', 'उनसठ|unsath,unsat',
  'साठ|saath,sath', 'इकसठ|iksath,iksat', 'बासठ|basath,baasath', 'तिरसठ|tirsath', 'चौंसठ|chaunsath', 'पैंसठ|painsath', 'छियासठ|chhiyasath', 'सड़सठ|sadsath', 'अड़सठ|adsath', 'उनहत्तर|unhattar,unahattar',
  'सत्तर|sattar', 'इकहत्तर|ikhattar,ikahattar', 'बहत्तर|bahattar', 'तिहत्तर|tihattar', 'चौहत्तर|chauhattar', 'पचहत्तर|pachhattar,pachattar', 'छिहत्तर|chhihattar', 'सतहत्तर|sattahattar,satahattar', 'अठहत्तर|athhattar,athahattar', 'उनासी|unasi,unaasi',
  'अस्सी|assi', 'इक्यासी|ikyasi', 'बयासी|bayasi', 'तिरासी|tirasi', 'चौरासी|chaurasi', 'पचासी|pachasi', 'छियासी|chhiyasi', 'सत्तासी|sattasi', 'अट्ठासी,अठासी|atthasi,athasi', 'नवासी|navasi',
  'नब्बे|nabbe', 'इक्यानवे|ikyanve,ikyanabe', 'बानवे|banve,baanve', 'तिरानवे|tiranve', 'चौरानवे|chauranve', 'पंचानवे|panchanve', 'छियानवे|chhiyanve', 'सत्तानवे|sattanve', 'अट्ठानवे,अठानवे|atthanve,athanve', 'निन्यानवे,निन्यानबे|ninyanve,ninnanve,ninanve',
];

export const HI_UNITS: { value: number; words: string[] }[] = ROWS.map((r, value) => {
  const [native, roman] = r.split('|') as [string, string];
  return { value, words: [...native.split(','), ...roman.split(',')] };
});
