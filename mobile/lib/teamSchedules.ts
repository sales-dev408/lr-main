// Hardcoded Arizona team schedules (times are Arizona time).
// Events disappear once their day (or final day, for multi-day events) passes.

export type TeamId = 'asu' | 'suns' | 'rising' | 'cardinals' | 'dbacks' | 'ua' | 'gcu';

export type RangeFilter = 'day' | 'week' | 'month' | 'all';

export type TeamScheduleEvent = {
  date: string; // 'YYYY-MM-DD' first day
  endDate?: string; // 'YYYY-MM-DD' last day for multi-day events
  time?: string; // Arizona time, e.g. '7:00 PM'; undefined = time TBA
  sport?: string; // e.g. 'Football' — omitted for pro teams where it's implied
  title: string; // 'vs. Baylor', 'at Dallas Cowboys', 'PING Invitational', ...
  venue?: string;
  note?: string; // 'Preseason', 'Regular-season finale', ...
};

export type TeamSchedule = {
  id: TeamId;
  label: string; // sub-tab label
  name: string;
  events: TeamScheduleEvent[];
  note?: string; // team-level note shown above the list
};

const ASU_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-09-18', time: '7:00 PM', sport: 'Soccer', title: 'vs. Utah', venue: 'Sun Devil Soccer Stadium, Tempe' },
  { date: '2026-10-02', time: '6:00 PM', sport: 'Swimming & Diving', title: 'vs. UNLV', venue: 'Tempe' },
  { date: '2026-10-03', sport: 'Football', title: 'vs. Baylor', venue: 'Tempe' },
  { date: '2026-10-04', sport: 'Volleyball', title: 'vs. Iowa State', venue: 'Tempe' },
  { date: '2026-10-08', time: '7:00 PM', sport: 'Soccer', title: 'vs. Iowa State', venue: 'Tempe' },
  { date: '2026-10-09', time: '7:00 PM', sport: 'Hockey', title: 'vs. Holy Cross', venue: 'Mullett Arena, Tempe' },
  { date: '2026-10-09', time: '7:00 PM', sport: 'Volleyball', title: 'vs. Colorado', venue: 'Tempe' },
  { date: '2026-10-10', sport: 'Football', title: "vs. Hawai'i", venue: 'Tempe' },
  { date: '2026-10-10', sport: 'Hockey', title: 'vs. Holy Cross', venue: 'Mullett Arena, Tempe' },
  { date: '2026-10-11', time: '12:00 PM', sport: 'Soccer', title: 'vs. Houston', venue: 'Tempe' },
  { date: '2026-10-11', sport: 'Volleyball', title: 'vs. TCU', venue: 'Tempe' },
  { date: '2026-10-15', time: '7:00 PM', sport: 'Volleyball', title: 'vs. Arizona', venue: 'Tempe' },
  { date: '2026-10-22', time: '2:00 PM', sport: 'Swimming & Diving', title: 'vs. SMU', venue: 'Tempe' },
  { date: '2026-10-22', time: '7:00 PM', sport: 'Soccer', title: 'vs. Baylor', venue: 'Tempe' },
  { date: '2026-10-24', sport: 'Football', title: 'vs. Kansas State', venue: 'Tempe' },
  { date: '2026-10-25', time: '1:00 PM', sport: 'Soccer', title: 'vs. Colorado', venue: 'Tempe' },
  { date: '2026-10-30', time: '7:00 PM', sport: 'Soccer', title: 'vs. Arizona', venue: 'Tempe' },
  { date: '2026-10-30', time: '7:00 PM', sport: 'Volleyball', title: 'vs. UCF', venue: 'Tempe' },
  { date: '2026-11-01', time: '1:00 PM', sport: 'Volleyball', title: 'vs. Houston' },
  { date: '2026-11-02', time: '5:00 PM', sport: "Women's Basketball", title: 'vs. Jackson State' },
  { date: '2026-11-02', time: '8:00 PM', sport: "Men's Basketball", title: 'vs. East Tennessee State' },
  { date: '2026-11-05', time: '6:30 PM', sport: "Women's Basketball", title: 'vs. Northern Arizona' },
  { date: '2026-11-06', time: '7:00 PM', sport: 'Hockey', title: 'vs. Denver', venue: 'Mullett Arena, Tempe' },
  { date: '2026-11-06', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Northern Colorado' },
  { date: '2026-11-07', sport: 'Football', title: 'vs. Colorado' },
  { date: '2026-11-08', time: '1:00 PM', sport: 'Volleyball', title: 'vs. Utah' },
  { date: '2026-11-08', time: '12:00 PM', sport: 'Hockey', title: 'vs. Denver', venue: 'Mullett Arena, Tempe' },
  { date: '2026-11-10', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Hofstra' },
  { date: '2026-11-13', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. ULM' },
  { date: '2026-11-15', time: '2:00 PM', sport: "Women's Basketball", title: 'vs. Penn State' },
  { date: '2026-11-17', time: '6:30 PM', sport: "Women's Basketball", title: 'vs. San Diego' },
  { date: '2026-11-18', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Oakland' },
  { date: '2026-11-20', time: '6:30 PM', sport: "Women's Basketball", title: 'vs. Santa Clara', venue: 'Mullett Arena, Tempe' },
  { date: '2026-11-21', sport: 'Football', title: 'vs. Oklahoma State' },
  { date: '2026-11-24', time: '6:30 PM', sport: "Women's Basketball", title: 'vs. San Jose State' },
  { date: '2026-11-25', time: '7:00 PM', sport: 'Volleyball', title: 'vs. Kansas State' },
  { date: '2026-11-27', time: '7:00 PM', sport: 'Volleyball', title: 'vs. Kansas' },
  { date: '2026-11-27', time: '7:00 PM', sport: 'Hockey', title: 'vs. Alaska Anchorage', venue: 'Mullett Arena, Tempe' },
  { date: '2026-11-28', time: '5:00 PM', sport: 'Hockey', title: 'vs. Alaska Anchorage', venue: 'Mullett Arena, Tempe' },
  { date: '2026-11-28', time: '2:30 PM', sport: "Women's Basketball", title: 'vs. CSU Bakersfield' },
  { date: '2026-11-29', time: '12:30 PM', sport: "Women's Basketball", title: 'vs. Wake Forest' },
  { date: '2026-11-30', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Montana' },
  { date: '2026-12-04', time: '7:00 PM', sport: 'Hockey', title: 'vs. Colorado College', venue: 'Mullett Arena, Tempe' },
  { date: '2026-12-05', time: '5:00 PM', sport: 'Hockey', title: 'vs. Colorado College', venue: 'Mullett Arena, Tempe' },
  { date: '2026-12-06', time: '2:00 PM', sport: "Women's Basketball", title: 'vs. Gonzaga', venue: 'Mullett Arena, Tempe' },
  { date: '2026-12-08', time: '5:00 PM', sport: "Women's Basketball", title: 'vs. UTRGV' },
  { date: '2026-12-08', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Mercer' },
  { date: '2026-12-11', time: '7:00 PM', sport: 'Hockey', title: 'vs. Western Michigan', venue: 'Mullett Arena, Tempe' },
  { date: '2026-12-12', time: '5:00 PM', sport: 'Hockey', title: 'vs. Western Michigan', venue: 'Mullett Arena, Tempe' },
  { date: '2026-12-20', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. San Diego' },
  { date: '2026-12-23', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Idaho' },
  { date: '2026-12-29', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Southern Illinois' },
  { date: '2027-01-09', time: '12:00 PM', sport: 'Swimming & Diving', title: 'vs. Grand Canyon' },
  { date: '2027-01-15', time: '7:00 PM', sport: 'Hockey', title: 'vs. Minnesota Duluth', venue: 'Mullett Arena, Tempe' },
  { date: '2027-01-16', time: '5:00 PM', sport: 'Hockey', title: 'vs. Minnesota Duluth', venue: 'Mullett Arena, Tempe' },
  { date: '2027-02-06', time: '12:00 PM', sport: 'Swimming & Diving', title: 'vs. Arizona' },
  { date: '2027-02-12', time: '7:00 PM', sport: 'Hockey', title: 'vs. North Dakota', venue: 'Mullett Arena, Tempe' },
  { date: '2027-02-13', time: '5:00 PM', sport: 'Hockey', title: 'vs. North Dakota', venue: 'Mullett Arena, Tempe' },
  { date: '2027-02-26', time: '7:00 PM', sport: 'Hockey', title: 'vs. Omaha', venue: 'Mullett Arena, Tempe' },
  { date: '2027-02-27', time: '5:00 PM', sport: 'Hockey', title: 'vs. Omaha', venue: 'Mullett Arena, Tempe' },
  { date: '2027-03-11', endDate: '2027-03-13', sport: 'Softball', title: 'vs. BYU' },
  { date: '2027-03-25', endDate: '2027-03-27', sport: "Women's Golf", title: 'PING Invitational' },
  { date: '2027-03-25', endDate: '2027-03-27', sport: 'Baseball', title: 'vs. UCF' },
  { date: '2027-03-26', endDate: '2027-03-28', sport: 'Softball', title: 'vs. Arizona' },
  { date: '2027-04-02', endDate: '2027-04-04', sport: 'Baseball', title: 'vs. Kansas State' },
  { date: '2027-04-09', endDate: '2027-04-11', sport: 'Softball', title: 'vs. Houston' },
  { date: '2027-04-16', endDate: '2027-04-18', sport: 'Baseball', title: 'vs. Arizona' },
  { date: '2027-04-16', endDate: '2027-04-18', sport: "Men's Golf", title: 'Thunderbird Invitational' },
  { date: '2027-04-23', endDate: '2027-04-25', sport: 'Softball', title: 'vs. Iowa State' },
  { date: '2027-05-07', endDate: '2027-05-09', sport: 'Baseball', title: 'vs. Houston' },
  { date: '2027-05-17', endDate: '2027-05-19', sport: "Men's Golf", title: 'NCAA Regional', venue: 'Ak-Chin Southern Dunes' },
  { date: '2027-05-20', endDate: '2027-05-22', sport: 'Baseball', title: 'vs. BYU' },
];

const SUNS_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-10-10', time: '7:30 PM', title: 'vs. San Antonio Spurs', note: 'Preseason' },
  { date: '2026-10-16', time: '7:00 PM', title: 'vs. Utah Jazz', note: 'Preseason' },
  { date: '2026-10-24', time: '7:00 PM', title: 'vs. Golden State Warriors' },
  { date: '2026-10-30', time: '7:00 PM', title: 'vs. Denver Nuggets' },
  { date: '2026-11-04', time: '6:00 PM', title: 'vs. Portland Trail Blazers' },
  { date: '2026-11-05', time: '6:00 PM', title: 'vs. Orlando Magic' },
  { date: '2026-11-07', time: '6:00 PM', title: 'vs. Houston Rockets' },
  { date: '2026-11-09', time: '6:00 PM', title: 'vs. San Antonio Spurs' },
  { date: '2026-11-10', time: '6:00 PM', title: 'vs. LA Clippers' },
  { date: '2026-11-12', time: '6:00 PM', title: 'vs. Charlotte Hornets' },
  { date: '2026-11-15', time: '1:00 PM', title: 'vs. Los Angeles Lakers' },
  { date: '2026-11-27', time: '6:00 PM', title: 'vs. Dallas Mavericks' },
  { date: '2026-12-01', time: '6:00 PM', title: 'vs. LA Clippers' },
  { date: '2026-12-02', time: '6:00 PM', title: 'vs. Sacramento Kings' },
  { date: '2026-12-12', time: '6:00 PM', title: 'vs. Minnesota Timberwolves' },
  { date: '2026-12-14', time: '6:00 PM', title: 'vs. Atlanta Hawks' },
  { date: '2026-12-23', time: '6:00 PM', title: 'vs. Indiana Pacers' },
  { date: '2026-12-28', time: '6:00 PM', title: 'vs. Golden State Warriors' },
  { date: '2026-12-30', time: '6:00 PM', title: 'vs. Philadelphia 76ers' },
  { date: '2026-12-31', time: '6:00 PM', title: 'vs. New York Knicks' },
  { date: '2027-01-02', time: '6:00 PM', title: 'vs. Sacramento Kings' },
  { date: '2027-01-04', time: '6:00 PM', title: 'vs. Boston Celtics' },
  { date: '2027-01-10', time: '4:00 PM', title: 'vs. Chicago Bulls' },
  { date: '2027-01-20', time: '6:00 PM', title: 'vs. Memphis Grizzlies' },
  { date: '2027-01-22', time: '6:00 PM', title: 'vs. Utah Jazz' },
  { date: '2027-01-24', time: '1:00 PM', title: 'vs. Utah Jazz' },
  { date: '2027-02-03', time: '6:00 PM', title: 'vs. Cleveland Cavaliers' },
  { date: '2027-02-05', time: '6:00 PM', title: 'vs. Houston Rockets' },
  { date: '2027-02-08', time: '6:30 PM', title: 'vs. Los Angeles Lakers' },
  { date: '2027-02-10', time: '6:00 PM', title: 'vs. Detroit Pistons' },
  { date: '2027-02-27', time: '6:00 PM', title: 'vs. New Orleans Pelicans' },
  { date: '2027-03-01', time: '6:30 PM', title: 'vs. Washington Wizards' },
  { date: '2027-03-03', time: '6:00 PM', title: 'vs. Brooklyn Nets' },
  { date: '2027-03-05', time: '6:00 PM', title: 'vs. Minnesota Timberwolves' },
  { date: '2027-03-19', time: '7:30 PM', title: 'vs. Miami Heat' },
  { date: '2027-03-21', time: '2:00 PM', title: 'vs. Portland Trail Blazers' },
  { date: '2027-03-23', time: '8:00 PM', title: 'vs. Oklahoma City Thunder' },
  { date: '2027-03-24', time: '7:00 PM', title: 'vs. Oklahoma City Thunder' },
  { date: '2027-03-26', time: '7:00 PM', title: 'vs. Milwaukee Bucks' },
  { date: '2027-03-28', time: '6:00 PM', title: 'vs. Toronto Raptors' },
  { date: '2027-04-02', time: '7:00 PM', title: 'vs. Denver Nuggets' },
  { date: '2027-04-09', time: '7:00 PM', title: 'vs. Memphis Grizzlies' },
];

const RISING_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-09-19', time: '7:00 PM', title: 'vs. El Paso Locomotive FC' },
  { date: '2026-10-10', time: '7:00 PM', title: 'vs. Las Vegas Lights FC' },
  { date: '2026-10-24', time: '7:00 PM', title: 'vs. Lexington SC', note: 'Regular-season finale' },
];

const CARDINALS_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-09-20', time: '1:25 PM', title: 'vs. Seattle Seahawks', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-09-27', time: '1:05 PM', title: 'at San Francisco 49ers' },
  { date: '2026-10-04', time: '10:00 AM', title: 'at New York Giants' },
  { date: '2026-10-11', time: '1:25 PM', title: 'vs. Detroit Lions', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-10-18', time: '1:05 PM', title: 'at Los Angeles Rams' },
  { date: '2026-10-25', time: '1:05 PM', title: 'vs. Denver Broncos', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-11-01', time: '11:00 AM', title: 'at Dallas Cowboys' },
  { date: '2026-11-08', time: '2:25 PM', title: 'at Seattle Seahawks' },
  { date: '2026-11-15', time: '2:05 PM', title: 'vs. Los Angeles Rams', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-11-22', time: '11:00 AM', title: 'at Kansas City Chiefs' },
  { date: '2026-11-29', time: '2:25 PM', title: 'vs. Washington Commanders', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-12-06', time: '2:05 PM', title: 'vs. Philadelphia Eagles', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-12-20', time: '2:05 PM', title: 'vs. New York Jets', venue: 'State Farm Stadium, Glendale' },
  { date: '2026-12-27', time: '11:00 AM', title: 'at New Orleans Saints' },
  { date: '2027-01-03', time: '2:05 PM', title: 'vs. Las Vegas Raiders', venue: 'State Farm Stadium, Glendale' },
];

const UA_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-09-19', time: '7:30 PM', sport: 'Football', title: 'vs. Northern Illinois', venue: 'Casino Del Sol Stadium, Tucson' },
  { date: '2026-09-26', time: '2:30 PM', sport: "Men's Basketball", title: 'Red-Blue Showcase', venue: 'McKale Center' },
  { date: '2026-10-02', time: '3:00 PM', sport: 'Swimming & Diving', title: 'Red vs. Blue Intrasquad', venue: 'Hillenbrand Aquatic Center' },
  { date: '2026-10-02', time: '6:00 PM', sport: "Women's Volleyball", title: 'vs. Iowa State', venue: 'McKale Center' },
  { date: '2026-10-03', sport: 'Football', title: 'vs. Cincinnati', venue: 'Casino Del Sol Stadium' },
  { date: '2026-10-04', time: '12:00 PM', sport: "Women's Volleyball", title: 'vs. Texas Tech', venue: 'McKale Center' },
  { date: '2026-10-08', time: '7:00 PM', sport: "Women's Soccer", title: 'vs. Houston', venue: 'Mulcahy Stadium' },
  { date: '2026-10-13', sport: "Men's Basketball", title: 'vs. San Francisco', venue: 'McKale Center', note: 'Exhibition' },
  { date: '2026-10-16', sport: "Men's Basketball", title: 'vs. San Diego State', venue: 'McKale Center', note: 'Exhibition' },
  { date: '2026-10-17', time: '6:00 PM', sport: "Women's Volleyball", title: 'vs. BYU', venue: 'McKale Center' },
  { date: '2026-10-22', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Embry-Riddle', venue: 'McKale Center', note: 'Exhibition' },
  { date: '2026-10-22', time: '7:00 PM', sport: "Women's Soccer", title: 'vs. Colorado', venue: 'Mulcahy Stadium' },
  { date: '2026-10-23', sport: "Men's Basketball", title: 'vs. Eastern Washington', venue: 'McKale Center', note: 'Exhibition' },
  { date: '2026-10-23', time: '6:00 PM', sport: 'Baseball', title: 'vs. Central Arizona College', venue: 'Hi Corbett Field', note: 'Exhibition' },
  { date: '2026-10-23', time: '6:00 PM', sport: 'Swimming & Diving', title: 'vs. SMU', venue: 'Hillenbrand Aquatic Center' },
  { date: '2026-10-24', sport: 'Football', title: 'vs. Iowa State', venue: 'Casino Del Sol Stadium' },
  { date: '2026-10-25', time: '12:00 PM', sport: "Women's Soccer", title: 'vs. Baylor', venue: 'Mulcahy Stadium' },
  { date: '2026-10-27', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Cal State Monterey Bay', venue: 'McKale Center', note: 'Exhibition' },
  { date: '2026-10-30', time: '12:00 PM', sport: "Women's Volleyball", title: 'vs. Houston', venue: 'McKale Center' },
  { date: '2026-11-01', time: '12:00 PM', sport: "Women's Volleyball", title: 'vs. UCF', venue: 'McKale Center' },
  { date: '2026-11-05', sport: "Men's Basketball", title: 'vs. Cal Poly', venue: 'McKale Center' },
  { date: '2026-11-06', time: '12:00 PM', sport: "Women's Volleyball", title: 'vs. Utah', venue: 'McKale Center' },
  { date: '2026-11-06', sport: 'Football', title: 'vs. TCU', venue: 'Casino Del Sol Stadium' },
  { date: '2026-11-08', time: '2:00 PM', sport: "Women's Basketball", title: 'vs. Iona', venue: 'McKale Center' },
  { date: '2026-11-10', sport: "Men's Basketball", title: 'vs. Northern Arizona', venue: 'McKale Center' },
  { date: '2026-11-14', sport: 'Football', title: 'vs. Utah', venue: 'Casino Del Sol Stadium' },
  { date: '2026-11-15', time: '11:00 AM', sport: "Women's Volleyball", title: 'vs. Arizona State', venue: 'McKale Center' },
  { date: '2026-11-15', time: '7:00 PM', sport: "Women's Basketball", title: 'vs. Oregon State', venue: 'McKale Center' },
  { date: '2026-11-18', sport: "Men's Basketball", title: 'vs. UConn', venue: 'McKale Center' },
  { date: '2026-11-19', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. New Mexico State', venue: 'McKale Center' },
  { date: '2026-11-25', time: '3:00 PM', sport: "Women's Volleyball", title: 'vs. Kansas', venue: 'McKale Center' },
  { date: '2026-11-25', time: '6:00 PM', sport: "Women's Volleyball", title: 'vs. Kansas State', venue: 'McKale Center' },
  { date: '2026-11-28', sport: 'Football', title: 'vs. Arizona State', venue: 'Casino Del Sol Stadium' },
  { date: '2026-11-29', time: '2:00 PM', sport: "Women's Basketball", title: 'vs. Sacramento State', venue: 'McKale Center' },
  { date: '2026-12-01', sport: "Men's Basketball", title: 'vs. LSU New Orleans', venue: 'McKale Center' },
  { date: '2026-12-09', time: '11:00 AM', sport: "Women's Basketball", title: 'vs. Southeast Missouri State', venue: 'McKale Center' },
  { date: '2026-12-12', sport: "Men's Basketball", title: 'vs. Tennessee Tech', venue: 'McKale Center' },
  { date: '2026-12-13', time: '2:00 PM', sport: "Women's Basketball", title: 'vs. Northern Arizona', venue: 'McKale Center' },
  { date: '2026-12-16', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Oakland', venue: 'McKale Center' },
  { date: '2026-12-21', sport: "Men's Basketball", title: 'vs. Northern Illinois', venue: 'McKale Center' },
  { date: '2026-12-28', sport: "Men's Basketball", title: 'vs. Incarnate Word', venue: 'McKale Center' },
  { date: '2027-02-23', sport: 'Baseball', title: 'vs. UNLV', venue: 'Hi Corbett Field' },
  { date: '2027-03-03', sport: 'Baseball', title: 'vs. Washington', venue: 'Hi Corbett Field' },
  { date: '2027-03-05', sport: 'Baseball', title: 'vs. San Diego', venue: 'Hi Corbett Field' },
  { date: '2027-03-06', sport: 'Baseball', title: 'vs. San Diego', venue: 'Hi Corbett Field' },
  { date: '2027-03-07', sport: 'Baseball', title: 'vs. San Diego', venue: 'Hi Corbett Field' },
  { date: '2027-03-10', sport: 'Baseball', title: 'vs. Seattle U', venue: 'Hi Corbett Field' },
  { date: '2027-03-12', sport: 'Baseball', title: 'vs. Lamar', venue: 'Hi Corbett Field' },
  { date: '2027-03-13', sport: 'Baseball', title: 'vs. Lamar', venue: 'Hi Corbett Field' },
  { date: '2027-03-14', sport: 'Baseball', title: 'vs. Lamar', venue: 'Hi Corbett Field' },
  { date: '2027-03-16', sport: 'Baseball', title: 'vs. Rice', venue: 'Hi Corbett Field' },
  { date: '2027-03-17', sport: 'Baseball', title: 'vs. Rice', venue: 'Hi Corbett Field' },
  { date: '2027-03-25', sport: 'Baseball', title: 'vs. Utah', venue: 'Hi Corbett Field' },
  { date: '2027-03-26', sport: 'Baseball', title: 'vs. Utah', venue: 'Hi Corbett Field' },
  { date: '2027-03-27', sport: 'Baseball', title: 'vs. Utah', venue: 'Hi Corbett Field' },
  { date: '2027-03-30', sport: 'Baseball', title: 'vs. Arizona State', venue: 'Hi Corbett Field' },
  { date: '2027-03-25', endDate: '2027-03-27', sport: "Men's/Women's Track & Field", title: 'Willie Williams Classic' },
  { date: '2027-04-01', endDate: '2027-04-03', sport: "Men's/Women's Track & Field", title: 'Jim Click Shootout & Multi' },
  { date: '2027-04-09', sport: 'Baseball', title: 'vs. TCU', venue: 'Hi Corbett Field' },
  { date: '2027-04-10', sport: 'Baseball', title: 'vs. TCU', venue: 'Hi Corbett Field' },
  { date: '2027-04-11', sport: 'Baseball', title: 'vs. TCU', venue: 'Hi Corbett Field' },
  { date: '2027-04-13', sport: 'Baseball', title: 'vs. New Mexico', venue: 'Hi Corbett Field' },
  { date: '2027-04-23', sport: 'Baseball', title: 'vs. Oklahoma State', venue: 'Hi Corbett Field' },
  { date: '2027-04-24', sport: 'Baseball', title: 'vs. Oklahoma State', venue: 'Hi Corbett Field' },
  { date: '2027-04-25', sport: 'Baseball', title: 'vs. Oklahoma State', venue: 'Hi Corbett Field' },
  { date: '2027-04-27', sport: 'Baseball', title: 'vs. Grand Canyon', venue: 'Hi Corbett Field' },
  { date: '2027-05-01', sport: "Men's/Women's Track & Field", title: 'Desert Heat Classic' },
  { date: '2027-05-07', sport: 'Baseball', title: 'vs. West Virginia', venue: 'Hi Corbett Field' },
  { date: '2027-05-08', sport: 'Baseball', title: 'vs. West Virginia', venue: 'Hi Corbett Field' },
  { date: '2027-05-09', sport: 'Baseball', title: 'vs. West Virginia', venue: 'Hi Corbett Field' },
  { date: '2027-05-11', sport: 'Baseball', title: 'vs. New Mexico State', venue: 'Hi Corbett Field' },
  { date: '2027-05-20', sport: 'Baseball', title: 'vs. Kansas', venue: 'Hi Corbett Field' },
  { date: '2027-05-21', sport: 'Baseball', title: 'vs. Kansas', venue: 'Hi Corbett Field' },
  { date: '2027-05-22', sport: 'Baseball', title: 'vs. Kansas', venue: 'Hi Corbett Field' },
];

const GCU_EVENTS: TeamScheduleEvent[] = [
  { date: '2026-09-26', time: '7:00 PM', sport: "Men's Soccer", title: 'vs. UNLV', venue: 'GCU Stadium' },
  { date: '2026-09-27', time: '1:00 PM', sport: "Women's Soccer", title: 'vs. UNLV', venue: 'GCU Stadium' },
  { date: '2026-10-03', time: '7:00 PM', sport: "Women's Soccer", title: 'vs. New Mexico', venue: 'GCU Stadium' },
  { date: '2026-10-04', time: '7:00 PM', sport: "Men's Soccer", title: 'vs. San José State', venue: 'GCU Stadium' },
  { date: '2026-10-09', time: '3:00 PM', sport: 'Baseball', title: 'vs. Central Arizona College', venue: 'Brazell Field' },
  { date: '2026-10-15', time: '7:00 PM', sport: "Women's Soccer", title: 'vs. Nevada', venue: 'GCU Stadium' },
  { date: '2026-10-17', time: '1:00 PM', sport: 'Baseball', title: 'vs. Chandler-Gilbert CC', venue: 'Brazell Field' },
  { date: '2026-10-18', time: '1:00 PM', sport: "Women's Soccer", title: 'vs. San José State', venue: 'GCU Stadium' },
  { date: '2026-10-18', time: '7:00 PM', sport: "Men's Soccer", title: 'vs. Utah Tech', venue: 'GCU Stadium' },
  { date: '2026-10-24', time: '1:00 PM', sport: 'Baseball', title: 'vs. South Mountain CC', venue: 'Brazell Field' },
  { date: '2026-10-28', time: '7:00 PM', sport: "Women's Soccer", title: 'vs. Wyoming', venue: 'GCU Stadium' },
  { date: '2026-10-30', time: '12:00 PM', sport: "Women's Volleyball", title: 'vs. Houston', venue: 'Global Credit Union Arena' },
  { date: '2026-11-01', time: '7:00 PM', sport: "Men's Soccer", title: 'vs. UC Davis', venue: 'GCU Stadium' },
  { date: '2026-11-02', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Texas Southern', venue: 'Global Credit Union Arena' },
  { date: '2026-11-04', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Jackson State', venue: 'Global Credit Union Arena' },
  { date: '2026-11-06', time: '3:00 PM', sport: 'Baseball', title: 'vs. Cochise College', venue: 'Brazell Field' },
  { date: '2026-11-07', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. Bethune-Cookman', venue: 'Global Credit Union Arena' },
  { date: '2026-11-09', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Oregon', venue: 'Global Credit Union Arena' },
  { date: '2026-11-11', sport: "Women's Soccer", title: 'MW Championship semifinal', venue: 'GCU Stadium', note: 'If qualified' },
  { date: '2026-11-11', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Cal Poly', venue: 'Global Credit Union Arena' },
  { date: '2026-11-13', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Gonzaga', venue: 'Global Credit Union Arena' },
  { date: '2026-11-14', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. Louisiana Monroe', venue: 'Global Credit Union Arena' },
  { date: '2026-11-15', sport: "Women's Soccer", title: 'MW Championship final', venue: 'GCU Stadium', note: 'If qualified' },
  { date: '2026-11-29', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. Incarnate Word', venue: 'Global Credit Union Arena' },
  { date: '2026-12-03', time: '5:00 PM', sport: "Women's Basketball", title: 'vs. Georgia State', venue: 'Global Credit Union Arena' },
  { date: '2026-12-05', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. Santa Clara', venue: 'Global Credit Union Arena' },
  { date: '2026-12-07', time: '6:00 PM', sport: "Women's Basketball", title: 'vs. Southeast Missouri State', venue: 'Global Credit Union Arena' },
  { date: '2026-12-08', time: '7:00 PM', sport: "Men's Basketball", title: 'vs. Northwestern State', venue: 'Global Credit Union Arena' },
  { date: '2026-12-22', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. UMBC', venue: 'Global Credit Union Arena' },
  { date: '2026-12-29', time: '6:00 PM', sport: "Men's Basketball", title: 'vs. Justice', venue: 'Global Credit Union Arena' },
  { date: '2027-01-05', sport: "Men's Basketball", title: 'vs. UNLV' },
  { date: '2027-01-06', sport: "Women's Basketball", title: 'vs. New Mexico' },
  { date: '2027-01-09', sport: "Men's Basketball", title: 'vs. Wyoming' },
  { date: '2027-01-09', sport: "Women's Basketball", title: 'vs. UTEP' },
  { date: '2027-01-13', sport: "Women's Basketball", title: 'vs. Wyoming' },
  { date: '2027-01-16', sport: "Women's Basketball", title: "vs. Hawai'i" },
  { date: '2027-01-20', sport: "Men's Basketball", title: "vs. Hawai'i" },
  { date: '2027-01-23', sport: "Women's Basketball", title: 'vs. UC Davis' },
  { date: '2027-01-26', sport: "Men's Basketball", title: 'vs. Air Force' },
  { date: '2027-01-27', sport: "Women's Basketball", title: 'vs. UC Davis' },
  { date: '2027-01-30', sport: "Women's Basketball", title: 'vs. UTEP' },
  { date: '2027-02-06', sport: "Men's Basketball", title: 'vs. New Mexico' },
  { date: '2027-02-06', sport: "Women's Basketball", title: 'vs. San José State' },
  { date: '2027-02-10', sport: "Women's Basketball", title: 'vs. Nevada' },
  { date: '2027-02-13', sport: "Men's Basketball", title: 'vs. Nevada' },
  { date: '2027-02-17', sport: "Women's Basketball", title: 'vs. UNLV' },
  { date: '2027-02-23', sport: "Men's Basketball", title: 'vs. UTEP' },
  { date: '2027-02-27', sport: "Men's Basketball", title: 'vs. San José State' },
  { date: '2027-02-27', sport: "Women's Basketball", title: 'vs. Air Force' },
  { date: '2027-03-02', sport: "Women's Basketball", title: 'vs. Air Force' },
  { date: '2027-03-06', sport: "Men's Basketball", title: 'vs. UC Davis' },
  { date: '2027-03-02', endDate: '2027-03-03', sport: "Women's Golf", title: 'GCU Invitational' },
];

export const TEAM_SCHEDULES: TeamSchedule[] = [
  { id: 'asu', label: 'ASU', name: 'Arizona State Sun Devils', events: ASU_EVENTS },
  { id: 'suns', label: 'Suns', name: 'Phoenix Suns', events: SUNS_EVENTS },
  {
    id: 'rising',
    label: 'Rising FC',
    name: 'Phoenix Rising FC',
    events: RISING_EVENTS,
    note: 'The 2027 Rising schedule has not been released. Playoff matches after Oct. 24 depend on qualification.',
  },
  {
    id: 'cardinals',
    label: 'Cardinals',
    name: 'Arizona Cardinals',
    events: CARDINALS_EVENTS,
    note: 'Week 18: vs. San Francisco 49ers — date/time TBA.',
  },
  {
    id: 'dbacks',
    label: 'D-backs',
    name: 'Arizona Diamondbacks',
    events: [],
    note: 'Schedule not yet available.',
  },
  { id: 'ua', label: 'U of A', name: 'Arizona Wildcats', events: UA_EVENTS },
  { id: 'gcu', label: 'GCU', name: 'Grand Canyon Antelopes', events: GCU_EVENTS },
];

// Schedules are published in Arizona time (America/Phoenix, UTC-7, no DST).
// Rebase "now" onto Phoenix wall time so day boundaries stay correct no matter
// what timezone the device is set to.
const PHOENIX_OFFSET_MIN = 7 * 60;

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeToMinutes(time?: string): number {
  if (!time) return Number.POSITIVE_INFINITY;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return Number.POSITIVE_INFINITY;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

export function eventEndDate(event: TeamScheduleEvent): string {
  return event.endDate ?? event.date;
}

export function formatEventDate(event: TeamScheduleEvent): string {
  const start = parseYmd(event.date);
  if (!event.endDate || event.endDate === event.date) {
    return `${WEEKDAYS[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}`;
  }
  const end = parseYmd(event.endDate);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

/**
 * Returns upcoming events for the given range. Anything whose last day is before
 * today (Phoenix time) is dropped. Range windows are calendar-based:
 * day = today, week = through Saturday, month = through the last day of the month.
 */
export function upcomingEvents(events: TeamScheduleEvent[], range: RangeFilter, now: Date = new Date()): TeamScheduleEvent[] {
  const today = toYmd(phoenixNow(now));

  let rangeEnd: string | null = null;
  if (range === 'day') {
    rangeEnd = today;
  } else if (range === 'week') {
    rangeEnd = addDays(today, 6 - parseYmd(today).getDay());
  } else if (range === 'month') {
    const t = parseYmd(today);
    rangeEnd = toYmd(new Date(t.getFullYear(), t.getMonth() + 1, 0));
  }

  return events
    .filter((event) => {
      if (eventEndDate(event) < today) return false; // day has passed
      if (rangeEnd && event.date > rangeEnd) return false;
      return true;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        timeToMinutes(a.time) - timeToMinutes(b.time) ||
        a.title.localeCompare(b.title),
    );
}

function phoenixNow(date: Date): Date {
  return new Date(date.getTime() + (date.getTimezoneOffset() - PHOENIX_OFFSET_MIN) * 60000);
}
