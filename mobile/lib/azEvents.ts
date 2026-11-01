// Arizona Master Events Calendar (November 2026 – August 2027).
// Statewide events beyond the light-rail cities, shown on the
// "Events Around Arizona" screen. Static curated content — no API.

export type AzAdmission = 'free' | 'paid' | 'mixed' | 'tbd';

export interface AzEvent {
  date: string;
  name: string;
  location: string;
  category: string;
  admission: AzAdmission;
  url: string;
}

export interface AzMonth {
  month: string;
  events: AzEvent[];
}

type Row = [date: string, name: string, location: string, category: string, admission: AzAdmission, url: string];

function month(title: string, rows: Row[]): AzMonth {
  return { month: title, events: rows.map(([date, name, location, category, admission, url]) => ({ date, name, location, category, admission, url })) };
}

export const AZ_EVENT_MONTHS: AzMonth[] = [
  
  
  month('November 2026', [
    ['Nov. 1', 'Arizona State Fair — final day', 'Phoenix', 'Fair', 'paid', 'https://azstatefair.com'],
    ['Nov. 1–30', 'Fountain Hills Hiking Challenge', 'Fountain Hills', 'Outdoor', 'free', 'https://www.fountainhillsaz.gov'],
    ['Nov. 1', 'Pirates of the Caribbean in Concert — final day', 'Phoenix / Symphony Hall', 'Music/Film', 'paid', 'https://www.phoenixsymphony.org'],
    ['Nov. 1', 'Arizona Cardinals at Dallas Cowboys — 11:00 AM', 'Arlington, TX', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Nov. 1', 'ASU Volleyball vs. Houston — 1:00 PM', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Nov. 2', "ASU Women's Basketball vs. Jackson State — 5:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 2', "ASU Men's Basketball vs. East Tennessee State — 8:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 3–7', 'AIA Swimming & Diving — Boys Divisions I–III', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 4', 'Phoenix Suns vs. Portland Trail Blazers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 4–7', 'AIA Swimming & Diving — Girls Divisions I–III', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 5', 'Phoenix Suns vs. Orlando Magic — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 5', "ASU Women's Basketball vs. Northern Arizona — 6:30 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 5', 'The Three Brides', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Nov. 5–7', 'Turquoise Circuit ProRodeo', 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Nov. 6–15', 'Canal Convergence: Western Nature', 'Scottsdale Waterfront', 'Public Art/Festival', 'free', 'https://canalconvergence.com'],
    ['Nov. 6–8', "Beethoven's 7th Symphony & Chopin's 2nd Piano Concerto", 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Nov. 6–29', 'National Parks Exhibit', 'Phoenix / Herberger Theater Art Galleries', 'Art', 'free', 'https://www.herbergertheater.org'],
    ['Nov. 6–29', 'Freedom Exhibit', 'Phoenix / Herberger Theater Art Galleries', 'Art', 'free', 'https://www.herbergertheater.org'],
    ['Nov. 6', 'ASU Hockey vs. Denver — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Nov. 6', "ASU Men's Basketball vs. Northern Colorado — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 6–8', 'All Souls Procession weekend', 'Tucson', 'Culture', 'mixed', 'https://allsoulsprocession.org'],
    ['Nov. 7', 'ASU Football vs. Colorado', 'Tempe', 'College Football', 'tbd', 'https://thesundevils.com'],
    ['Nov. 7', 'Phoenix Suns vs. Houston Rockets — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 7', 'AIA Volleyball championships / qualifying', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 7–8', 'Scottsdale Italian Festival', 'Scottsdale Civic Center', 'Italian Food/Culture/Wine', 'paid', 'https://www.experiencescottsdale.com'],
    ['Nov. 7–8', 'YumaCon', 'Yuma', 'Pop Culture', 'paid', 'https://www.visityuma.com'],
    ['Nov. 7', 'Cowboy Festival', 'Empire Ranch/Sonoita', 'Western', 'mixed', 'https://empireranchfoundation.org'],
    ['Nov. 7', 'Tubac Día de los Muertos celebration', 'Tubac', 'Culture', 'mixed', 'https://www.tubacaz.com'],
    ['Nov. 7', 'Bentley Scottsdale Polo Championships', 'Scottsdale / WestWorld', 'Polo/Social/Sports', 'paid', 'https://thepoloparty.com'],
    ['Nov. 7', 'Diwali: Festival of Lights', 'Chandler', 'Culture', 'mixed', 'https://www.chandleraz.gov'],
    ['Nov. 7–8', 'El Gato con Botas', 'Phoenix', 'Theater', 'paid', 'https://azopera.org'],
    ['Nov. 7', 'Litchfield Park Festival of Arts', 'Litchfield Park', 'Arts', 'free', 'https://www.litchfieldpark.gov'],
    ['Nov. 7', 'Arizona Fall Festival', 'Phoenix area', 'Food/Festival', 'free', 'https://localfirstaz.com'],
    ['Nov. 7–8', 'Autumnfest', 'Anthem', 'Arts/Festival', 'free', 'https://www.anthemcouncil.com'],
    ['Nov. 8', 'ASU Hockey vs. Denver — Noon', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Nov. 8', 'ASU Volleyball vs. Utah — 1:00 PM', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Nov. 8', 'Arizona Cardinals at Seattle Seahawks — 2:25 PM', 'Seattle, WA', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Nov. 8', 'Wings & Wheels', 'Nogales', 'Aviation', 'paid', 'https://www.nogalesaz.gov'],
    ['Nov. 9', 'Phoenix Suns vs. San Antonio Spurs — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 10', 'Phoenix Suns vs. LA Clippers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 10', "ASU Men's Basketball vs. Hofstra — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 10–15', 'Elf the Musical', 'Tucson / Centennial Hall', 'Theater', 'paid', 'https://centhall.org'],
    ['Nov. 11', 'Prescott Veterans Day Parade', 'Prescott', 'Community', 'free', 'https://www.prescott.org'],
    ['Nov. 11–15', 'Fleurs de Villes NOËL', 'Scottsdale Fashion Square', 'Floral/Art', 'mixed', 'https://www.fleursdevilles.com'],
    ['Nov. 12', 'Phoenix Suns vs. Charlotte Hornets — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 12', 'Good Morning Yuma', 'Yuma Civic Center', 'Community', 'free', 'https://www.visityuma.com'],
    ['Nov. 12', "Brahms' Serenade No. 1", 'Phoenix / Musical Instrument Museum', 'Classical', 'paid', 'https://mim.org'],
    ['Nov. 13', "ASU Men's Basketball vs. ULM — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 13–14', "Show Low Santa's North Pole Workshop & Craft Fair", 'Show Low', 'Holiday', 'paid', 'https://www.showlowaz.gov'],
    ['Nov. 13–15', 'The Play That Goes Wrong', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Nov. 13–15', 'Music of the Knights', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['Nov. 13–15', 'Hondo Rodeo Fest', 'Phoenix / Chase Field', 'Rodeo', 'paid', 'https://www.thehondorodeofest.com'],
    ['Nov. 13–15', 'Fountain Festival of Fine Art & Crafts', 'Fountain Hills', 'Arts', 'free', 'https://www.fountainhillsaz.gov'],
    ['Nov. 13–14', 'DUSK X', 'Tucson', 'Music', 'paid', 'https://www.visittucson.org'],
    ['Nov. 13–15', 'Gem & Mineral Thanksgiving Showcase', 'Tucson', 'Gems', 'mixed', 'https://www.visittucson.org'],
    ['Nov. 14', 'NAU Football vs. Weber State', 'Flagstaff', 'College Football', 'paid', 'https://nauathletics.com'],
    ['Nov. 14', 'AIA Cross Country State Championships', 'Cave Creek', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 14', 'AIA Girls Volleyball State Championships', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 14', 'Arizona Football vs. TCU', 'Tucson / Arizona Stadium', 'College Football', 'tbd', 'https://arizonawildcats.com'],
    ['Nov. 14', "Ridin' For a Cure", 'Prescott', 'Community', 'paid', 'https://www.prescott.org'],
    ['Nov. 14', "Arizona Wine Founder's Day", 'Sonoita', 'Food/Wine', 'paid', 'https://www.arizonawine.com'],
    ['Nov. 14', 'Festival of the Arts', 'Phoenix / Herberger Theater Center', 'Arts', 'paid', 'https://www.herbergertheater.org'],
    ['Nov. 14', 'Pride in Chandler', 'Chandler', 'Community', 'mixed', 'https://www.chandleraz.gov'],
    ['Nov. 14', 'Cave Creek Cactus Classic', 'Cave Creek', 'Sports', 'paid', 'https://www.cavecreekaz.gov'],
    ['Nov. 14', 'Desert Discovery Day', 'Cave Creek', 'Nature', 'free', 'https://dflt.org'],
    ['Nov. 15', 'Phoenix Suns vs. Los Angeles Lakers — 1:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 15', "ASU Women's Basketball vs. Penn State — 2:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 15', 'Arizona Cardinals vs. Los Angeles Rams — 2:05 PM', 'Glendale / State Farm Stadium', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Nov. 17', "ASU Women's Basketball vs. San Diego — 6:30 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 18', "ASU Men's Basketball vs. Oakland — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 20–22', 'Muñoz Conducts Schumann & Barber', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Nov. 20–22', 'Gilbert Days Weekend', 'Gilbert', 'Festival', 'mixed', 'https://www.gilbertaz.gov'],
    ['Nov. 20–22', 'Hidden in the Hills Artist Studio Tour', 'Scottsdale/Cave Creek area', 'Arts', 'free', 'https://sonoranartsleague.org/hidden-in-the-hills/'],
    ['Nov. 20', "ASU Women's Basketball vs. Santa Clara — 6:30 PM", 'Tempe / Mullett Arena', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 21', 'ASU Football vs. Oklahoma State', 'Tempe', 'College Football', 'tbd', 'https://thesundevils.com'],
    ['Nov. 21', 'NAU Football vs. Northern Colorado', 'Flagstaff', 'College Football', 'paid', 'https://nauathletics.com'],
    ['Nov. 21', 'AIA Football semifinals', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 21', 'AIA Flag Football championships', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 21', 'Turkey Trot & Turkey Bowl', 'Payson', 'Sports', 'free', 'https://www.paysonaz.gov'],
    ['Nov. 21', 'Special Olympics Tucson Field of Dreams', 'Tucson', 'Sports', 'free', 'https://specialolympicsarizona.org'],
    ['Nov. 21', 'Arizona Indigenous Culinary Experience', 'Scottsdale', 'Food/Culture', 'paid', 'https://www.experiencescottsdale.com'],
    ['Nov. 21', 'From Gershwin to Garland', 'Phoenix / Herberger Theater Center', 'Music', 'paid', 'https://www.herbergertheater.org'],
    ['Nov. 21', 'Southwest Tea', 'Chandler', 'Food', 'paid', 'https://www.chandleraz.gov'],
    ['Nov. 21', 'Gilbert Days Parade', 'Gilbert', 'Parade', 'free', 'https://www.gilbertaz.gov'],
    ['Nov. 21', 'Gilbert Days Festival', 'Gilbert', 'Festival', 'mixed', 'https://www.gilbertaz.gov'],
    ['Nov. 21', 'Free To Be Me Drumming', 'Sedona', 'Music/Community', 'free', 'https://www.visitsedona.com'],
    ['Nov. 21', 'El Tour de Tucson', 'Tucson', 'Cycling', 'paid', 'https://eltourdetucson.org'],
    ['Nov. 22', 'Arizona Cardinals at Kansas City Chiefs — 11:00 AM', 'Kansas City, MO', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Nov. 22', 'Special Olympics Lower River Area Golf Competition', 'Yuma', 'Sports', 'free', 'https://specialolympicsarizona.org'],
    ['Nov. 22', 'Gilbert Days Weekend', 'Gilbert', 'Festival', 'mixed', 'https://www.gilbertaz.gov'],
    ['Nov. 22', 'Hidden in the Hills Artist Studio Tour', 'Arizona', 'Arts', 'free', 'https://sonoranartsleague.org/hidden-in-the-hills/'],
    ['Nov. 24', "ASU Women's Basketball vs. San Jose State — 6:30 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 25', 'ASU Volleyball vs. Kansas State — 7:00 PM', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Nov. 26', 'Turkey Trot & Thanksgiving Parade', 'Fountain Hills', 'Holiday/Sports', 'free', 'https://www.fountainhillsaz.gov'],
    ['Nov. 26', 'Turkey Trot', 'Sedona', 'Running', 'paid', 'https://www.visitsedona.com'],
    ['Nov. 27', 'Phoenix Suns vs. Dallas Mavericks — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Nov. 27', 'ASU Volleyball vs. Kansas — 7:00 PM', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Nov. 27', 'ASU Hockey vs. Alaska Anchorage — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Nov. 27–29', 'Elf in Concert', 'Phoenix / Symphony Hall', 'Music/Film', 'paid', 'https://www.phoenixsymphony.org'],
    ['Nov. 27', 'Hidden in the Hills Artist Studio Tour — second weekend', 'Arizona', 'Arts', 'free', 'https://sonoranartsleague.org/hidden-in-the-hills/'],
    ['Nov. 27', 'Sedona Turkey Trot', 'Sedona', 'Running', 'paid', 'https://www.visitsedona.com'],
    ['Nov. 28', "ASU Women's Basketball vs. CSU Bakersfield — 2:30 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 28', 'ASU Hockey vs. Alaska Anchorage — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Nov. 28', 'AIA Open Football semifinal', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Nov. 28', 'AIA 2A/3A Football championships', 'Arizona', 'High School Sports', 'tbd', 'https://aiaonline.org'],
    ['Nov. 28', 'Prescott Holiday Light Parade', 'Prescott', 'Holiday', 'free', 'https://www.prescott.org'],
    ['Nov. 28–Dec. 20', 'Little Shop of Horrors', 'Tucson / Invisible Theatre', 'Theater', 'paid', 'https://www.invisibletheatre.com'],
    ['Nov. 28–Dec. 31', 'Scottsdazzle', 'Scottsdale / Old Town & Waterfront', 'Holiday', 'mixed', 'https://www.experiencescottsdale.com'],
    ['Nov. 29', "ASU Women's Basketball vs. Wake Forest — 12:30 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 29', 'Arizona Cardinals vs. Washington Commanders — 2:25 PM', 'Glendale / State Farm Stadium', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Nov. 30', "ASU Men's Basketball vs. Montana — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Nov. 30', 'Water Tower Holiday Lighting', 'Gilbert', 'Holiday', 'free', 'https://www.gilbertaz.gov'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('December 2026', [
    ['Dec. 1', 'Phoenix Suns vs. LA Clippers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 2', 'Phoenix Suns vs. Sacramento Kings — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 2–3', 'Days Off', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Dec. 4', 'ASU Hockey vs. Colorado College — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Dec. 4', 'AIA 4A Football State Championship', 'Arizona', 'High School Sports', 'tbd', 'https://aiaonline.org'],
    ['Dec. 4', 'AIA 5A Football State Championship', 'Arizona', 'High School Sports', 'tbd', 'https://aiaonline.org'],
    ['Dec. 4–5', 'Tubac Center of the Arts holiday events', 'Tubac', 'Arts/Holiday', 'mixed', 'https://tubacarts.org'],
    ['Dec. 4–6', 'Holiday Pops Spectacular', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['Dec. 4–6', 'Hadestown', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['Dec. 5', 'ASU Hockey vs. Colorado College — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Dec. 5', 'AIA 6A Football State Championship', 'Arizona', 'High School Sports', 'tbd', 'https://aiaonline.org'],
    ['Dec. 5', 'AIA Open Division Football State Championship', 'Arizona', 'High School Sports', 'tbd', 'https://aiaonline.org'],
    ['Dec. 5', "GCU Men's Basketball vs. Santa Clara", 'Phoenix / Global Credit Union Arena', 'College Basketball', 'paid', 'https://gculopes.com'],
    ['Dec. 5', 'Prescott Christmas Parade & Courthouse events', 'Prescott', 'Holiday', 'free', 'https://www.prescott.org'],
    ['Dec. 4–5', 'Tubac Luminarias', 'Tubac', 'Holiday', 'mixed', 'https://www.tubacaz.com'],
    ['Dec. 5', 'Arizona Korean Culture Festival', 'Chandler', 'Culture', 'free', 'https://www.chandleraz.gov'],
    ['Dec. 5', 'Breakfast with Santa', 'Sedona', 'Family', 'paid', 'https://www.visitsedona.com'],
    ['Dec. 6', "ASU Women's Basketball vs. Gonzaga — 2:00 PM", 'Tempe / Mullett Arena', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 6', 'Arizona Cardinals vs. Philadelphia Eagles — 2:05 PM', 'Glendale / State Farm Stadium', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Dec. 6', 'Patagonia Benderly Concert Series', 'Patagonia', 'Music', 'paid', 'https://patagonia-az.gov'],
    ['Dec. 8', "ASU Women's Basketball vs. UTRGV — 5:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 8', "ASU Men's Basketball vs. Mercer — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 9–13', "Handel's Messiah", 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Dec. 10–20', 'Claus & Effect: An Elf Union Reunion', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Dec. 11', 'ASU Hockey vs. Western Michigan — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Dec. 11–13', 'Tucson Fourth Avenue Street Fair / Winter Street Fair', 'Tucson / Fourth Avenue', 'Arts/Shopping', 'free', 'https://fourthavenue.org'],
    ['Dec. 11–22', 'Riparian After Dark', 'Gilbert', 'Holiday', 'paid', 'https://www.gilbertaz.gov'],
    ['Dec. 11', 'Prescott Acker Night Musical Showcase', 'Prescott', 'Music/Holiday', 'free', 'https://www.prescott.org'],
    ['Dec. 12', 'ASU Hockey vs. Western Michigan — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Dec. 12', 'Phoenix Suns vs. Minnesota Timberwolves — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 12', 'Christmas at Empire Ranch', 'Sonoita', 'Holiday', 'mixed', 'https://empireranchfoundation.org'],
    ['Dec. 12', 'Walk4Unity — UN Human Rights Day', 'Chandler', 'Community', 'free', 'https://www.chandleraz.gov'],
    ['Dec. 13', "Arizona Women's Basketball vs. Northern Arizona", 'Tucson / McKale Center', 'College Basketball', 'paid', 'https://arizonawildcats.com'],
    ['Dec. 13', 'Tucson Marathon', 'Tucson', 'Running', 'paid', 'https://www.tucsonmarathon.com'],
    ['Dec. 13', 'Patagonia Benderly Concert Series', 'Patagonia', 'Music', 'paid', 'https://patagonia-az.gov'],
    ['Dec. 14', 'Phoenix Suns vs. Atlanta Hawks — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 18–20', 'Holiday Baroque', 'Phoenix / Orpheum Theatre', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Dec. 18', 'Finer Arts Art Affaire', 'Cave Creek', 'Arts', 'paid', 'https://www.cavecreekaz.gov'],
    ['Dec. 18', 'Luminaria Walk at Harmony Hollow', 'Cave Creek', 'Holiday', 'mixed', 'https://www.cavecreekaz.gov'],
    ['Dec. 19', 'Cave Creek Santa Summit', 'Cave Creek', 'Family', 'free', 'https://www.cavecreekaz.gov'],
    ['Dec. 19', 'Cave Creek Christmas Tractor Parade', 'Cave Creek', 'Holiday', 'free', 'https://www.cavecreekaz.gov'],
    ['Dec. 19', 'Holiday Magic at Tlaquepaque', 'Sedona', 'Holiday', 'free', 'https://tlap.com'],
    ['Dec. 20', 'Arizona Cardinals vs. New York Jets — 2:05 PM', 'Glendale / State Farm Stadium', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Dec. 20', "ASU Men's Basketball vs. San Diego — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 23', 'Phoenix Suns vs. Indiana Pacers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 23', "ASU Men's Basketball vs. Idaho — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 26', 'Rate Bowl', 'Phoenix / Chase Field', 'College Football', 'paid', 'https://www.fiestabowl.org'],
    ['Dec. 27', 'Arizona Cardinals at New Orleans Saints — 11:00 AM', 'New Orleans, LA', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Dec. 28', 'Phoenix Suns vs. Golden State Warriors — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 29', "ASU Men's Basketball vs. Southern Illinois — 7:00 PM", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['Dec. 30', 'Fiesta Bowl', 'Glendale / State Farm Stadium', 'College Football', 'paid', 'https://www.fiestabowl.org'],
    ['Dec. 30', 'Phoenix Suns vs. Philadelphia 76ers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Dec. 31', 'Phoenix Suns vs. New York Knicks — 6:00 PM', 'Phoenix', 'NBA', 'tbd', 'https://www.nba.com/suns'],
    ['Dec. 31', "New Year's Eve Gala: Havana Nights", 'Phoenix / Arizona Biltmore', 'Holiday', 'paid', 'https://www.arizonabiltmore.com'],
    ['Dec. 31', 'Whiskey Row Boot Drop', 'Prescott', 'Holiday', 'mixed', 'https://www.prescott.org'],
    ['December', 'Holiday events / performances', 'Scottsdale Arts', 'Performing Arts', 'paid', 'https://scottsdalearts.org'],
    ['December', 'ZooLights', 'Phoenix Zoo', 'Holiday Lights', 'paid', 'https://www.phoenixzoo.org'],
    ['December — TBD', 'Las Noches de las Luminarias', 'Phoenix / Desert Botanical Garden', 'Holiday', 'paid', 'https://dbg.org'],
    ['December — TBD', 'Electric Light Parade', 'Casa Grande', 'Holiday', 'mixed', 'https://casagrandeaz.gov'],
    ['December — TBD', 'Grande Glitters', 'Casa Grande', 'Holiday', 'mixed', 'https://casagrandeaz.gov'],
    ['December — TBD', 'Christmas in the Park', 'Litchfield Park', 'Holiday', 'free', 'https://www.litchfieldpark.gov'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('January 2027', [
    ['Jan. 1–10', 'Tyson Wells Rock & Gem Show', 'Quartzsite', 'Gems/Market', 'free', 'https://tysonwells.com'],
    ['Jan. 2', 'Phoenix Suns vs. Sacramento Kings — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 2', 'Finer Arts Mimosas & Muffins', 'Cave Creek', 'Arts/Food', 'paid', 'https://www.cavecreekaz.gov'],
    ['Jan. 3', 'Arizona Cardinals vs. Las Vegas Raiders — 2:05 PM', 'Glendale / State Farm Stadium', 'NFL', 'paid', 'https://www.azcardinals.com'],
    ['Jan. 4', 'Phoenix Suns vs. Boston Celtics — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 7', 'Arizona Opera Studio Series', 'Phoenix / Arizona Opera Center', 'Opera', 'paid', 'https://azopera.org'],
    ['Jan. 8–10', 'Quartzsite RV/Swap Meet season', 'Quartzsite', 'Shopping/RV', 'free', 'https://www.quartzsitervshow.com'],
    ['Jan. 8–10', 'Cave Creek Winter Fine Art & Wine Festival', 'Cave Creek', 'Arts/Food', 'paid', 'https://thunderbirdartists.com'],
    ['Jan. 9', 'ASU Swimming & Diving vs. Grand Canyon — Noon', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Jan. 9–10', 'Litchfield Park Gathering — Native American Fine Arts Festival', 'Litchfield Park', 'Arts/Culture', 'free', 'https://www.litchfieldpark.gov'],
    ['Jan. 10', 'Phoenix Suns vs. Chicago Bulls — 4:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 15', 'ASU Hockey vs. Minnesota Duluth — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Jan. 15–17', 'Arizona Balloon Classic', 'Chandler / Wild Horse Pass', 'Festival', 'paid', 'https://azballoonclassic.com'],
    ['Jan. 15–17', 'Winter art festivals', 'Phoenix metro', 'Arts', 'mixed', 'https://www.visitphoenix.com'],
    ['Jan. 15', 'Chandler Dr. Martin Luther King Jr. Awards Ceremony', 'Chandler', 'Community', 'free', 'https://www.chandleraz.gov'],
    ['Jan. 15–17', 'Bruch & Mendelssohn with Rolf Haas', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Jan. 15', 'Finer Arts Art Affaire', 'Cave Creek', 'Arts', 'paid', 'https://www.cavecreekaz.gov'],
    ['Jan. 16', 'ASU Hockey vs. Minnesota Duluth — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Jan. 16–Mar. 28', 'Celebration of Fine Art', 'Scottsdale / Big White Tents', 'Fine Art', 'paid', 'https://celebrateart.com'],
    ['Jan. 16', 'Tucson Polar Plunge', 'Tucson', 'Sports', 'paid', 'https://specialolympicsarizona.org'],
    ['Jan. 16', 'Arizona Archaeological Society – Rim Country', 'Payson', 'Archaeology', 'paid', 'https://azarchsoc.org'],
    ['Jan. 16', 'Chandler Multicultural Festival', 'Chandler', 'Culture', 'free', 'https://www.chandleraz.gov'],
    ['Jan. 20', 'Phoenix Suns vs. Memphis Grizzlies — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 21', 'Sonoran Sunset Series', 'Chandler', 'Music', 'free', 'https://www.chandleraz.gov'],
    ['Jan. 22', 'Phoenix Suns vs. Utah Jazz — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 22–Feb. 7', 'The Vagina Monologues', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Jan. 22–24', 'E.T. in Concert', 'Phoenix / Orpheum Theatre', 'Music/Film', 'paid', 'https://www.phoenixsymphony.org'],
    ['Jan. 22–24', 'Fine Art & Wine Festival', 'Cave Creek / Stagecoach Village', 'Arts/Food', 'paid', 'https://thunderbirdartists.com'],
    ['Jan. 23–31', 'Barrett-Jackson Scottsdale Auction', 'Scottsdale / WestWorld', 'Collector Cars', 'paid', 'https://www.barrett-jackson.com'],
    ['Jan. 23', 'Carnival of Creatures: Past & Present', 'Phoenix / Madison Center for the Arts', 'Arts', 'paid', 'https://www.themadison.org'],
    ['Jan. 23', 'Embracing Wellness Community Expo', 'Chandler', 'Community', 'free', 'https://www.chandleraz.gov'],
    ['Jan. 24', 'Phoenix Suns vs. Utah Jazz — 1:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Jan. 24–28', 'AMSPC Annual Meeting', 'Tucson', 'Conference', 'paid', 'https://www.visittucson.org'],
    ['Jan. 24–Feb. 14', 'Vintage Hitchcock', 'Tucson / Invisible Theatre', 'Theater', 'paid', 'https://www.invisibletheatre.com'],
    ['Jan. 27–Feb. 14', 'Tucson Gem, Mineral & Fossil Showcase', 'Tucson / Multiple venues', 'Gems', 'mixed', 'https://www.visittucson.org/tucson-gem-mineral-fossil-showcase/'],
    ['Jan. 28', 'Warlock, Charles & Elfman', 'Phoenix / Musical Instrument Museum', 'Music', 'paid', 'https://mim.org'],
    ['Jan. 29–31', 'The Music of Paul Simon', 'Phoenix / Orpheum Theatre', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['Jan. 30–31', 'The Pirates of Penzance', 'Phoenix / Symphony Hall', 'Theater', 'paid', 'https://azopera.org'],
    ['Jan. 31–Feb. 4', 'AGTA GemFair', 'Tucson Convention Center', 'Gems/Trade', 'paid', 'https://agta.org'],
    ['Jan. 31–Feb. 20', 'The Play That Goes Wrong', 'Tucson / Arizona Theatre Company', 'Theater', 'paid', 'https://atc.org'],
    ['Jan. 31', 'Skateboard Classic', 'Fountain Hills', 'Sports', 'free', 'https://www.fountainhillsaz.gov'],
    ['Saturdays', 'Old Town Scottsdale Farmers Market', 'Scottsdale / Old Town', 'Farmers Market', 'free', 'https://www.experiencescottsdale.com'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
    ['January — TBD', 'Tucson Jazz Festival', 'Tucson', 'Music', 'paid', 'https://tucsonjazzfestival.org'],
    ['January — TBD', "ASU Men's Basketball — Big 12 home games", 'Tempe', 'College Basketball', 'paid', 'https://thesundevils.com'],
    ['January — TBD', "Arizona Men's/Women's Basketball", 'Tucson', 'College Basketball', 'paid', 'https://arizonawildcats.com'],
    ['January — TBD', "NAU Men's/Women's Basketball", 'Flagstaff', 'College Basketball', 'paid', 'https://nauathletics.com'],
    ['January — TBD', "GCU Men's/Women's Basketball", 'Phoenix', 'College Basketball', 'paid', 'https://gculopes.com'],
    ['January — TBD', 'Phoenix Suns home games', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['January — TBD', 'AIA winter sports championships/playoffs', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
  ]),
  month('February 2027', [
    ['Feb. 2–7', 'The Outsiders', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['Feb. 3', 'Phoenix Suns vs. Cleveland Cavaliers — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 4', 'Savor the Symphony', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Feb. 5', 'Phoenix Suns vs. Houston Rockets — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 5–7', "John Williams' Epic 95th Birthday Celebration", 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Feb. 6', 'ASU Swimming & Diving vs. Arizona — Noon', 'Tempe', 'College Sports', 'paid', 'https://thesundevils.com'],
    ['Feb. 6', 'RunSedona Half Marathon / 10K / 5K / Walk', 'Sedona', 'Running', 'paid', 'https://runsedona.com'],
    ['Feb. 6', 'Finer Arts Mimosas & Muffins', 'Cave Creek', 'Arts/Food', 'paid', 'https://www.cavecreekaz.gov'],
    ['Feb. 8', 'Phoenix Suns vs. Los Angeles Lakers — 6:30 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 8–14', 'WM Phoenix Open', 'Scottsdale / TPC Scottsdale', 'Golf', 'paid', 'https://wmphoenixopen.com'],
    ['Feb. 9', 'Arizona Opera Studio Series', 'Phoenix / Arizona Opera Center', 'Opera', 'paid', 'https://azopera.org'],
    ['Feb. 10', 'Phoenix Suns vs. Detroit Pistons — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 10–14', 'Tubac Festival of the Arts', 'Tubac', 'Arts', 'paid', 'https://www.tubacaz.com'],
    ['Feb. 11–21', 'Scottsdale Arabian Horse Show', 'Scottsdale / WestWorld', 'Equestrian', 'paid', 'https://www.scottsdaleshow.com'],
    ['Feb. 12', 'ASU Hockey vs. North Dakota — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Feb. 12–14', 'Gold Rush Days', 'Wickenburg', 'Western', 'mixed', 'https://www.wickenburgchamber.com'],
    ['Feb. 13', 'ASU Hockey vs. North Dakota — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Feb. 18', 'Desert Foothills Land Trust Movie Night: Hummingbirds', 'Cave Creek', 'Film/Nature', 'paid', 'https://dflt.org'],
    ['Feb. 18', 'Arizona Archaeological Society – Rim Country', 'Payson', 'Archaeology', 'paid', 'https://azarchsoc.org'],
    ['Feb. 19–21', 'NBA All-Star Weekend', 'Phoenix', 'Basketball', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 19–21', 'The Bodyguard', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['Feb. 19–21', 'Paolo, Pablo & The Rite of Spring', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Feb. 19', 'Teen Takeover', 'Fountain Hills', 'Youth/Community', 'free', 'https://www.fountainhillsaz.gov'],
    ['Feb. 19', 'Finer Arts Art Affaire', 'Cave Creek', 'Arts', 'paid', 'https://www.cavecreekaz.gov'],
    ['Feb. 20–28', 'La Fiesta de los Vaqueros / Tucson Rodeo', 'Tucson', 'Rodeo', 'paid', 'https://www.tucsonrodeo.com'],
    ['Feb. 20', 'Chandler Innovation Fair', 'Chandler', 'Science/Innovation', 'free', 'https://www.chandleraz.gov'],
    ['Feb. 20–21', 'Navajo Rug & Jewelry Show', 'Cave Creek', 'Arts/Culture', 'paid', 'https://www.cavecreekaz.gov'],
    ['Feb. 26', 'ASU Hockey vs. Omaha — 7:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Feb. 26–28', 'Cirque Adventure with Troupe Vertigo', 'Phoenix / Orpheum Theatre', 'Circus', 'paid', 'https://www.phoenixsymphony.org'],
    ['Feb. 26–28', 'Fountain Festival of Fine Art & Crafts', 'Fountain Hills', 'Arts', 'free', 'https://www.fountainhillsaz.gov'],
    ['Feb. 27', 'Phoenix Suns vs. New Orleans Pelicans — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 27', 'ASU Hockey vs. Omaha — 5:00 PM', 'Tempe / Mullett Arena', 'College Hockey', 'paid', 'https://thesundevils.com'],
    ['Feb. 27', 'Clap, Count, Play! A Symphony Rhythm Party', 'Phoenix / Madison Center for the Arts', 'Music/Family', 'paid', 'https://www.themadison.org'],
    ['Feb. 27–Mar. 14', 'The Play That Goes Wrong', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Feb. 28', 'NBA All-Star Weekend — final day', 'Phoenix', 'Basketball', 'paid', 'https://www.nba.com/suns'],
    ['Feb. 28', 'Tucson Rodeo — final day', 'Tucson', 'Rodeo', 'paid', 'https://www.tucsonrodeo.com'],
    ['Feb. 28', 'Cirque Adventure — final day', 'Phoenix', 'Circus', 'paid', 'https://www.phoenixsymphony.org'],
    ['February', 'Scottsdale Western Week', 'Scottsdale / Old Town & Civic Center', 'Western/Cultural', 'mixed', 'https://www.experiencescottsdale.com'],
    ['February', "Parada del Sol / Trail's End Festival", 'Scottsdale / Old Town', 'Western Parade/Festival', 'mixed', 'https://www.experiencescottsdale.com'],
    ['February — TBD', 'Phoenix Chinese Week', 'Phoenix', 'Culture', 'mixed', 'https://www.phoenixchineseweek.org'],
    ['February — TBD', 'Arizona Matsuri', 'Phoenix', 'Culture', 'free', 'https://azmatsuri.org'],
    ['February — TBD', 'Devour Culinary Classic', 'Phoenix', 'Food', 'paid', 'https://localfirstaz.com'],
    ['February — TBD', 'Arizona Renaissance Festival', 'Gold Canyon', 'Festival', 'paid', 'https://arizona.renfestinfo.com'],
    ['February — TBD', '24 Hours in the Old Pueblo', 'Tucson area', 'Mountain Bike', 'paid', 'https://www.epicrides.com'],
    ['February — TBD', 'Cactus League Spring Training', 'Phoenix metro', 'Baseball', 'paid', 'https://cactusleague.com'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('March 2027', [
    ['Mar. 1', 'Phoenix Suns vs. Washington Wizards — 6:30 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 3', 'Phoenix Suns vs. Brooklyn Nets — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 5', 'Phoenix Suns vs. Minnesota Timberwolves — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 5–7', 'Sonoran Fine Art & Wine Festival', 'Cave Creek', 'Arts/Food', 'paid', 'https://thunderbirdartists.com'],
    ['Mar. 5–7', 'Midnight at the Oasis', 'Yuma / Desert Sun Stadium', 'Cars/Music', 'paid', 'https://www.visityuma.com'],
    ['Mar. 6–7', 'La Traviata', 'Phoenix / Symphony Hall', 'Opera', 'paid', 'https://azopera.org'],
    ['Mar. 6', 'Gilbert Global Village Festival', 'Gilbert', 'Culture', 'free', 'https://www.gilbertaz.gov'],
    ['Mar. 6', 'Spring Art & Wine Festival', 'Litchfield Park', 'Arts/Food', 'free', 'https://www.litchfieldpark.gov'],
    ['Mar. 6', 'Finer Arts Mimosas & Muffins', 'Cave Creek', 'Arts/Food', 'paid', 'https://www.cavecreekaz.gov'],
    ['Mar. 7–28', 'Murder For Two', 'Tucson / Invisible Theatre', 'Theater', 'paid', 'https://www.invisibletheatre.com'],
    ['Mar. 10–21', 'The Lion King', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['Mar. 11–13', 'ASU Softball vs. BYU', 'Tempe', 'College Softball', 'tbd', 'https://thesundevils.com'],
    ['Mar. 12–14', 'Katharina Conducts Prokofiev / Joyce Yang', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Mar. 12–14', 'M3F Music Festival', 'Phoenix / Margaret T. Hance Park', 'Music', 'paid', 'https://m3ffest.com'],
    ['Mar. 12–14', 'Tempe Festival of the Arts', 'Tempe', 'Arts', 'free', 'https://www.tempefestivalofthearts.com'],
    ['Mar. 13–14', 'Art at the Lake', 'Lake Havasu City', 'Arts', 'free', 'https://www.golakehavasu.com'],
    ['Mar. 13', "St. Patrick's Parade", 'Sedona', 'Parade', 'free', 'https://www.visitsedona.com'],
    ['Mar. 13', 'Irish Fest', 'Fountain Hills', 'Culture/Music', 'free', 'https://www.fountainhillsaz.gov'],
    ['Mar. 18', 'Mendelssohn, Mozart & Haydn', 'Phoenix / Musical Instrument Museum', 'Classical', 'paid', 'https://mim.org'],
    ['Mar. 19', 'Phoenix Suns vs. Miami Heat — 7:30 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 19', 'Redhouse Family Jazz Band', 'Tubac', 'Music', 'paid', 'https://www.tubacaz.com'],
    ['Mar. 19', 'Finer Arts Art Affaire', 'Cave Creek', 'Arts', 'paid', 'https://www.cavecreekaz.gov'],
    ['Mar. 19–21', 'Top Gun: Maverick in Concert', 'Phoenix / Symphony Hall', 'Music/Film', 'paid', 'https://www.phoenixsymphony.org'],
    ['Mar. 19–21', 'Art at Frontier Town', 'Cave Creek', 'Arts', 'free', 'https://www.cavecreekaz.gov'],
    ['Mar. 20', 'Arizona Archaeological Society – Rim Country', 'Payson', 'Archaeology', 'paid', 'https://azarchsoc.org'],
    ['Mar. 20', 'Cave Creek Rodeo Days Parade', 'Cave Creek', 'Parade', 'free', 'https://www.cavecreekaz.gov'],
    ['Mar. 20', 'Cornhole Tournament', 'Cave Creek', 'Sports', 'paid', 'https://www.cavecreekaz.gov'],
    ['Mar. 20', 'Eggstravaganza', 'Fountain Hills', 'Family', 'free', 'https://www.fountainhillsaz.gov'],
    ['Mar. 20', 'Touch-a-Truck', 'Fountain Hills', 'Family', 'free', 'https://www.fountainhillsaz.gov'],
    ['Mar. 21', 'Phoenix Suns vs. Portland Trail Blazers — 2:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 21', "Mutton Bustin' Qualifying Round", 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Mar. 23', 'Phoenix Suns vs. Oklahoma City Thunder — 8:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 23', 'Arizona Opera Studio Series', 'Phoenix / Arizona Opera Center', 'Opera', 'paid', 'https://azopera.org'],
    ['Mar. 24', 'Phoenix Suns vs. Oklahoma City Thunder — 7:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 24', 'All Bulls, All Night!', 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Mar. 25–27', "ASU Women's Golf — PING Invitational", 'Arizona', 'College Golf', 'paid', 'https://thesundevils.com'],
    ['Mar. 25–27', 'ASU Baseball vs. UCF', 'Tempe', 'College Baseball', 'tbd', 'https://thesundevils.com'],
    ['Mar. 25', 'Cave Creek Rodeo — First PRCA Performance', 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Mar. 26', 'Phoenix Suns vs. Milwaukee Bucks — 7:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 26', 'Cave Creek Rodeo — Second PRCA Performance', 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Mar. 26–28', 'ASU Softball vs. Arizona', 'Tempe', 'College Softball', 'tbd', 'https://thesundevils.com'],
    ['Mar. 27', "Cave Creek Rodeo — Final Performance & Mutton Bustin' Finals", 'Cave Creek', 'Rodeo', 'paid', 'https://www.prorodeo.com'],
    ['Mar. 27', 'Celebration of Spring', 'Sedona', 'Festival', 'mixed', 'https://www.visitsedona.com'],
    ['Mar. 28', 'Phoenix Suns vs. Toronto Raptors — 6:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Mar. 28', 'Arizona Dragon Boat Festival', 'Tempe Town Lake', 'Sports/Culture', 'free', 'https://www.visittempe.com'],
    ['March', 'MLB Cactus League Spring Training', 'Scottsdale / Scottsdale Stadium', 'Baseball', 'paid', 'https://cactusleague.com'],
    ['March', 'Celebration of Fine Art', 'Scottsdale / Big White Tents', 'Fine Art', 'paid', 'https://celebrateart.com'],
    ['March', 'Scottsdale Art Week / related art events', 'Scottsdale', 'Art', 'paid', 'https://www.scottsdaleartweek.com'],
    ['March — TBD', 'Tucson Festival of Books', 'Tucson / University of Arizona', 'Books', 'free', 'https://tucsonfestivalofbooks.org'],
    ['March — TBD', 'Cologuard Classic', 'Tucson', 'Golf', 'paid', 'https://cologuardclassic.com'],
    ['March — TBD', 'Arizona Renaissance Festival', 'Gold Canyon', 'Festival', 'paid', 'https://arizona.renfestinfo.com'],
    ['March — TBD', 'AIA basketball/winter-sports championships', 'Arizona', 'High School Sports', 'paid', 'https://aiaonline.org'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('April 2027', [
    ['Apr. 2', 'Phoenix Suns vs. Denver Nuggets — 7:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Apr. 2–4', 'Art in Gold Canyon', 'Gold Canyon', 'Arts', 'free', 'https://www.visitarizona.com'],
    ['Apr. 2–4', 'Arizona Diamondbacks vs. Miami Marlins', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Apr. 2–4', 'ASU Baseball vs. Kansas State', 'Tempe', 'College Baseball', 'tbd', 'https://thesundevils.com'],
    ['Apr. 3–4', 'Arizona Renaissance Festival', 'Gold Canyon', 'Festival', 'paid', 'https://arizona.renfestinfo.com'],
    ['Apr. 3', 'Fleetwood Mac: A Symphonic Tribute', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['Apr. 3', "I'm Not a Comedian… I'm Lenny Bruce", 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Apr. 3', 'Music Fest', 'Fountain Hills', 'Music', 'free', 'https://www.fountainhillsaz.gov'],
    ['Apr. 5–7', 'Arizona Diamondbacks vs. Los Angeles Dodgers', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Apr. 8', 'Viviana Performs Mozart', 'Phoenix / Musical Instrument Museum', 'Classical', 'paid', 'https://mim.org'],
    ['Apr. 8', 'Desert Foothills Land Trust Boot & Bourbon Fundraiser', 'Cave Creek', 'Fundraiser', 'paid', 'https://dflt.org'],
    ['Apr. 8–11', 'Country Thunder Arizona', 'Florence', 'Country Music', 'paid', 'https://www.countrythunder.com'],
    ['Apr. 9', 'Phoenix Suns vs. Memphis Grizzlies — 7:00 PM', 'Phoenix', 'NBA', 'paid', 'https://www.nba.com/suns'],
    ['Apr. 9–11', 'The Taylor Swift Symphonic Experience', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['Apr. 9–11', 'ASU Softball vs. Houston', 'Tempe', 'College Softball', 'tbd', 'https://thesundevils.com'],
    ['Apr. 9–25', 'Waiting for Godot', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Apr. 9–11', 'Ballet Tucson', 'Tucson / Leo Rich Theatre', 'Dance', 'paid', 'https://www.ballettucson.org'],
    ['Apr. 10–11', 'Arizona Opera New Works Festival', 'Phoenix / Arizona Opera Center', 'Opera', 'paid', 'https://azopera.org'],
    ['Apr. 10–25', 'Gem of the Ocean', 'Phoenix / Phoenix Theatre', 'Theater', 'paid', 'https://phoenixtheatre.com'],
    ['Apr. 10–25', 'Gem of the Ocean', 'Tucson / Arizona Theatre Company', 'Theater', 'paid', 'https://atc.org'],
    ['Apr. 15', 'Concerts on the Avenue', 'Fountain Hills', 'Music', 'free', 'https://www.fountainhillsaz.gov'],
    ['Apr. 16–18', 'Arizona Diamondbacks vs. San Diego Padres', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Apr. 16–18', 'Bella, Britten & Sibelius', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['Apr. 16–18', 'ASU Baseball vs. Arizona', 'Tempe', 'College Baseball', 'tbd', 'https://thesundevils.com'],
    ['Apr. 16–18', "ASU Men's Golf — Thunderbird Invitational", 'Arizona', 'College Golf', 'paid', 'https://thesundevils.com'],
    ['Apr. 19–21', 'Arizona Diamondbacks vs. Chicago Cubs', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Apr. 22–25', 'Region 7 Championship', 'Scottsdale', 'Arabian Horse', 'paid', 'https://westworldaz.com'],
    ['Apr. 23–30', 'Arizona Diamondbacks vs. Cleveland Guardians', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Apr. 23–25', 'Raiders of the Lost Ark in Concert', 'Phoenix / Symphony Hall', 'Music/Film', 'paid', 'https://www.phoenixsymphony.org'],
    ['Apr. 23–25', 'South Pacific', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['Apr. 23–25', 'Art at Frontier Town', 'Cave Creek', 'Arts', 'free', 'https://www.cavecreekaz.gov'],
    ['Apr. 23–25', 'ASU Softball vs. Iowa State', 'Tempe', 'College Softball', 'tbd', 'https://thesundevils.com'],
    ['Apr. 23–25', 'Red Rock Rally Pickleball Tournament', 'Sedona', 'Sports', 'paid', 'https://www.visitsedona.com'],
    ['Apr. 27–May 2', 'The Notebook', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['Apr. 30–May 2', 'Litton Leads Shostakovich & Brahms with Michelle Cann', 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['April', 'Arizona Bike Week', 'Scottsdale / WestWorld', 'Motorcycle/Festival', 'paid', 'https://azbikeweek.com'],
    ['April — TBD', 'Tucson Folk Festival', 'Tucson', 'Music', 'free', 'https://tucsonfolkfest.org'],
    ['April — TBD', 'Fourth Avenue Spring Street Fair', 'Tucson', 'Arts/Shopping', 'free', 'https://fourthavenue.org'],
    ['April — TBD', 'Agave Heritage Festival', 'Tucson', 'Food/Culture', 'paid', 'https://agaveheritagefestival.com'],
    ['April — TBD', 'Palo Verde Bloom Festival', 'Tucson', 'Nature/Culture', 'mixed', 'https://www.visittucson.org'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('May 2027', [
    ['May 1–2', 'Arizona Diamondbacks vs. Cleveland Guardians', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 2', 'Cabaret Sessions: Duo Entre-Nous', 'Scottsdale / Taliesin West', 'Music', 'paid', 'https://franklloydwright.org'],
    ['May 3–5', 'Arizona Diamondbacks vs. Baltimore Orioles', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 4', 'Gravity & Other Myths', 'Tucson / Centennial Hall', 'Dance/Circus', 'paid', 'https://centhall.org'],
    ['May 7–9', 'Arizona Diamondbacks vs. Texas Rangers', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 7–9', 'Mandy Gonzalez Sings Lin-Manuel Miranda', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['May 8', 'Music of the Stars: Cosmic Connections', 'Phoenix / Madison Center for the Arts', 'Music', 'paid', 'https://www.themadison.org'],
    ['May 14–16', "Mahler's 5th Symphony", 'Phoenix / Symphony Hall', 'Classical', 'paid', 'https://www.phoenixsymphony.org'],
    ['May 17–19', 'Arizona Diamondbacks vs. Seattle Mariners', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 20–23', 'PBR World Finals: Championship', 'Glendale / Desert Diamond Arena', 'Bull Riding', 'paid', 'https://www.pbr.com'],
    ['May 20', 'Arizona Diamondbacks vs. Colorado Rockies', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 20', 'Mozart, Glass & Bartok', 'Phoenix / Musical Instrument Museum', 'Classical', 'paid', 'https://mim.org'],
    ['May 21–23', 'Arizona Diamondbacks vs. Colorado Rockies', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May 21–23', 'Symphonic Genesis & Phil Collins', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['May 21–23', 'SIX', 'Tucson / Centennial Hall', 'Broadway', 'paid', 'https://centhall.org'],
    ['May 22', 'Marshall Charloff & The Purple xPeRIeNCE', 'Phoenix / Herberger Theater Center', 'Music', 'paid', 'https://www.herbergertheater.org'],
    ['May 28–29', 'Game On!', 'Phoenix / Symphony Hall', 'Music', 'paid', 'https://www.phoenixsymphony.org'],
    ['May 31', 'Arizona Diamondbacks vs. Cincinnati Reds', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['May', 'Arizona Restaurant Week', 'Scottsdale restaurants', 'Food', 'paid', 'https://www.arizonarestaurantweek.com'],
    ['May — TBD', 'Pueblos del Maiz', 'Tucson', 'Food/Culture', 'mixed', 'https://www.visittucson.org'],
    ['May — TBD', 'Tucson International Mariachi Conference', 'Tucson', 'Music/Culture', 'paid', 'https://tucsonmariachi.org'],
    ['May — TBD', 'Phippen Western Art Show & Sale', 'Prescott / Courthouse Plaza', 'Western Art', 'mixed', 'https://phippenartmuseum.org'],
    ['May — TBD', 'Memorial Day weekend festivals', 'Statewide', 'Arts/Events', 'mixed', 'https://www.visitarizona.com'],
    ['May — TBD', 'CinePark / outdoor movie events', 'Chandler', 'Film', 'free', 'https://www.chandleraz.gov'],
    ['May — TBD', 'Spring/Summer community events', 'Casa Grande', 'Community', 'mixed', 'https://casagrandeaz.gov'],
    ['Thursdays', 'Scottsdale ArtWalk', 'Old Town Scottsdale', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
  ]),
  month('June 2027', [
    ['June 1–2', 'Arizona Diamondbacks vs. Cincinnati Reds', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['June 4–6', 'Arizona Diamondbacks vs. San Francisco Giants', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['June 14–16', 'Arizona Diamondbacks vs. Atlanta Braves', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['June 18–20', 'Arizona Diamondbacks vs. Boston Red Sox', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['June 18–July 3', 'The Underpants', 'Phoenix / Herberger Theater Center', 'Theater', 'paid', 'https://www.herbergertheater.org'],
    ['June 28–30', 'Arizona Diamondbacks vs. New York Mets', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['June 28–July 4', "World's Oldest Rodeo / Prescott Frontier Days", 'Prescott', 'Rodeo/Western', 'mixed', 'https://www.worldsoldestrodeo.com'],
    ['June', 'June Days in Old Town', 'Scottsdale / Old Town', 'Community/Shopping', 'mixed', 'https://www.experiencescottsdale.com'],
    ['June', 'Old Town Scottsdale Farmers Market', 'Scottsdale / Old Town', 'Farmers Market', 'free', 'https://www.experiencescottsdale.com'],
    ['June', 'Scottsdale ArtWalk', 'Scottsdale / Old Town', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
    ['June — TBD', 'Flagstaff Folk Festival', 'Flagstaff / Wheeler Park', 'Music', 'free', 'https://www.flagstaffarizona.org'],
    ['June — TBD', 'Pride in the Pines', 'Flagstaff / Thorpe Park', 'Pride/Community', 'free', 'https://www.flagstaffarizona.org'],
    ['June — TBD', 'Flagstaff Beer Festival', 'Flagstaff', 'Food/Drink', 'paid', 'https://www.flagstaffarizona.org'],
    ['June — TBD', 'Flagstaff Piano Festival', 'Flagstaff', 'Music', 'paid', 'https://www.flagstaffarizona.org'],
    ['June — TBD', 'Heritage Festival', 'Flagstaff / Museum of Northern Arizona', 'Culture', 'paid', 'https://musnaz.org'],
    ['June — TBD', 'Prescott Bluegrass Festival', 'Prescott / Courthouse Plaza', 'Music', 'free', 'https://www.prescott.org'],
    ['June — TBD', 'Phippen Western Art Show', 'Prescott / Courthouse Plaza', 'Arts', 'mixed', 'https://phippenartmuseum.org'],
    ['June — TBD', 'El Día de San Juan', 'Tucson / Mission Garden', 'Culture', 'free', 'https://missiongarden.org'],
    ['June — TBD', 'Juneteenth events', 'Statewide', 'Culture', 'mixed', 'https://www.visitarizona.com'],
    ['June — TBD', 'Summer concerts', 'Flagstaff', 'Music', 'free', 'https://www.flagstaffarizona.org'],
    ['June — TBD', 'Summer art festivals', 'Prescott/Flagstaff', 'Arts', 'mixed', 'https://www.visitarizona.com'],
    ['June — TBD', 'Summer community activities', 'Fountain Hills', 'Community', 'free', 'https://www.fountainhillsaz.gov'],
    ['June — TBD', 'Phoenix Fan Fusion', 'Phoenix Convention Center', 'Pop Culture', 'paid', 'https://www.phoenixfanfusion.com'],
    ['June — TBD', 'Family Fun Fridays', 'Sedona', 'Family', 'free', 'https://www.visitsedona.com'],
  ]),
  month('July 2027', [
    ['July 1–4', 'Arizona Diamondbacks vs. San Francisco Giants', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['July 1–4', "World's Oldest Rodeo", 'Prescott', 'Rodeo', 'paid', 'https://www.worldsoldestrodeo.com'],
    ['July 1–10', 'Scottsdale ArtWalk / Old Town activities', 'Scottsdale / Old Town', 'Art/Culture', 'free', 'https://scottsdalegalleries.com'],
    ['July 3–5', 'Art in the Park (tentative)', 'Flagstaff / Wheeler Park', 'Arts', 'free', 'https://www.flagstaffarizona.org'],
    ['July 3', 'Prescott Rodeo Dance / Frontier Days events', 'Prescott', 'Western', 'mixed', 'https://www.worldsoldestrodeo.com'],
    ['July 4', 'Scottsdale 4th of July Celebration', 'Scottsdale / WestWorld', 'Independence Day', 'mixed', 'https://westworldaz.com'],
    ['July 4', 'Prescott Frontier Days Rodeo Parade', 'Prescott', 'Parade', 'free', 'https://www.prescott.org'],
    ['July 4', 'Prescott Fourth of July / Freedom Festival', 'Prescott', 'Holiday', 'mixed', 'https://www.prescott.org'],
    ['July 4', 'Flagstaff Fourth of July', 'Flagstaff', 'Holiday', 'free', 'https://www.flagstaffarizona.org'],
    ['July 4', 'Independence Day events', 'Phoenix metro', 'Holiday', 'mixed', 'https://www.visitphoenix.com'],
    ['July 9–11', 'Medieval Mayhem Renaissance Faire', 'Show Low', 'Renaissance/Festival', 'paid', 'https://www.showlowaz.gov'],
    ['July 10', 'Special Engagement Concert', 'Show Low', 'Music', 'paid', 'https://www.showlowaz.gov'],
    ['July 15–18', 'White Mountain Square & Round Dance Festival', 'Show Low', 'Dance/Culture', 'paid', 'https://www.showlowaz.gov'],
    ['July 16–18', 'Arizona Diamondbacks vs. Colorado Rockies', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['July 19–21', 'Arizona Diamondbacks vs. St. Louis Cardinals', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['July — TBD', 'Celtic Festival', 'Flagstaff', 'Culture/Music', 'paid', 'https://www.flagstaffarizona.org'],
    ['July — TBD', 'Summer concert series', 'Flagstaff', 'Music', 'free', 'https://www.flagstaffarizona.org'],
    ['July — TBD', 'Movies in the Park', 'Flagstaff / Heritage Square', 'Film', 'free', 'https://www.flagstaffarizona.org'],
  ]),
  month('August 2027', [
    ['Aug. 2–4', 'Arizona Diamondbacks vs. Tampa Bay Rays', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Aug. 6–8', 'Arizona Diamondbacks vs. Houston Astros', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Aug. 12–15', 'Arizona Diamondbacks vs. Milwaukee Brewers', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Aug. 23–25', 'Arizona Diamondbacks vs. Washington Nationals', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
    ['Aug. 27–29', 'Arizona Diamondbacks vs. Philadelphia Phillies', 'Phoenix / Chase Field', 'Baseball', 'tbd', 'https://www.mlb.com/dbacks'],
  ]),
];

export const AZ_ADMISSION_LABELS: Record<AzAdmission, string> = {
  free: 'Free',
  paid: 'Paid',
  mixed: 'Mixed',
  tbd: 'TBD',
};

export const AZ_ADMISSION_COLORS: Record<AzAdmission, string> = {
  free: '#22c55e',
  paid: '#eab308',
  mixed: '#3b82f6',
  tbd: '#9ca3af',
};

// ---- Day/week/month filtering ----
// Dates in this calendar are freeform strings: 'Sept. 19', 'Sept. 19–Jan. 31',
// 'Apr. 10–11', 'July — TBD', 'Saturdays', or bare month names. Resolve each to
// a concrete [start, end] range using the section's year (cross-year ranges
// like Sept→Jan bump the end year).

const AZ_MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function monthIndexOf(token: string): number | undefined {
  return AZ_MONTH_INDEX[token.replace(/\./g, '').toLowerCase()];
}

function parseMonthDay(text: string): { month: number; day: number } | null {
  const match = text.trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2})$/);
  if (!match) return null;
  const month = monthIndexOf(match[1]!);
  return month === undefined ? null : { month, day: Number(match[2]) };
}

export function azEventRange(date: string, monthTitle: string): { start: Date; end: Date } | null {
  const yearMatch = monthTitle.match(/\d{4}/);
  const sectionYear = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  const sectionMonth = monthIndexOf(monthTitle.trim().split(' ')[0] ?? '') ?? -1;

  const cleaned = date
    .replace(/[–—]/g, '-')
    .replace(/-?\s*(tbd|weekend|ongoing|tentative)\s*$/i, '')
    .trim();
  const halves = cleaned.split(/\s*-\s*/).filter(Boolean);

  const first = parseMonthDay(halves[0] ?? '');
  if (first) {
    const start = new Date(sectionYear, first.month, first.day);
    let end = start;
    const secondRaw = (halves[1] ?? '').trim();
    if (secondRaw) {
      const second = parseMonthDay(secondRaw);
      if (second) {
        end = new Date(second.month < first.month ? sectionYear + 1 : sectionYear, second.month, second.day);
      } else if (/^\d{1,2}$/.test(secondRaw)) {
        end = new Date(sectionYear, first.month, Number(secondRaw));
      }
    }
    return { start, end };
  }

  // Bare month names ('December', 'March — TBD') and recurring hints
  // ('Thursdays') span the whole named month, or the section month when no
  // month is named.
  const named = monthIndexOf(cleaned.replace(/[^a-zA-Z]/g, ''));
  const month = named ?? sectionMonth;
  if (month < 0) return null;
  const year = sectionMonth >= 0 && month < sectionMonth ? sectionYear + 1 : sectionYear;
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
}

export type AzViewMode = 'all' | 'day' | 'week' | 'month';

// An event matches when its date range overlaps the filter window, so
// multi-week events ('Sept. 19–Jan. 31') stay visible in day/week views.
export function azEventMatchesMode(event: AzEvent, monthTitle: string, mode: AzViewMode, now = new Date()): boolean {
  if (mode === 'all') return true;
  const range = azEventRange(event.date, monthTitle);
  if (!range) return false;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd =
    mode === 'day'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      : mode === 'week'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()))
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return range.start.getTime() < windowEnd.getTime() && range.end.getTime() >= startOfDay.getTime();
}
